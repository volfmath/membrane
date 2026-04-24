export interface BlendState {
  enabled: boolean;
  srcFactor: GLenum;
  dstFactor: GLenum;
}

export interface DepthState {
  enabled: boolean;
  write: boolean;
  func: GLenum;
}

export interface CullState {
  enabled: boolean;
  face: GLenum;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class GLStateCache {
  private gl: WebGLRenderingContext;
  currentProgram: WebGLProgram | null = null;
  boundTextures: (WebGLTexture | null)[];
  blend: BlendState;
  depth: DepthState;
  cull: CullState;
  viewport: Viewport;
  skippedCalls = 0;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.boundTextures = new Array(8).fill(null);
    this.blend = { enabled: false, srcFactor: gl.ONE, dstFactor: gl.ZERO };
    this.depth = { enabled: false, write: true, func: gl.LESS };
    this.cull = { enabled: false, face: gl.BACK };
    this.viewport = { x: 0, y: 0, width: 0, height: 0 };
  }

  useProgram(program: WebGLProgram): void {
    if (this.currentProgram === program) { this.skippedCalls++; return; }
    this.gl.useProgram(program);
    this.currentProgram = program;
  }

  bindTexture(slot: number, texture: WebGLTexture): void {
    if (this.boundTextures[slot] === texture) { this.skippedCalls++; return; }
    this.gl.activeTexture(this.gl.TEXTURE0 + slot);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.boundTextures[slot] = texture;
  }

  setBlendState(enabled: boolean, srcFactor?: GLenum, dstFactor?: GLenum): void {
    const src = srcFactor ?? this.gl.SRC_ALPHA;
    const dst = dstFactor ?? this.gl.ONE_MINUS_SRC_ALPHA;

    if (this.blend.enabled === enabled && this.blend.srcFactor === src && this.blend.dstFactor === dst) {
      this.skippedCalls++;
      return;
    }

    if (enabled !== this.blend.enabled) {
      if (enabled) this.gl.enable(this.gl.BLEND);
      else this.gl.disable(this.gl.BLEND);
    }
    if (enabled && (src !== this.blend.srcFactor || dst !== this.blend.dstFactor)) {
      this.gl.blendFunc(src, dst);
    }
    this.blend.enabled = enabled;
    this.blend.srcFactor = src;
    this.blend.dstFactor = dst;
  }

  setDepthState(enabled: boolean, write?: boolean, func?: GLenum): void {
    const w = write ?? true;
    const f = func ?? this.gl.LESS;

    if (this.depth.enabled === enabled && this.depth.write === w && this.depth.func === f) {
      this.skippedCalls++;
      return;
    }

    if (enabled !== this.depth.enabled) {
      if (enabled) this.gl.enable(this.gl.DEPTH_TEST);
      else this.gl.disable(this.gl.DEPTH_TEST);
    }
    if (w !== this.depth.write) this.gl.depthMask(w);
    if (f !== this.depth.func) this.gl.depthFunc(f);
    this.depth.enabled = enabled;
    this.depth.write = w;
    this.depth.func = f;
  }

  setCullFace(enabled: boolean, face?: GLenum): void {
    const f = face ?? this.gl.BACK;
    if (this.cull.enabled === enabled && this.cull.face === f) {
      this.skippedCalls++;
      return;
    }
    if (enabled !== this.cull.enabled) {
      if (enabled) this.gl.enable(this.gl.CULL_FACE);
      else this.gl.disable(this.gl.CULL_FACE);
    }
    if (f !== this.cull.face) this.gl.cullFace(f);
    this.cull.enabled = enabled;
    this.cull.face = f;
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    if (this.viewport.x === x && this.viewport.y === y && this.viewport.width === width && this.viewport.height === height) {
      this.skippedCalls++;
      return;
    }
    this.gl.viewport(x, y, width, height);
    this.viewport.x = x;
    this.viewport.y = y;
    this.viewport.width = width;
    this.viewport.height = height;
  }

  invalidate(): void {
    this.currentProgram = null;
    this.boundTextures.fill(null);
    this.blend.enabled = false;
    this.depth.enabled = false;
    this.cull.enabled = false;
    this.viewport.x = -1;
  }
}
