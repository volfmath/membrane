import { describe, it, expect } from 'vitest';
import { Vec3, Mat4, EPSILON } from '../../src/math';

describe('Vec3', () => {
  it('initializes to zero', () => {
    const v = new Vec3();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  it('set and getters/setters', () => {
    const v = new Vec3();
    Vec3.set(v, 1, 2, 3);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
    expect(v.z).toBe(3);
    v.x = 10;
    expect(v.data[0]).toBe(10);
  });

  it('add', () => {
    const a = new Vec3(), b = new Vec3(), out = new Vec3();
    Vec3.set(a, 1, 2, 3);
    Vec3.set(b, 4, 5, 6);
    Vec3.add(a, b, out);
    expect(out.x).toBe(5);
    expect(out.y).toBe(7);
    expect(out.z).toBe(9);
  });

  it('add in-place', () => {
    const a = new Vec3(), b = new Vec3();
    Vec3.set(a, 1, 2, 3);
    Vec3.set(b, 4, 5, 6);
    Vec3.add(a, b, a);
    expect(a.x).toBe(5);
    expect(a.y).toBe(7);
    expect(a.z).toBe(9);
  });

  it('sub', () => {
    const a = new Vec3(), b = new Vec3(), out = new Vec3();
    Vec3.set(a, 5, 7, 9);
    Vec3.set(b, 1, 2, 3);
    Vec3.sub(a, b, out);
    expect(out.x).toBe(4);
    expect(out.y).toBe(5);
    expect(out.z).toBe(6);
  });

  it('scale', () => {
    const a = new Vec3(), out = new Vec3();
    Vec3.set(a, 1, 2, 3);
    Vec3.scale(a, 2, out);
    expect(out.x).toBe(2);
    expect(out.y).toBe(4);
    expect(out.z).toBe(6);
  });

  it('dot', () => {
    const a = new Vec3(), b = new Vec3();
    Vec3.set(a, 1, 2, 3);
    Vec3.set(b, 4, 5, 6);
    expect(Vec3.dot(a, b)).toBe(32);
  });

  it('cross', () => {
    const a = new Vec3(), b = new Vec3(), out = new Vec3();
    Vec3.set(a, 1, 0, 0);
    Vec3.set(b, 0, 1, 0);
    Vec3.cross(a, b, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.z).toBe(1);
  });

  it('cross with aliased out', () => {
    const a = new Vec3(), b = new Vec3();
    Vec3.set(a, 1, 0, 0);
    Vec3.set(b, 0, 1, 0);
    Vec3.cross(a, b, a);
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(a.z).toBe(1);
  });

  it('length and lengthSq', () => {
    const a = new Vec3();
    Vec3.set(a, 1, 2, 2);
    expect(Vec3.len(a)).toBe(3);
    expect(Vec3.lengthSq(a)).toBe(9);
  });

  it('normalize', () => {
    const a = new Vec3(), out = new Vec3();
    Vec3.set(a, 3, 0, 4);
    Vec3.normalize(a, out);
    expect(Math.abs(Vec3.len(out) - 1)).toBeLessThan(EPSILON);
    expect(Math.abs(out.x - 0.6)).toBeLessThan(EPSILON);
    expect(Math.abs(out.z - 0.8)).toBeLessThan(EPSILON);
  });

  it('normalize zero vector', () => {
    const a = new Vec3(), out = new Vec3();
    Vec3.normalize(a, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.z).toBe(0);
  });

  it('lerp', () => {
    const a = new Vec3(), b = new Vec3(), out = new Vec3();
    Vec3.set(a, 0, 0, 0);
    Vec3.set(b, 10, 20, 30);
    Vec3.lerp(a, b, 0.5, out);
    expect(out.x).toBe(5);
    expect(out.y).toBe(10);
    expect(out.z).toBe(15);
  });

  it('negate', () => {
    const a = new Vec3(), out = new Vec3();
    Vec3.set(a, 1, -2, 3);
    Vec3.negate(a, out);
    expect(out.x).toBe(-1);
    expect(out.y).toBe(2);
    expect(out.z).toBe(-3);
  });

  it('distance and distanceSq', () => {
    const a = new Vec3(), b = new Vec3();
    Vec3.set(a, 0, 0, 0);
    Vec3.set(b, 1, 2, 2);
    expect(Vec3.distance(a, b)).toBe(3);
    expect(Vec3.distanceSq(a, b)).toBe(9);
  });

  it('transformMat4 with identity', () => {
    const v = new Vec3(), out = new Vec3(), m = new Mat4();
    Vec3.set(v, 1, 2, 3);
    Mat4.identity(m);
    Vec3.transformMat4(v, m, out);
    expect(Math.abs(out.x - 1)).toBeLessThan(EPSILON);
    expect(Math.abs(out.y - 2)).toBeLessThan(EPSILON);
    expect(Math.abs(out.z - 3)).toBeLessThan(EPSILON);
  });

  it('transformMat4 with translation', () => {
    const v = new Vec3(), out = new Vec3(), m = new Mat4(), t = new Vec3();
    Vec3.set(v, 1, 2, 3);
    Vec3.set(t, 10, 20, 30);
    Mat4.identity(m);
    Mat4.translate(m, t, m);
    Vec3.transformMat4(v, m, out);
    expect(Math.abs(out.x - 11)).toBeLessThan(EPSILON);
    expect(Math.abs(out.y - 22)).toBeLessThan(EPSILON);
    expect(Math.abs(out.z - 33)).toBeLessThan(EPSILON);
  });

  it('equals and exactEquals', () => {
    const a = new Vec3(), b = new Vec3();
    Vec3.set(a, 1, 2, 3);
    Vec3.set(b, 1, 2, 3);
    expect(Vec3.exactEquals(a, b)).toBe(true);
    expect(Vec3.equals(a, b)).toBe(true);

    Vec3.set(b, 1 + EPSILON * 0.5, 2, 3);
    expect(Vec3.exactEquals(a, b)).toBe(false);
    expect(Vec3.equals(a, b)).toBe(true);
  });
});
