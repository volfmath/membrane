import { describe, it, expect } from 'vitest';
import { Vec2, EPSILON } from '../../src/math';

describe('Vec2', () => {
  it('initializes to zero', () => {
    const v = new Vec2();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('set', () => {
    const v = new Vec2();
    Vec2.set(v, 3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('copy', () => {
    const a = new Vec2();
    const b = new Vec2();
    Vec2.set(a, 1, 2);
    Vec2.copy(a, b);
    expect(b.x).toBe(1);
    expect(b.y).toBe(2);
  });

  it('add', () => {
    const a = new Vec2(), b = new Vec2(), out = new Vec2();
    Vec2.set(a, 1, 2);
    Vec2.set(b, 3, 4);
    Vec2.add(a, b, out);
    expect(out.x).toBe(4);
    expect(out.y).toBe(6);
  });

  it('add in-place (out === a)', () => {
    const a = new Vec2(), b = new Vec2();
    Vec2.set(a, 1, 2);
    Vec2.set(b, 3, 4);
    Vec2.add(a, b, a);
    expect(a.x).toBe(4);
    expect(a.y).toBe(6);
  });

  it('sub', () => {
    const a = new Vec2(), b = new Vec2(), out = new Vec2();
    Vec2.set(a, 5, 7);
    Vec2.set(b, 2, 3);
    Vec2.sub(a, b, out);
    expect(out.x).toBe(3);
    expect(out.y).toBe(4);
  });

  it('scale', () => {
    const a = new Vec2(), out = new Vec2();
    Vec2.set(a, 2, 3);
    Vec2.scale(a, 3, out);
    expect(out.x).toBe(6);
    expect(out.y).toBe(9);
  });

  it('mul (component-wise)', () => {
    const a = new Vec2(), b = new Vec2(), out = new Vec2();
    Vec2.set(a, 2, 3);
    Vec2.set(b, 4, 5);
    Vec2.mul(a, b, out);
    expect(out.x).toBe(8);
    expect(out.y).toBe(15);
  });

  it('dot', () => {
    const a = new Vec2(), b = new Vec2();
    Vec2.set(a, 1, 2);
    Vec2.set(b, 3, 4);
    expect(Vec2.dot(a, b)).toBe(11);
  });

  it('cross', () => {
    const a = new Vec2(), b = new Vec2();
    Vec2.set(a, 1, 0);
    Vec2.set(b, 0, 1);
    expect(Vec2.cross(a, b)).toBe(1);
  });

  it('length and lengthSq', () => {
    const a = new Vec2();
    Vec2.set(a, 3, 4);
    expect(Vec2.len(a)).toBe(5);
    expect(Vec2.lengthSq(a)).toBe(25);
  });

  it('distance and distanceSq', () => {
    const a = new Vec2(), b = new Vec2();
    Vec2.set(a, 0, 0);
    Vec2.set(b, 3, 4);
    expect(Vec2.distance(a, b)).toBe(5);
    expect(Vec2.distanceSq(a, b)).toBe(25);
  });

  it('normalize', () => {
    const a = new Vec2(), out = new Vec2();
    Vec2.set(a, 3, 4);
    Vec2.normalize(a, out);
    expect(Math.abs(Vec2.len(out) - 1)).toBeLessThan(EPSILON);
  });

  it('normalize zero vector', () => {
    const a = new Vec2(), out = new Vec2();
    Vec2.normalize(a, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it('lerp', () => {
    const a = new Vec2(), b = new Vec2(), out = new Vec2();
    Vec2.set(a, 0, 0);
    Vec2.set(b, 10, 20);
    Vec2.lerp(a, b, 0.5, out);
    expect(out.x).toBe(5);
    expect(out.y).toBe(10);
  });

  it('negate', () => {
    const a = new Vec2(), out = new Vec2();
    Vec2.set(a, 3, -4);
    Vec2.negate(a, out);
    expect(out.x).toBe(-3);
    expect(out.y).toBe(4);
  });

  it('equals and exactEquals', () => {
    const a = new Vec2(), b = new Vec2();
    Vec2.set(a, 1, 2);
    Vec2.set(b, 1, 2);
    expect(Vec2.exactEquals(a, b)).toBe(true);
    expect(Vec2.equals(a, b)).toBe(true);

    Vec2.set(b, 1 + EPSILON * 0.5, 2);
    expect(Vec2.exactEquals(a, b)).toBe(false);
    expect(Vec2.equals(a, b)).toBe(true);
  });
});
