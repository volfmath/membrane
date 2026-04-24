import { EPSILON } from './constants';
import type { Mat4 } from './mat4';

export class Vec3 {
  readonly data: Float32Array;

  constructor() {
    this.data = new Float32Array(3);
  }

  get x(): number { return this.data[0]; }
  set x(v: number) { this.data[0] = v; }
  get y(): number { return this.data[1]; }
  set y(v: number) { this.data[1] = v; }
  get z(): number { return this.data[2]; }
  set z(v: number) { this.data[2] = v; }

  static set(out: Vec3, x: number, y: number, z: number): void {
    out.data[0] = x;
    out.data[1] = y;
    out.data[2] = z;
  }

  static copy(a: Vec3, out: Vec3): void {
    out.data[0] = a.data[0];
    out.data[1] = a.data[1];
    out.data[2] = a.data[2];
  }

  static add(a: Vec3, b: Vec3, out: Vec3): void {
    out.data[0] = a.data[0] + b.data[0];
    out.data[1] = a.data[1] + b.data[1];
    out.data[2] = a.data[2] + b.data[2];
  }

  static sub(a: Vec3, b: Vec3, out: Vec3): void {
    out.data[0] = a.data[0] - b.data[0];
    out.data[1] = a.data[1] - b.data[1];
    out.data[2] = a.data[2] - b.data[2];
  }

  static scale(a: Vec3, s: number, out: Vec3): void {
    out.data[0] = a.data[0] * s;
    out.data[1] = a.data[1] * s;
    out.data[2] = a.data[2] * s;
  }

  static mul(a: Vec3, b: Vec3, out: Vec3): void {
    out.data[0] = a.data[0] * b.data[0];
    out.data[1] = a.data[1] * b.data[1];
    out.data[2] = a.data[2] * b.data[2];
  }

  static dot(a: Vec3, b: Vec3): number {
    return a.data[0] * b.data[0] + a.data[1] * b.data[1] + a.data[2] * b.data[2];
  }

  static cross(a: Vec3, b: Vec3, out: Vec3): void {
    const ax = a.data[0], ay = a.data[1], az = a.data[2];
    const bx = b.data[0], by = b.data[1], bz = b.data[2];
    out.data[0] = ay * bz - az * by;
    out.data[1] = az * bx - ax * bz;
    out.data[2] = ax * by - ay * bx;
  }

  static len(a: Vec3): number {
    return Math.sqrt(a.data[0] * a.data[0] + a.data[1] * a.data[1] + a.data[2] * a.data[2]);
  }

  static lengthSq(a: Vec3): number {
    return a.data[0] * a.data[0] + a.data[1] * a.data[1] + a.data[2] * a.data[2];
  }

  static distance(a: Vec3, b: Vec3): number {
    const dx = b.data[0] - a.data[0];
    const dy = b.data[1] - a.data[1];
    const dz = b.data[2] - a.data[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static distanceSq(a: Vec3, b: Vec3): number {
    const dx = b.data[0] - a.data[0];
    const dy = b.data[1] - a.data[1];
    const dz = b.data[2] - a.data[2];
    return dx * dx + dy * dy + dz * dz;
  }

  static normalize(a: Vec3, out: Vec3): void {
    const len = a.data[0] * a.data[0] + a.data[1] * a.data[1] + a.data[2] * a.data[2];
    if (len > 0) {
      const invLen = 1 / Math.sqrt(len);
      out.data[0] = a.data[0] * invLen;
      out.data[1] = a.data[1] * invLen;
      out.data[2] = a.data[2] * invLen;
    } else {
      out.data[0] = 0;
      out.data[1] = 0;
      out.data[2] = 0;
    }
  }

  static lerp(a: Vec3, b: Vec3, t: number, out: Vec3): void {
    out.data[0] = a.data[0] + t * (b.data[0] - a.data[0]);
    out.data[1] = a.data[1] + t * (b.data[1] - a.data[1]);
    out.data[2] = a.data[2] + t * (b.data[2] - a.data[2]);
  }

  static negate(a: Vec3, out: Vec3): void {
    out.data[0] = -a.data[0];
    out.data[1] = -a.data[1];
    out.data[2] = -a.data[2];
  }

  static transformMat4(a: Vec3, m: Mat4, out: Vec3): void {
    const x = a.data[0], y = a.data[1], z = a.data[2];
    const d = m.data;
    const w = d[3] * x + d[7] * y + d[11] * z + d[15] || 1.0;
    out.data[0] = (d[0] * x + d[4] * y + d[8] * z + d[12]) / w;
    out.data[1] = (d[1] * x + d[5] * y + d[9] * z + d[13]) / w;
    out.data[2] = (d[2] * x + d[6] * y + d[10] * z + d[14]) / w;
  }

  static equals(a: Vec3, b: Vec3): boolean {
    return (
      Math.abs(a.data[0] - b.data[0]) <= EPSILON &&
      Math.abs(a.data[1] - b.data[1]) <= EPSILON &&
      Math.abs(a.data[2] - b.data[2]) <= EPSILON
    );
  }

  static exactEquals(a: Vec3, b: Vec3): boolean {
    return a.data[0] === b.data[0] && a.data[1] === b.data[1] && a.data[2] === b.data[2];
  }
}
