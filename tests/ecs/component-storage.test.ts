import { describe, it, expect } from 'vitest';
import {
  ComponentRegistry,
  ComponentStorage,
  StorageType,
  componentBit,
} from '../../src/ecs';
import type { ComponentSchema } from '../../src/ecs';

const TransformSchema: ComponentSchema = {
  posX: { type: Float32Array, default: 0 },
  posY: { type: Float32Array, default: 0 },
};

const SpriteSchema: ComponentSchema = {
  atlasId: { type: Uint32Array, default: 0 },
  color: { type: Uint32Array, default: 0xFFFFFFFF },
};

const HiddenSchema: ComponentSchema = {};

const HitSchema: ComponentSchema = {
  damage: { type: Float32Array, default: 10 },
};

function setup(capacity = 64) {
  const registry = new ComponentRegistry();
  const transformId = registry.register('Transform', TransformSchema);
  const spriteId = registry.register('Sprite', SpriteSchema);
  const hiddenId = registry.register('Hidden', HiddenSchema, StorageType.SparseSet);
  const hitId = registry.register('Hit', HitSchema, StorageType.SparseSet);
  const storage = new ComponentStorage(registry, capacity);
  return { registry, storage, transformId, spriteId, hiddenId, hitId };
}

describe('ComponentRegistry', () => {
  it('registers components with incrementing ids', () => {
    const { transformId, spriteId, hiddenId } = setup();
    expect(transformId).toBe(0);
    expect(spriteId).toBe(1);
    expect(hiddenId).toBe(2);
  });

  it('throws on duplicate name', () => {
    const registry = new ComponentRegistry();
    registry.register('A', {});
    expect(() => registry.register('A', {})).toThrow('already registered');
  });

  it('returns correct schema and storage type', () => {
    const { registry, transformId, hiddenId } = setup();
    expect(registry.getStorageType(transformId)).toBe(StorageType.Table);
    expect(registry.getStorageType(hiddenId)).toBe(StorageType.SparseSet);
    expect(registry.getName(transformId)).toBe('Transform');
  });
});

describe('ComponentStorage — Table mode', () => {
  it('add and has component', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    expect(storage.hasComponent(0, transformId)).toBe(true);
    expect(storage.hasComponent(1, transformId)).toBe(false);
  });

  it('remove component', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    storage.removeComponent(0, transformId);
    expect(storage.hasComponent(0, transformId)).toBe(false);
  });

  it('addComponent is idempotent (no-op if already present)', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    const posX = storage.getField(transformId, 'posX') as Float32Array;
    posX[0] = 42;
    storage.addComponent(0, transformId);
    expect(posX[0]).toBe(42);
  });

  it('getField returns TypedArray indexed by entityIndex', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    storage.addComponent(1, transformId);
    const posX = storage.getField(transformId, 'posX') as Float32Array;
    posX[0] = 100;
    posX[1] = 200;
    expect(posX[0]).toBe(100);
    expect(posX[1]).toBe(200);
  });

  it('SoA memory is contiguous for same field across entities', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    storage.addComponent(1, transformId);
    storage.addComponent(2, transformId);
    const posX = storage.getField(transformId, 'posX') as Float32Array;
    posX[0] = 10;
    posX[1] = 20;
    posX[2] = 30;
    expect(posX[0]).toBe(10);
    expect(posX[1]).toBe(20);
    expect(posX[2]).toBe(30);
    expect(posX.buffer).toBe(posX.buffer);
  });

  it('getFields returns all fields', () => {
    const { storage, transformId } = setup();
    const fields = storage.getFields(transformId);
    expect('posX' in fields).toBe(true);
    expect('posY' in fields).toBe(true);
  });

  it('default values are applied on add', () => {
    const { storage, spriteId } = setup();
    storage.addComponent(0, spriteId);
    const color = storage.getField(spriteId, 'color') as Uint32Array;
    expect(color[0]).toBe(0xFFFFFFFF);
  });

  it('archetype mask tracks multiple components', () => {
    const { storage, transformId, spriteId } = setup();
    storage.addComponent(0, transformId);
    storage.addComponent(0, spriteId);
    const mask = storage.getArchetype(0);
    expect(mask & componentBit(transformId)).not.toBe(0n);
    expect(mask & componentBit(spriteId)).not.toBe(0n);
  });
});

describe('ComponentStorage — SparseSet mode', () => {
  it('add and has tag component', () => {
    const { storage, hiddenId } = setup();
    storage.addComponent(5, hiddenId);
    expect(storage.hasComponent(5, hiddenId)).toBe(true);
    expect(storage.hasComponent(0, hiddenId)).toBe(false);
  });

  it('remove tag component', () => {
    const { storage, hiddenId } = setup();
    storage.addComponent(5, hiddenId);
    storage.removeComponent(5, hiddenId);
    expect(storage.hasComponent(5, hiddenId)).toBe(false);
  });

  it('SparseSet with data fields', () => {
    const { storage, hitId } = setup();
    storage.addComponent(10, hitId);
    const ss = storage.getSparseSetDense(hitId)!;
    expect(ss.count).toBe(1);
    expect(ss.dense[0]).toBe(10);
  });

  it('frequent add/remove is O(1) swap-remove', () => {
    const { storage, hiddenId } = setup();
    for (let i = 0; i < 50; i++) {
      storage.addComponent(i, hiddenId);
    }
    for (let i = 0; i < 50; i++) {
      storage.removeComponent(i, hiddenId);
    }
    for (let i = 0; i < 50; i++) {
      expect(storage.hasComponent(i, hiddenId)).toBe(false);
    }
  });

  it('SparseSet grows beyond initial capacity', () => {
    const { storage, hitId } = setup(256);
    for (let i = 0; i < 128; i++) {
      storage.addComponent(i, hitId);
    }
    const ss = storage.getSparseSetDense(hitId)!;
    expect(ss.count).toBe(128);
  });

  it('swap-remove maintains data integrity', () => {
    const { storage, hitId } = setup();
    storage.addComponent(0, hitId);
    storage.addComponent(1, hitId);
    storage.addComponent(2, hitId);

    const damage = storage.getField(hitId, 'damage') as Float32Array;
    damage[0] = 100;
    damage[1] = 200;
    damage[2] = 300;

    storage.removeComponent(0, hitId);

    const ss = storage.getSparseSetDense(hitId)!;
    expect(ss.count).toBe(2);
    expect(storage.hasComponent(1, hitId)).toBe(true);
    expect(storage.hasComponent(2, hitId)).toBe(true);
  });
});

describe('ComponentStorage — Change Detection', () => {
  it('markChanged and isChanged', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    const tick0 = storage.currentTick;
    storage.advanceTick();

    const posX = storage.getField(transformId, 'posX') as Float32Array;
    posX[0] = 42;
    storage.markChanged(0, transformId);

    expect(storage.isChanged(0, transformId, tick0)).toBe(true);
  });

  it('isChanged returns false when not modified', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    storage.addComponent(1, transformId);
    const addTick = storage.currentTick;
    storage.advanceTick();

    storage.markChanged(0, transformId);

    expect(storage.isChanged(0, transformId, addTick)).toBe(true);
    expect(storage.isChanged(1, transformId, storage.currentTick)).toBe(false);
  });

  it('isAdded returns true after addComponent', () => {
    const { storage, transformId } = setup();
    const beforeTick = storage.currentTick;
    storage.advanceTick();
    storage.addComponent(0, transformId);
    expect(storage.isAdded(0, transformId, beforeTick)).toBe(true);
  });

  it('isAdded returns false in subsequent ticks', () => {
    const { storage, transformId } = setup();
    storage.addComponent(0, transformId);
    const addedTick = storage.currentTick;
    storage.advanceTick();
    storage.advanceTick();
    expect(storage.isAdded(0, transformId, addedTick)).toBe(false);
  });

  it('advanceTick increments correctly', () => {
    const { storage } = setup();
    expect(storage.currentTick).toBe(0);
    storage.advanceTick();
    expect(storage.currentTick).toBe(1);
    storage.advanceTick();
    expect(storage.currentTick).toBe(2);
  });
});

describe('ComponentStorage — clearEntity and reset', () => {
  it('clearEntity removes all components', () => {
    const { storage, transformId, spriteId, hiddenId } = setup();
    storage.addComponent(0, transformId);
    storage.addComponent(0, spriteId);
    storage.addComponent(0, hiddenId);
    storage.clearEntity(0);
    expect(storage.hasComponent(0, transformId)).toBe(false);
    expect(storage.hasComponent(0, spriteId)).toBe(false);
    expect(storage.hasComponent(0, hiddenId)).toBe(false);
    expect(storage.getArchetype(0)).toBe(0n);
  });

  it('reset clears all state', () => {
    const { storage, transformId, hiddenId } = setup();
    storage.addComponent(0, transformId);
    storage.addComponent(5, hiddenId);
    storage.advanceTick();
    storage.reset();
    expect(storage.hasComponent(0, transformId)).toBe(false);
    expect(storage.hasComponent(5, hiddenId)).toBe(false);
    expect(storage.currentTick).toBe(0);
  });

  it('clearEntity resets change detection ticks', () => {
    const { storage, transformId } = setup();
    storage.advanceTick();
    storage.addComponent(0, transformId);
    storage.markChanged(0, transformId);
    const tickBefore = storage.currentTick;

    storage.clearEntity(0);

    expect(storage.isChanged(0, transformId, 0)).toBe(false);
    expect(storage.isAdded(0, transformId, 0)).toBe(false);
  });
});
