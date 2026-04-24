export type EntityId = number;

export const INVALID_ENTITY: EntityId = 0xFFFFFFFF;
export const ENTITY_INDEX_BITS = 16;
export const ENTITY_INDEX_MASK = 0xFFFF;
export const ENTITY_GEN_MASK = 0xFFFF;
export const MAX_ENTITIES = 1 << ENTITY_INDEX_BITS; // 65536
