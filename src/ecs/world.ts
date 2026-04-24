import type { EntityId } from './types';
import type { ComponentId } from './component-registry';
import { EntityManager } from './entity-manager';
import { ComponentRegistry } from './component-registry';
import { ComponentStorage } from './component-storage';
import { Scheduler } from './scheduler';
import { ArchetypeQueryBuilder } from './query';
import type { System } from './system';

export interface WorldConfig {
  maxEntities?: number;
}

export class World {
  readonly entities: EntityManager;
  readonly registry: ComponentRegistry;
  readonly storage: ComponentStorage;
  readonly scheduler: Scheduler;

  constructor(config?: WorldConfig) {
    const max = config?.maxEntities ?? 65536;
    this.entities = new EntityManager({ maxEntities: max });
    this.registry = new ComponentRegistry();
    this.storage = new ComponentStorage(this.registry, max);
    this.scheduler = new Scheduler(max);
  }

  get currentTick(): number {
    return this.storage.currentTick;
  }

  get entityCount(): number {
    return this.entities.aliveCount;
  }

  createEntity(): EntityId {
    return this.entities.create();
  }

  destroyEntity(id: EntityId): void {
    if (!this.entities.isAlive(id)) return;
    const index = EntityManager.getIndex(id);
    this.storage.clearEntity(index);
    this.entities.destroy(id);
  }

  isAlive(id: EntityId): boolean {
    return this.entities.isAlive(id);
  }

  addComponent(id: EntityId, componentId: ComponentId): this {
    const index = EntityManager.getIndex(id);
    this.storage.ensureComponent(componentId);
    this.storage.addComponent(index, componentId);
    return this;
  }

  removeComponent(id: EntityId, componentId: ComponentId): void {
    const index = EntityManager.getIndex(id);
    this.storage.removeComponent(index, componentId);
  }

  hasComponent(id: EntityId, componentId: ComponentId): boolean {
    const index = EntityManager.getIndex(id);
    return this.storage.hasComponent(index, componentId);
  }

  query(): ArchetypeQueryBuilder {
    return new ArchetypeQueryBuilder();
  }

  addSystem(system: System): void {
    this.scheduler.addSystem(system);
  }

  removeSystem(system: System): void {
    this.scheduler.removeSystem(system);
  }

  update(dt: number): void {
    this.storage.advanceTick();
    this.scheduler.update(this, dt);
  }

  reset(): void {
    this.entities.reset();
    this.storage.reset();
  }
}
