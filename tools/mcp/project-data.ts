import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';
import type {
  CanonicalSceneFile,
  CanonicalEntity,
  CanonicalComponents,
  CanonicalEvent,
  CanonicalAssetsFile,
} from '../../src/canonical/types.js';
import { validateScene } from '../../src/canonical/validator.js';
import type { ValidationResult } from '../../src/canonical/validator.js';
import { CANONICAL_FORMATS, CANONICAL_VERSION } from '../../src/canonical/types.js';

export interface ProjectManifest {
  projectRoot: string;
  scenes: { sceneId: string; entityCount: number; path: string }[];
  hasAssets: boolean;
  hasImportReport: boolean;
}

export class ProjectDataManager {
  readonly projectRoot: string;
  private scenesDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot);
    this.scenesDir = resolve(this.projectRoot, 'scenes');
  }

  private ensureScenesDir(): void {
    if (!existsSync(this.scenesDir)) {
      mkdirSync(this.scenesDir, { recursive: true });
    }
  }

  private sceneFilePath(sceneId: string): string {
    return resolve(this.scenesDir, `${sceneId}.scene.json`);
  }

  private readJson<T>(path: string): T | null {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  }

  private writeJson(path: string, data: unknown): void {
    const dir = resolve(path, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ── Scenes ──

  listScenes(): CanonicalSceneFile[] {
    if (!existsSync(this.scenesDir)) return [];
    const files = readdirSync(this.scenesDir).filter(f => f.endsWith('.scene.json'));
    const scenes: CanonicalSceneFile[] = [];
    for (const file of files) {
      const scene = this.readJson<CanonicalSceneFile>(resolve(this.scenesDir, file));
      if (scene) scenes.push(scene);
    }
    return scenes;
  }

  getScene(sceneId: string): CanonicalSceneFile | null {
    return this.readJson<CanonicalSceneFile>(this.sceneFilePath(sceneId));
  }

  saveScene(scene: CanonicalSceneFile): void {
    this.ensureScenesDir();
    this.writeJson(this.sceneFilePath(scene.sceneId), scene);
  }

  createScene(sceneId: string, name?: string): CanonicalSceneFile {
    const scene: CanonicalSceneFile = {
      format: CANONICAL_FORMATS.scene,
      version: CANONICAL_VERSION,
      sceneId,
      name: name ?? sceneId,
      entities: [],
    };
    this.saveScene(scene);
    return scene;
  }

  deleteScene(sceneId: string): boolean {
    const path = this.sceneFilePath(sceneId);
    if (!existsSync(path)) return false;
    unlinkSync(path);
    return true;
  }

  // ── Entities ──

  getEntity(sceneId: string, entityId: string): CanonicalEntity | null {
    const scene = this.getScene(sceneId);
    if (!scene) return null;
    return scene.entities.find(e => e.id === entityId) ?? null;
  }

  createEntity(sceneId: string, entity: CanonicalEntity): CanonicalSceneFile | null {
    const scene = this.getScene(sceneId);
    if (!scene) return null;
    if (scene.entities.some(e => e.id === entity.id)) {
      throw new Error(`Entity "${entity.id}" already exists in scene "${sceneId}"`);
    }
    scene.entities.push(entity);
    this.saveScene(scene);
    return scene;
  }

  updateEntity(
    sceneId: string,
    entityId: string,
    components: Partial<CanonicalComponents>,
  ): CanonicalSceneFile | null {
    const scene = this.getScene(sceneId);
    if (!scene) return null;
    const entity = scene.entities.find(e => e.id === entityId);
    if (!entity) return null;
    for (const [key, value] of Object.entries(components)) {
      if (value === undefined) {
        delete entity.components[key];
      } else {
        entity.components[key] = value;
      }
    }
    this.saveScene(scene);
    return scene;
  }

  deleteEntity(sceneId: string, entityId: string): CanonicalSceneFile | null {
    const scene = this.getScene(sceneId);
    if (!scene) return null;
    const idx = scene.entities.findIndex(e => e.id === entityId);
    if (idx === -1) return null;
    scene.entities.splice(idx, 1);
    this.saveScene(scene);
    return scene;
  }

  // ── Events ──

  addEvent(sceneId: string, event: CanonicalEvent): CanonicalSceneFile | null {
    const scene = this.getScene(sceneId);
    if (!scene) return null;
    if (!scene.events) scene.events = [];
    scene.events.push(event);
    this.saveScene(scene);
    return scene;
  }

  // ── Assets ──

  getAssets(): CanonicalAssetsFile | null {
    return this.readJson<CanonicalAssetsFile>(resolve(this.projectRoot, 'assets.json'));
  }

  // ── Validation ──

  validate(): ValidationResult {
    const scenes = this.listScenes();
    const allErrors: { path: string; message: string }[] = [];

    for (const scene of scenes) {
      const result = validateScene(scene);
      if (!result.valid) {
        for (const err of result.errors) {
          allErrors.push({ path: `scenes/${scene.sceneId}: ${err.path}`, message: err.message });
        }
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  // ── Manifest ──

  getManifest(): ProjectManifest {
    const scenes = this.listScenes();
    return {
      projectRoot: this.projectRoot,
      scenes: scenes.map(s => ({
        sceneId: s.sceneId,
        entityCount: s.entities.length,
        path: `scenes/${s.sceneId}.scene.json`,
      })),
      hasAssets: existsSync(resolve(this.projectRoot, 'assets.json')),
      hasImportReport: existsSync(resolve(this.projectRoot, 'import-report.json')),
    };
  }
}
