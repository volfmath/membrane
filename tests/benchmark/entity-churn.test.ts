import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/world';
import { EntityManager } from '../../src/ecs/entity-manager';
import { StorageType } from '../../src/ecs/component-registry';
import type { EntityId } from '../../src/ecs/types';

const TRANSFORM_SCHEMA = {
  x: { type: Float32Array },
  y: { type: Float32Array },
};

const TAG_SCHEMA = {
  value: { type: Uint8Array, default: 1 },
};

describe('entity churn benchmark', () => {
  it('create-destroy cycle: 100/frame for 600 frames', () => {
    const world = new World({ maxEntities: 1024 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    const tId = world.registry.getId('Transform');

    // Seed 200 entities
    const pool: EntityId[] = [];
    for (let i = 0; i < 200; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, tId);
      pool.push(eid);
    }

    const FRAMES = 600;
    const CHURN_PER_FRAME = 100;

    const start = performance.now();

    for (let frame = 0; frame < FRAMES; frame++) {
      // Destroy oldest CHURN_PER_FRAME
      const toDestroy = Math.min(CHURN_PER_FRAME, pool.length);
      for (let i = 0; i < toDestroy; i++) {
        world.destroyEntity(pool.shift()!);
      }

      // Create CHURN_PER_FRAME new
      for (let i = 0; i < CHURN_PER_FRAME; i++) {
        const eid = world.createEntity();
        world.addComponent(eid, tId);
        const idx = EntityManager.getIndex(eid);
        world.storage.getField(tId, 'x')[idx] = frame;
        pool.push(eid);
      }
    }

    const elapsed = performance.now() - start;
    console.log(`  [bench] 600-frame churn (100 create+destroy/frame): ${elapsed.toFixed(1)}ms`);

    // Pool should be 200 (original steady state)
    expect(pool.length).toBe(200);
    expect(world.entityCount).toBe(200);

    // All surviving entities are alive
    for (const eid of pool) {
      expect(world.isAlive(eid)).toBe(true);
    }

    expect(elapsed).toBeLessThan(500);
  });

  it('generations increment correctly under churn', () => {
    const world = new World({ maxEntities: 16 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    const tId = world.registry.getId('Transform');

    const CYCLES = 50;
    const staleIds: EntityId[] = [];

    for (let c = 0; c < CYCLES; c++) {
      const ids: EntityId[] = [];
      for (let i = 0; i < 8; i++) {
        const eid = world.createEntity();
        world.addComponent(eid, tId);
        ids.push(eid);
      }

      staleIds.push(...ids);

      for (const eid of ids) {
        world.destroyEntity(eid);
      }
    }

    // All stale IDs should be dead
    for (const eid of staleIds) {
      expect(world.isAlive(eid)).toBe(false);
    }

    expect(world.entityCount).toBe(0);
  });

  it('component churn: SparseSet add/remove stability', () => {
    const world = new World({ maxEntities: 256 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    world.registry.register('Tag', TAG_SCHEMA, StorageType.SparseSet);
    const tId = world.registry.getId('Transform');
    const tagId = world.registry.getId('Tag');

    const entities: EntityId[] = [];
    for (let i = 0; i < 100; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, tId);
      entities.push(eid);
    }

    const CYCLES = 200;
    const start = performance.now();

    for (let c = 0; c < CYCLES; c++) {
      // Add Tag to half
      for (let i = 0; i < 50; i++) {
        world.addComponent(entities[i], tagId);
      }

      // Remove Tag from that half
      for (let i = 0; i < 50; i++) {
        world.removeComponent(entities[i], tagId);
      }
    }

    const elapsed = performance.now() - start;
    console.log(`  [bench] SparseSet churn (200 cycles, 50 add+remove): ${elapsed.toFixed(1)}ms`);

    // No entity should have Tag after all removes
    for (const eid of entities) {
      expect(world.hasComponent(eid, tagId)).toBe(false);
    }

    // All entities still alive with Transform
    expect(world.entityCount).toBe(100);
    for (const eid of entities) {
      expect(world.hasComponent(eid, tId)).toBe(true);
    }

    expect(elapsed).toBeLessThan(200);
  });

  it('high-frequency create-destroy does not leak', () => {
    const world = new World({ maxEntities: 512 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    const tId = world.registry.getId('Transform');

    for (let round = 0; round < 1000; round++) {
      const eid = world.createEntity();
      world.addComponent(eid, tId);
      const idx = EntityManager.getIndex(eid);
      world.storage.getField(tId, 'x')[idx] = round;
      world.destroyEntity(eid);
    }

    expect(world.entityCount).toBe(0);

    // Can still create entities after heavy churn
    const fresh = world.createEntity();
    expect(world.isAlive(fresh)).toBe(true);
    expect(world.entityCount).toBe(1);
  });
});
