import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  validateScene,
  validatePrefab,
  validateAssets,
  validateImportReport,
  CANONICAL_FORMATS,
  CANONICAL_VERSION,
} from '../../src/canonical';

const FIXTURES = resolve(__dirname, '../fixtures/canonical');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

// ── Scene Validation ─────────────────────────────────────────────

describe('validateScene', () => {
  it('accepts a valid minimal scene', () => {
    const scene = loadFixture('min-scene.scene.json');
    const result = validateScene(scene);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a bare-minimum scene (1 entity, no events)', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: CANONICAL_VERSION,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Transform: { x: 0, y: 0 } } },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects wrong format', () => {
    const result = validateScene({
      format: 'wrong.format',
      version: 1,
      sceneId: 'test',
      entities: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'format')).toBe(true);
  });

  it('rejects wrong version', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 99,
      sceneId: 'test',
      entities: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'version')).toBe(true);
  });

  it('rejects missing sceneId', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      entities: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'sceneId')).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateScene(null).valid).toBe(false);
    expect(validateScene('string').valid).toBe(false);
    expect(validateScene(42).valid).toBe(false);
  });

  it('detects duplicate entity ids', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'dup', components: { Transform: {} } },
        { id: 'dup', components: { Transform: {} } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('duplicate'))).toBe(true);
  });

  it('detects dangling parent reference', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'child', parent: 'nonexistent', components: { Transform: {} } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('unknown entity'))).toBe(true);
  });

  it('validates parent references between entities', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'parent_node', components: { Transform: {} } },
        { id: 'child_node', parent: 'parent_node', components: { Transform: {} } },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid entity id format', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'has spaces', components: { Transform: {} } },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects entity with invalid component name', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { '123bad': {} } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('invalid component name'))).toBe(true);
  });

  it('validates Sprite requires atlas and frame', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Sprite: { order: 1 } } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('Sprite.atlas'))).toBe(true);
    expect(result.errors.some(e => e.path.includes('Sprite.frame'))).toBe(true);
  });

  it('validates Sprite color format', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Sprite: { atlas: 'a', frame: 'f', color: 'red' } } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('Sprite.color'))).toBe(true);
  });

  it('accepts valid Sprite color #RRGGBBAA', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Sprite: { atlas: 'a', frame: 'f', color: '#FF0000FF' } } },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('validates Camera mode must be orthographic or perspective', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Camera: { mode: 'isometric' } } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('Camera.mode'))).toBe(true);
  });

  it('validates Tags.values must be an array', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Tags: { values: 'not-array' } } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('Tags.values'))).toBe(true);
  });

  it('validates PrefabRef requires prefabId', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { PrefabRef: {} } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('PrefabRef.prefabId'))).toBe(true);
  });

  it('validates events structure', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [],
      events: [
        { id: 'ev1', on: 'trigger', do: 'action' },
        { id: 'ev2', on: 'trigger2', do: ['a1', 'a2'] },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects event with missing fields', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [],
      events: [{ id: 'ev1' }],
    });
    expect(result.valid).toBe(false);
  });

  it('allows custom/unknown components', () => {
    const result = validateScene({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: { Transform: {}, CustomHealth: { hp: 100 } } },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

// ── Prefab Validation ────────────────────────────────────────────

describe('validatePrefab', () => {
  it('accepts a valid prefab fixture', () => {
    const prefab = loadFixture('enemy.prefab.json');
    const result = validatePrefab(prefab);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects wrong format', () => {
    const result = validatePrefab({
      format: CANONICAL_FORMATS.scene,
      version: 1,
      prefabId: 'test',
      entities: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'format')).toBe(true);
  });

  it('rejects missing prefabId', () => {
    const result = validatePrefab({
      format: CANONICAL_FORMATS.prefab,
      version: 1,
      entities: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'prefabId')).toBe(true);
  });

  it('validates parent references within prefab', () => {
    const result = validatePrefab({
      format: CANONICAL_FORMATS.prefab,
      version: 1,
      prefabId: 'test',
      entities: [
        { id: 'root', components: { Transform: {} } },
        { id: 'child', parent: 'root', components: { Transform: {} } },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

// ── Assets Validation ────────────────────────────────────────────

describe('validateAssets', () => {
  it('accepts a valid assets fixture', () => {
    const assets = loadFixture('assets.json');
    const result = validateAssets(assets);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects wrong format', () => {
    const result = validateAssets({
      format: 'wrong',
      version: 1,
      scenes: [],
      atlases: [],
      audio: [],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects missing scenes array', () => {
    const result = validateAssets({
      format: CANONICAL_FORMATS.assets,
      version: 1,
      atlases: [],
      audio: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'scenes')).toBe(true);
  });

  it('validates scene path entries', () => {
    const result = validateAssets({
      format: CANONICAL_FORMATS.assets,
      version: 1,
      scenes: [{ id: 'test', path: '' }],
      atlases: [],
      audio: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('scenes[0].path'))).toBe(true);
  });

  it('validates atlas dimensions', () => {
    const result = validateAssets({
      format: CANONICAL_FORMATS.assets,
      version: 1,
      scenes: [],
      atlases: [{ id: 'a', image: 'tex.png', width: 0, height: 1024, frames: [] }],
      audio: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('width'))).toBe(true);
  });

  it('validates frame fields', () => {
    const result = validateAssets({
      format: CANONICAL_FORMATS.assets,
      version: 1,
      scenes: [],
      atlases: [{
        id: 'a', image: 'tex.png', width: 1024, height: 1024,
        frames: [{ id: 'f1', x: 0, y: 0, width: 'bad', height: 64 }],
      }],
      audio: [],
    });
    expect(result.valid).toBe(false);
  });

  it('validates audio kind enum', () => {
    const result = validateAssets({
      format: CANONICAL_FORMATS.assets,
      version: 1,
      scenes: [],
      atlases: [],
      audio: [{ id: 'a', path: 'test.mp3', kind: 'invalid' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('audio[0].kind'))).toBe(true);
  });

  it('accepts all valid audio kinds', () => {
    const result = validateAssets({
      format: CANONICAL_FORMATS.assets,
      version: 1,
      scenes: [],
      atlases: [],
      audio: [
        { id: 'a1', path: 'a.mp3', kind: 'bgm' },
        { id: 'a2', path: 'b.wav', kind: 'sfx' },
        { id: 'a3', path: 'c.ogg', kind: 'voice' },
        { id: 'a4', path: 'd.mp3', kind: 'ambient' },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

// ── Import Report Validation ─────────────────────────────────────

describe('validateImportReport', () => {
  it('accepts a valid import report fixture', () => {
    const report = loadFixture('import-report.json');
    const result = validateImportReport(report);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects wrong format', () => {
    const result = validateImportReport({
      format: 'wrong',
      version: 1,
      source: { kind: 'cocos', root: '.' },
      summary: { sceneCount: 0, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
      issues: [],
    });
    expect(result.valid).toBe(false);
  });

  it('validates source.kind enum', () => {
    const result = validateImportReport({
      format: CANONICAL_FORMATS.importReport,
      version: 1,
      source: { kind: 'godot', root: '.' },
      summary: { sceneCount: 0, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
      issues: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'source.kind')).toBe(true);
  });

  it('validates summary fields are non-negative', () => {
    const result = validateImportReport({
      format: CANONICAL_FORMATS.importReport,
      version: 1,
      source: { kind: 'cocos', root: '.' },
      summary: { sceneCount: -1, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
      issues: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'summary.sceneCount')).toBe(true);
  });

  it('validates issue severity enum', () => {
    const result = validateImportReport({
      format: CANONICAL_FORMATS.importReport,
      version: 1,
      source: { kind: 'cocos', root: '.' },
      summary: { sceneCount: 0, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
      issues: [{ severity: 'critical', code: 'X', message: 'test' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('severity'))).toBe(true);
  });

  it('validates issue requires code and message', () => {
    const result = validateImportReport({
      format: CANONICAL_FORMATS.importReport,
      version: 1,
      source: { kind: 'cocos', root: '.' },
      summary: { sceneCount: 0, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
      issues: [{ severity: 'warning' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('code'))).toBe(true);
    expect(result.errors.some(e => e.path.includes('message'))).toBe(true);
  });

  it('accepts all source kinds', () => {
    for (const kind of ['cocos', 'unity', 'custom']) {
      const result = validateImportReport({
        format: CANONICAL_FORMATS.importReport,
        version: 1,
        source: { kind, root: '.' },
        summary: { sceneCount: 0, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
        issues: [],
      });
      expect(result.valid).toBe(true);
    }
  });

  it('accepts empty issues array', () => {
    const result = validateImportReport({
      format: CANONICAL_FORMATS.importReport,
      version: 1,
      source: { kind: 'cocos', root: '.' },
      summary: { sceneCount: 0, entityCount: 0, warningCount: 0, unsupportedCount: 0 },
      issues: [],
    });
    expect(result.valid).toBe(true);
  });
});
