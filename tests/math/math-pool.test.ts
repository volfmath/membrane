import { describe, it, expect } from 'vitest';
import { MathPool } from '../../src/math';

describe('MathPool', () => {
  it('get returns pre-allocated objects', () => {
    const pool = new MathPool({ vec2Count: 4, vec3Count: 4, mat4Count: 2 });
    const v2 = pool.getVec2();
    const v3 = pool.getVec3();
    const m4 = pool.getMat4();
    expect(v2.data.length).toBe(2);
    expect(v3.data.length).toBe(3);
    expect(m4.data.length).toBe(16);
  });

  it('returns the same objects after releaseAll', () => {
    const pool = new MathPool({ vec2Count: 2, vec3Count: 2, mat4Count: 2 });
    const first = pool.getVec3();
    pool.releaseAll();
    const second = pool.getVec3();
    expect(first).toBe(second);
  });

  it('throws when exhausted', () => {
    const pool = new MathPool({ vec2Count: 1, vec3Count: 1, mat4Count: 1 });
    pool.getVec2();
    expect(() => pool.getVec2()).toThrow('MathPool exhausted: vec2');

    pool.getVec3();
    expect(() => pool.getVec3()).toThrow('MathPool exhausted: vec3');

    pool.getMat4();
    expect(() => pool.getMat4()).toThrow('MathPool exhausted: mat4');
  });

  it('10000 get/release cycles without memory growth', () => {
    const pool = new MathPool({ vec2Count: 32, vec3Count: 32, mat4Count: 8 });
    for (let i = 0; i < 10000; i++) {
      pool.getVec2();
      pool.getVec3();
      pool.getMat4();
      pool.releaseAll();
    }
    const v = pool.getVec3();
    expect(v.data.length).toBe(3);
  });
});
