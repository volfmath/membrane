import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { compileCanonicalDir } from '../../../tools/compiler/scene-compiler';
import { BundleReader } from '../../../src/asset/bundle-reader';
import { AssetType } from '../../../src/asset/bundle-format';
import { CANONICAL_FORMATS, CANONICAL_VERSION } from '../../../src/canonical';

const TMP = resolve(__dirname, '../../.tmp-compile-test');

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

const SCENE_DATA = {
  format: CANONICAL_FORMATS.scene,
  version: CANONICAL_VERSION,
  sceneId: 'level_01',
  name: 'Level 01',
  entities: [
    {
      id: 'cam',
      name: 'Main Camera',
      parent: null,
      enabled: true,
      components: {
        Transform: { x: 0, y: 0 },
        Camera: { mode: 'orthographic', size: 320, clearColor: '#1A1A2EFF' },
      },
    },
    {
      id: 'player',
      name: 'Player',
      parent: null,
      enabled: true,
      components: {
        Transform: { x: 100, y: 200 },
        Sprite: { atlas: 'main', frame: 'player_idle', order: 10 },
        Tags: { values: ['player'] },
      },
    },
  ],
};

beforeAll(() => {
  mkdirSync(resolve(TMP, 'scenes'), { recursive: true });

  writeJson(resolve(TMP, 'assets.json'), {
    format: CANONICAL_FORMATS.assets,
    version: CANONICAL_VERSION,
    scenes: [{ id: 'level_01', path: 'scenes/level_01.scene.json' }],
    atlases: [],
    audio: [],
  });

  writeJson(resolve(TMP, 'scenes/level_01.scene.json'), SCENE_DATA);
});

afterAll(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

describe('compileCanonicalDir', () => {
  it('compiles a canonical directory into a bundle', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });

    expect(result.manifest.version).toBe(1);
    expect(result.manifest.scenes).toHaveLength(1);
    expect(result.manifest.scenes[0].sceneId).toBe('level_01');
    expect(result.manifest.scenes[0].entityCount).toBe(2);
  });

  it('produces a valid WXGE bundle', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    const bundleBuffer = result.bundles.get('bundles/assets.wxpak')!;

    expect(bundleBuffer).toBeDefined();
    expect(bundleBuffer.byteLength).toBeGreaterThan(0);

    const reader = new BundleReader(bundleBuffer);
    expect(reader.header.magic).toBe(0x57584745);
    expect(reader.header.assetCount).toBe(1);
  });

  it('stores scene data as AssetType.Scene', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    const bundleBuffer = result.bundles.get('bundles/assets.wxpak')!;
    const reader = new BundleReader(bundleBuffer);

    const sceneAssetId = result.manifest.scenes[0].assetId;
    const entry = reader.getEntry(sceneAssetId)!;
    expect(entry).not.toBeNull();
    expect(entry.assetType).toBe(AssetType.Scene);
  });

  it('scene data can be decoded back to JSON', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    const bundleBuffer = result.bundles.get('bundles/assets.wxpak')!;
    const reader = new BundleReader(bundleBuffer);

    const sceneAssetId = result.manifest.scenes[0].assetId;
    const data = reader.getAssetData(sceneAssetId);
    const decoder = new TextDecoder();
    const sceneJson = JSON.parse(decoder.decode(data));

    expect(sceneJson.sceneId).toBe('level_01');
    expect(sceneJson.entities).toHaveLength(2);
    expect(sceneJson.entities[0].id).toBe('cam');
    expect(sceneJson.entities[1].id).toBe('player');
    expect(sceneJson.entities[1].components.Transform.x).toBe(100);
    expect(sceneJson.entities[1].components.Sprite.atlas).toBe('main');
  });

  it('builds assetIdMap in manifest', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    expect(result.manifest.assetIdMap['level_01']).toBeDefined();
    expect(typeof result.manifest.assetIdMap['level_01']).toBe('number');
  });

  it('generates compile report', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });

    expect(result.report.scenesCompiled).toBe(1);
    expect(result.report.totalEntities).toBe(2);
    expect(result.report.totalBundleBytes).toBeGreaterThan(0);
    expect(result.report.errors).toHaveLength(0);
  });

  it('reports missing scene files', () => {
    const badDir = resolve(TMP, '../.tmp-compile-bad');
    mkdirSync(resolve(badDir, 'scenes'), { recursive: true });
    writeJson(resolve(badDir, 'assets.json'), {
      format: CANONICAL_FORMATS.assets,
      version: CANONICAL_VERSION,
      scenes: [{ id: 'missing', path: 'scenes/missing.scene.json' }],
      atlases: [],
      audio: [],
    });

    try {
      const result = compileCanonicalDir({ input: badDir, output: resolve(badDir, 'build') });
      expect(result.report.errors.length).toBeGreaterThan(0);
      expect(result.report.errors[0]).toContain('not found');
    } finally {
      rmSync(badDir, { recursive: true });
    }
  });

  it('handles multiple scenes', () => {
    const multiDir = resolve(TMP, '../.tmp-compile-multi');
    mkdirSync(resolve(multiDir, 'scenes'), { recursive: true });

    writeJson(resolve(multiDir, 'assets.json'), {
      format: CANONICAL_FORMATS.assets,
      version: CANONICAL_VERSION,
      scenes: [
        { id: 'scene_a', path: 'scenes/scene_a.scene.json' },
        { id: 'scene_b', path: 'scenes/scene_b.scene.json' },
      ],
      atlases: [],
      audio: [],
    });

    writeJson(resolve(multiDir, 'scenes/scene_a.scene.json'), {
      format: CANONICAL_FORMATS.scene, version: CANONICAL_VERSION,
      sceneId: 'scene_a', entities: [{ id: 'a1', components: { Transform: {} } }],
    });
    writeJson(resolve(multiDir, 'scenes/scene_b.scene.json'), {
      format: CANONICAL_FORMATS.scene, version: CANONICAL_VERSION,
      sceneId: 'scene_b', entities: [{ id: 'b1', components: { Transform: {} } }, { id: 'b2', components: { Transform: {} } }],
    });

    try {
      const result = compileCanonicalDir({ input: multiDir, output: resolve(multiDir, 'build') });
      expect(result.manifest.scenes).toHaveLength(2);
      expect(result.report.totalEntities).toBe(3);

      const bundleBuffer = result.bundles.get('bundles/assets.wxpak')!;
      const reader = new BundleReader(bundleBuffer);
      expect(reader.header.assetCount).toBe(2);
    } finally {
      rmSync(multiDir, { recursive: true });
    }
  });
});
