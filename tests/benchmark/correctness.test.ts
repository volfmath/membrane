import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { World } from '../../src/ecs/world';
import { EntityManager } from '../../src/ecs/entity-manager';
import { BundleWriter } from '../../src/asset/bundle-writer';
import { BundleReader } from '../../src/asset/bundle-reader';
import { AssetType } from '../../src/asset/bundle-format';
import { loadSceneFromBundle, loadSceneData } from '../../src/canonical/scene-loader';
import type { SceneLoaderConfig } from '../../src/canonical/scene-loader';
import type { CompiledSceneData } from '../../src/canonical/loader-types';
import { importCocosProject } from '../../tools/cocos-importer/importer';
import { compileCanonicalDir } from '../../tools/compiler/scene-compiler';

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

const LOADER_CONFIG: SceneLoaderConfig = {
  componentFieldMap: new Map([
    ['Transform', ['x', 'y', 'rotation', 'scaleX', 'scaleY']],
    ['Sprite', ['order', 'flipX', 'flipY', 'visible']],
    ['Camera', ['size', 'near', 'far']],
  ]),
};

function createTestWorld(maxEntities = 4096): World {
  const world = new World({ maxEntities });
  world.registry.register('Transform', TRANSFORM_SCHEMA);
  world.registry.register('Sprite', SPRITE_SCHEMA);
  world.registry.register('Camera', CAMERA_SCHEMA);
  return world;
}

function bundleScene(scene: CompiledSceneData, assetId: number): ArrayBuffer {
  const encoder = new TextEncoder();
  const writer = new BundleWriter();
  writer.addAsset(assetId, AssetType.Scene, encoder.encode(JSON.stringify(scene)));
  return writer.serialize();
}

describe('correctness harness', () => {
  describe('round-trip correctness', () => {
    it('every field value survives compile → bundle → load', () => {
      const scene: CompiledSceneData = {
        sceneId: 'roundtrip_test',
        entities: [
          {
            id: 'e1', name: 'Entity1', parent: null, enabled: true,
            components: {
              Transform: { x: 42.5, y: -100.25, rotation: 180, scaleX: 3, scaleY: 0.5 },
              Sprite: { order: 7, flipX: 1, flipY: 0, visible: 1 },
            },
          },
          {
            id: 'e2', name: 'Entity2', parent: null, enabled: true,
            components: {
              Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
              Camera: { size: 480, near: 0.1, far: 5000 },
            },
          },
        ],
      };

      const buf = bundleScene(scene, 1);
      const reader = new BundleReader(buf);
      const world = createTestWorld();

      const loaded = loadSceneFromBundle(reader, 1, world, LOADER_CONFIG);

      expect(loaded.entityCount).toBe(2);
      expect(loaded.sceneId).toBe('roundtrip_test');

      const transformId = world.registry.getId('Transform');
      const spriteId = world.registry.getId('Sprite');
      const cameraId = world.registry.getId('Camera');

      // Verify e1 Transform
      const e1 = loaded.idMap.get('e1')!;
      const e1i = EntityManager.getIndex(e1);
      expect(world.storage.getField(transformId, 'x')[e1i]).toBeCloseTo(42.5);
      expect(world.storage.getField(transformId, 'y')[e1i]).toBeCloseTo(-100.25);
      expect(world.storage.getField(transformId, 'rotation')[e1i]).toBeCloseTo(180);
      expect(world.storage.getField(transformId, 'scaleX')[e1i]).toBeCloseTo(3);
      expect(world.storage.getField(transformId, 'scaleY')[e1i]).toBeCloseTo(0.5);

      // Verify e1 Sprite
      expect(world.storage.getField(spriteId, 'order')[e1i]).toBe(7);
      expect(world.storage.getField(spriteId, 'flipX')[e1i]).toBe(1);
      expect(world.storage.getField(spriteId, 'flipY')[e1i]).toBe(0);

      // Verify e2 Camera
      const e2 = loaded.idMap.get('e2')!;
      const e2i = EntityManager.getIndex(e2);
      expect(world.storage.getField(cameraId, 'size')[e2i]).toBeCloseTo(480);
      expect(world.storage.getField(cameraId, 'near')[e2i]).toBeCloseTo(0.1, 1);
      expect(world.storage.getField(cameraId, 'far')[e2i]).toBeCloseTo(5000);
    });
  });

  describe('multi-scene loading', () => {
    it('two scenes loaded into same world do not conflict', () => {
      const scene1: CompiledSceneData = {
        sceneId: 'scene_a',
        entities: [
          { id: 'a1', name: 'A1', parent: null, enabled: true, components: { Transform: { x: 10, y: 20 } } },
          { id: 'a2', name: 'A2', parent: null, enabled: true, components: { Transform: { x: 30, y: 40 } } },
        ],
      };

      const scene2: CompiledSceneData = {
        sceneId: 'scene_b',
        entities: [
          { id: 'b1', name: 'B1', parent: null, enabled: true, components: { Transform: { x: 100, y: 200 } } },
          { id: 'b2', name: 'B2', parent: null, enabled: true, components: { Transform: { x: 300, y: 400 } } },
          { id: 'b3', name: 'B3', parent: null, enabled: true, components: { Transform: { x: 500, y: 600 } } },
        ],
      };

      const world = createTestWorld();

      const loadedA = loadSceneData(scene1, world, LOADER_CONFIG);
      const loadedB = loadSceneData(scene2, world, LOADER_CONFIG);

      expect(world.entityCount).toBe(5);
      expect(loadedA.entityCount).toBe(2);
      expect(loadedB.entityCount).toBe(3);

      // No entity ID overlap
      const allIds = new Set([...loadedA.entityIds, ...loadedB.entityIds]);
      expect(allIds.size).toBe(5);

      // Scene A data intact after scene B load
      const transformId = world.registry.getId('Transform');
      const a1i = EntityManager.getIndex(loadedA.idMap.get('a1')!);
      expect(world.storage.getField(transformId, 'x')[a1i]).toBeCloseTo(10);

      const b3i = EntityManager.getIndex(loadedB.idMap.get('b3')!);
      expect(world.storage.getField(transformId, 'x')[b3i]).toBeCloseTo(500);
    });

    it('loading same scene twice produces distinct entities', () => {
      const scene: CompiledSceneData = {
        sceneId: 'dup',
        entities: [
          { id: 'obj', name: 'Obj', parent: null, enabled: true, components: { Transform: { x: 1 } } },
        ],
      };

      const world = createTestWorld();
      const load1 = loadSceneData(scene, world, LOADER_CONFIG);
      const load2 = loadSceneData(scene, world, LOADER_CONFIG);

      expect(world.entityCount).toBe(2);
      expect(load1.entityIds[0]).not.toBe(load2.entityIds[0]);
    });
  });

  describe('large scene', () => {
    it('loads 200 entities correctly', () => {
      const entities = [];
      for (let i = 0; i < 200; i++) {
        entities.push({
          id: `e_${i}`,
          name: `Entity_${i}`,
          parent: null,
          enabled: true,
          components: {
            Transform: { x: i * 10, y: i * -5, rotation: i % 360, scaleX: 1, scaleY: 1 },
          },
        });
      }

      const scene: CompiledSceneData = { sceneId: 'large', entities };
      const world = createTestWorld();

      const loaded = loadSceneData(scene, world, LOADER_CONFIG);
      expect(loaded.entityCount).toBe(200);

      const transformId = world.registry.getId('Transform');
      for (let i = 0; i < 200; i++) {
        const eid = loaded.idMap.get(`e_${i}`)!;
        const idx = EntityManager.getIndex(eid);
        expect(world.storage.getField(transformId, 'x')[idx]).toBeCloseTo(i * 10);
        expect(world.storage.getField(transformId, 'y')[idx]).toBeCloseTo(i * -5);
      }
    });

    it('loads 500 entities via bundle round-trip', () => {
      const entities = [];
      for (let i = 0; i < 500; i++) {
        entities.push({
          id: `ent${i}`,
          name: `E${i}`,
          parent: null,
          enabled: true,
          components: {
            Transform: { x: i, y: -i },
            Sprite: { order: i % 100 },
          },
        });
      }

      const scene: CompiledSceneData = { sceneId: 'big', entities };
      const buf = bundleScene(scene, 99);
      const reader = new BundleReader(buf);
      const world = createTestWorld();

      const loaded = loadSceneFromBundle(reader, 99, world, LOADER_CONFIG);
      expect(loaded.entityCount).toBe(500);

      const spriteId = world.registry.getId('Sprite');
      const last = loaded.idMap.get('ent499')!;
      const lastIdx = EntityManager.getIndex(last);
      expect(world.storage.getField(spriteId, 'order')[lastIdx]).toBe(99);
    });
  });

  describe('Float32 precision boundaries', () => {
    it('handles large coordinate values', () => {
      const scene: CompiledSceneData = {
        sceneId: 'precision',
        entities: [{
          id: 'p1', name: 'P1', parent: null, enabled: true,
          components: { Transform: { x: 100000, y: -999999, rotation: 359.99 } },
        }],
      };

      const world = createTestWorld();
      const loaded = loadSceneData(scene, world, LOADER_CONFIG);
      const transformId = world.registry.getId('Transform');
      const idx = EntityManager.getIndex(loaded.entityIds[0]);

      expect(world.storage.getField(transformId, 'x')[idx]).toBeCloseTo(100000, 0);
      expect(world.storage.getField(transformId, 'y')[idx]).toBeCloseTo(-999999, 0);
      expect(world.storage.getField(transformId, 'rotation')[idx]).toBeCloseTo(359.99, 1);
    });

    it('handles very small values', () => {
      const scene: CompiledSceneData = {
        sceneId: 'small',
        entities: [{
          id: 's1', name: 'S1', parent: null, enabled: true,
          components: { Transform: { x: 0.001, y: 0.0001, scaleX: 0.01 } },
        }],
      };

      const world = createTestWorld();
      const loaded = loadSceneData(scene, world, LOADER_CONFIG);
      const transformId = world.registry.getId('Transform');
      const idx = EntityManager.getIndex(loaded.entityIds[0]);

      expect(world.storage.getField(transformId, 'x')[idx]).toBeCloseTo(0.001, 3);
      expect(world.storage.getField(transformId, 'y')[idx]).toBeCloseTo(0.0001, 4);
      expect(world.storage.getField(transformId, 'scaleX')[idx]).toBeCloseTo(0.01, 2);
    });
  });

  describe('default values', () => {
    it('unset fields get schema defaults', () => {
      const scene: CompiledSceneData = {
        sceneId: 'defaults',
        entities: [{
          id: 'd1', name: 'D1', parent: null, enabled: true,
          components: {
            Transform: { x: 5 },
            Camera: {},
          },
        }],
      };

      const world = createTestWorld();
      const loaded = loadSceneData(scene, world, LOADER_CONFIG);
      const transformId = world.registry.getId('Transform');
      const cameraId = world.registry.getId('Camera');
      const idx = EntityManager.getIndex(loaded.entityIds[0]);

      expect(world.storage.getField(transformId, 'x')[idx]).toBeCloseTo(5);
      // scaleX/scaleY default to 1
      expect(world.storage.getField(transformId, 'scaleX')[idx]).toBeCloseTo(1);
      expect(world.storage.getField(transformId, 'scaleY')[idx]).toBeCloseTo(1);

      // Camera defaults
      expect(world.storage.getField(cameraId, 'size')[idx]).toBeCloseTo(320);
      expect(world.storage.getField(cameraId, 'near')[idx]).toBeCloseTo(1);
      expect(world.storage.getField(cameraId, 'far')[idx]).toBeCloseTo(2000);
    });
  });
});

// Real project E2E: import → compile → load into ECS World
const COCOS_PROJECT = 'D:/majonggame';
const hasRealProject = existsSync(resolve(COCOS_PROJECT, 'assets'));
const TMP = resolve(__dirname, '../.tmp-correctness-test');

describe.skipIf(!hasRealProject)('real project: import → compile → load', () => {
  let bundleBuffer: ArrayBuffer;
  let manifest: any;

  beforeEach(() => {
    mkdirSync(resolve(TMP, 'scenes'), { recursive: true });

    const imported = importCocosProject(COCOS_PROJECT);
    writeFileSync(resolve(TMP, 'assets.json'), JSON.stringify(imported.assets, null, 2), 'utf-8');
    writeFileSync(resolve(TMP, 'import-report.json'), JSON.stringify(imported.report, null, 2), 'utf-8');
    for (const scene of imported.scenes) {
      writeFileSync(resolve(TMP, `scenes/${scene.sceneId}.scene.json`), JSON.stringify(scene, null, 2), 'utf-8');
    }

    const compiled = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    bundleBuffer = compiled.bundles.get('bundles/assets.wxpak')!;
    manifest = compiled.manifest;

    rmSync(TMP, { recursive: true });
  });

  it('all compiled scenes load into ECS World', () => {
    const reader = new BundleReader(bundleBuffer);
    const world = createTestWorld(4096);

    let totalEntities = 0;
    for (const entry of manifest.scenes) {
      const loaded = loadSceneFromBundle(reader, entry.assetId, world, LOADER_CONFIG);
      expect(loaded.sceneId).toBe(entry.sceneId);
      expect(loaded.entityCount).toBe(entry.entityCount);
      totalEntities += loaded.entityCount;
    }

    expect(world.entityCount).toBe(totalEntities);
  });

  it('all loaded entities have Transform component', () => {
    const reader = new BundleReader(bundleBuffer);
    const world = createTestWorld(4096);

    const transformId = world.registry.getId('Transform');

    for (const entry of manifest.scenes) {
      const loaded = loadSceneFromBundle(reader, entry.assetId, world, LOADER_CONFIG);
      for (const entityId of loaded.entityIds) {
        expect(world.hasComponent(entityId, transformId)).toBe(true);
      }
    }
  });
});
