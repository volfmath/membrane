import { Mat4 } from '../math/mat4';
import { Vec3 } from '../math/vec3';

export class Camera3D {
  readonly viewMat = new Mat4();
  readonly projMat = new Mat4();
  readonly vpMat   = new Mat4();
  private readonly _mvp = new Mat4();
  private readonly _eye = new Vec3();
  private readonly _tgt = new Vec3();
  private readonly _up  = new Vec3();

  setLookAt(eye: readonly number[], target: readonly number[], up: readonly number[]): void {
    Vec3.set(this._eye, eye[0], eye[1], eye[2]);
    Vec3.set(this._tgt, target[0], target[1], target[2]);
    Vec3.set(this._up,  up[0],  up[1],  up[2]);
    Mat4.lookAt(this._eye, this._tgt, this._up, this.viewMat);
    Mat4.multiply(this.projMat, this.viewMat, this.vpMat);
  }

  setPerspective(fovY: number, aspect: number, near: number, far: number): void {
    Mat4.perspective(fovY, aspect, near, far, this.projMat);
    Mat4.multiply(this.projMat, this.viewMat, this.vpMat);
  }

  // VP * translate(tx, ty, tz) * uniformScale(scale) — optimized for translation + uniform scale
  buildMVP(tx: number, ty: number, tz: number, scale = 1): Float32Array {
    const v = this.vpMat.data, m = this._mvp.data;
    m[0]=v[0]*scale; m[1]=v[1]*scale; m[2]=v[2]*scale; m[3]=v[3]*scale;
    m[4]=v[4]*scale; m[5]=v[5]*scale; m[6]=v[6]*scale; m[7]=v[7]*scale;
    m[8]=v[8]*scale; m[9]=v[9]*scale; m[10]=v[10]*scale; m[11]=v[11]*scale;
    m[12]=v[0]*tx+v[4]*ty+v[8]*tz+v[12];
    m[13]=v[1]*tx+v[5]*ty+v[9]*tz+v[13];
    m[14]=v[2]*tx+v[6]*ty+v[10]*tz+v[14];
    m[15]=v[3]*tx+v[7]*ty+v[11]*tz+v[15];
    return m;
  }

  worldToScreen(wx: number, wy: number, wz: number, screenW: number, screenH: number): { x: number; y: number } | null {
    const v = this.vpMat.data;
    const cx = v[0]*wx + v[4]*wy + v[8]*wz  + v[12];
    const cy = v[1]*wx + v[5]*wy + v[9]*wz  + v[13];
    const cw = v[3]*wx + v[7]*wy + v[11]*wz + v[15];
    if (Math.abs(cw) < 1e-6) return null;
    return { x: (cx/cw + 1) * 0.5 * screenW, y: (1 - cy/cw) * 0.5 * screenH };
  }
}
