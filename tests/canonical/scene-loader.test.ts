import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/world';
import { EntityManager } from '../../src/ecs/entity-manager';
import { StorageType } from '../../src/ecs/component-registry';
import { BundleWriter } from '../../src/asset/bundle-writer';
import { BundleReader } from '../../src/asset/bundle-reader';
import { AssetType } from '../../src/asset/bundle-format';
import { loadSceneFromBundle, loadSceneData } from '../../src/canonical/scene-loader';
import type { SceneLoaderConfig } from '../../src/canonical/scene-loader';
import type { CompiledSceneData } from '../../src/canonical/loader-types';

const TRANSFORM_SCHEMA = {
  x: { type: Float32Array },
  y: { type: Float32Array },
  rotation: { type: Float32Array },
  scaleX: { type: Float32Array, default: 1 },
  scaleY: { type: Float32Array, default: 1 },
};

const SPRITE_SCHEMA = {
  order: { type: Int32Array },
  flipX: { type: Uint8Array },
  flipY: { type: Uint8Array },
  visible: { type: Uint8Array, default: 1 },
};

const CAMERA_SCHEMA = {
  size: { type: Float32Array, default: 320 },
  near: { type: Float32Array, default: 1 },
  far: { type: Float32Array, default: 2000 },
};

const HIT_SCHEMA = {
  damage: { type: Float32Array, default: 0 },
};

const LOADER_CONFIG: SceneLoaderConfig = {
  componentFieldMap: new Map([
    ['Transform', ['x', 'y', 'rotation', 'scaleX', 'scaleY']],
    ['Sprite', ['order', 'flipX', 'flipY', 'visible']],
    ['Camera', ['size', 'near', 'far']],
  ]),
};

function createTestWorld(): World {
  const world = new World({ maxEntities: 256 });
  world.registry.register('Transform', TRANSFORM_SCHEMA);
  world.registry.register('Sprite', SPRITE_SCHEMA);
  world.registry.register('Camera', CAMERA_SCHEMA);
  return world;
}

const SCENE_DATA: CompiledSceneData = {
  sceneId: 'test_level',
  entities: [
    {
      id: 'cam',
      name: 'Main Camera',
      parent: null,
      enabled: true,
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Camera: { size: 320, near: 1, far: 2000 },
      },
    },
    {
      id: 'player',
      name: 'Player',
      parent: null,
      enabled: true,
      components: {
        Transform: { x: 100, y: 200, rotation: 45, scaleX: 2, scaleY: 2 },
        Sprite: { atlas: 'main', frame: 'player_idle', order: 10, visible: 1 },
      },
    },
    {
      id: 'enemy',
      name: 'Enemy',
      parent: null,
      enabled: true,
      components: {
        Transform: { x: 400, y: 300, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'main', frame: 'enemy_idle', order: 5, flipX: 1 },
      },
    },
  ],
};

describe('loadSceneData', () => {
  let world: World;

  beforeEach(() => {
    world = createTestWorld();
  });

  it('creates all entities from scene data', () => {
    const result = loadSceneData(SCENE_DATA, world, LOADER_CONFIG);
    expect(result.entityCount).toBe(3);
    expect(result.sceneId).toBe('test_level');
    expect(result.entityIds).toHaveLength(3);
  });

  it('maps string ids to entity ids', () => {
    const result = loadSceneData(SCENE_DATA, world, LOADER_CONFIG);
    expect(result.idMap.has('cam')).toBe(true);
    expect(result.idMap.has('player')).toBe(true);
    expect(result.idMap.has('enemy')).toBe(true);
  });

  it('preserves parent and enabled metadata', () => {
    const sceneWithHierarchy: CompiledSceneData = {
      sceneId: 'hierarchy',
      entities: [
        {
          id: 'root',
          name: 'Root',
          parent: null,
          enabled: true,
          components: { Transform: { x: 0, y: 0 } },
        },
        {
          id: 'child',
          name: 'Child',
          parent: 'root',
          enabled: false,
          components: { Transform: { x: 10, y: 20 } },
        },
      ],
    };

    const result = loadSceneData(sceneWithHierarchy, world, LOADER_CONFIG);
    const rootId = result.idMap.get('root')!;
    const childId = result.idMap.get('child')!;
    const childMeta = result.metaByEntity.get(childId)!;

    expect(result.metaByEntity.get(rootId)?.parentEntityId).toBeNull();
    expect(childMeta.parentSourceId).toBe('root');
    expect(childMeta.parentEntityId).toBe(rootId);
    expect(childMeta.enabled).toBe(false);
  });

  it('entities are alive in the world', () => {
    const result = loadSceneData(SCENE_DATA, world, LOADER_CONFIG);
    for (const id of result.entityIds) {
      expect(world.isAlive(id)).toBe(true);
    }
  });

  it('adds Transform component with correct data', () => {
    const result = loadSceneData(SCENE_DATA, world, LOADER_CONFIG);
    const transformId = world.registry.getId('Transform');
    const playerId = result.idMap.get('player')!;
    const playerIndex = EntityManager.getIndex(playerId);

    expect(world.hasComponent(playerId, transformId)).toBe(true);

    const xField = world.storage.getField(transformId, 'x');
    const yField = world.storage.getField(transformId, 'y');
    const rotField = world.storage.getField(transformId, 'rotation');
    const sxField = world.storage.getField(transformId, 'scaleX');

    expect(xField[playerIndex]).toBeCloseTo(100);
    expect(yField[playerIndex]).toBeCloseTo(200);
    expect(rotField[playerIndex]).toBeCloseTo(45);
    expect(sxField[playerIndex]).toBeCloseTo(2);
  });

  it('adds Sprite component with correct data', () => {
    const result = loadSceneData(SCENE_DATA, world, LOADER_CONFIG);
    const spriteId = world.registry.getId('Sprite');
    const enemyId = result.idMap.get('enemy')!;
    const enemyIndex = EntityManager.getIndex(enemyId);

    expect(world.hasComponent(enemyId, spriteId)).toBe(true);

    const orderField = world.storage.getField(spriteId, 'order');
    const flipXField = world.storage.getField(spriteId, 'flipX');

    expect(orderField[enemyIndex]).toBe(5);
    expect(flipXField[enemyIndex]).toBe(1);
  });

  it('adds Camera component with correct data', () => {
    const result = loadSceneData(SCENE_DATA, world, LOADER_CONFIG);
    const cameraId = world.registry.getId('Camera');
    const camEntityId = result.idMap.get('cam')!;
    const camIndex = EntityManager.getIndex(camEntityId);

    expect(world.hasComponent(camEntityId, cameraId)).toBe(true);

    const sizeField = world.storage.getField(cameraId, 'size');
    expect(sizeField[camIndex]).toBeCloseTo(320);
  });

  it('skips unknown components gracefully', () => {
    const sceneWithUnknown: CompiledSceneData = {
      sceneId: 'test',
      entities: [{
        id: 'e1',
        name: 'Test',
        parent: null,
        enabled: true,
        components: {
          Transform: { x: 10 },
          UnknownComponent: { foo: 'bar' },
        },
      }],
    };

    const result = loadSceneData(sceneWithUnknown, world, LOADER_CONFIG);
    expect(result.entityCount).toBe(1);

    const transformId = world.registry.getId('Transform');
    const e1Id = result.entityIds[0];
    expect(world.hasComponent(e1Id, transformId)).toBe(true);
  });

  it('skips non-numeric field values', () => {
    const sceneWithStrings: CompiledSceneData = {
      sceneId: 'test',
      entities: [{
        id: 'e1',
        name: 'Test',
        parent: null,
        enabled: true,
        components: {
          Sprite: { atlas: 'main', frame: 'idle', order: 5, visible: 1 },
        },
      }],
    };

    const result = loadSceneData(sceneWithStrings, world, LOADER_CONFIG);
    const spriteId = world.registry.getId('Sprite');
    const e1Index = EntityManager.getIndex(result.entityIds[0]);

    const orderField = world.storage.getField(spriteId, 'order');
    expect(orderField[e1Index]).toBe(5);
  });

  it('accepts boolean field values for numeric component storage', () => {
    const sceneWithBooleans: CompiledSceneData = {
      sceneId: 'bools',
      entities: [{
        id: 'e1',
        name: 'Bool Sprite',
        parent: null,
        enabled: true,
        components: {
          Sprite: { order: 3, flipX: true, flipY: false, visible: true },
        },
      }],
    };

    const result = loadSceneData(sceneWithBooleans, world, LOADER_CONFIG);
    const spriteId = world.registry.getId('Sprite');
    const e1Index = EntityManager.getIndex(result.entityIds[0]);

    const flipXField = world.storage.getField(spriteId, 'flipX');
    const flipYField = world.storage.getField(spriteId, 'flipY');
    const visibleField = world.storage.getField(spriteId, 'visible');

    expect(flipXField[e1Index]).toBe(1);
    expect(flipYField[e1Index]).toBe(0);
    expect(visibleField[e1Index]).toBe(1);
  });

  it('writes SparseSet component fields using dense indices', () => {
    const sparseWorld = createTestWorld();
    sparseWorld.registry.register('Hit', HIT_SCHEMA, StorageType.SparseSet);
    const hitId = sparseWorld.registry.getId('Hit');

    const sparseConfig: SceneLoaderConfig = {
      componentFieldMap: new Map([
        ['Transform', ['x', 'y', 'rotation', 'scaleX', 'scaleY']],
        ['Sprite', ['order', 'flipX', 'flipY', 'visible']],
        ['Camera', ['size', 'near', 'far']],
        ['Hit', ['damage']],
      ]),
    };

    const sparseScene: CompiledSceneData = {
      sceneId: 'sparse',
      entities: [
        {
          id: 'plain',
          name: 'Plain',
          parent: null,
          enabled: true,
          components: { Transform: { x: 0, y: 0 } },
        },
        {
          id: 'enemy',
          name: 'Enemy',
          parent: null,
          enabled: true,
          components: { Hit: { damage: 7 } },
        },
      ],
    };

    const result = loadSceneData(sparseScene, sparseWorld, sparseConfig);
    const enemyId = result.idMap.get('enemy')!;
    const enemyIndex = EntityManager.getIndex(enemyId);
    const damageField = sparseWorld.storage.getField(hitId, 'damage') as Float32Array;
    const dense = sparseWorld.storage.getSparseSetDense(hitId)!;
    const denseIndex = sparseWorld.storage.getFieldIndex(enemyIndex, hitId);

    expect(dense.count).toBe(1);
    expect(dense.dense[denseIndex]).toBe(enemyIndex);
    expect(damageField[denseIndex]).toBe(7);
  });

  it('handles empty scene', () => {
    const emptyScene: CompiledSceneData = { sceneId: 'empty', entities: [] };
    const result = loadSceneData(emptyScene, world, LOADER_CONFIG);
    expect(result.entityCount).toBe(0);
    expect(result.entityIds).toHaveLength(0);
  });
});

describe('loadSceneFromBundle', () => {
  it('loads scene from a WXGE bundle', () => {
    const encoder = new TextEncoder();
    const sceneBytes = encoder.encode(JSON.stringify(SCENE_DATA));

    const writer = new BundleWriter();
    writer.addAsset(1, AssetType.Scene, sceneBytes);
    const bundleBuffer = writer.serialize();

    const reader = new BundleReader(bundleBuffer);
    const world = createTestWorld();

    const result = loadSceneFromBundle(reader, 1, world, LOADER_CONFIG);
    expect(result.sceneId).toBe('test_level');
    expect(result.entityCount).toBe(3);

    const transformId = world.registry.getId('Transform');
    const playerId = result.idMap.get('player')!;
    const playerIndex = EntityManager.getIndex(playerId);
    const xField = world.storage.getField(transformId, 'x');
    expect(xField[playerIndex]).toBeCloseTo(100);
  });

  it('full round-trip: compile → bundle → load', () => {
    const encoder = new TextEncoder();
    const sceneBytes = encoder.encode(JSON.stringify(SCENE_DATA));

    const writer = new BundleWriter();
    writer.addAsset(42, AssetType.Scene, sceneBytes);
    const bundleBuffer = writer.serialize();

    const reader = new BundleReader(bundleBuffer);
    const world = createTestWorld();

    const loaded = loadSceneFromBundle(reader, 42, world, LOADER_CONFIG);

    expect(loaded.entityCount).toBe(3);
    expect(world.entityCount).toBe(3);

    const transformId = world.registry.getId('Transform');
    const spriteId = world.registry.getId('Sprite');
    const cameraId = world.registry.getId('Camera');

    for (const entityId of loaded.entityIds) {
      expect(world.hasComponent(entityId, transformId)).toBe(true);
    }

    const playerId = loaded.idMap.get('player')!;
    expect(world.hasComponent(playerId, spriteId)).toBe(true);

    const camId = loaded.idMap.get('cam')!;
    expect(world.hasComponent(camId, cameraId)).toBe(true);
  });
});
