import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateCanonicalDir, formatValidateResult } from '../../../tools/canonical/validate';
import { CANONICAL_FORMATS, CANONICAL_VERSION } from '../../../src/canonical';

const TMP = resolve(__dirname, '../../.tmp-validate-test');

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

beforeAll(() => {
  mkdirSync(resolve(TMP, 'scenes'), { recursive: true });
  mkdirSync(resolve(TMP, 'prefabs'), { recursive: true });

  writeJson(resolve(TMP, 'assets.json'), {
    format: CANONICAL_FORMATS.assets,
    version: CANONICAL_VERSION,
    scenes: [{ id: 'level_01', path: 'scenes/level_01.scene.json' }],
    atlases: [],
    audio: [],
  });

  writeJson(resolve(TMP, 'scenes/level_01.scene.json'), {
    format: CANONICAL_FORMATS.scene,
    version: CANONICAL_VERSION,
    sceneId: 'level_01',
    entities: [
      { id: 'cam', components: { Camera: { mode: 'orthographic' } } },
      { id: 'player', components: { Transform: { x: 10, y: 20 }, Sprite: { atlas: 'main', frame: 'idle' } } },
    ],
  });

  writeJson(resolve(TMP, 'import-report.json'), {
    format: CANONICAL_FORMATS.importReport,
    version: CANONICAL_VERSION,
    source: { kind: 'cocos', root: '.' },
    summary: { sceneCount: 1, entityCount: 2, warningCount: 0, unsupportedCount: 0 },
    issues: [],
  });
});

afterAll(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

describe('validateCanonicalDir', () => {
  it('validates a valid canonical directory', () => {
    const result = validateCanonicalDir({ input: TMP });
    expect(result.totalFiles).toBe(3);
    expect(result.validFiles).toBe(3);
    expect(result.invalidFiles).toBe(0);
  });

  it('reports all files checked', () => {
    const result = validateCanonicalDir({ input: TMP });
    expect(result.results.has('assets.json')).toBe(true);
    expect(result.results.has('import-report.json')).toBe(true);
    expect(result.results.has('scenes/level_01.scene.json')).toBe(true);
  });

  it('throws on missing directory', () => {
    expect(() => validateCanonicalDir({ input: '/nonexistent' })).toThrow('not found');
  });

  it('detects invalid scene files', () => {
    const badDir = resolve(TMP, '../.tmp-validate-bad');
    mkdirSync(resolve(badDir, 'scenes'), { recursive: true });
    writeJson(resolve(badDir, 'scenes/bad.scene.json'), {
      format: 'wrong',
      version: 1,
      sceneId: 'bad',
      entities: [],
    });

    try {
      const result = validateCanonicalDir({ input: badDir });
      expect(result.invalidFiles).toBe(1);
    } finally {
      rmSync(badDir, { recursive: true });
    }
  });
});

describe('formatValidateResult', () => {
  it('formats a passing result', () => {
    const result = validateCanonicalDir({ input: TMP });
    const output = formatValidateResult(result);

    expect(output).toContain('3 valid');
    expect(output).toContain('0 invalid');
    expect(output).toContain('OK');
  });
});
