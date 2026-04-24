import { BundleReader } from '../asset/bundle-reader.js';
import { World } from '../ecs/world.js';
import type { ComponentId } from '../ecs/component-registry.js';
import { EntityManager } from '../ecs/entity-manager.js';
import type { EntityId } from '../ecs/types.js';
import type { CompiledSceneData, CompiledEntity } from './loader-types.js';

export interface LoadedScene {
  sceneId: string;
  entityCount: number;
  entityIds: EntityId[];
  idMap: Map<string, EntityId>;
}

export interface SceneLoaderConfig {
  componentFieldMap: Map<string, string[]>;
}

export function loadSceneFromBundle(
  reader: BundleReader,
  assetId: number,
  world: World,
  config: SceneLoaderConfig
): LoadedScene {
  const rawData = reader.getAssetData(assetId);
  const decoder = new TextDecoder();
  const sceneData = JSON.parse(decoder.decode(rawData)) as CompiledSceneData;

  return loadSceneData(sceneData, world, config);
}

export function loadSceneData(
  sceneData: CompiledSceneData,
  world: World,
  config: SceneLoaderConfig
): LoadedScene {
  const entityIds: EntityId[] = [];
  const idMap = new Map<string, EntityId>();

  for (const compiled of sceneData.entities) {
    const entityId = world.createEntity();
    const entityIndex = EntityManager.getIndex(entityId);
    entityIds.push(entityId);
    idMap.set(compiled.id, entityId);

    for (const [compName, compData] of Object.entries(compiled.components)) {
      const componentId = world.registry.getId(compName);
      if (componentId === -1) continue;

      world.addComponent(entityId, componentId);

      const fieldNames = config.componentFieldMap.get(compName);
      if (!fieldNames) continue;

      for (const fieldName of fieldNames) {
        const value = (compData as Record<string, unknown>)[fieldName];
        if (value === undefined || value === null) continue;
        if (typeof value !== 'number') continue;

        const field = world.storage.getField(componentId, fieldName);
        field[entityIndex] = value;
      }

      world.storage.markChanged(entityIndex, componentId);
    }
  }

  return {
    sceneId: sceneData.sceneId,
    entityCount: entityIds.length,
    entityIds,
    idMap,
  };
}
