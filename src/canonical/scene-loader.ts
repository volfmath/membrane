import { BundleReader } from '../asset/bundle-reader.js';
import { World } from '../ecs/world.js';
import { EntityManager } from '../ecs/entity-manager.js';
import type { EntityId } from '../ecs/types.js';
import type { CompiledSceneData } from './loader-types.js';

export interface LoadedEntityMeta {
  sourceId: string;
  name: string;
  parentSourceId: string | null;
  parentEntityId: EntityId | null;
  enabled: boolean;
}

export interface LoadedScene {
  sceneId: string;
  entityCount: number;
  entityIds: EntityId[];
  idMap: Map<string, EntityId>;
  metaByEntity: Map<EntityId, LoadedEntityMeta>;
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
  const metaByEntity = new Map<EntityId, LoadedEntityMeta>();

  for (const compiled of sceneData.entities) {
    const entityId = world.createEntity();
    entityIds.push(entityId);
    idMap.set(compiled.id, entityId);
  }

  for (let i = 0; i < sceneData.entities.length; i++) {
    const compiled = sceneData.entities[i];
    const entityId = entityIds[i];
    const entityIndex = EntityManager.getIndex(entityId);

    metaByEntity.set(entityId, {
      sourceId: compiled.id,
      name: compiled.name,
      parentSourceId: compiled.parent,
      parentEntityId: compiled.parent ? (idMap.get(compiled.parent) ?? null) : null,
      enabled: compiled.enabled,
    });

    for (const [compName, compData] of Object.entries(compiled.components)) {
      const componentId = world.registry.getId(compName);
      if (componentId === -1) continue;

      world.addComponent(entityId, componentId);

      const fieldNames = config.componentFieldMap.get(compName);
      if (!fieldNames) continue;

      for (const fieldName of fieldNames) {
        const value = (compData as Record<string, unknown>)[fieldName];
        const numericValue = normalizeFieldValue(value);
        if (numericValue === null) continue;

        const field = world.storage.getField(componentId, fieldName);
        const fieldIndex = world.storage.getFieldIndex(entityIndex, componentId);
        field[fieldIndex] = numericValue;
      }

      world.storage.markChanged(entityIndex, componentId);
    }
  }

  return {
    sceneId: sceneData.sceneId,
    entityCount: entityIds.length,
    entityIds,
    idMap,
    metaByEntity,
  };
}

function normalizeFieldValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return null;
}
