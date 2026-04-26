import { WebGLDevice } from './webgl-device';

export interface VertexAttrib {
  location: number;
  components: number;  // float32 components: 2, 3, or 4
  offset: number;      // byte offset into vertex
}

export class Mesh {
  private readonly _vbo: WebGLBuffer;
  private readonly _ibo: WebGLBuffer;
  readonly indexCount: number;
  readonly stride: number;

  constructor(device: WebGLDevice, vertices: Float32Array, indices: Uint16Array, stride: number) {
    const gl = device.gl;
    this.indexCount = indices.length;
    this.stride = stride;

    this._vbo = device.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this._ibo = device.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  bind(gl: WebGLRenderingContext, attribs: readonly VertexAttrib[]): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    for (const a of attribs) {
      gl.enableVertexAttribArray(a.location);
      gl.vertexAttribPointer(a.location, a.components, gl.FLOAT, false, this.stride, a.offset);
    }
  }

  draw(gl: WebGLRenderingContext): void {
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  unbind(gl: WebGLRenderingContext, attribs: readonly VertexAttrib[]): void {
    for (const a of attribs) gl.disableVertexAttribArray(a.location);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  destroy(device: WebGLDevice): void {
    device.destroyBuffer(this._vbo);
    device.destroyBuffer(this._ibo);
  }
}
