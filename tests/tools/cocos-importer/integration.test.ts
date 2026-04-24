import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSceneFile } from '../../../tools/cocos-importer/scene-parser';
import { mapSceneNodes } from '../../../tools/cocos-importer/component-mapper';
import { importCocosProject } from '../../../tools/cocos-importer/importer';
import { validateScene, validateAssets, validateImportReport, CANONICAL_FORMATS, CANONICAL_VERSION } from '../../../src/canonical';

const COCOS_PROJECT = 'D:/majonggame';
const hasRealProject = existsSync(resolve(COCOS_PROJECT, 'assets'));

describe.skipIf(!hasRealProject)('real Cocos project integration', () => {
  it('parses Loading.scene without throwing', () => {
    const raw = readFileSync(resolve(COCOS_PROJECT, 'assets/Scene/Loading.scene'), 'utf-8');
    const json = JSON.parse(raw);
    const result = parseSceneFile(json);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.rootNodeIndices.length).toBeGreaterThan(0);
  });

  it('maps Loading.scene to valid canonical entities', () => {
    const raw = readFileSync(resolve(COCOS_PROJECT, 'assets/Scene/Loading.scene'), 'utf-8');
    const json = JSON.parse(raw);
    const parsed = parseSceneFile(json);
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'loading');

    expect(entities.length).toBeGreaterThan(0);

    const scene = {
      format: CANONICAL_FORMATS.scene,
      version: CANONICAL_VERSION,
      sceneId: 'loading',
      entities,
    };
    const result = validateScene(scene);
    expect(result.valid).toBe(true);
    if (!result.valid) {
      console.log('Validation errors:', result.errors);
    }
  });

  it('imports the full mahjong project', () => {
    const result = importCocosProject(COCOS_PROJECT);

    expect(result.scenes.length).toBe(3);
    expect(result.report.summary.sceneCount).toBe(3);
    expect(result.report.summary.entityCount).toBeGreaterThan(0);

    for (const scene of result.scenes) {
      const validation = validateScene(scene);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.log(`Scene ${scene.sceneId} validation errors:`, validation.errors);
      }
    }

    const assetsResult = validateAssets(result.assets);
    expect(assetsResult.valid).toBe(true);

    const reportResult = validateImportReport(result.report);
    expect(reportResult.valid).toBe(true);
  });

  it('reports unsupported components', () => {
    const result = importCocosProject(COCOS_PROJECT);
    const unsupported = result.report.issues.filter(i => i.code === 'UNSUPPORTED_COMPONENT');

    expect(unsupported.length).toBeGreaterThan(0);

    const compTypes = new Set(unsupported.map(i => i.component));
    console.log('Unsupported component types found:', [...compTypes].sort());
    console.log(`Total: ${result.report.summary.entityCount} entities, ${unsupported.length} unsupported components`);
  });

  it('scene entity ids are unique', () => {
    const result = importCocosProject(COCOS_PROJECT);
    for (const scene of result.scenes) {
      const ids = scene.entities.map(e => e.id);
      const unique = new Set(ids);
      if (unique.size !== ids.length) {
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        console.log(`Duplicate IDs in ${scene.sceneId}:`, dupes.slice(0, 5));
      }
      expect(unique.size).toBe(ids.length);
    }
  });
});
