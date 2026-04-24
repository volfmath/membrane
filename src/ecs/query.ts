import type { ComponentId, ArchetypeMask } from './component-registry';
import { componentBit } from './component-registry';
import type { ComponentStorage } from './component-storage';

export class ArchetypeQuery {
  readonly withMask: ArchetypeMask;
  readonly withoutMask: ArchetypeMask;
  readonly changedIds: ReadonlyArray<ComponentId>;
  readonly addedIds: ReadonlyArray<ComponentId>;

  constructor(
    withMask: ArchetypeMask,
    withoutMask: ArchetypeMask,
    changedIds: ComponentId[],
    addedIds: ComponentId[],
  ) {
    this.withMask = withMask;
    this.withoutMask = withoutMask;
    this.changedIds = changedIds;
    this.addedIds = addedIds;
  }

  matchesArchetype(archetype: ArchetypeMask): boolean {
    return (
      (archetype & this.withMask) === this.withMask &&
      (archetype & this.withoutMask) === 0n
    );
  }

  matchesEntity(entityIndex: number, storage: ComponentStorage, lastRunTick: number): boolean {
    for (const cid of this.changedIds) {
      if (!storage.isChanged(entityIndex, cid, lastRunTick)) return false;
    }
    for (const cid of this.addedIds) {
      if (!storage.isAdded(entityIndex, cid, lastRunTick)) return false;
    }
    return true;
  }

  get hasTickFilters(): boolean {
    return this.changedIds.length > 0 || this.addedIds.length > 0;
  }
}

export class ArchetypeQueryBuilder {
  private _withIds: ComponentId[] = [];
  private _withoutIds: ComponentId[] = [];
  private _changedIds: ComponentId[] = [];
  private _addedIds: ComponentId[] = [];

  with(...componentIds: ComponentId[]): this {
    this._withIds.push(...componentIds);
    return this;
  }

  without(...componentIds: ComponentId[]): this {
    this._withoutIds.push(...componentIds);
    return this;
  }

  changed(...componentIds: ComponentId[]): this {
    this._changedIds.push(...componentIds);
    return this;
  }

  added(...componentIds: ComponentId[]): this {
    this._addedIds.push(...componentIds);
    return this;
  }

  build(): ArchetypeQuery {
    let withMask: ArchetypeMask = 0n;
    for (const id of this._withIds) withMask |= componentBit(id);

    let withoutMask: ArchetypeMask = 0n;
    for (const id of this._withoutIds) withoutMask |= componentBit(id);

    return new ArchetypeQuery(withMask, withoutMask, this._changedIds, this._addedIds);
  }
}
