import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { importCocosProject } from '../../../tools/cocos-importer/importer';
import { validateCanonicalDir } from '../../../tools/canonical/validate';
import { compileCanonicalDir } from '../../../tools/compiler/scene-compiler';
import { BundleReader } from '../../../src/asset/bundle-reader';
import { AssetType } from '../../../src/asset/bundle-format';
import { CANONICAL_FORMATS, CANONICAL_VERSION } from '../../../src/canonical';

const COCOS_PROJECT = 'D:/majonggame';
const hasRealProject = existsSync(resolve(COCOS_PROJECT, 'assets'));
const TMP = resolve(__dirname, '../../.tmp-e2e-test');

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

describe.skipIf(!hasRealProject)('end-to-end: import → validate → compile → read', () => {
  beforeAll(() => {
    mkdirSync(resolve(TMP, 'scenes'), { recursive: true });

    const imported = importCocosProject(COCOS_PROJECT);

    writeJson(resolve(TMP, 'assets.json'), imported.assets);
    writeJson(resolve(TMP, 'import-report.json'), imported.report);

    for (const scene of imported.scenes) {
      writeJson(resolve(TMP, `scenes/${scene.sceneId}.scene.json`), scene);
    }
  });

  afterAll(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  });

  it('validate passes on imported canonical output', () => {
    const result = validateCanonicalDir({ input: TMP });
    expect(result.invalidFiles).toBe(0);
    expect(result.validFiles).toBeGreaterThan(0);
  });

  it('compile produces valid bundles', () => {
    const result = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });

    expect(result.manifest.scenes.length).toBe(3);
    expect(result.report.errors).toHaveLength(0);
    expect(result.report.totalEntities).toBeGreaterThan(0);
  });

  it('compiled scenes can be read back from bundle', () => {
    const compiled = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    const bundleBuffer = compiled.bundles.get('bundles/assets.wxpak')!;
    const reader = new BundleReader(bundleBuffer);

    expect(reader.header.assetCount).toBe(3);

    const decoder = new TextDecoder();
    for (const entry of compiled.manifest.scenes) {
      const data = reader.getAssetData(entry.assetId);
      const sceneJson = JSON.parse(decoder.decode(data));

      expect(sceneJson.sceneId).toBe(entry.sceneId);
      expect(sceneJson.entities.length).toBe(entry.entityCount);
    }
  });

  it('round-trip preserves entity data', () => {
    const compiled = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    const bundleBuffer = compiled.bundles.get('bundles/assets.wxpak')!;
    const reader = new BundleReader(bundleBuffer);

    const loadingEntry = compiled.manifest.scenes.find(s => s.sceneId === 'Loading')!;
    const data = reader.getAssetData(loadingEntry.assetId);
    const decoder = new TextDecoder();
    const sceneJson = JSON.parse(decoder.decode(data));

    for (const entity of sceneJson.entities) {
      expect(typeof entity.id).toBe('string');
      expect(typeof entity.name).toBe('string');
      expect(typeof entity.enabled).toBe('boolean');
      expect(entity.components).toBeDefined();
      expect(entity.components.Transform).toBeDefined();
    }
  });

  it('all scene asset types are Scene', () => {
    const compiled = compileCanonicalDir({ input: TMP, output: resolve(TMP, 'build') });
    const bundleBuffer = compiled.bundles.get('bundles/assets.wxpak')!;
    const reader = new BundleReader(bundleBuffer);

    const sceneIds = reader.getAssetIdsByType(AssetType.Scene);
    expect(sceneIds.length).toBe(3);
  });
});
