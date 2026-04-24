import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ProjectDataManager } from './project-data.js';
import type { CanonicalEntity, CanonicalComponents } from '../../src/canonical/types.js';

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

  return server;
}
