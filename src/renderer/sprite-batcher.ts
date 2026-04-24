import type { Mat4 } from '../math/mat4';
import type { WebGLDevice } from './webgl-device';
import { SPRITE_VERTEX_SHADER, SPRITE_FRAGMENT_SHADER } from './default-shaders';

const MAX_SPRITES_PER_BATCH = 2048;
const VERTICES_PER_SPRITE = 4;
const INDICES_PER_SPRITE = 6;
const FLOATS_PER_VERTEX = 5; // posX, posY, u, v, colorAsFloat

export class SpriteBatcher {
  private device: WebGLDevice;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private vertexBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;
  private vertexData: Float32Array;
  private colorView: Uint32Array;

  private aPosition: number;
  private aTexCoord: number;
  private aColor: number;
  private uProjection: WebGLUniformLocation | null;
  private uTexture: WebGLUniformLocation | null;

  private currentTexture: WebGLTexture | null = null;
  private spriteIdx = 0;
  private _drawCallCount = 0;
  private _spriteCount = 0;
  private batching = false;

  constructor(device: WebGLDevice) {
    this.device = device;
    this.gl = device.gl;

    this.program = device.createProgram(SPRITE_VERTEX_SHADER, SPRITE_FRAGMENT_SHADER);

    const gl = this.gl;
    this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
    this.aTexCoord = gl.getAttribLocation(this.program, 'aTexCoord');
    this.aColor = gl.getAttribLocation(this.program, 'aColor');
    this.uProjection = gl.getUniformLocation(this.program, 'uProjection');
    this.uTexture = gl.getUniformLocation(this.program, 'uTexture');

    const totalFloats = MAX_SPRITES_PER_BATCH * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX;
    this.vertexData = new Float32Array(totalFloats);
    this.colorView = new Uint32Array(this.vertexData.buffer);

    this.vertexBuffer = device.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

    const indices = new Uint16Array(MAX_SPRITES_PER_BATCH * INDICES_PER_SPRITE);
    for (let i = 0; i < MAX_SPRITES_PER_BATCH; i++) {
      const vi = i * 4;
      const ii = i * 6;
      indices[ii] = vi;
      indices[ii + 1] = vi + 1;
      indices[ii + 2] = vi + 2;
      indices[ii + 3] = vi;
      indices[ii + 4] = vi + 2;
      indices[ii + 5] = vi + 3;
    }
    this.indexBuffer = device.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }

  get drawCallCount(): number { return this._drawCallCount; }
  get spriteCount(): number { return this._spriteCount; }

  begin(projectionMatrix: Mat4): void {
    this.batching = true;
    this.spriteIdx = 0;
    this._drawCallCount = 0;
    this._spriteCount = 0;
    this.currentTexture = null;

    const gl = this.gl;
    this.device.useProgram(this.program);
    gl.uniformMatrix4fv(this.uProjection, false, projectionMatrix.data);
    gl.uniform1i(this.uTexture, 0);

    this.device.setBlendState(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.device.setDepthState(false);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    const stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.UNSIGNED_BYTE, true, stride, 16);
  }

  draw(
    texture: WebGLTexture,
    x: number, y: number, width: number, height: number,
    rotation = 0,
    u0 = 0, v0 = 0, u1 = 1, v1 = 1,
    color = 0xFFFFFFFF,
  ): void {
    if (this.currentTexture !== null && this.currentTexture !== texture) {
      this.flush();
    }
    if (this.spriteIdx >= MAX_SPRITES_PER_BATCH) {
      this.flush();
    }
    this.currentTexture = texture;

    const i = this.spriteIdx * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX;

    if (rotation === 0) {
      const x1 = x + width;
      const y1 = y + height;

      // top-left
      this.vertexData[i] = x;       this.vertexData[i + 1] = y;
      this.vertexData[i + 2] = u0;  this.vertexData[i + 3] = v0;
      this.colorView[i + 4] = color;
      // top-right
      this.vertexData[i + 5] = x1;  this.vertexData[i + 6] = y;
      this.vertexData[i + 7] = u1;  this.vertexData[i + 8] = v0;
      this.colorView[i + 9] = color;
      // bottom-right
      this.vertexData[i + 10] = x1; this.vertexData[i + 11] = y1;
      this.vertexData[i + 12] = u1; this.vertexData[i + 13] = v1;
      this.colorView[i + 14] = color;
      // bottom-left
      this.vertexData[i + 15] = x;  this.vertexData[i + 16] = y1;
      this.vertexData[i + 17] = u0; this.vertexData[i + 18] = v1;
      this.colorView[i + 19] = color;
    } else {
      const cx = x + width * 0.5;
      const cy = y + height * 0.5;
      const hw = width * 0.5;
      const hh = height * 0.5;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);

      const corners = [
        [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
      ];
      const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

      for (let c = 0; c < 4; c++) {
        const vi = i + c * FLOATS_PER_VERTEX;
        const lx = corners[c][0], ly = corners[c][1];
        this.vertexData[vi] = cx + lx * cos - ly * sin;
        this.vertexData[vi + 1] = cy + lx * sin + ly * cos;
        this.vertexData[vi + 2] = uvs[c][0];
        this.vertexData[vi + 3] = uvs[c][1];
        this.colorView[vi + 4] = color;
      }
    }

    this.spriteIdx++;
    this._spriteCount++;
  }

  end(): void {
    if (this.spriteIdx > 0) this.flush();
    this.batching = false;
  }

  private flush(): void {
    if (this.spriteIdx === 0) return;

    const gl = this.gl;
    this.device.bindTexture(0, this.currentTexture!);

    const floatCount = this.spriteIdx * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData.subarray(0, floatCount));

    gl.drawElements(gl.TRIANGLES, this.spriteIdx * INDICES_PER_SPRITE, gl.UNSIGNED_SHORT, 0);

    this._drawCallCount++;
    this.spriteIdx = 0;
  }
}
