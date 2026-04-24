export type TypedArrayConstructor =
  | typeof Float32Array
  | typeof Float64Array
  | typeof Int8Array
  | typeof Int16Array
  | typeof Int32Array
  | typeof Uint8Array
  | typeof Uint16Array
  | typeof Uint32Array;

export interface FieldDef {
  type: TypedArrayConstructor;
  default?: number;
}

export interface ComponentSchema {
  [fieldName: string]: FieldDef;
}

export enum StorageType {
  Table = 0,
  SparseSet = 1,
}

export type ComponentId = number;
export const MAX_COMPONENT_TYPES = 64;
export type ArchetypeMask = bigint;

export function componentBit(id: ComponentId): ArchetypeMask {
  return 1n << BigInt(id);
}

interface RegisteredComponent {
  name: string;
  schema: ComponentSchema;
  storage: StorageType;
}

export class ComponentRegistry {
  private components: RegisteredComponent[] = [];
  private nameToId = new Map<string, ComponentId>();

  register(name: string, schema: ComponentSchema, storage: StorageType = StorageType.Table): ComponentId {
    if (this.nameToId.has(name)) {
      throw new Error(`Component "${name}" already registered`);
    }
    if (this.components.length >= MAX_COMPONENT_TYPES) {
      throw new Error(`Cannot register more than ${MAX_COMPONENT_TYPES} component types`);
    }
    const id = this.components.length;
    this.components.push({ name, schema, storage });
    this.nameToId.set(name, id);
    return id;
  }

  getSchema(id: ComponentId): ComponentSchema {
    return this.components[id].schema;
  }

  getStorageType(id: ComponentId): StorageType {
    return this.components[id].storage;
  }

  getName(id: ComponentId): string {
    return this.components[id].name;
  }

  getId(name: string): ComponentId {
    return this.nameToId.get(name) ?? -1;
  }

  get count(): number {
    return this.components.length;
  }
}
