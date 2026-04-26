import {
  CANONICAL_FORMATS,
  CANONICAL_VERSION,
  type CanonicalSceneFile,
  type CanonicalPrefabFile,
  type CanonicalAssetsFile,
  type ImportReportFile,
  type CanonicalEntity,
} from './types.js';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const ID_PATTERN = /^[A-Za-z0-9_./:@-]+$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{8}$/;
const COMPONENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function err(path: string, message: string): ValidationError {
  return { path, message };
}

function validateId(value: unknown, path: string, errors: ValidationError[]): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(err(path, 'must be a non-empty string'));
    return false;
  }
  if (!ID_PATTERN.test(value)) {
    errors.push(err(path, `invalid id format: "${value}"`));
    return false;
  }
  return true;
}

function validateEntity(entity: unknown, index: number, errors: ValidationError[]): void {
  const base = `entities[${index}]`;
  if (typeof entity !== 'object' || entity === null) {
    errors.push(err(base, 'must be an object'));
    return;
  }
  const e = entity as Record<string, unknown>;

  validateId(e.id, `${base}.id`, errors);

  if (e.name !== undefined && typeof e.name !== 'string') {
    errors.push(err(`${base}.name`, 'must be a string'));
  }

  if (e.parent !== undefined && e.parent !== null && typeof e.parent !== 'string') {
    errors.push(err(`${base}.parent`, 'must be a string or null'));
  }

  if (e.enabled !== undefined && typeof e.enabled !== 'boolean') {
    errors.push(err(`${base}.enabled`, 'must be a boolean'));
  }

  if (typeof e.components !== 'object' || e.components === null) {
    errors.push(err(`${base}.components`, 'must be an object'));
    return;
  }

  const comps = e.components as Record<string, unknown>;
  for (const name of Object.keys(comps)) {
    if (!COMPONENT_NAME_PATTERN.test(name)) {
      errors.push(err(`${base}.components.${name}`, `invalid component name`));
    }
    if (typeof comps[name] !== 'object' || comps[name] === null) {
      errors.push(err(`${base}.components.${name}`, 'must be an object'));
    }
  }

  validateBuiltinComponents(comps, base, errors);
}

function validateBuiltinComponents(
  comps: Record<string, unknown>,
  base: string,
  errors: ValidationError[]
): void {
  if (comps.Sprite) {
    const s = comps.Sprite as Record<string, unknown>;
    if (typeof s.atlas !== 'string' || s.atlas.length === 0) {
      errors.push(err(`${base}.components.Sprite.atlas`, 'required string'));
    }
    if (typeof s.frame !== 'string' || s.frame.length === 0) {
      errors.push(err(`${base}.components.Sprite.frame`, 'required string'));
    }
    if (s.color !== undefined && (typeof s.color !== 'string' || !COLOR_PATTERN.test(s.color))) {
      errors.push(err(`${base}.components.Sprite.color`, 'must be #RRGGBBAA format'));
    }
  }

  if (comps.Tags) {
    const t = comps.Tags as Record<string, unknown>;
    if (!Array.isArray(t.values)) {
      errors.push(err(`${base}.components.Tags.values`, 'must be an array'));
    }
  }

  if (comps.Camera) {
    const c = comps.Camera as Record<string, unknown>;
    if (c.mode !== undefined && c.mode !== 'orthographic' && c.mode !== 'perspective') {
      errors.push(err(`${base}.components.Camera.mode`, 'must be "orthographic" or "perspective"'));
    }
    if (c.clearColor !== undefined && (typeof c.clearColor !== 'string' || !COLOR_PATTERN.test(c.clearColor))) {
      errors.push(err(`${base}.components.Camera.clearColor`, 'must be #RRGGBBAA format'));
    }
  }

  if (comps.PrefabRef) {
    const p = comps.PrefabRef as Record<string, unknown>;
    validateId(p.prefabId, `${base}.components.PrefabRef.prefabId`, errors);
  }
}

function validateEntities(entities: unknown, errors: ValidationError[]): void {
  if (!Array.isArray(entities)) {
    errors.push(err('entities', 'must be an array'));
    return;
  }
  const ids = new Set<string>();
  for (let i = 0; i < entities.length; i++) {
    validateEntity(entities[i], i, errors);
    const e = entities[i] as CanonicalEntity;
    if (e && typeof e.id === 'string') {
      if (ids.has(e.id)) {
        errors.push(err(`entities[${i}].id`, `duplicate entity id: "${e.id}"`));
      }
      ids.add(e.id);
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i] as CanonicalEntity;
    if (e && typeof e.parent === 'string' && !ids.has(e.parent)) {
      errors.push(err(`entities[${i}].parent`, `references unknown entity: "${e.parent}"`));
    }
  }
}

export function validateScene(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: [err('', 'must be an object')] };
  }
  const d = data as Record<string, unknown>;

  if (d.format !== CANONICAL_FORMATS.scene) {
    errors.push(err('format', `must be "${CANONICAL_FORMATS.scene}"`));
  }
  if (d.version !== CANONICAL_VERSION) {
    errors.push(err('version', `must be ${CANONICAL_VERSION}`));
  }
  validateId(d.sceneId, 'sceneId', errors);
  validateEntities(d.entities, errors);

  if (d.events !== undefined) {
    if (!Array.isArray(d.events)) {
      errors.push(err('events', 'must be an array'));
    } else {
      for (let i = 0; i < d.events.length; i++) {
        const ev = d.events[i] as Record<string, unknown>;
        validateId(ev.id, `events[${i}].id`, errors);
        if (typeof ev.on !== 'string') {
          errors.push(err(`events[${i}].on`, 'must be a string'));
        }
        if (typeof ev.do !== 'string' && !Array.isArray(ev.do)) {
          errors.push(err(`events[${i}].do`, 'must be a string or string[]'));
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validatePrefab(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: [err('', 'must be an object')] };
  }
  const d = data as Record<string, unknown>;

  if (d.format !== CANONICAL_FORMATS.prefab) {
    errors.push(err('format', `must be "${CANONICAL_FORMATS.prefab}"`));
  }
  if (d.version !== CANONICAL_VERSION) {
    errors.push(err('version', `must be ${CANONICAL_VERSION}`));
  }
  validateId(d.prefabId, 'prefabId', errors);
  validateEntities(d.entities, errors);

  return { valid: errors.length === 0, errors };
}

export function validateAssets(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: [err('', 'must be an object')] };
  }
  const d = data as Record<string, unknown>;

  if (d.format !== CANONICAL_FORMATS.assets) {
    errors.push(err('format', `must be "${CANONICAL_FORMATS.assets}"`));
  }
  if (d.version !== CANONICAL_VERSION) {
    errors.push(err('version', `must be ${CANONICAL_VERSION}`));
  }

  if (!Array.isArray(d.scenes)) {
    errors.push(err('scenes', 'must be an array'));
  } else {
    for (let i = 0; i < d.scenes.length; i++) {
      const s = d.scenes[i] as Record<string, unknown>;
      validateId(s.id, `scenes[${i}].id`, errors);
      if (typeof s.path !== 'string' || s.path.length === 0) {
        errors.push(err(`scenes[${i}].path`, 'must be a non-empty string'));
      }
    }
  }

  if (!Array.isArray(d.atlases)) {
    errors.push(err('atlases', 'must be an array'));
  } else {
    for (let i = 0; i < d.atlases.length; i++) {
      const a = d.atlases[i] as Record<string, unknown>;
      validateId(a.id, `atlases[${i}].id`, errors);
      if (typeof a.image !== 'string' || a.image.length === 0) {
        errors.push(err(`atlases[${i}].image`, 'must be a non-empty string'));
      }
      if (typeof a.width !== 'number' || a.width < 1) {
        errors.push(err(`atlases[${i}].width`, 'must be a positive number'));
      }
      if (typeof a.height !== 'number' || a.height < 1) {
        errors.push(err(`atlases[${i}].height`, 'must be a positive number'));
      }
      if (!Array.isArray(a.frames)) {
        errors.push(err(`atlases[${i}].frames`, 'must be an array'));
      } else {
        for (let j = 0; j < a.frames.length; j++) {
          const f = a.frames[j] as Record<string, unknown>;
          validateId(f.id, `atlases[${i}].frames[${j}].id`, errors);
          for (const dim of ['x', 'y', 'width', 'height'] as const) {
            if (typeof f[dim] !== 'number') {
              errors.push(err(`atlases[${i}].frames[${j}].${dim}`, 'must be a number'));
            }
          }
        }
      }
    }
  }

  if (!Array.isArray(d.audio)) {
    errors.push(err('audio', 'must be an array'));
  } else {
    const validKinds = new Set(['bgm', 'sfx', 'voice', 'ambient']);
    for (let i = 0; i < d.audio.length; i++) {
      const a = d.audio[i] as Record<string, unknown>;
      validateId(a.id, `audio[${i}].id`, errors);
      if (typeof a.path !== 'string' || a.path.length === 0) {
        errors.push(err(`audio[${i}].path`, 'must be a non-empty string'));
      }
      if (!validKinds.has(a.kind as string)) {
        errors.push(err(`audio[${i}].kind`, 'must be bgm|sfx|voice|ambient'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateImportReport(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: [err('', 'must be an object')] };
  }
  const d = data as Record<string, unknown>;

  if (d.format !== CANONICAL_FORMATS.importReport) {
    errors.push(err('format', `must be "${CANONICAL_FORMATS.importReport}"`));
  }
  if (d.version !== CANONICAL_VERSION) {
    errors.push(err('version', `must be ${CANONICAL_VERSION}`));
  }

  if (typeof d.source !== 'object' || d.source === null) {
    errors.push(err('source', 'must be an object'));
  } else {
    const src = d.source as Record<string, unknown>;
    const validKinds = new Set(['cocos', 'unity', 'custom']);
    if (!validKinds.has(src.kind as string)) {
      errors.push(err('source.kind', 'must be cocos|unity|custom'));
    }
    if (typeof src.root !== 'string' || src.root.length === 0) {
      errors.push(err('source.root', 'must be a non-empty string'));
    }
  }

  if (typeof d.summary !== 'object' || d.summary === null) {
    errors.push(err('summary', 'must be an object'));
  } else {
    const sum = d.summary as Record<string, unknown>;
    for (const field of ['sceneCount', 'entityCount', 'warningCount', 'unsupportedCount'] as const) {
      if (typeof sum[field] !== 'number' || sum[field] < 0) {
        errors.push(err(`summary.${field}`, 'must be a non-negative number'));
      }
    }
  }

  if (!Array.isArray(d.issues)) {
    errors.push(err('issues', 'must be an array'));
  } else {
    const validSeverities = new Set(['info', 'warning', 'error']);
    for (let i = 0; i < d.issues.length; i++) {
      const issue = d.issues[i] as Record<string, unknown>;
      if (!validSeverities.has(issue.severity as string)) {
        errors.push(err(`issues[${i}].severity`, 'must be info|warning|error'));
      }
      if (typeof issue.code !== 'string' || issue.code.length === 0) {
        errors.push(err(`issues[${i}].code`, 'must be a non-empty string'));
      }
      if (typeof issue.message !== 'string' || issue.message.length === 0) {
        errors.push(err(`issues[${i}].message`, 'must be a non-empty string'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
