import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ProjectDataManager } from './project-data.js';
import type { CanonicalEntity, CanonicalComponents } from '../../src/canonical/types.js';
import { getConnectorConfig, listAvailableConnectors } from '../ai/config.js';
import { generateScene as aiGenerateScene, generateEvents as aiGenerateEvents } from '../ai/claude.js';
import { generateSprite as aiGenerateSprite } from '../ai/openai-image.js';
import { research as aiResearch } from '../ai/perplexity.js';
import { generateMusic as aiGenerateMusic, generateSFX as aiGenerateSFX } from '../ai/audio.js';
import { translateScene as aiTranslateScene } from '../ai/localize.js';
import { runWorkflow, createGameWorkflow } from '../ai/orchestrator.js';

export function createMembraneServer(projectRoot: string): McpServer {
  const manager = new ProjectDataManager(projectRoot);

  const server = new McpServer({
    name: 'membrane',
    version: '0.1.0',
  });

  // ── Resources ──

  server.resource(
    'project-manifest',
    'membrane://project/manifest',
    { description: 'Project overview: scene list, entity counts, asset status' },
    async () => ({
      contents: [{
        uri: 'membrane://project/manifest',
        mimeType: 'application/json',
        text: JSON.stringify(manager.getManifest(), null, 2),
      }],
    }),
  );

  server.resource(
    'scene',
    new ResourceTemplate('membrane://scenes/{sceneId}', {
      list: async () => {
        const scenes = manager.listScenes();
        return {
          resources: scenes.map(s => ({
            uri: `membrane://scenes/${s.sceneId}`,
            name: s.name ?? s.sceneId,
            description: `Scene with ${s.entities.length} entities`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    { description: 'Canonical scene data (entities + events)' },
    async (uri, { sceneId }) => {
      const scene = manager.getScene(sceneId);
      if (!scene) {
        throw new Error(`Scene "${sceneId}" not found`);
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(scene, null, 2),
        }],
      };
    },
  );

  server.resource(
    'assets',
    'membrane://assets',
    { description: 'Asset manifest: atlases, audio, scene paths' },
    async () => {
      const assets = manager.getAssets();
      return {
        contents: [{
          uri: 'membrane://assets',
          mimeType: 'application/json',
          text: assets ? JSON.stringify(assets, null, 2) : '{}',
        }],
      };
    },
  );

  // ── Tools ──

  server.tool(
    'create_scene',
    'Create a new empty scene',
    { sceneId: z.string().describe('Unique scene identifier'), name: z.string().optional().describe('Display name') },
    async ({ sceneId, name }) => {
      const existing = manager.getScene(sceneId);
      if (existing) {
        return { content: [{ type: 'text', text: `Error: Scene "${sceneId}" already exists` }], isError: true };
      }
      const scene = manager.createScene(sceneId, name);
      return { content: [{ type: 'text', text: `Created scene "${scene.sceneId}" (${scene.name})` }] };
    },
  );

  server.tool(
    'create_entity',
    'Add a new entity to a scene',
    {
      sceneId: z.string().describe('Scene to add entity to'),
      entityId: z.string().describe('Unique entity identifier'),
      name: z.string().optional().describe('Display name'),
      parent: z.string().nullable().optional().describe('Parent entity id'),
      components: z.record(z.string(), z.record(z.string(), z.unknown())).describe('Component data'),
    },
    async ({ sceneId, entityId, name, parent, components }) => {
      const entity: CanonicalEntity = {
        id: entityId,
        name: name ?? entityId,
        parent: parent ?? null,
        enabled: true,
        components: components as CanonicalComponents,
      };
      try {
        const scene = manager.createEntity(sceneId, entity);
        if (!scene) {
          return { content: [{ type: 'text', text: `Error: Scene "${sceneId}" not found` }], isError: true };
        }
        return { content: [{ type: 'text', text: `Created entity "${entityId}" in scene "${sceneId}" (${scene.entities.length} entities total)` }] };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
      }
    },
  );

  server.tool(
    'update_entity',
    'Update components on an existing entity',
    {
      sceneId: z.string().describe('Scene containing the entity'),
      entityId: z.string().describe('Entity to update'),
      components: z.record(z.string(), z.record(z.string(), z.unknown())).describe('Component data to merge'),
    },
    async ({ sceneId, entityId, components }) => {
      const scene = manager.updateEntity(sceneId, entityId, components as Partial<CanonicalComponents>);
      if (!scene) {
        return { content: [{ type: 'text', text: `Error: Entity "${entityId}" not found in scene "${sceneId}"` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Updated entity "${entityId}" in scene "${sceneId}"` }] };
    },
  );

  server.tool(
    'delete_entity',
    'Remove an entity from a scene',
    {
      sceneId: z.string().describe('Scene containing the entity'),
      entityId: z.string().describe('Entity to delete'),
    },
    async ({ sceneId, entityId }) => {
      const scene = manager.deleteEntity(sceneId, entityId);
      if (!scene) {
        return { content: [{ type: 'text', text: `Error: Entity "${entityId}" not found in scene "${sceneId}"` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Deleted entity "${entityId}" from scene "${sceneId}" (${scene.entities.length} entities remaining)` }] };
    },
  );

  server.tool(
    'add_event',
    'Add an event rule to a scene',
    {
      sceneId: z.string().describe('Scene to add event to'),
      eventId: z.string().describe('Unique event identifier'),
      on: z.string().describe('Trigger condition (e.g. "tag:player touch tag:enemy")'),
      action: z.union([z.string(), z.array(z.string())]).describe('Action(s) to execute'),
    },
    async ({ sceneId, eventId, on, action }) => {
      const scene = manager.addEvent(sceneId, { id: eventId, on, do: action });
      if (!scene) {
        return { content: [{ type: 'text', text: `Error: Scene "${sceneId}" not found` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Added event "${eventId}" to scene "${sceneId}" (${scene.events?.length ?? 0} events total)` }] };
    },
  );

  server.tool(
    'validate',
    'Validate all canonical format files in the project',
    {},
    async () => {
      const result = manager.validate();
      if (result.valid) {
        return { content: [{ type: 'text', text: 'Validation passed: all scenes are valid' }] };
      }
      const lines = result.errors.map(e => `  ${e.path}: ${e.message}`);
      return {
        content: [{ type: 'text', text: `Validation failed (${result.errors.length} errors):\n${lines.join('\n')}` }],
        isError: true,
      };
    },
  );

  // ── AI Tools ──

  server.tool(
    'ai_generate_scene',
    'Use Claude AI to generate a game scene from a natural language description',
    {
      prompt: z.string().describe('Scene description (e.g. "a platformer level with 3 platforms and a player")'),
      sceneId: z.string().optional().describe('Override scene ID (auto-generated if omitted)'),
    },
    async ({ prompt, sceneId }) => {
      const config = getConnectorConfig('claude');
      if (!config) {
        return { content: [{ type: 'text', text: 'Error: ANTHROPIC_API_KEY not set' }], isError: true };
      }
      const manifest = manager.getManifest();
      const result = await aiGenerateScene(config, prompt, {
        existingScenes: manifest.scenes.map(s => s.sceneId),
        projectManifest: manifest,
      });
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }
      const scene = result.data;
      if (sceneId) scene.sceneId = sceneId;
      manager.createScene(scene.sceneId, scene.name);
      for (const entity of scene.entities) {
        manager.createEntity(scene.sceneId, entity);
      }
      if (scene.events) {
        for (const event of scene.events) {
          manager.addEvent(scene.sceneId, event);
        }
      }
      const summary = `Created scene "${scene.sceneId}" with ${scene.entities.length} entities and ${scene.events?.length ?? 0} events`;
      return { content: [{ type: 'text', text: summary }] };
    },
  );

  server.tool(
    'ai_generate_sprite',
    'Use GPT Image to generate a sprite image',
    {
      prompt: z.string().describe('Sprite description (e.g. "pixel art warrior character")'),
      size: z.enum(['256x256', '512x512', '1024x1024']).optional().describe('Image size'),
    },
    async ({ prompt, size }) => {
      const config = getConnectorConfig('openai-image');
      if (!config) {
        return { content: [{ type: 'text', text: 'Error: OPENAI_API_KEY not set' }], isError: true };
      }
      const result = await aiGenerateSprite(config, prompt, { size: size as any });
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }
      return {
        content: [{
          type: 'text',
          text: `Generated ${result.data.width}x${result.data.height} sprite (${result.data.buffer.length} bytes)`,
        }],
      };
    },
  );

  server.tool(
    'ai_research',
    'Use Perplexity to search for game design references and best practices',
    {
      query: z.string().describe('Research query (e.g. "runner game design patterns")'),
    },
    async ({ query }) => {
      const config = getConnectorConfig('perplexity');
      if (!config) {
        return { content: [{ type: 'text', text: 'Error: PERPLEXITY_API_KEY not set' }], isError: true };
      }
      const result = await aiResearch(config, query);
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }
      const data = result.data;
      const text = `## Research: ${query}\n\n${data.summary}\n\n### Key Points\n${data.keyPoints.map(p => `- ${p}`).join('\n')}\n\n### References\n${data.references.map(r => `- ${r}`).join('\n')}`;
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'ai_generate_audio',
    'Use AI to generate background music or sound effects',
    {
      prompt: z.string().describe('Audio description (e.g. "upbeat chiptune background music")'),
      kind: z.enum(['bgm', 'sfx']).describe('Audio type: bgm for music, sfx for sound effects'),
      duration: z.number().optional().describe('Duration in seconds (default: 30 for bgm, 3 for sfx)'),
    },
    async ({ prompt, kind, duration }) => {
      const config = getConnectorConfig('audio');
      if (!config) {
        return { content: [{ type: 'text', text: 'Error: SUNO_API_KEY not set' }], isError: true };
      }
      const result = kind === 'bgm'
        ? await aiGenerateMusic(config, prompt, { duration })
        : await aiGenerateSFX(config, prompt, { duration });
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }
      return {
        content: [{
          type: 'text',
          text: `Generated ${kind} audio: ${result.data.duration}s, ${result.data.buffer.length} bytes`,
        }],
      };
    },
  );

  server.tool(
    'ai_localize',
    'Translate a scene\'s entity names to another language',
    {
      sceneId: z.string().describe('Scene to translate'),
      language: z.string().describe('Target language (e.g. "zh-CN", "ja", "ko", "es")'),
    },
    async ({ sceneId, language }) => {
      const config = getConnectorConfig('localize');
      if (!config) {
        return { content: [{ type: 'text', text: 'Error: ANTHROPIC_API_KEY not set' }], isError: true };
      }
      const scene = manager.getScene(sceneId);
      if (!scene) {
        return { content: [{ type: 'text', text: `Error: Scene "${sceneId}" not found` }], isError: true };
      }
      const result = await aiTranslateScene(config, scene, language);
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
      }
      manager.saveScene(result.data);
      return {
        content: [{
          type: 'text',
          text: `Translated ${result.data.entities.length} entity names in "${sceneId}" to ${language}`,
        }],
      };
    },
  );

  server.tool(
    'ai_workflow',
    'Run a full AI game generation workflow: research → generate scene → sprites → audio',
    {
      description: z.string().describe('Game description (e.g. "a simple runner game with obstacles and coins")'),
    },
    async ({ description }) => {
      const available = listAvailableConnectors();
      if (available.length === 0) {
        return { content: [{ type: 'text', text: 'Error: No AI API keys configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.' }], isError: true };
      }
      const configs: any = {};
      for (const name of available) {
        configs[name] = getConnectorConfig(name);
      }
      const steps = createGameWorkflow(description);
      const result = await runWorkflow(steps, configs, manager);
      const lines = result.steps.map(s => `  ${s.id}: ${s.status}${s.error ? ` (${s.error})` : ''}`);
      const sceneSummary = result.scene
        ? `\nScene "${result.scene.sceneId}": ${result.scene.entities.length} entities, ${result.scene.events?.length ?? 0} events`
        : '';
      return {
        content: [{
          type: 'text',
          text: `Workflow complete:\n${lines.join('\n')}${sceneSummary}\n\nAvailable connectors: ${available.join(', ')}`,
        }],
      };
    },
  );

  return server;
}
