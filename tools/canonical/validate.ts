import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, extname, relative } from 'path';
import {
  validateScene,
  validatePrefab,
  validateAssets,
  validateImportReport,
  type ValidationResult,
} from '../../src/canonical/validator.js';

export interface ValidateOptions {
  input: string;
  verbose?: boolean;
}

export interface ValidateResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: Map<string, ValidationResult>;
}

export function validateCanonicalDir(opts: ValidateOptions): ValidateResult {
  const { input, verbose } = opts;
  if (!existsSync(input)) {
    throw new Error(`Directory not found: ${input}`);
  }

  const results = new Map<string, ValidationResult>();
  let validFiles = 0;
  let invalidFiles = 0;

  const assetsPath = resolve(input, 'assets.json');
  if (existsSync(assetsPath)) {
    const data = loadJson(assetsPath);
    const result = validateAssets(data);
    results.set(relative(input, assetsPath), result);
    result.valid ? validFiles++ : invalidFiles++;
  }

  const reportPath = resolve(input, 'import-report.json');
  if (existsSync(reportPath)) {
    const data = loadJson(reportPath);
    const result = validateImportReport(data);
    results.set(relative(input, reportPath), result);
    result.valid ? validFiles++ : invalidFiles++;
  }

  const scenesDir = resolve(input, 'scenes');
  if (existsSync(scenesDir)) {
    for (const file of readdirSync(scenesDir)) {
      if (!file.endsWith('.scene.json')) continue;
      const filePath = resolve(scenesDir, file);
      const data = loadJson(filePath);
      const result = validateScene(data);
      results.set(`scenes/${file}`, result);
      result.valid ? validFiles++ : invalidFiles++;
    }
  }

  const prefabsDir = resolve(input, 'prefabs');
  if (existsSync(prefabsDir)) {
    for (const file of readdirSync(prefabsDir)) {
      if (!file.endsWith('.prefab.json')) continue;
      const filePath = resolve(prefabsDir, file);
      const data = loadJson(filePath);
      const result = validatePrefab(data);
      results.set(`prefabs/${file}`, result);
      result.valid ? validFiles++ : invalidFiles++;
    }
  }

  return {
    totalFiles: validFiles + invalidFiles,
    validFiles,
    invalidFiles,
    results,
  };
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function formatValidateResult(result: ValidateResult): string {
  const lines: string[] = [];
  lines.push(`Validated ${result.totalFiles} files: ${result.validFiles} valid, ${result.invalidFiles} invalid`);

  for (const [file, vr] of result.results) {
    if (vr.valid) {
      lines.push(`  OK  ${file}`);
    } else {
      lines.push(`  ERR ${file}`);
      for (const err of vr.errors) {
        lines.push(`       [${err.path}] ${err.message}`);
      }
    }
  }

  return lines.join('\n');
}
