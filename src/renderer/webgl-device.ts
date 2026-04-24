import { GLStateCache } from './gl-state-cache';
import { compileShader, linkProgram } from './shader-utils';

export interface WebGLDeviceConfig {
  antialias?: boolean;
  alpha?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
}

export interface GLCapabilities {
  webglVersion: number;
  maxTextureSize: number;
  maxTextureUnits: number;
  instancedArrays: boolean;
  vertexArrayObject: boolean;
  astc: boolean;
  etc2: boolean;
  pvrtc: boolean;
  floatTexture: boolean;
}

export class WebGLDevice {
  readonly gl: WebGLRenderingContext;
  readonly isWebGL2: boolean;
  readonly canvas: unknown;
  readonly capabilities: GLCapabilities;
  readonly stateCache: GLStateCache;

  constructor(canvas: unknown, config?: WebGLDeviceConfig) {
    this.canvas = canvas;
    const attrs: WebGLContextAttributes = {
      antialias: config?.antialias ?? false,
      alpha: config?.alpha ?? false,
      premultipliedAlpha: config?.premultipliedAlpha ?? true,
      preserveDrawingBuffer: config?.preserveDrawingBuffer ?? false,
    };

    const c = canvas as HTMLCanvasElement;
    let gl = c.getContext('webgl2', attrs) as WebGLRenderingContext | null;
    let isWebGL2 = !!gl;

    if (!gl) {
      gl = c.getContext('webgl', attrs) as WebGLRenderingContext | null;
      isWebGL2 = false;
    }

    if (!gl) throw new Error('WebGL not supported');

    this.gl = gl;
    this.isWebGL2 = isWebGL2;
    this.stateCache = new GLStateCache(gl);
    this.capabilities = this.detectCapabilities();

    c.addEventListener?.('webglcontextlost', (e) => { e.preventDefault(); });
    c.addEventListener?.('webglcontextrestored', () => { this.stateCache.invalidate(); });
  }

  private detectCapabilities(): GLCapabilities {
    const gl = this.gl;
    return {
      webglVersion: this.isWebGL2 ? 2 : 1,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      maxTextureUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) as number,
      instancedArrays: this.isWebGL2 || !!gl.getExtension('ANGLE_instanced_arrays'),
      vertexArrayObject: this.isWebGL2 || !!gl.getExtension('OES_vertex_array_object'),
      astc: !!gl.getExtension('WEBGL_compressed_texture_astc'),
      etc2: !!gl.getExtension('WEBGL_compressed_texture_etc'),
      pvrtc: !!gl.getExtension('WEBGL_compressed_texture_pvrtc'),
      floatTexture: !!gl.getExtension('OES_texture_float'),
    };
  }

  clear(r: number, g: number, b: number, a: number): void {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    this.stateCache.setViewport(x, y, width, height);
  }

  getDrawingBufferSize(): { width: number; height: number } {
    return {
      width: this.gl.drawingBufferWidth,
      height: this.gl.drawingBufferHeight,
    };
  }

  createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram {
    const vs = compileShader(this.gl, this.gl.VERTEX_SHADER, vertexSrc);
    const fs = compileShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentSrc);
    const program = linkProgram(this.gl, vs, fs);
    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);
    return program;
  }

  createBuffer(): WebGLBuffer {
    const buf = this.gl.createBuffer();
    if (!buf) throw new Error('Failed to create buffer');
    return buf;
  }

  createTexture(): WebGLTexture {
    const tex = this.gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    return tex;
  }

  destroyProgram(program: WebGLProgram): void {
    this.gl.deleteProgram(program);
    if (this.stateCache.currentProgram === program) {
      this.stateCache.currentProgram = null;
    }
  }

  destroyBuffer(buffer: WebGLBuffer): void {
    this.gl.deleteBuffer(buffer);
  }

  destroyTexture(texture: WebGLTexture): void {
    this.gl.deleteTexture(texture);
    for (let i = 0; i < this.stateCache.boundTextures.length; i++) {
      if (this.stateCache.boundTextures[i] === texture) {
        this.stateCache.boundTextures[i] = null;
      }
    }
  }

  useProgram(program: WebGLProgram): void {
    this.stateCache.useProgram(program);
  }

  bindTexture(slot: number, texture: WebGLTexture): void {
    this.stateCache.bindTexture(slot, texture);
  }

  setBlendState(enabled: boolean, srcFactor?: GLenum, dstFactor?: GLenum): void {
    this.stateCache.setBlendState(enabled, srcFactor, dstFactor);
  }

  setDepthState(enabled: boolean, write?: boolean, func?: GLenum): void {
    this.stateCache.setDepthState(enabled, write, func);
  }

  setCullFace(enabled: boolean, face?: GLenum): void {
    this.stateCache.setCullFace(enabled, face);
  }
}
