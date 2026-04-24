import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, cpSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ProjectDataManager } from '../../../tools/mcp/project-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_DIR = resolve(__dirname, '../../fixtures/mcp-demo');
const TMP_DIR = resolve(__dirname, '../../tmp-mcp-test');

describe('ProjectDataManager', () => {
  let manager: ProjectDataManager;

  beforeEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    cpSync(FIXTURE_DIR, TMP_DIR, { recursive: true });
    manager = new ProjectDataManager(TMP_DIR);
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe('scenes', () => {
    it('lists scenes from directory', () => {
      const scenes = manager.listScenes();
      expect(scenes).toHaveLength(1);
      expect(scenes[0].sceneId).toBe('level_01');
      expect(scenes[0].entities).toHaveLength(3);
    });

    it('gets a scene by id', () => {
      const scene = manager.getScene('level_01');
      expect(scene).not.toBeNull();
      expect(scene!.sceneId).toBe('level_01');
      expect(scene!.name).toBe('Level 01');
    });

    it('returns null for non-existent scene', () => {
      expect(manager.getScene('nonexistent')).toBeNull();
    });

    it('creates a new scene', () => {
      const scene = manager.createScene('level_02', 'Level 02');
      expect(scene.sceneId).toBe('level_02');
      expect(scene.entities).toHaveLength(0);

      const loaded = manager.getScene('level_02');
      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Level 02');
    });

    it('creates scene with default name', () => {
      const scene = manager.createScene('test');
      expect(scene.name).toBe('test');
    });

    it('deletes a scene', () => {
      expect(manager.deleteScene('level_01')).toBe(true);
      expect(manager.getScene('level_01')).toBeNull();
    });

    it('returns false when deleting non-existent scene', () => {
      expect(manager.deleteScene('nonexistent')).toBe(false);
    });

    it('saves modified scene', () => {
      const scene = manager.getScene('level_01')!;
      scene.name = 'Modified';
      manager.saveScene(scene);

      const reloaded = manager.getScene('level_01')!;
      expect(reloaded.name).toBe('Modified');
    });
  });

  describe('entities', () => {
    it('gets an entity by id', () => {
      const entity = manager.getEntity('level_01', 'player');
      expect(entity).not.toBeNull();
      expect(entity!.name).toBe('Player');
      expect(entity!.components.Transform).toBeDefined();
    });

    it('returns null for non-existent entity', () => {
      expect(manager.getEntity('level_01', 'nope')).toBeNull();
    });

    it('returns null for non-existent scene', () => {
      expect(manager.getEntity('nope', 'player')).toBeNull();
    });

    it('creates an entity', () => {
      const scene = manager.createEntity('level_01', {
        id: 'npc_01',
        name: 'NPC',
        enabled: true,
        components: {
          Transform: { x: 50, y: 60 },
        },
      });
      expect(scene).not.toBeNull();
      expect(scene!.entities).toHaveLength(4);

      const entity = manager.getEntity('level_01', 'npc_01');
      expect(entity!.name).toBe('NPC');
    });

    it('throws when creating duplicate entity', () => {
      expect(() =>
        manager.createEntity('level_01', {
          id: 'player',
          components: {},
        }),
      ).toThrow('already exists');
    });

    it('returns null when creating entity in non-existent scene', () => {
      expect(
        manager.createEntity('nope', { id: 'x', components: {} }),
      ).toBeNull();
    });

    it('updates entity components', () => {
      const scene = manager.updateEntity('level_01', 'player', {
        Transform: { x: 999, y: 888 },
      });
      expect(scene).not.toBeNull();

      const entity = manager.getEntity('level_01', 'player')!;
      expect((entity.components.Transform as any).x).toBe(999);
    });

    it('merges component updates', () => {
      manager.updateEntity('level_01', 'player', {
        Tags: { values: ['hero'] },
      });
      const entity = manager.getEntity('level_01', 'player')!;
      expect(entity.components.Transform).toBeDefined();
      expect(entity.components.Tags).toEqual({ values: ['hero'] });
    });

    it('returns null when updating non-existent entity', () => {
      expect(manager.updateEntity('level_01', 'nope', {})).toBeNull();
    });

    it('deletes an entity', () => {
      const scene = manager.deleteEntity('level_01', 'enemy_01');
      expect(scene).not.toBeNull();
      expect(scene!.entities).toHaveLength(2);
      expect(manager.getEntity('level_01', 'enemy_01')).toBeNull();
    });

    it('returns null when deleting non-existent entity', () => {
      expect(manager.deleteEntity('level_01', 'nope')).toBeNull();
    });
  });

  describe('events', () => {
    it('adds an event to scene', () => {
      const scene = manager.addEvent('level_01', {
        id: 'enemy_death',
        on: 'tag:enemy health:0',
        do: 'destroy:self',
      });
      expect(scene).not.toBeNull();
      expect(scene!.events).toHaveLength(2);
    });

    it('initializes events array if missing', () => {
      manager.createScene('empty');
      const scene = manager.addEvent('empty', {
        id: 'test',
        on: 'start',
        do: 'log:hello',
      });
      expect(scene!.events).toHaveLength(1);
    });
  });

  describe('assets', () => {
    it('reads assets file', () => {
      const assets = manager.getAssets();
      expect(assets).not.toBeNull();
      expect(assets!.atlases).toHaveLength(1);
      expect(assets!.audio).toHaveLength(1);
    });

    it('returns null when no assets file', () => {
      const emptyManager = new ProjectDataManager(resolve(TMP_DIR, 'nonexistent'));
      expect(emptyManager.getAssets()).toBeNull();
    });
  });

  describe('validation', () => {
    it('validates correct project', () => {
      const result = manager.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('manifest', () => {
    it('returns project manifest', () => {
      const manifest = manager.getManifest();
      expect(manifest.scenes).toHaveLength(1);
      expect(manifest.scenes[0].sceneId).toBe('level_01');
      expect(manifest.scenes[0].entityCount).toBe(3);
      expect(manifest.hasAssets).toBe(true);
    });
  });

  describe('empty project', () => {
    it('handles project with no scenes dir', () => {
      const emptyDir = resolve(TMP_DIR, 'empty-project');
      mkdirSync(emptyDir, { recursive: true });
      const emptyManager = new ProjectDataManager(emptyDir);

      expect(emptyManager.listScenes()).toHaveLength(0);
      expect(emptyManager.getManifest().scenes).toHaveLength(0);
    });

    it('creates scenes dir on first scene creation', () => {
      const emptyDir = resolve(TMP_DIR, 'empty-project');
      mkdirSync(emptyDir, { recursive: true });
      const emptyManager = new ProjectDataManager(emptyDir);

      emptyManager.createScene('first');
      expect(emptyManager.listScenes()).toHaveLength(1);
    });
  });
});
