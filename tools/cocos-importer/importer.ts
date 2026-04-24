import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { parseSceneFile } from './scene-parser.js';
import { mapSceneNodes } from './component-mapper.js';
import {
  CANONICAL_FORMATS,
  CANONICAL_VERSION,
  type CanonicalSceneFile,
  type CanonicalAssetsFile,
  type ImportReportFile,
  type ImportIssue,
} from '../../src/canonical/types.js';

export interface ImportResult {
  scenes: CanonicalSceneFile[];
  assets: CanonicalAssetsFile;
  report: ImportReportFile;
}

export function importCocosProject(projectRoot: string): ImportResult {
  const assetsDir = resolve(projectRoot, 'assets');
  if (!existsSync(assetsDir)) {
    throw new Error(`Cocos project assets directory not found: ${assetsDir}`);
  }

  const sceneFiles = findFiles(assetsDir, '.scene');
  const allIssues: ImportIssue[] = [];
  const scenes: CanonicalSceneFile[] = [];
  let totalEntityCount = 0;

  for (const scenePath of sceneFiles) {
    const raw = readFileSync(scenePath, 'utf-8');
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      allIssues.push({
        severity: 'error',
        code: 'PARSE_ERROR',
        message: `Failed to parse scene file: ${scenePath}`,
      });
      continue;
    }

    const sceneId = basename(scenePath, '.scene').replace(/[^A-Za-z0-9_./:@-]/g, '_');
    const parsed = parseSceneFile(json);
    const { entities, issues } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, sceneId);

    allIssues.push(...issues);
    totalEntityCount += entities.length;

    const scene: CanonicalSceneFile = {
      format: CANONICAL_FORMATS.scene,
      version: CANONICAL_VERSION,
      sceneId,
      name: sceneId,
      metadata: {
        source: 'cocos',
        sourceFile: scenePath,
      },
      entities,
    };

    scenes.push(scene);
  }

  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const unsupportedCount = allIssues.filter(i => i.code === 'UNSUPPORTED_COMPONENT').length;

  const assets: CanonicalAssetsFile = {
    format: CANONICAL_FORMATS.assets,
    version: CANONICAL_VERSION,
    scenes: scenes.map(s => ({
      id: s.sceneId,
      path: `scenes/${s.sceneId}.scene.json`,
    })),
    atlases: [],
    audio: [],
  };

  const report: ImportReportFile = {
    format: CANONICAL_FORMATS.importReport,
    version: CANONICAL_VERSION,
    source: {
      kind: 'cocos',
      root: projectRoot,
    },
    summary: {
      sceneCount: scenes.length,
      entityCount: totalEntityCount,
      warningCount,
      unsupportedCount,
    },
    issues: allIssues,
  };

  return { scenes, assets, report };
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];

  function walk(d: string): void {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = resolve(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (extname(entry.name) === ext) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}
