import { describe, it, expect } from 'vitest';
import { BundleWriter } from '../../src/asset/bundle-writer';
import { BundleReader } from '../../src/asset/bundle-reader';
import { AssetType } from '../../src/asset/bundle-format';
import { World } from '../../src/ecs/world';
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
  visible: { type: Uint8Array, default: 1 },
};

const LOADER_CONFIG: SceneLoaderConfig = {
  componentFieldMap: new Map([
    ['Transform', ['x', 'y', 'rotation', 'scaleX', 'scaleY']],
    ['Sprite', ['order', 'visible']],
  ]),
};

function makeScene(entityCount: number, sceneId: string): CompiledSceneData {
  const entities = [];
  for (let i = 0; i < entityCount; i++) {
    entities.push({
      id: `e${i}`,
      name: `Entity${i}`,
      parent: null,
      enabled: true,
      components: {
        Transform: { x: i * 10, y: -i * 5, rotation: i % 360, scaleX: 1, scaleY: 1 },
        Sprite: { order: i % 100, visible: 1 },
      },
    });
  }
  return { sceneId, entities };
}

function bench(label: string, fn: () => void, iterations: number): number {
  fn(); // warmup
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const perOp = elapsed / iterations;
  console.log(`  [bench] ${label}: ${perOp.toFixed(3)}ms (${iterations}x, total ${elapsed.toFixed(1)}ms)`);
  return perOp;
}

describe('bundle load benchmark', () => {
  describe('bundle write speed', () => {
    it('write 50 scenes (20 entities each) into a single bundle', () => {
      const encoder = new TextEncoder();
      const scenes: Uint8Array[] = [];
      for (let s = 0; s < 50; s++) {
        scenes.push(encoder.encode(JSON.stringify(makeScene(20, `scene_${s}`))));
      }

      const ms = bench('write 50 scenes to bundle', () => {
        const writer = new BundleWriter();
        for (let s = 0; s < 50; s++) {
          writer.addAsset(s + 1, AssetType.Scene, scenes[s]);
        }
        writer.serialize();
      }, 50);

      expect(ms).toBeLessThan(50);
    });
  });

  describe('bundle read speed', () => {
    it('read 50 scenes from bundle', () => {
      const encoder = new TextEncoder();
      const writer = new BundleWriter();
      for (let s = 0; s < 50; s++) {
        writer.addAsset(s + 1, AssetType.Scene, encoder.encode(JSON.stringify(makeScene(20, `scene_${s}`))));
      }
      const bundleBuffer = writer.serialize();

      const ms = bench('read 50 scenes from bundle', () => {
        const reader = new BundleReader(bundleBuffer);
        const decoder = new TextDecoder();
        for (let s = 0; s < 50; s++) {
          const data = reader.getAssetData(s + 1);
          JSON.parse(decoder.decode(data));
        }
      }, 100);

      expect(ms).toBeLessThan(20);
    });
  });

  describe('scene instantiate speed', () => {
    it('loadSceneData: 50-entity scene x 100', () => {
      const scene = makeScene(50, 'perf');

      const ms = bench('loadSceneData (50 entities, x100)', () => {
        const world = new World({ maxEntities: 100 });
        world.registry.register('Transform', TRANSFORM_SCHEMA);
        world.registry.register('Sprite', SPRITE_SCHEMA);
        loadSceneData(scene, world, LOADER_CONFIG);
      }, 100);

      expect(ms).toBeLessThan(10);
    });

    it('loadSceneFromBundle: 50-entity scene x 100', () => {
      const scene = makeScene(50, 'perf');
      const encoder = new TextEncoder();
      const writer = new BundleWriter();
      writer.addAsset(1, AssetType.Scene, encoder.encode(JSON.stringify(scene)));
      const bundleBuffer = writer.serialize();

      const ms = bench('loadSceneFromBundle (50 entities, x100)', () => {
        const world = new World({ maxEntities: 100 });
        world.registry.register('Transform', TRANSFORM_SCHEMA);
        world.registry.register('Sprite', SPRITE_SCHEMA);
        const reader = new BundleReader(bundleBuffer);
        loadSceneFromBundle(reader, 1, world, LOADER_CONFIG);
      }, 100);

      expect(ms).toBeLessThan(15);
    });
  });

  describe('bundle size statistics', () => {
    it('reports bundle sizes for different entity counts', () => {
      const encoder = new TextEncoder();
      const sizes: { entities: number; bytes: number; bytesPerEntity: number }[] = [];

      for (const count of [10, 50, 100, 200, 500]) {
        const scene = makeScene(count, `size_${count}`);
        const writer = new BundleWriter();
        writer.addAsset(1, AssetType.Scene, encoder.encode(JSON.stringify(scene)));
        const buf = writer.serialize();

        sizes.push({
          entities: count,
          bytes: buf.byteLength,
          bytesPerEntity: Math.round(buf.byteLength / count),
        });
      }

      console.log('  [bench] Bundle sizes:');
      for (const s of sizes) {
        console.log(`    ${s.entities} entities → ${s.bytes} bytes (${s.bytesPerEntity} bytes/entity)`);
      }

      // Sanity: more entities → larger bundle
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i].bytes).toBeGreaterThan(sizes[i - 1].bytes);
      }

      // Bytes per entity should be reasonable (< 500 bytes each with Transform+Sprite)
      for (const s of sizes) {
        expect(s.bytesPerEntity).toBeLessThan(500);
      }
    });
  });
});
