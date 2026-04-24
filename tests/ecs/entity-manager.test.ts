import { describe, it, expect } from 'vitest';
import { EntityManager, INVALID_ENTITY } from '../../src/ecs';

describe('EntityManager', () => {
  it('creates entities with incrementing index', () => {
    const em = new EntityManager({ maxEntities: 16 });
    const e0 = em.create();
    const e1 = em.create();
    expect(EntityManager.getIndex(e0)).toBe(0);
    expect(EntityManager.getIndex(e1)).toBe(1);
    expect(EntityManager.getGeneration(e0)).toBe(0);
    expect(EntityManager.getGeneration(e1)).toBe(0);
  });

  it('tracks aliveCount', () => {
    const em = new EntityManager({ maxEntities: 16 });
    expect(em.aliveCount).toBe(0);
    const e = em.create();
    expect(em.aliveCount).toBe(1);
    em.create();
    expect(em.aliveCount).toBe(2);
    em.destroy(e);
    expect(em.aliveCount).toBe(1);
  });

  it('isAlive returns true for living entities', () => {
    const em = new EntityManager({ maxEntities: 16 });
    const e = em.create();
    expect(em.isAlive(e)).toBe(true);
  });

  it('isAlive returns false after destroy', () => {
    const em = new EntityManager({ maxEntities: 16 });
    const e = em.create();
    em.destroy(e);
    expect(em.isAlive(e)).toBe(false);
  });

  it('reuses index with incremented generation', () => {
    const em = new EntityManager({ maxEntities: 16 });
    const e0 = em.create();
    const idx0 = EntityManager.getIndex(e0);
    em.destroy(e0);
    const e1 = em.create();
    expect(EntityManager.getIndex(e1)).toBe(idx0);
    expect(EntityManager.getGeneration(e1)).toBe(1);
    expect(em.isAlive(e0)).toBe(false);
    expect(em.isAlive(e1)).toBe(true);
  });

  it('destroy is idempotent on dead entities', () => {
    const em = new EntityManager({ maxEntities: 16 });
    const e = em.create();
    em.destroy(e);
    em.destroy(e);
    expect(em.aliveCount).toBe(0);
  });

  it('destroy on INVALID_ENTITY is no-op', () => {
    const em = new EntityManager({ maxEntities: 16 });
    em.destroy(INVALID_ENTITY);
    expect(em.aliveCount).toBe(0);
  });

  it('isAlive returns false for INVALID_ENTITY', () => {
    const em = new EntityManager({ maxEntities: 16 });
    expect(em.isAlive(INVALID_ENTITY)).toBe(false);
  });

  it('throws on capacity exhaustion', () => {
    const em = new EntityManager({ maxEntities: 4 });
    em.create();
    em.create();
    em.create();
    em.create();
    expect(() => em.create()).toThrow('EntityManager capacity exhausted');
  });

  it('capacity returns configured max', () => {
    const em = new EntityManager({ maxEntities: 128 });
    expect(em.capacity).toBe(128);
  });

  it('defaults to MAX_ENTITIES capacity', () => {
    const em = new EntityManager();
    expect(em.capacity).toBe(65536);
  });

  it('bulk create/destroy cycle maintains correctness', () => {
    const em = new EntityManager({ maxEntities: 256 });
    const entities: number[] = [];
    for (let i = 0; i < 256; i++) entities.push(em.create());
    expect(em.aliveCount).toBe(256);

    for (const e of entities) em.destroy(e);
    expect(em.aliveCount).toBe(0);

    for (const e of entities) expect(em.isAlive(e)).toBe(false);

    const newEntities: number[] = [];
    for (let i = 0; i < 256; i++) newEntities.push(em.create());
    expect(em.aliveCount).toBe(256);

    for (const e of newEntities) expect(em.isAlive(e)).toBe(true);
    for (const e of entities) expect(em.isAlive(e)).toBe(false);
  });

  it('reset clears all state', () => {
    const em = new EntityManager({ maxEntities: 16 });
    em.create();
    em.create();
    em.reset();
    expect(em.aliveCount).toBe(0);
    const e = em.create();
    expect(EntityManager.getIndex(e)).toBe(0);
    expect(EntityManager.getGeneration(e)).toBe(0);
  });

  it('throws on invalid maxEntities', () => {
    expect(() => new EntityManager({ maxEntities: 0 })).toThrow();
    expect(() => new EntityManager({ maxEntities: 70000 })).toThrow();
  });
});
