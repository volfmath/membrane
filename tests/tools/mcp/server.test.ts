import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, rmSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMembraneServer } from '../../../tools/mcp/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_DIR = resolve(__dirname, '../../fixtures/mcp-demo');
const TMP_DIR = resolve(__dirname, '../../tmp-mcp-server-test');

describe('MCP server integration', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    cpSync(FIXTURE_DIR, TMP_DIR, { recursive: true });

    const server = createMembraneServer(TMP_DIR);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe('resources', () => {
    it('lists available resources', async () => {
      const result = await client.listResources();
      const uris = result.resources.map(r => r.uri);
      expect(uris).toContain('membrane://project/manifest');
      expect(uris).toContain('membrane://assets');
    });

    it('reads project manifest', async () => {
      const result = await client.readResource({ uri: 'membrane://project/manifest' });
      expect(result.contents).toHaveLength(1);
      const manifest = JSON.parse(result.contents[0].text as string);
      expect(manifest.scenes).toHaveLength(1);
      expect(manifest.scenes[0].sceneId).toBe('level_01');
      expect(manifest.scenes[0].entityCount).toBe(3);
      expect(manifest.hasAssets).toBe(true);
    });

    it('lists scene resources via resource templates', async () => {
      const result = await client.listResourceTemplates();
      const templates = result.resourceTemplates.map(t => t.uriTemplate);
      expect(templates).toContain('membrane://scenes/{sceneId}');
    });

    it('reads a scene by id', async () => {
      const result = await client.readResource({ uri: 'membrane://scenes/level_01' });
      expect(result.contents).toHaveLength(1);
      const scene = JSON.parse(result.contents[0].text as string);
      expect(scene.sceneId).toBe('level_01');
      expect(scene.entities).toHaveLength(3);
    });

    it('reads assets', async () => {
      const result = await client.readResource({ uri: 'membrane://assets' });
      const assets = JSON.parse(result.contents[0].text as string);
      expect(assets.atlases).toHaveLength(1);
      expect(assets.audio).toHaveLength(1);
    });
  });

  describe('tools', () => {
    it('lists available tools', async () => {
      const result = await client.listTools();
      const names = result.tools.map(t => t.name);
      expect(names).toContain('create_scene');
      expect(names).toContain('create_entity');
      expect(names).toContain('update_entity');
      expect(names).toContain('delete_entity');
      expect(names).toContain('add_event');
      expect(names).toContain('validate');
    });

    it('creates a scene', async () => {
      const result = await client.callTool({ name: 'create_scene', arguments: { sceneId: 'level_02', name: 'Level 02' } });
      expect(result.isError).toBeFalsy();
      expect((result.content as any)[0].text).toContain('Created scene');

      const readResult = await client.readResource({ uri: 'membrane://scenes/level_02' });
      const scene = JSON.parse(readResult.contents[0].text as string);
      expect(scene.sceneId).toBe('level_02');
      expect(scene.name).toBe('Level 02');
    });

    it('rejects duplicate scene', async () => {
      const result = await client.callTool({ name: 'create_scene', arguments: { sceneId: 'level_01' } });
      expect(result.isError).toBe(true);
    });

    it('creates an entity', async () => {
      const result = await client.callTool({
        name: 'create_entity',
        arguments: {
          sceneId: 'level_01',
          entityId: 'powerup_01',
          name: 'Health Potion',
          components: {
            Transform: { x: 200, y: 300 },
            Tags: { values: ['item', 'health'] },
          },
        },
      });
      expect(result.isError).toBeFalsy();

      const readResult = await client.readResource({ uri: 'membrane://scenes/level_01' });
      const scene = JSON.parse(readResult.contents[0].text as string);
      expect(scene.entities).toHaveLength(4);
      const entity = scene.entities.find((e: any) => e.id === 'powerup_01');
      expect(entity.name).toBe('Health Potion');
      expect(entity.components.Transform.x).toBe(200);
    });

    it('updates entity components', async () => {
      const result = await client.callTool({
        name: 'update_entity',
        arguments: {
          sceneId: 'level_01',
          entityId: 'player',
          components: { Transform: { x: 500, y: 600 } },
        },
      });
      expect(result.isError).toBeFalsy();

      const readResult = await client.readResource({ uri: 'membrane://scenes/level_01' });
      const scene = JSON.parse(readResult.contents[0].text as string);
      const player = scene.entities.find((e: any) => e.id === 'player');
      expect(player.components.Transform.x).toBe(500);
    });

    it('deletes an entity', async () => {
      const result = await client.callTool({
        name: 'delete_entity',
        arguments: { sceneId: 'level_01', entityId: 'enemy_01' },
      });
      expect(result.isError).toBeFalsy();

      const readResult = await client.readResource({ uri: 'membrane://scenes/level_01' });
      const scene = JSON.parse(readResult.contents[0].text as string);
      expect(scene.entities).toHaveLength(2);
      expect(scene.entities.find((e: any) => e.id === 'enemy_01')).toBeUndefined();
    });

    it('adds an event', async () => {
      const result = await client.callTool({
        name: 'add_event',
        arguments: {
          sceneId: 'level_01',
          eventId: 'level_complete',
          on: 'score:>=100',
          action: ['show:victory_screen', 'play:fanfare'],
        },
      });
      expect(result.isError).toBeFalsy();

      const readResult = await client.readResource({ uri: 'membrane://scenes/level_01' });
      const scene = JSON.parse(readResult.contents[0].text as string);
      expect(scene.events).toHaveLength(2);
    });

    it('validates project', async () => {
      const result = await client.callTool({ name: 'validate', arguments: {} });
      expect(result.isError).toBeFalsy();
      expect((result.content as any)[0].text).toContain('passed');
    });

    it('full round-trip: create scene → add entities → validate', async () => {
      await client.callTool({ name: 'create_scene', arguments: { sceneId: 'boss_arena' } });

      await client.callTool({
        name: 'create_entity',
        arguments: {
          sceneId: 'boss_arena',
          entityId: 'boss',
          name: 'Dragon Boss',
          components: {
            Transform: { x: 400, y: 300, scaleX: 2, scaleY: 2 },
            Sprite: { atlas: 'enemies', frame: 'dragon', order: 100 },
          },
        },
      });

      await client.callTool({
        name: 'create_entity',
        arguments: {
          sceneId: 'boss_arena',
          entityId: 'arena_camera',
          components: {
            Transform: { x: 0, y: 0 },
            Camera: { mode: 'orthographic', size: 1280 },
          },
        },
      });

      await client.callTool({
        name: 'add_event',
        arguments: {
          sceneId: 'boss_arena',
          eventId: 'boss_defeated',
          on: 'entity:boss health:0',
          action: 'scene:victory',
        },
      });

      const validateResult = await client.callTool({ name: 'validate', arguments: {} });
      expect(validateResult.isError).toBeFalsy();

      const manifest = await client.readResource({ uri: 'membrane://project/manifest' });
      const data = JSON.parse(manifest.contents[0].text as string);
      expect(data.scenes).toHaveLength(2);

      const sceneResult = await client.readResource({ uri: 'membrane://scenes/boss_arena' });
      const scene = JSON.parse(sceneResult.contents[0].text as string);
      expect(scene.entities).toHaveLength(2);
      expect(scene.events).toHaveLength(1);
    });
  });
});
