import { describe, it, expect, vi } from 'vitest';
import {
  World,
  SystemPhase,
  ArchetypeQueryBuilder,
  EntityManager,
} from '../../src/ecs';
import type { System, ComponentSchema } from '../../src/ecs';

const TransformSchema: ComponentSchema = {
  posX: { type: Float32Array, default: 0 },
  posY: { type: Float32Array, default: 0 },
};

const VelocitySchema: ComponentSchema = {
  velX: { type: Float32Array, default: 0 },
  velY: { type: Float32Array, default: 0 },
};

const HiddenSchema: ComponentSchema = {};

function makeSystem(
  name: string,
  phase: SystemPhase,
  query: ReturnType<typeof ArchetypeQueryBuilder.prototype.build> | null,
  updateFn?: System['update'],
): System {
  return {
    name,
    phase,
    query,
    enabled: true,
    update: updateFn ?? vi.fn(),
  };
}

describe('Scheduler — Phase ordering', () => {
  it('executes systems in phase order', () => {
    const world = new World({ maxEntities: 16 });
    const order: string[] = [];

    const sA = makeSystem('A', SystemPhase.PostUpdate, null, () => { order.push('A'); });
    const sB = makeSystem('B', SystemPhase.PreUpdate, null, () => { order.push('B'); });
    const sC = makeSystem('C', SystemPhase.Update, null, () => { order.push('C'); });

    world.addSystem(sA);
    world.addSystem(sB);
    world.addSystem(sC);
    world.update(0.016);

    expect(order).toEqual(['B', 'C', 'A']);
  });

  it('same phase preserves registration order', () => {
    const world = new World({ maxEntities: 16 });
    const order: string[] = [];

    const s1 = makeSystem('S1', SystemPhase.Update, null, () => { order.push('S1'); });
    const s2 = makeSystem('S2', SystemPhase.Update, null, () => { order.push('S2'); });
    const s3 = makeSystem('S3', SystemPhase.Update, null, () => { order.push('S3'); });

    world.addSystem(s1);
    world.addSystem(s2);
    world.addSystem(s3);
    world.update(0.016);

    expect(order).toEqual(['S1', 'S2', 'S3']);
  });

  it('disabled systems are skipped', () => {
    const world = new World({ maxEntities: 16 });
    const updateFn = vi.fn();
    const sys = makeSystem('disabled', SystemPhase.Update, null, updateFn);
    sys.enabled = false;
    world.addSystem(sys);
    world.update(0.016);
    expect(updateFn).not.toHaveBeenCalled();
  });
});

describe('Scheduler — Query matching', () => {
  it('matches entities with correct components', () => {
    const world = new World({ maxEntities: 64 });
    const tId = world.registry.register('Transform', TransformSchema);
    const vId = world.registry.register('Velocity', VelocitySchema);

    const e1 = world.createEntity();
    world.addComponent(e1, tId).addComponent(e1, vId);

    const e2 = world.createEntity();
    world.addComponent(e2, tId);

    let matched: number[] = [];
    const query = new ArchetypeQueryBuilder().with(tId, vId).build();
    const sys = makeSystem('Move', SystemPhase.Update, query, (_w, _dt, ents, count) => {
      matched = Array.from(ents.subarray(0, count));
    });

    world.addSystem(sys);
    world.update(0.016);

    expect(matched).toEqual([EntityManager.getIndex(e1)]);
  });

  it('without filter excludes entities', () => {
    const world = new World({ maxEntities: 64 });
    const tId = world.registry.register('Transform', TransformSchema);
    const hId = world.registry.register('Hidden', HiddenSchema);

    const e1 = world.createEntity();
    world.addComponent(e1, tId);

    const e2 = world.createEntity();
    world.addComponent(e2, tId).addComponent(e2, hId);

    let matched: number[] = [];
    const query = new ArchetypeQueryBuilder().with(tId).without(hId).build();
    const sys = makeSystem('Visible', SystemPhase.Update, query, (_w, _dt, ents, count) => {
      matched = Array.from(ents.subarray(0, count));
    });

    world.addSystem(sys);
    world.update(0.016);

    expect(matched).toEqual([EntityManager.getIndex(e1)]);
  });
});

describe('Scheduler — Change Detection filters', () => {
  it('changed filter only matches modified entities', () => {
    const world = new World({ maxEntities: 64 });
    const tId = world.registry.register('Transform', TransformSchema);

    const e1 = world.createEntity();
    world.addComponent(e1, tId);
    const e2 = world.createEntity();
    world.addComponent(e2, tId);

    world.update(0.016);

    const posX = world.storage.getField(tId, 'posX') as Float32Array;
    const idx1 = EntityManager.getIndex(e1);
    posX[idx1] = 99;
    world.storage.markChanged(idx1, tId);

    let matched: number[] = [];
    const query = new ArchetypeQueryBuilder().with(tId).changed(tId).build();
    const sys = makeSystem('ChangedOnly', SystemPhase.Update, query, (_w, _dt, ents, count) => {
      matched = Array.from(ents.subarray(0, count));
    });
    world.addSystem(sys);

    world.update(0.016);

    expect(matched).toEqual([idx1]);
  });

  it('added filter only matches newly added components', () => {
    const world = new World({ maxEntities: 64 });
    const tId = world.registry.register('Transform', TransformSchema);

    const e1 = world.createEntity();
    world.addComponent(e1, tId);

    world.update(0.016);

    const e2 = world.createEntity();
    world.addComponent(e2, tId);

    let matched: number[] = [];
    const query = new ArchetypeQueryBuilder().with(tId).added(tId).build();
    const sys = makeSystem('AddedOnly', SystemPhase.Update, query, (_w, _dt, ents, count) => {
      matched = Array.from(ents.subarray(0, count));
    });
    world.addSystem(sys);

    world.update(0.016);

    expect(matched).toEqual([EntityManager.getIndex(e2)]);
  });

  it('mixed filter: with(T).changed(T).without(H)', () => {
    const world = new World({ maxEntities: 64 });
    const tId = world.registry.register('Transform', TransformSchema);
    const hId = world.registry.register('Hidden', HiddenSchema);

    const e1 = world.createEntity();
    world.addComponent(e1, tId);
    const e2 = world.createEntity();
    world.addComponent(e2, tId).addComponent(e2, hId);
    const e3 = world.createEntity();
    world.addComponent(e3, tId);

    world.update(0.016);

    const idx1 = EntityManager.getIndex(e1);
    const idx2 = EntityManager.getIndex(e2);
    world.storage.markChanged(idx1, tId);
    world.storage.markChanged(idx2, tId);

    let matched: number[] = [];
    const query = new ArchetypeQueryBuilder().with(tId).changed(tId).without(hId).build();
    const sys = makeSystem('Mixed', SystemPhase.Update, query, (_w, _dt, ents, count) => {
      matched = Array.from(ents.subarray(0, count));
    });
    world.addSystem(sys);

    world.update(0.016);

    expect(matched).toEqual([idx1]);
  });
});

describe('World', () => {
  it('createEntity and destroyEntity', () => {
    const world = new World({ maxEntities: 16 });
    const e = world.createEntity();
    expect(world.isAlive(e)).toBe(true);
    expect(world.entityCount).toBe(1);
    world.destroyEntity(e);
    expect(world.isAlive(e)).toBe(false);
    expect(world.entityCount).toBe(0);
  });

  it('destroyEntity clears components', () => {
    const world = new World({ maxEntities: 16 });
    const tId = world.registry.register('Transform', TransformSchema);
    const e = world.createEntity();
    world.addComponent(e, tId);
    expect(world.hasComponent(e, tId)).toBe(true);
    world.destroyEntity(e);
    const idx = EntityManager.getIndex(e);
    expect(world.storage.hasComponent(idx, tId)).toBe(false);
  });

  it('addComponent chaining', () => {
    const world = new World({ maxEntities: 16 });
    const tId = world.registry.register('Transform', TransformSchema);
    const vId = world.registry.register('Velocity', VelocitySchema);
    const e = world.createEntity();
    world.addComponent(e, tId).addComponent(e, vId);
    expect(world.hasComponent(e, tId)).toBe(true);
    expect(world.hasComponent(e, vId)).toBe(true);
  });

  it('update advances tick', () => {
    const world = new World({ maxEntities: 16 });
    expect(world.currentTick).toBe(0);
    world.update(0.016);
    expect(world.currentTick).toBe(1);
    world.update(0.016);
    expect(world.currentTick).toBe(2);
  });

  it('reset clears entities and storage', () => {
    const world = new World({ maxEntities: 16 });
    const tId = world.registry.register('Transform', TransformSchema);
    const e = world.createEntity();
    world.addComponent(e, tId);
    world.reset();
    expect(world.entityCount).toBe(0);
    expect(world.currentTick).toBe(0);
  });

  it('query builder returns fresh builder', () => {
    const world = new World({ maxEntities: 16 });
    const q1 = world.query();
    const q2 = world.query();
    expect(q1).not.toBe(q2);
  });

  it('addComponent on dead entity is a no-op', () => {
    const world = new World({ maxEntities: 16 });
    const tId = world.registry.register('Transform', TransformSchema);
    const e = world.createEntity();
    world.destroyEntity(e);
    world.addComponent(e, tId);
    const idx = EntityManager.getIndex(e);
    expect(world.storage.hasComponent(idx, tId)).toBe(false);
  });

  it('removeComponent on dead entity is a no-op', () => {
    const world = new World({ maxEntities: 16 });
    const tId = world.registry.register('Transform', TransformSchema);
    const e = world.createEntity();
    world.addComponent(e, tId);
    world.destroyEntity(e);
    expect(() => world.removeComponent(e, tId)).not.toThrow();
  });

  it('hasComponent on dead entity returns false', () => {
    const world = new World({ maxEntities: 16 });
    const tId = world.registry.register('Transform', TransformSchema);
    const e = world.createEntity();
    world.addComponent(e, tId);
    world.destroyEntity(e);
    expect(world.hasComponent(e, tId)).toBe(false);
  });
});

describe('Scheduler — highWaterMark optimization', () => {
  it('only scans up to highWaterMark, not full capacity', () => {
    const world = new World({ maxEntities: 1024 });
    const tId = world.registry.register('Transform', TransformSchema);

    const e1 = world.createEntity();
    const e2 = world.createEntity();
    world.addComponent(e1, tId);
    world.addComponent(e2, tId);

    let matchCount = 0;
    const query = new ArchetypeQueryBuilder().with(tId).build();
    const sys = makeSystem('Counter', SystemPhase.Update, query, (_w, _dt, _ents, count) => {
      matchCount = count;
    });
    world.addSystem(sys);
    world.update(0.016);

    expect(matchCount).toBe(2);
    expect(world.entities.highWaterMark).toBe(2);
  });
});
