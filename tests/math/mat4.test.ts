import { describe, it, expect } from 'vitest';
import { Mat4, Vec3, EPSILON } from '../../src/math';

function expectMat4Near(a: Mat4, b: Mat4) {
  for (let i = 0; i < 16; i++) {
    expect(Math.abs(a.data[i] - b.data[i])).toBeLessThan(EPSILON);
  }
}

describe('Mat4', () => {
  it('constructor initializes to identity', () => {
    const m = new Mat4();
    expect(m.data[0]).toBe(1);
    expect(m.data[5]).toBe(1);
    expect(m.data[10]).toBe(1);
    expect(m.data[15]).toBe(1);
    expect(m.data[1]).toBe(0);
    expect(m.data[4]).toBe(0);
  });

  it('identity', () => {
    const m = new Mat4();
    m.data[3] = 99;
    Mat4.identity(m);
    expect(m.data[0]).toBe(1);
    expect(m.data[3]).toBe(0);
    expect(m.data[15]).toBe(1);
  });

  it('copy', () => {
    const a = new Mat4(), b = new Mat4();
    a.data[5] = 42;
    Mat4.copy(a, b);
    expect(b.data[5]).toBe(42);
  });

  it('multiply identity * identity = identity', () => {
    const a = new Mat4(), b = new Mat4(), out = new Mat4();
    Mat4.identity(a);
    Mat4.identity(b);
    Mat4.multiply(a, b, out);
    expectMat4Near(out, a);
  });

  it('multiply A * identity = A', () => {
    const a = new Mat4(), id = new Mat4(), out = new Mat4();
    const v = new Vec3();
    Vec3.set(v, 1, 2, 3);
    Mat4.translate(a, v, a);
    Mat4.identity(id);
    Mat4.multiply(a, id, out);
    expectMat4Near(out, a);
  });

  it('multiply in-place (out === a)', () => {
    const a = new Mat4(), b = new Mat4();
    const v = new Vec3();
    Vec3.set(v, 1, 2, 3);
    Mat4.translate(a, v, a);
    Mat4.identity(b);
    Mat4.multiply(a, b, a);
    expect(a.data[12]).toBeCloseTo(1, 5);
    expect(a.data[13]).toBeCloseTo(2, 5);
    expect(a.data[14]).toBeCloseTo(3, 5);
  });

  it('translate', () => {
    const m = new Mat4(), v = new Vec3();
    Vec3.set(v, 10, 20, 30);
    Mat4.translate(m, v, m);
    expect(m.data[12]).toBe(10);
    expect(m.data[13]).toBe(20);
    expect(m.data[14]).toBe(30);
  });

  it('scale', () => {
    const m = new Mat4(), v = new Vec3();
    Vec3.set(v, 2, 3, 4);
    Mat4.scale(m, v, m);
    expect(m.data[0]).toBe(2);
    expect(m.data[5]).toBe(3);
    expect(m.data[10]).toBe(4);
  });

  it('rotateZ 90 degrees', () => {
    const m = new Mat4();
    Mat4.rotateZ(m, Math.PI / 2, m);
    expect(m.data[0]).toBeCloseTo(0, 5);
    expect(m.data[1]).toBeCloseTo(1, 5);
    expect(m.data[4]).toBeCloseTo(-1, 5);
    expect(m.data[5]).toBeCloseTo(0, 5);
  });

  it('rotateX', () => {
    const m = new Mat4();
    Mat4.rotateX(m, Math.PI / 2, m);
    expect(m.data[5]).toBeCloseTo(0, 5);
    expect(m.data[6]).toBeCloseTo(1, 5);
    expect(m.data[9]).toBeCloseTo(-1, 5);
    expect(m.data[10]).toBeCloseTo(0, 5);
  });

  it('rotateY', () => {
    const m = new Mat4();
    Mat4.rotateY(m, Math.PI / 2, m);
    expect(m.data[0]).toBeCloseTo(0, 5);
    expect(m.data[2]).toBeCloseTo(-1, 5);
    expect(m.data[8]).toBeCloseTo(1, 5);
    expect(m.data[10]).toBeCloseTo(0, 5);
  });

  it('rotate around Z axis', () => {
    const m = new Mat4(), axis = new Vec3();
    Vec3.set(axis, 0, 0, 1);
    Mat4.rotate(m, Math.PI / 2, axis, m);
    expect(m.data[0]).toBeCloseTo(0, 5);
    expect(m.data[1]).toBeCloseTo(1, 5);
  });

  it('invert identity = identity', () => {
    const m = new Mat4(), inv = new Mat4();
    const ok = Mat4.invert(m, inv);
    expect(ok).toBe(true);
    expectMat4Near(inv, m);
  });

  it('invert * original = identity', () => {
    const m = new Mat4(), inv = new Mat4(), result = new Mat4(), id = new Mat4();
    const v = new Vec3();
    Vec3.set(v, 3, 5, 7);
    Mat4.translate(m, v, m);
    Mat4.rotateZ(m, 0.5, m);
    const ok = Mat4.invert(m, inv);
    expect(ok).toBe(true);
    Mat4.multiply(m, inv, result);
    expectMat4Near(result, id);
  });

  it('invert singular matrix returns false', () => {
    const m = new Mat4(), inv = new Mat4();
    m.data.fill(0);
    const ok = Mat4.invert(m, inv);
    expect(ok).toBe(false);
  });

  it('transpose', () => {
    const m = new Mat4(), out = new Mat4();
    m.data[1] = 2;
    m.data[4] = 3;
    Mat4.transpose(m, out);
    expect(out.data[1]).toBe(3);
    expect(out.data[4]).toBe(2);
  });

  it('transpose in-place', () => {
    const m = new Mat4();
    m.data[1] = 2;
    m.data[4] = 3;
    Mat4.transpose(m, m);
    expect(m.data[1]).toBe(3);
    expect(m.data[4]).toBe(2);
  });

  it('determinant of identity = 1', () => {
    const m = new Mat4();
    expect(Mat4.determinant(m)).toBeCloseTo(1, 5);
  });

  it('perspective', () => {
    const m = new Mat4();
    Mat4.perspective(Math.PI / 4, 16 / 9, 0.1, 100, m);
    expect(m.data[0]).toBeGreaterThan(0);
    expect(m.data[5]).toBeGreaterThan(0);
    expect(m.data[11]).toBe(-1);
    expect(m.data[15]).toBe(0);
  });

  it('perspective infinite far', () => {
    const m = new Mat4();
    Mat4.perspective(Math.PI / 4, 1, 0.1, Infinity, m);
    expect(m.data[10]).toBe(-1);
    expect(m.data[14]).toBeCloseTo(-0.2, 5);
  });

  it('ortho', () => {
    const m = new Mat4();
    Mat4.ortho(-1, 1, -1, 1, 0.1, 100, m);
    expect(m.data[0]).toBeCloseTo(1, 5);
    expect(m.data[5]).toBeCloseTo(1, 5);
    expect(m.data[15]).toBe(1);
  });

  it('lookAt', () => {
    const eye = new Vec3(), center = new Vec3(), up = new Vec3(), m = new Mat4();
    Vec3.set(eye, 0, 0, 5);
    Vec3.set(center, 0, 0, 0);
    Vec3.set(up, 0, 1, 0);
    Mat4.lookAt(eye, center, up, m);
    expect(m.data[14]).toBeCloseTo(-5, 5);
  });

  it('getTranslation', () => {
    const m = new Mat4(), v = new Vec3(), out = new Vec3();
    Vec3.set(v, 7, 8, 9);
    Mat4.translate(m, v, m);
    Mat4.getTranslation(m, out);
    expect(out.x).toBe(7);
    expect(out.y).toBe(8);
    expect(out.z).toBe(9);
  });

  it('getScaling', () => {
    const m = new Mat4(), v = new Vec3(), out = new Vec3();
    Vec3.set(v, 2, 3, 4);
    Mat4.scale(m, v, m);
    Mat4.getScaling(m, out);
    expect(out.x).toBeCloseTo(2, 5);
    expect(out.y).toBeCloseTo(3, 5);
    expect(out.z).toBeCloseTo(4, 5);
  });

  it('equals and exactEquals', () => {
    const a = new Mat4(), b = new Mat4();
    expect(Mat4.exactEquals(a, b)).toBe(true);
    expect(Mat4.equals(a, b)).toBe(true);
    b.data[0] = 1 + EPSILON * 0.5;
    expect(Mat4.exactEquals(a, b)).toBe(false);
    expect(Mat4.equals(a, b)).toBe(true);
  });
});
