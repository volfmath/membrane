import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/world';
import { EntityManager } from '../../src/ecs/entity-manager';
import { SystemPhase } from '../../src/ecs/system';
import type { System } from '../../src/ecs/system';
import { ArchetypeQueryBuilder } from '../../src/ecs/query';
import { BundleWriter } from '../../src/asset/bundle-writer';
import { BundleReader } from '../../src/asset/bundle-reader';
import { AssetType } from '../../src/asset/bundle-format';
import { loadSceneFromBundle } from '../../src/canonical/scene-loader';
import type { SceneLoaderConfig } from '../../src/canonical/scene-loader';
import type { CompiledSceneData } from '../../src/canonical/loader-types';

const TRANSFORM_SCHEMA = {
  x: { type: Float32Array },
  y: { type: Float32Array },
  rotation: { type: Float32Array },
  scaleX: { type: Float32Array, default: 1 },
  scaleY: { type: Float32Array, default: 1 },
};

const VELOCITY_SCHEMA = {
  vx: { type: Float32Array },
  vy: { type: Float32Array },
};

const SPRITE_SCHEMA = {
  order: { type: Int32Array },
  visible: { type: Uint8Array, default: 1 },
};

function bench(label: string, fn: () => void, iterations = 1): number {
  // Warmup
  fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const perOp = elapsed / iterations;
  console.log(`  [bench] ${label}: ${perOp.toFixed(3)}ms (${iterations} iterations, total ${elapsed.toFixed(1)}ms)`);
  return perOp;
}

describe('ECS performance benchmarks', () => {
  it('entity creation: 10000 entities', () => {
    const ms = bench('create 10000 entities', () => {
      const world = new World({ maxEntities: 10000 });
      for (let i = 0; i < 10000; i++) world.createEntity();
    }, 20);

    expect(ms).toBeLessThan(50);
  });

  it('entity creation: 50000 entities', () => {
    const ms = bench('create 50000 entities', () => {
      const world = new World({ maxEntities: 50000 });
      for (let i = 0; i < 50000; i++) world.createEntity();
    }, 5);

    expect(ms).toBeLessThan(200);
  });

  it('component add + field write: 10000 entities x 2 components', () => {
    const world = new World({ maxEntities: 10000 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    world.registry.register('Velocity', VELOCITY_SCHEMA);
    const transformId = world.registry.getId('Transform');
    const velocityId = world.registry.getId('Velocity');

    const ids = [];
    for (let i = 0; i < 10000; i++) ids.push(world.createEntity());

    const ms = bench('addComponent + write fields (10000 x 2)', () => {
      for (let i = 0; i < 10000; i++) {
        world.addComponent(ids[i], transformId);
        world.addComponent(ids[i], velocityId);
        const idx = EntityManager.getIndex(ids[i]);
        world.storage.getField(transformId, 'x')[idx] = i;
        world.storage.getField(transformId, 'y')[idx] = -i;
        world.storage.getField(velocityId, 'vx')[idx] = 1;
        world.storage.getField(velocityId, 'vy')[idx] = -1;
      }
    }, 10);

    expect(ms).toBeLessThan(100);
  });

  it('field read throughput: iterate 10000 entities', () => {
    const world = new World({ maxEntities: 10000 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    const transformId = world.registry.getId('Transform');

    for (let i = 0; i < 10000; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, transformId);
      const idx = EntityManager.getIndex(eid);
      world.storage.getField(transformId, 'x')[idx] = i;
    }

    const xField = world.storage.getField(transformId, 'x');
    const yField = world.storage.getField(transformId, 'y');

    let sum = 0;
    const ms = bench('read fields (10000 entities)', () => {
      sum = 0;
      for (let i = 0; i < 10000; i++) {
        sum += xField[i] + yField[i];
      }
    }, 1000);

    expect(sum).not.toBe(0);
    expect(ms).toBeLessThan(1);
  });

  it('query iteration: 10000 entities with archetype matching', () => {
    const world = new World({ maxEntities: 10000 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    world.registry.register('Velocity', VELOCITY_SCHEMA);
    world.registry.register('Sprite', SPRITE_SCHEMA);
    const tId = world.registry.getId('Transform');
    const vId = world.registry.getId('Velocity');
    const sId = world.registry.getId('Sprite');

    // 5000 entities with Transform+Velocity, 5000 with Transform+Sprite
    for (let i = 0; i < 5000; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, tId);
      world.addComponent(eid, vId);
    }
    for (let i = 0; i < 5000; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, tId);
      world.addComponent(eid, sId);
    }

    const query = new ArchetypeQueryBuilder().with(tId, vId).build();

    let matchCount = 0;
    const ms = bench('query iterate (5000 matches / 10000 total)', () => {
      matchCount = 0;
      for (let e = 0; e < 10000; e++) {
        const arch = world.storage.getArchetype(e);
        if (arch === 0n) continue;
        if (query.matchesArchetype(arch)) matchCount++;
      }
    }, 100);

    expect(matchCount).toBe(5000);
    expect(ms).toBeLessThan(5);
  });

  it('system update cycle: 3 systems on 10000 entities', () => {
    const world = new World({ maxEntities: 10000 });
    world.registry.register('Transform', TRANSFORM_SCHEMA);
    world.registry.register('Velocity', VELOCITY_SCHEMA);
    const tId = world.registry.getId('Transform');
    const vId = world.registry.getId('Velocity');

    for (let i = 0; i < 10000; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, tId);
      world.addComponent(eid, vId);
      const idx = EntityManager.getIndex(eid);
      world.storage.getField(vId, 'vx')[idx] = 1;
      world.storage.getField(vId, 'vy')[idx] = -1;
    }

    const movementQuery = new ArchetypeQueryBuilder().with(tId, vId).build();

    const movementSystem: System = {
      name: 'Movement',
      phase: SystemPhase.Update,
      query: movementQuery,
      enabled: true,
      update(w, dt, matched, count) {
        const xf = w.storage.getField(tId, 'x');
        const yf = w.storage.getField(tId, 'y');
        const vxf = w.storage.getField(vId, 'vx');
        const vyf = w.storage.getField(vId, 'vy');
        for (let i = 0; i < count; i++) {
          const idx = matched[i];
          xf[idx] += vxf[idx] * dt;
          yf[idx] += vyf[idx] * dt;
        }
      },
    };

    const boundsSystem: System = {
      name: 'Bounds',
      phase: SystemPhase.PostUpdate,
      query: movementQuery,
      enabled: true,
      update(w, _dt, matched, count) {
        const xf = w.storage.getField(tId, 'x');
        const yf = w.storage.getField(tId, 'y');
        for (let i = 0; i < count; i++) {
          const idx = matched[i];
          if (xf[idx] > 1000) xf[idx] = 0;
          if (yf[idx] < -1000) yf[idx] = 0;
        }
      },
    };

    const tickSystem: System = {
      name: 'Tick',
      phase: SystemPhase.PreUpdate,
      query: null,
      enabled: true,
      update() { /* no-op counter */ },
    };

    world.addSystem(tickSystem);
    world.addSystem(movementSystem);
    world.addSystem(boundsSystem);

    const ms = bench('world.update (3 systems, 10000 entities)', () => {
      world.update(0.016);
    }, 500);

    expect(ms).toBeLessThan(5);
  });

  it('scene load throughput: 50-entity scene x 100 loads', () => {
    const entities = [];
    for (let i = 0; i < 50; i++) {
      entities.push({
        id: `e${i}`, name: `E${i}`, parent: null, enabled: true,
        components: {
          Transform: { x: i, y: -i, rotation: i % 360, scaleX: 1, scaleY: 1 },
        },
      });
    }
    const scene: CompiledSceneData = { sceneId: 'perf_scene', entities };

    const encoder = new TextEncoder();
    const writer = new BundleWriter();
    writer.addAsset(1, AssetType.Scene, encoder.encode(JSON.stringify(scene)));
    const bundleBuffer = writer.serialize();

    const config: SceneLoaderConfig = {
      componentFieldMap: new Map([
        ['Transform', ['x', 'y', 'rotation', 'scaleX', 'scaleY']],
      ]),
    };

    const ms = bench('load 50-entity scene from bundle (x100)', () => {
      const world = new World({ maxEntities: 100 });
      world.registry.register('Transform', TRANSFORM_SCHEMA);
      const reader = new BundleReader(bundleBuffer);
      loadSceneFromBundle(reader, 1, world, config);
    }, 100);

    expect(ms).toBeLessThan(10);
  });
});
