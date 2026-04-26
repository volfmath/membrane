/**
 * scene-audit.ts
 *
 * Compares the Cocos importer output (ground truth) against the compiled
 * wx-project/assets/scene-data.js, reports all diffs, and auto-rebuilds
 * when systemic gaps are detected.
 *
 * Run:  npx tsx tools/scene-audit.ts [--fix]
 *       --fix  triggers `pnpm build:compile-fixture` after the report
 */

import { execSync } from 'child_process';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { importCocosProject } from './cocos-importer/importer';
import type { CanonicalEntity, TransformComponent } from '../src/canonical/types';
import type { CompiledFixtureData, CompiledEntity } from '../src/canonical/loader-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COCOS_PROJECT = 'D:/majonggame';
const FIXTURE_PATH = resolve(__dirname, '../wx-project/assets/scene-data.js');
const EPSILON = 0.01;

// ─── ANSI colours ────────────────────────────────────────────────────────────
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const C = (s: string) => `\x1b[36m${s}\x1b[0m`;
const B = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ─── Load compiled fixture ────────────────────────────────────────────────────
const req = createRequire(import.meta.url);
let fixture: CompiledFixtureData;
try {
  fixture = req(FIXTURE_PATH) as CompiledFixtureData;
} catch (e) {
  console.error(R('✗ Cannot load compiled fixture:'), FIXTURE_PATH);
  process.exit(1);
}

// ─── Build ground truth from Cocos importer ───────────────────────────────────
console.log(C('● Importing Cocos project…'));
const imported = importCocosProject(COCOS_PROJECT);
console.log(G(`  ✓ ${imported.scenes.length} scenes, ${imported.report.summary.entityCount} entities`));

// ─── Types ────────────────────────────────────────────────────────────────────
interface Diff {
  sceneId: string;
  entityId: string;
  field: string;
  truth: unknown;
  got: unknown;
}

const diffs: Diff[] = [];
let missingFromCompiled = 0;
let extraInCompiled = 0;

function addDiff(sceneId: string, entityId: string, field: string, truth: unknown, got: unknown) {
  diffs.push({ sceneId, entityId, field, truth, got });
}

function near(a: number | undefined, b: number | undefined, def = 0): boolean {
  return Math.abs((a ?? def) - (b ?? def)) < EPSILON;
}

function fmtNum(n: number | undefined, def = 0): string {
  return (n ?? def).toFixed(2);
}

// ─── Per-entity comparison ────────────────────────────────────────────────────
function compareTransform(
  sceneId: string,
  id: string,
  truth: TransformComponent,
  got: Record<string, unknown>,
) {
  const numFields: Array<[keyof TransformComponent, number]> = [
    ['x', 0], ['y', 0], ['z', 0],
    ['rotationX', 0], ['rotationY', 0], ['rotation', 0],
    ['scaleX', 1], ['scaleY', 1], ['scaleZ', 1],
    ['anchorX', 0.5], ['anchorY', 0.5],
    ['width', 0], ['height', 0],
  ];
  for (const [key, def] of numFields) {
    const tv = truth[key] as number | undefined;
    const gv = got[key] as number | undefined;
    if (!near(tv, gv, def)) {
      addDiff(sceneId, id, `Transform.${key}`,
        fmtNum(tv, def), fmtNum(gv, def));
    }
  }
}

function compareSprite(
  sceneId: string,
  id: string,
  truth: { atlas: string; frame: string; color?: string },
  got: Record<string, unknown>,
) {
  if (truth.atlas !== got['atlas']) addDiff(sceneId, id, 'Sprite.atlas', truth.atlas, got['atlas']);
  if (truth.frame !== got['frame']) addDiff(sceneId, id, 'Sprite.frame', truth.frame, got['frame']);
  if ((truth.color ?? undefined) !== (got['color'] as string | undefined))
    addDiff(sceneId, id, 'Sprite.color', truth.color, got['color']);
}

function compareLabel(
  sceneId: string,
  id: string,
  truth: { text: string; fontSize?: number; align?: string; vAlign?: string; wrap?: boolean },
  got: Record<string, unknown>,
) {
  if (truth.text !== got['text']) addDiff(sceneId, id, 'Label.text', truth.text, got['text']);
  if ((truth.fontSize ?? 0) !== (got['fontSize'] ?? 0))
    addDiff(sceneId, id, 'Label.fontSize', truth.fontSize, got['fontSize']);
  if ((truth.align ?? 'left') !== (got['align'] ?? 'left'))
    addDiff(sceneId, id, 'Label.align', truth.align, got['align']);
}

function compareEntities(
  sceneId: string,
  truthEntities: CanonicalEntity[],
  compiledEntities: CompiledEntity[],
) {
  const compiledById = new Map<string, CompiledEntity>(
    compiledEntities.map(e => [e.id, e]),
  );
  const truthById = new Map<string, CanonicalEntity>(
    truthEntities.map(e => [e.id!, e]),
  );

  // entities missing from compiled output
  for (const te of truthEntities) {
    if (!compiledById.has(te.id!)) {
      missingFromCompiled++;
      addDiff(sceneId, te.id!, '⚠ entity', 'present', 'MISSING');
    }
  }

  // entities present in compiled but not in truth
  for (const ce of compiledEntities) {
    if (!truthById.has(ce.id)) {
      extraInCompiled++;
      addDiff(sceneId, ce.id, '⚠ entity', 'EXTRA', 'not in importer');
    }
  }

  // field-level comparison for shared entities
  for (const te of truthEntities) {
    const ce = compiledById.get(te.id!);
    if (!ce) continue;

    // enabled
    const te_enabled = te.enabled !== false;
    if (te_enabled !== ce.enabled) {
      addDiff(sceneId, te.id!, 'enabled', te_enabled, ce.enabled);
    }

    // parent
    if ((te.parent ?? null) !== ce.parent) {
      addDiff(sceneId, te.id!, 'parent', te.parent ?? null, ce.parent);
    }

    // Transform
    const tTransform = te.components.Transform ?? {};
    const cTransform = (ce.components['Transform'] ?? {}) as Record<string, unknown>;
    compareTransform(sceneId, te.id!, tTransform, cTransform);

    // Sprite
    if (te.components.Sprite) {
      if (!ce.components['Sprite']) {
        addDiff(sceneId, te.id!, 'Sprite', 'present', 'MISSING');
      } else {
        compareSprite(sceneId, te.id!, te.components.Sprite, ce.components['Sprite'] as Record<string, unknown>);
      }
    }

    // Label
    if (te.components.Label) {
      if (!ce.components['Label']) {
        addDiff(sceneId, te.id!, 'Label', 'present', 'MISSING');
      } else {
        compareLabel(sceneId, te.id!, te.components.Label, ce.components['Label'] as Record<string, unknown>);
      }
    }

    // Button presence
    if (te.components.Button && !ce.components['Button']) {
      addDiff(sceneId, te.id!, 'Button', 'present', 'MISSING');
    }
  }
}

// ─── Run comparison across all scenes ────────────────────────────────────────
for (const truthScene of imported.scenes) {
  const compiledScene = fixture.scenes.find(s => s.sceneId === truthScene.sceneId);
  if (!compiledScene) {
    console.error(R(`✗ Scene "${truthScene.sceneId}" missing from compiled fixture`));
    continue;
  }
  console.log(`  Auditing ${C(truthScene.sceneId)}…`);
  compareEntities(truthScene.sceneId, truthScene.entities, compiledScene.entities as CompiledEntity[]);
}

// ─── Report ───────────────────────────────────────────────────────────────────
console.log('');
console.log(B('═══ AUDIT REPORT ════════════════════════════════════════════'));
console.log(`  Scenes:         ${imported.scenes.length}`);
console.log(`  Total diffs:    ${diffs.length === 0 ? G('0 ✓') : R(String(diffs.length))}`);
console.log(`  Missing entities: ${missingFromCompiled}`);
console.log(`  Extra entities:   ${extraInCompiled}`);
console.log('');

// Group by field prefix to identify systemic issues
const byField = new Map<string, number>();
for (const d of diffs) {
  const key = d.field.split('.')[0];
  byField.set(key, (byField.get(key) ?? 0) + 1);
}

if (diffs.length > 0) {
  console.log(B('── Systemic gaps (by field) ──────────────────────────────────'));
  for (const [field, count] of [...byField.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${Y(field.padEnd(18))}  ${count} diff(s)`);
  }
  console.log('');

  // Print worst offenders (up to 40)
  console.log(B('── Per-entity diffs (first 40) ──────────────────────────────'));
  const sorted = diffs.sort((a, b) => {
    if (a.sceneId !== b.sceneId) return a.sceneId.localeCompare(b.sceneId);
    return a.entityId.localeCompare(b.entityId);
  });

  let printed = 0;
  let lastEntity = '';
  for (const d of sorted) {
    if (printed >= 40) {
      console.log(`  … and ${diffs.length - 40} more`);
      break;
    }
    const label = `${d.sceneId}/${d.entityId}`;
    if (label !== lastEntity) {
      console.log(`\n  ${C(d.entityId)} (${d.sceneId})`);
      lastEntity = label;
    }
    const truth = String(d.truth).slice(0, 60);
    const got   = String(d.got).slice(0, 60);
    console.log(`    ${Y(d.field.padEnd(22))}  want ${G(truth)}  got ${R(got)}`);
    printed++;
  }
  console.log('');
}

// ─── Systemic fix: auto-rebuild if requested or if diffs > 0 ─────────────────
const shouldFix = process.argv.includes('--fix') || (diffs.length > 0 && process.argv.includes('--fix-auto'));

if (diffs.length === 0) {
  console.log(G('✓ No diffs — compiled fixture matches importer output.'));
} else {
  console.log(Y(`⚠ ${diffs.length} diff(s) found.`));

  if (shouldFix) {
    console.log(C('\n● Rebuilding fixture…'));
    try {
      execSync('pnpm build:compile-fixture', { stdio: 'inherit', cwd: resolve(__dirname, '..') });
      console.log(G('✓ Fixture rebuilt. Run audit again to verify.'));
    } catch (e) {
      console.error(R('✗ Rebuild failed.'));
      process.exit(1);
    }
  } else {
    console.log(`  Run with ${C('--fix')} to automatically rebuild the compiled fixture.`);
  }
  process.exit(diffs.length > 0 ? 1 : 0);
}
