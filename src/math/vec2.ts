import { EPSILON } from './constants';

export class Vec2 {
  readonly data: Float32Array;

  constructor() {
    this.data = new Float32Array(2);
  }

  get x(): number { return this.data[0]; }
  set x(v: number) { this.data[0] = v; }
  get y(): number { return this.data[1]; }
  set y(v: number) { this.data[1] = v; }

  static set(out: Vec2, x: number, y: number): void {
    out.data[0] = x;
    out.data[1] = y;
  }

  static copy(a: Vec2, out: Vec2): void {
    out.data[0] = a.data[0];
    out.data[1] = a.data[1];
  }

  static add(a: Vec2, b: Vec2, out: Vec2): void {
    out.data[0] = a.data[0] + b.data[0];
    out.data[1] = a.data[1] + b.data[1];
  }

  static sub(a: Vec2, b: Vec2, out: Vec2): void {
    out.data[0] = a.data[0] - b.data[0];
    out.data[1] = a.data[1] - b.data[1];
  }

  static scale(a: Vec2, s: number, out: Vec2): void {
    out.data[0] = a.data[0] * s;
    out.data[1] = a.data[1] * s;
  }

  static mul(a: Vec2, b: Vec2, out: Vec2): void {
    out.data[0] = a.data[0] * b.data[0];
    out.data[1] = a.data[1] * b.data[1];
  }

  static dot(a: Vec2, b: Vec2): number {
    return a.data[0] * b.data[0] + a.data[1] * b.data[1];
  }

  static cross(a: Vec2, b: Vec2): number {
    return a.data[0] * b.data[1] - a.data[1] * b.data[0];
  }

  static len(a: Vec2): number {
    return Math.sqrt(a.data[0] * a.data[0] + a.data[1] * a.data[1]);
  }

  static lengthSq(a: Vec2): number {
    return a.data[0] * a.data[0] + a.data[1] * a.data[1];
  }

  static distance(a: Vec2, b: Vec2): number {
    const dx = b.data[0] - a.data[0];
    const dy = b.data[1] - a.data[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  static distanceSq(a: Vec2, b: Vec2): number {
    const dx = b.data[0] - a.data[0];
    const dy = b.data[1] - a.data[1];
    return dx * dx + dy * dy;
  }

  static normalize(a: Vec2, out: Vec2): void {
    const len = a.data[0] * a.data[0] + a.data[1] * a.data[1];
    if (len > 0) {
      const invLen = 1 / Math.sqrt(len);
      out.data[0] = a.data[0] * invLen;
      out.data[1] = a.data[1] * invLen;
    } else {
      out.data[0] = 0;
      out.data[1] = 0;
    }
  }

  static lerp(a: Vec2, b: Vec2, t: number, out: Vec2): void {
    out.data[0] = a.data[0] + t * (b.data[0] - a.data[0]);
    out.data[1] = a.data[1] + t * (b.data[1] - a.data[1]);
  }

  static negate(a: Vec2, out: Vec2): void {
    out.data[0] = -a.data[0];
    out.data[1] = -a.data[1];
  }

  static equals(a: Vec2, b: Vec2): boolean {
    return (
      Math.abs(a.data[0] - b.data[0]) <= EPSILON &&
      Math.abs(a.data[1] - b.data[1]) <= EPSILON
    );
  }

  static exactEquals(a: Vec2, b: Vec2): boolean {
    return a.data[0] === b.data[0] && a.data[1] === b.data[1];
  }
}
