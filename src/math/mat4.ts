import { EPSILON } from './constants';
import type { Vec3 } from './vec3';

export class Mat4 {
  readonly data: Float32Array;

  constructor() {
    this.data = new Float32Array(16);
    this.data[0] = 1;
    this.data[5] = 1;
    this.data[10] = 1;
    this.data[15] = 1;
  }

  static identity(out: Mat4): void {
    const d = out.data;
    d[0] = 1; d[1] = 0; d[2] = 0; d[3] = 0;
    d[4] = 0; d[5] = 1; d[6] = 0; d[7] = 0;
    d[8] = 0; d[9] = 0; d[10] = 1; d[11] = 0;
    d[12] = 0; d[13] = 0; d[14] = 0; d[15] = 1;
  }

  static copy(a: Mat4, out: Mat4): void {
    out.data.set(a.data);
  }

  static multiply(a: Mat4, b: Mat4, out: Mat4): void {
    const ae = a.data, be = b.data, oe = out.data;
    const a00 = ae[0], a01 = ae[4], a02 = ae[8],  a03 = ae[12];
    const a10 = ae[1], a11 = ae[5], a12 = ae[9],  a13 = ae[13];
    const a20 = ae[2], a21 = ae[6], a22 = ae[10], a23 = ae[14];
    const a30 = ae[3], a31 = ae[7], a32 = ae[11], a33 = ae[15];

    let b0 = be[0], b1 = be[1], b2 = be[2], b3 = be[3];
    oe[0] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[1] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[2] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[3] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    b0 = be[4]; b1 = be[5]; b2 = be[6]; b3 = be[7];
    oe[4] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[5] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[6] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[7] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    b0 = be[8]; b1 = be[9]; b2 = be[10]; b3 = be[11];
    oe[8]  = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[9]  = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[10] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[11] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    b0 = be[12]; b1 = be[13]; b2 = be[14]; b3 = be[15];
    oe[12] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[13] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[14] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[15] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;
  }

  static determinant(a: Mat4): number {
    const d = a.data;
    const a00 = d[0], a01 = d[4], a02 = d[8],  a03 = d[12];
    const a10 = d[1], a11 = d[5], a12 = d[9],  a13 = d[13];
    const a20 = d[2], a21 = d[6], a22 = d[10], a23 = d[14];
    const a30 = d[3], a31 = d[7], a32 = d[11], a33 = d[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  }

  static invert(a: Mat4, out: Mat4): boolean {
    const d = a.data;
    const a00 = d[0], a01 = d[4], a02 = d[8],  a03 = d[12];
    const a10 = d[1], a11 = d[5], a12 = d[9],  a13 = d[13];
    const a20 = d[2], a21 = d[6], a22 = d[10], a23 = d[14];
    const a30 = d[3], a31 = d[7], a32 = d[11], a33 = d[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < EPSILON) return false;

    det = 1.0 / det;
    const o = out.data;
    o[0]  = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1]  = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[2]  = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[3]  = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[4]  = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[5]  = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6]  = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[7]  = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[8]  = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[9]  = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[12] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[13] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[14] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return true;
  }

  static transpose(a: Mat4, out: Mat4): void {
    const d = a.data, o = out.data;
    if (d === o) {
      let t: number;
      t = d[1]; o[1] = d[4]; o[4] = t;
      t = d[2]; o[2] = d[8]; o[8] = t;
      t = d[3]; o[3] = d[12]; o[12] = t;
      t = d[6]; o[6] = d[9]; o[9] = t;
      t = d[7]; o[7] = d[13]; o[13] = t;
      t = d[11]; o[11] = d[14]; o[14] = t;
    } else {
      o[0] = d[0]; o[1] = d[4]; o[2] = d[8]; o[3] = d[12];
      o[4] = d[1]; o[5] = d[5]; o[6] = d[9]; o[7] = d[13];
      o[8] = d[2]; o[9] = d[6]; o[10] = d[10]; o[11] = d[14];
      o[12] = d[3]; o[13] = d[7]; o[14] = d[11]; o[15] = d[15];
    }
  }

  static translate(m: Mat4, v: Vec3, out: Mat4): void {
    const x = v.data[0], y = v.data[1], z = v.data[2];
    const d = m.data, o = out.data;

    if (d === o) {
      o[12] = d[0] * x + d[4] * y + d[8]  * z + d[12];
      o[13] = d[1] * x + d[5] * y + d[9]  * z + d[13];
      o[14] = d[2] * x + d[6] * y + d[10] * z + d[14];
      o[15] = d[3] * x + d[7] * y + d[11] * z + d[15];
    } else {
      const a00 = d[0], a01 = d[1], a02 = d[2], a03 = d[3];
      const a10 = d[4], a11 = d[5], a12 = d[6], a13 = d[7];
      const a20 = d[8], a21 = d[9], a22 = d[10], a23 = d[11];
      o[0] = a00; o[1] = a01; o[2] = a02; o[3] = a03;
      o[4] = a10; o[5] = a11; o[6] = a12; o[7] = a13;
      o[8] = a20; o[9] = a21; o[10] = a22; o[11] = a23;
      o[12] = a00 * x + a10 * y + a20 * z + d[12];
      o[13] = a01 * x + a11 * y + a21 * z + d[13];
      o[14] = a02 * x + a12 * y + a22 * z + d[14];
      o[15] = a03 * x + a13 * y + a23 * z + d[15];
    }
  }

  static rotate(m: Mat4, rad: number, axis: Vec3, out: Mat4): void {
    let x = axis.data[0], y = axis.data[1], z = axis.data[2];
    let len = Math.sqrt(x * x + y * y + z * z);
    if (len < EPSILON) return;
    len = 1 / len;
    x *= len; y *= len; z *= len;

    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const t = 1 - c;

    const a = m.data;
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

    const b00 = x * x * t + c,     b01 = y * x * t + z * s, b02 = z * x * t - y * s;
    const b10 = x * y * t - z * s, b11 = y * y * t + c,     b12 = z * y * t + x * s;
    const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;

    const o = out.data;
    o[0]  = a00 * b00 + a10 * b01 + a20 * b02;
    o[1]  = a01 * b00 + a11 * b01 + a21 * b02;
    o[2]  = a02 * b00 + a12 * b01 + a22 * b02;
    o[3]  = a03 * b00 + a13 * b01 + a23 * b02;
    o[4]  = a00 * b10 + a10 * b11 + a20 * b12;
    o[5]  = a01 * b10 + a11 * b11 + a21 * b12;
    o[6]  = a02 * b10 + a12 * b11 + a22 * b12;
    o[7]  = a03 * b10 + a13 * b11 + a23 * b12;
    o[8]  = a00 * b20 + a10 * b21 + a20 * b22;
    o[9]  = a01 * b20 + a11 * b21 + a21 * b22;
    o[10] = a02 * b20 + a12 * b21 + a22 * b22;
    o[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== o) {
      o[12] = a[12]; o[13] = a[13]; o[14] = a[14]; o[15] = a[15];
    }
  }

  static rotateX(m: Mat4, rad: number, out: Mat4): void {
    const s = Math.sin(rad), c = Math.cos(rad);
    const d = m.data, o = out.data;
    const a10 = d[4], a11 = d[5], a12 = d[6], a13 = d[7];
    const a20 = d[8], a21 = d[9], a22 = d[10], a23 = d[11];

    if (d !== o) {
      o[0] = d[0]; o[1] = d[1]; o[2] = d[2]; o[3] = d[3];
      o[12] = d[12]; o[13] = d[13]; o[14] = d[14]; o[15] = d[15];
    }

    o[4]  = a10 * c + a20 * s;
    o[5]  = a11 * c + a21 * s;
    o[6]  = a12 * c + a22 * s;
    o[7]  = a13 * c + a23 * s;
    o[8]  = a20 * c - a10 * s;
    o[9]  = a21 * c - a11 * s;
    o[10] = a22 * c - a12 * s;
    o[11] = a23 * c - a13 * s;
  }

  static rotateY(m: Mat4, rad: number, out: Mat4): void {
    const s = Math.sin(rad), c = Math.cos(rad);
    const d = m.data, o = out.data;
    const a00 = d[0], a01 = d[1], a02 = d[2], a03 = d[3];
    const a20 = d[8], a21 = d[9], a22 = d[10], a23 = d[11];

    if (d !== o) {
      o[4] = d[4]; o[5] = d[5]; o[6] = d[6]; o[7] = d[7];
      o[12] = d[12]; o[13] = d[13]; o[14] = d[14]; o[15] = d[15];
    }

    o[0]  = a00 * c - a20 * s;
    o[1]  = a01 * c - a21 * s;
    o[2]  = a02 * c - a22 * s;
    o[3]  = a03 * c - a23 * s;
    o[8]  = a00 * s + a20 * c;
    o[9]  = a01 * s + a21 * c;
    o[10] = a02 * s + a22 * c;
    o[11] = a03 * s + a23 * c;
  }

  static rotateZ(m: Mat4, rad: number, out: Mat4): void {
    const s = Math.sin(rad), c = Math.cos(rad);
    const d = m.data, o = out.data;
    const a00 = d[0], a01 = d[1], a02 = d[2], a03 = d[3];
    const a10 = d[4], a11 = d[5], a12 = d[6], a13 = d[7];

    if (d !== o) {
      o[8] = d[8]; o[9] = d[9]; o[10] = d[10]; o[11] = d[11];
      o[12] = d[12]; o[13] = d[13]; o[14] = d[14]; o[15] = d[15];
    }

    o[0] = a00 * c + a10 * s;
    o[1] = a01 * c + a11 * s;
    o[2] = a02 * c + a12 * s;
    o[3] = a03 * c + a13 * s;
    o[4] = a10 * c - a00 * s;
    o[5] = a11 * c - a01 * s;
    o[6] = a12 * c - a02 * s;
    o[7] = a13 * c - a03 * s;
  }

  static scale(m: Mat4, v: Vec3, out: Mat4): void {
    const x = v.data[0], y = v.data[1], z = v.data[2];
    const d = m.data, o = out.data;
    o[0] = d[0] * x; o[1] = d[1] * x; o[2] = d[2] * x; o[3] = d[3] * x;
    o[4] = d[4] * y; o[5] = d[5] * y; o[6] = d[6] * y; o[7] = d[7] * y;
    o[8] = d[8] * z; o[9] = d[9] * z; o[10] = d[10] * z; o[11] = d[11] * z;
    o[12] = d[12]; o[13] = d[13]; o[14] = d[14]; o[15] = d[15];
  }

  static perspective(fovY: number, aspect: number, near: number, far: number, out: Mat4): void {
    const f = 1.0 / Math.tan(fovY / 2);
    const o = out.data;
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[11] = -1;
    o[12] = 0; o[13] = 0; o[15] = 0;

    if (far !== Infinity) {
      const nf = 1 / (near - far);
      o[10] = (far + near) * nf;
      o[14] = 2 * far * near * nf;
    } else {
      o[10] = -1;
      o[14] = -2 * near;
    }
  }

  static ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, out: Mat4): void {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    const o = out.data;
    o[0] = -2 * lr; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = -2 * bt; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 2 * nf; o[11] = 0;
    o[12] = (left + right) * lr;
    o[13] = (top + bottom) * bt;
    o[14] = (far + near) * nf;
    o[15] = 1;
  }

  static lookAt(eye: Vec3, center: Vec3, up: Vec3, out: Mat4): void {
    const ex = eye.data[0], ey = eye.data[1], ez = eye.data[2];
    const cx = center.data[0], cy = center.data[1], cz = center.data[2];
    const ux = up.data[0], uy = up.data[1], uz = up.data[2];

    let fx = cx - ex, fy = cy - ey, fz = cz - ez;
    let len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (len < EPSILON) return;
    len = 1 / len;
    fx *= len; fy *= len; fz *= len;

    let sx = fy * uz - fz * uy;
    let sy = fz * ux - fx * uz;
    let sz = fx * uy - fy * ux;
    len = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (len < EPSILON) { sx = 0; sy = 0; sz = 0; }
    else { len = 1 / len; sx *= len; sy *= len; sz *= len; }

    const upx = sy * fz - sz * fy;
    const upy = sz * fx - sx * fz;
    const upz = sx * fy - sy * fx;

    const o = out.data;
    o[0] = sx;  o[1] = upx; o[2] = -fx; o[3] = 0;
    o[4] = sy;  o[5] = upy; o[6] = -fy; o[7] = 0;
    o[8] = sz;  o[9] = upz; o[10] = -fz; o[11] = 0;
    o[12] = -(sx * ex + sy * ey + sz * ez);
    o[13] = -(upx * ex + upy * ey + upz * ez);
    o[14] = fx * ex + fy * ey + fz * ez;
    o[15] = 1;
  }

  static getTranslation(m: Mat4, out: Vec3): void {
    out.data[0] = m.data[12];
    out.data[1] = m.data[13];
    out.data[2] = m.data[14];
  }

  static getScaling(m: Mat4, out: Vec3): void {
    const d = m.data;
    out.data[0] = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    out.data[1] = Math.sqrt(d[4] * d[4] + d[5] * d[5] + d[6] * d[6]);
    out.data[2] = Math.sqrt(d[8] * d[8] + d[9] * d[9] + d[10] * d[10]);
  }

  static equals(a: Mat4, b: Mat4): boolean {
    for (let i = 0; i < 16; i++) {
      if (Math.abs(a.data[i] - b.data[i]) > EPSILON) return false;
    }
    return true;
  }

  static exactEquals(a: Mat4, b: Mat4): boolean {
    for (let i = 0; i < 16; i++) {
      if (a.data[i] !== b.data[i]) return false;
    }
    return true;
  }
}
