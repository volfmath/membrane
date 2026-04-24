import {
  type EntityId,
  INVALID_ENTITY,
  ENTITY_INDEX_MASK,
  ENTITY_GEN_MASK,
  MAX_ENTITIES,
} from './types';

export interface EntityManagerConfig {
  maxEntities?: number;
}

export class EntityManager {
  private generations: Uint16Array;
  private freeList: Uint16Array;
  private freeCount: number;
  private _aliveCount: number;
  private nextNewIndex: number;
  private readonly _capacity: number;

  constructor(config?: EntityManagerConfig) {
    const max = config?.maxEntities ?? MAX_ENTITIES;
    if (max < 1 || max > MAX_ENTITIES) {
      throw new Error(`maxEntities must be between 1 and ${MAX_ENTITIES}`);
    }
    this._capacity = max;
    this.generations = new Uint16Array(max);
    this.freeList = new Uint16Array(max);
    this.freeCount = 0;
    this._aliveCount = 0;
    this.nextNewIndex = 0;
  }

  get aliveCount(): number {
    return this._aliveCount;
  }

  get capacity(): number {
    return this._capacity;
  }

  create(): EntityId {
    let index: number;
    if (this.freeCount > 0) {
      index = this.freeList[--this.freeCount];
    } else if (this.nextNewIndex < this._capacity) {
      index = this.nextNewIndex++;
    } else {
      throw new Error('EntityManager capacity exhausted');
    }
    this._aliveCount++;
    const gen = this.generations[index];
    return ((gen & ENTITY_GEN_MASK) << 16) | (index & ENTITY_INDEX_MASK);
  }

  destroy(id: EntityId): void {
    if (id === INVALID_ENTITY) return;
    const index = id & ENTITY_INDEX_MASK;
    const gen = (id >>> 16) & ENTITY_GEN_MASK;
    if (index >= this.nextNewIndex) return;
    if (this.generations[index] !== gen) return;
    this.generations[index] = (gen + 1) & ENTITY_GEN_MASK;
    this.freeList[this.freeCount++] = index;
    this._aliveCount--;
  }

  isAlive(id: EntityId): boolean {
    if (id === INVALID_ENTITY) return false;
    const index = id & ENTITY_INDEX_MASK;
    const gen = (id >>> 16) & ENTITY_GEN_MASK;
    if (index >= this.nextNewIndex) return false;
    return this.generations[index] === gen;
  }

  static getIndex(id: EntityId): number {
    return id & ENTITY_INDEX_MASK;
  }

  static getGeneration(id: EntityId): number {
    return (id >>> 16) & ENTITY_GEN_MASK;
  }

  reset(): void {
    this.generations.fill(0);
    this.freeCount = 0;
    this._aliveCount = 0;
    this.nextNewIndex = 0;
  }
}
