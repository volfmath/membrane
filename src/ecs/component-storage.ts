import {
  type ComponentId,
  type ComponentSchema,
  type ArchetypeMask,
  type TypedArrayConstructor,
  StorageType,
  componentBit,
  ComponentRegistry,
} from './component-registry';

type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;

const SPARSE_INVALID = 0xFFFFFFFF;

interface SparseSetData {
  sparse: Uint32Array;
  dense: Uint32Array;
  denseCount: number;
  fields: Map<string, TypedArray>;
}

export class ComponentStorage {
  private readonly registry: ComponentRegistry;
  private readonly _capacity: number;

  private archetypes: BigUint64Array;

  private tableFields: Map<ComponentId, Map<string, TypedArray>> = new Map();
  private sparseSets: Map<ComponentId, SparseSetData> = new Map();

  private changedTicks: Map<ComponentId, Uint32Array> = new Map();
  private addedTicks: Map<ComponentId, Uint32Array> = new Map();

  private _currentTick = 0;

  constructor(registry: ComponentRegistry, capacity: number) {
    this.registry = registry;
    this._capacity = capacity;
    this.archetypes = new BigUint64Array(capacity);

    for (let id = 0; id < registry.count; id++) {
      this.allocateComponent(id);
    }
  }

  private allocateComponent(id: ComponentId): void {
    const schema = this.registry.getSchema(id);
    const storageType = this.registry.getStorageType(id);

    this.changedTicks.set(id, new Uint32Array(this._capacity));
    this.addedTicks.set(id, new Uint32Array(this._capacity));

    if (storageType === StorageType.Table) {
      const fields = new Map<string, TypedArray>();
      for (const [name, def] of Object.entries(schema)) {
        const arr = new (def.type as TypedArrayConstructor)(this._capacity);
        if (def.default !== undefined && def.default !== 0) {
          arr.fill(def.default);
        }
        fields.set(name, arr);
      }
      this.tableFields.set(id, fields);
    } else {
      const fieldNames = Object.keys(schema);
      const fields = new Map<string, TypedArray>();
      const initialDenseCapacity = 64;

      for (const name of fieldNames) {
        const def = schema[name];
        fields.set(name, new (def.type as TypedArrayConstructor)(initialDenseCapacity));
      }

      const sparse = new Uint32Array(this._capacity);
      sparse.fill(SPARSE_INVALID);

      this.sparseSets.set(id, {
        sparse,
        dense: new Uint32Array(initialDenseCapacity),
        denseCount: 0,
        fields,
      });
    }
  }

  ensureComponent(id: ComponentId): void {
    if (!this.changedTicks.has(id)) {
      this.allocateComponent(id);
    }
  }

  get capacity(): number {
    return this._capacity;
  }

  get currentTick(): number {
    return this._currentTick;
  }

  addComponent(entityIndex: number, componentId: ComponentId): void {
    const bit = componentBit(componentId);
    if (this.archetypes[entityIndex] & bit) return;
    this.archetypes[entityIndex] |= bit;

    this.ensureComponent(componentId);
    this.addedTicks.get(componentId)![entityIndex] = this._currentTick;
    this.changedTicks.get(componentId)![entityIndex] = this._currentTick;

    const storageType = this.registry.getStorageType(componentId);
    if (storageType === StorageType.Table) {
      const schema = this.registry.getSchema(componentId);
      const fields = this.tableFields.get(componentId)!;
      for (const [name, def] of Object.entries(schema)) {
        fields.get(name)![entityIndex] = def.default ?? 0;
      }
    } else {
      const ss = this.sparseSets.get(componentId)!;
      const denseIdx = ss.denseCount;

      if (denseIdx >= ss.dense.length) {
        this.growSparseSet(ss, componentId);
      }

      ss.sparse[entityIndex] = denseIdx;
      ss.dense[denseIdx] = entityIndex;
      ss.denseCount++;

      const schema = this.registry.getSchema(componentId);
      for (const [name, def] of Object.entries(schema)) {
        ss.fields.get(name)![denseIdx] = def.default ?? 0;
      }
    }
  }

  private growSparseSet(ss: SparseSetData, componentId: ComponentId): void {
    const newCap = ss.dense.length * 2;
    const newDense = new Uint32Array(newCap);
    newDense.set(ss.dense);
    ss.dense = newDense;

    const schema = this.registry.getSchema(componentId);
    for (const [name, def] of Object.entries(schema)) {
      const oldArr = ss.fields.get(name)!;
      const newArr = new (def.type as TypedArrayConstructor)(newCap);
      (newArr as TypedArray).set(oldArr as TypedArray);
      ss.fields.set(name, newArr);
    }
  }

  removeComponent(entityIndex: number, componentId: ComponentId): void {
    const bit = componentBit(componentId);
    if (!(this.archetypes[entityIndex] & bit)) return;
    this.archetypes[entityIndex] &= ~bit;

    const storageType = this.registry.getStorageType(componentId);
    if (storageType === StorageType.SparseSet) {
      const ss = this.sparseSets.get(componentId)!;
      const denseIdx = ss.sparse[entityIndex];
      if (denseIdx === SPARSE_INVALID) return;

      const lastIdx = ss.denseCount - 1;
      if (denseIdx !== lastIdx) {
        const lastEntity = ss.dense[lastIdx];
        ss.dense[denseIdx] = lastEntity;
        ss.sparse[lastEntity] = denseIdx;

        for (const [, arr] of ss.fields) {
          (arr as TypedArray)[denseIdx] = (arr as TypedArray)[lastIdx];
        }
      }

      ss.sparse[entityIndex] = SPARSE_INVALID;
      ss.denseCount--;
    }
  }

  hasComponent(entityIndex: number, componentId: ComponentId): boolean {
    return (this.archetypes[entityIndex] & componentBit(componentId)) !== 0n;
  }

  getArchetype(entityIndex: number): ArchetypeMask {
    return this.archetypes[entityIndex];
  }

  getField(componentId: ComponentId, fieldName: string): TypedArray {
    const storageType = this.registry.getStorageType(componentId);
    if (storageType === StorageType.Table) {
      return this.tableFields.get(componentId)!.get(fieldName)!;
    }
    return this.sparseSets.get(componentId)!.fields.get(fieldName)!;
  }

  getFields(componentId: ComponentId): Record<string, TypedArray> {
    const storageType = this.registry.getStorageType(componentId);
    const result: Record<string, TypedArray> = {};
    if (storageType === StorageType.Table) {
      for (const [name, arr] of this.tableFields.get(componentId)!) {
        result[name] = arr;
      }
    } else {
      for (const [name, arr] of this.sparseSets.get(componentId)!.fields) {
        result[name] = arr;
      }
    }
    return result;
  }

  getSparseSetDense(componentId: ComponentId): { dense: Uint32Array; count: number } | null {
    const ss = this.sparseSets.get(componentId);
    if (!ss) return null;
    return { dense: ss.dense, count: ss.denseCount };
  }

  markChanged(entityIndex: number, componentId: ComponentId): void {
    this.changedTicks.get(componentId)![entityIndex] = this._currentTick;
  }

  isChanged(entityIndex: number, componentId: ComponentId, sinceTick: number): boolean {
    return this.changedTicks.get(componentId)![entityIndex] > sinceTick;
  }

  isAdded(entityIndex: number, componentId: ComponentId, sinceTick: number): boolean {
    return this.addedTicks.get(componentId)![entityIndex] > sinceTick;
  }

  advanceTick(): number {
    return ++this._currentTick;
  }

  clearEntity(entityIndex: number): void {
    const mask = this.archetypes[entityIndex];
    if (mask === 0n) return;

    for (let id = 0; id < this.registry.count; id++) {
      if (mask & componentBit(id)) {
        this.removeComponent(entityIndex, id);
      }
    }
    this.archetypes[entityIndex] = 0n;
  }

  reset(): void {
    this.archetypes.fill(0n);
    for (const [, ticks] of this.changedTicks) ticks.fill(0);
    for (const [, ticks] of this.addedTicks) ticks.fill(0);
    for (const [, ss] of this.sparseSets) {
      ss.sparse.fill(SPARSE_INVALID);
      ss.denseCount = 0;
    }
    this._currentTick = 0;
  }
}
