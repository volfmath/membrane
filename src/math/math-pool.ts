import { Vec2 } from './vec2';
import { Vec3 } from './vec3';
import { Mat4 } from './mat4';

export interface MathPoolConfig {
  vec2Count: number;
  vec3Count: number;
  mat4Count: number;
}

export class MathPool {
  private readonly vec2s: Vec2[];
  private readonly vec3s: Vec3[];
  private readonly mat4s: Mat4[];
  private vec2Cursor = 0;
  private vec3Cursor = 0;
  private mat4Cursor = 0;

  constructor(config: MathPoolConfig) {
    this.vec2s = new Array(config.vec2Count);
    for (let i = 0; i < config.vec2Count; i++) this.vec2s[i] = new Vec2();

    this.vec3s = new Array(config.vec3Count);
    for (let i = 0; i < config.vec3Count; i++) this.vec3s[i] = new Vec3();

    this.mat4s = new Array(config.mat4Count);
    for (let i = 0; i < config.mat4Count; i++) this.mat4s[i] = new Mat4();
  }

  getVec2(): Vec2 {
    if (this.vec2Cursor >= this.vec2s.length) throw new Error('MathPool exhausted: vec2');
    return this.vec2s[this.vec2Cursor++];
  }

  getVec3(): Vec3 {
    if (this.vec3Cursor >= this.vec3s.length) throw new Error('MathPool exhausted: vec3');
    return this.vec3s[this.vec3Cursor++];
  }

  getMat4(): Mat4 {
    if (this.mat4Cursor >= this.mat4s.length) throw new Error('MathPool exhausted: mat4');
    return this.mat4s[this.mat4Cursor++];
  }

  releaseAll(): void {
    this.vec2Cursor = 0;
    this.vec3Cursor = 0;
    this.mat4Cursor = 0;
  }
}
