import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { BundleWriter } from '../../src/asset/bundle-writer.js';
import { AssetType } from '../../src/asset/bundle-format.js';
import type {
  CanonicalSceneFile,
  CanonicalAssetsFile,
  CanonicalEntity,
} from '../../src/canonical/types.js';

export interface CompileOptions {
  input: string;
  output: string;
}

export interface SceneManifestEntry {
  sceneId: string;
  bundleFile: string;
  assetId: number;
  entityCount: number;
}

export interface CompileManifest {
  version: 1;
  scenes: SceneManifestEntry[];
  assetIdMap: Record<string, number>;
}

export interface CompileReport {
  version: 1;
  inputDir: string;
  outputDir: string;
  scenesCompiled: number;
  totalEntities: number;
  totalBundleBytes: number;
  errors: string[];
}

export interface CompileResult {
  manifest: CompileManifest;
  report: CompileReport;
  bundles: Map<string, ArrayBuffer>;
}

let nextAssetId = 1;

function allocateAssetId(): number {
  return nextAssetId++;
}

function resetAssetIdCounter(): void {
  nextAssetId = 1;
}

export interface CompiledSceneData {
  sceneId: string;
  entities: CompiledEntity[];
}

export interface CompiledEntity {
  id: string;
  name: string;
  parent: string | null;
  enabled: boolean;
  components: Record<string, Record<string, unknown>>;
}

function compileEntity(e: CanonicalEntity): CompiledEntity {
  return {
    id: e.id,
    name: e.name ?? e.id,
    parent: e.parent ?? null,
    enabled: e.enabled !== false,
    components: { ...e.components } as Record<string, Record<string, unknown>>,
  };
}

function compileScene(scene: CanonicalSceneFile): { data: Uint8Array; compiled: CompiledSceneData } {
  const compiled: CompiledSceneData = {
    sceneId: scene.sceneId,
    entities: scene.entities.map(compileEntity),
  };

  const jsonStr = JSON.stringify(compiled);
  const encoder = new TextEncoder();
  return { data: encoder.encode(jsonStr), compiled };
}

export function compileCanonicalDir(opts: CompileOptions): CompileResult {
  const { input, output } = opts;

  resetAssetIdCounter();

  const assetsPath = resolve(input, 'assets.json');
  let assetsFile: CanonicalAssetsFile | null = null;
  if (existsSync(assetsPath)) {
    assetsFile = JSON.parse(readFileSync(assetsPath, 'utf-8')) as CanonicalAssetsFile;
  }

  const sceneEntries = assetsFile?.scenes ?? [];
  const errors: string[] = [];
  const manifestScenes: SceneManifestEntry[] = [];
  const assetIdMap: Record<string, number> = {};
  const bundles = new Map<string, ArrayBuffer>();
  let totalEntities = 0;
  let totalBundleBytes = 0;

  const writer = new BundleWriter();

  for (const entry of sceneEntries) {
    const scenePath = resolve(input, entry.path);
    if (!existsSync(scenePath)) {
      errors.push(`Scene file not found: ${entry.path}`);
      continue;
    }

    let sceneFile: CanonicalSceneFile;
    try {
      sceneFile = JSON.parse(readFileSync(scenePath, 'utf-8')) as CanonicalSceneFile;
    } catch (e) {
      errors.push(`Failed to parse scene: ${entry.path}`);
      continue;
    }

    const assetId = allocateAssetId();
    assetIdMap[entry.id] = assetId;

    const { data } = compileScene(sceneFile);
    writer.addAsset(assetId, AssetType.Scene, data);

    totalEntities += sceneFile.entities.length;

    manifestScenes.push({
      sceneId: entry.id,
      bundleFile: 'bundles/assets.wxpak',
      assetId,
      entityCount: sceneFile.entities.length,
    });
  }

  const bundleBuffer = writer.serialize();
  bundles.set('bundles/assets.wxpak', bundleBuffer);
  totalBundleBytes = bundleBuffer.byteLength;

  const manifest: CompileManifest = {
    version: 1,
    scenes: manifestScenes,
    assetIdMap,
  };

  const report: CompileReport = {
    version: 1,
    inputDir: input,
    outputDir: output,
    scenesCompiled: manifestScenes.length,
    totalEntities,
    totalBundleBytes,
    errors,
  };

  return { manifest, report, bundles };
}
