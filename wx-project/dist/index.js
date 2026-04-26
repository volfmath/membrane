"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/renderer/gl-state-cache.ts
var GLStateCache = class {
  constructor(gl) {
    this.currentProgram = null;
    this.skippedCalls = 0;
    this.gl = gl;
    this.boundTextures = new Array(8).fill(null);
    this.blend = { enabled: false, srcFactor: gl.ONE, dstFactor: gl.ZERO };
    this.depth = { enabled: false, write: true, func: gl.LESS };
    this.cull = { enabled: false, face: gl.BACK };
    this.viewport = { x: 0, y: 0, width: 0, height: 0 };
  }
  useProgram(program) {
    if (this.currentProgram === program) {
      this.skippedCalls++;
      return;
    }
    this.gl.useProgram(program);
    this.currentProgram = program;
  }
  bindTexture(slot, texture) {
    if (this.boundTextures[slot] === texture) {
      this.skippedCalls++;
      return;
    }
    this.gl.activeTexture(this.gl.TEXTURE0 + slot);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.boundTextures[slot] = texture;
  }
  setBlendState(enabled, srcFactor, dstFactor) {
    const src = srcFactor != null ? srcFactor : this.gl.SRC_ALPHA;
    const dst = dstFactor != null ? dstFactor : this.gl.ONE_MINUS_SRC_ALPHA;
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
  setDepthState(enabled, write, func) {
    const w = write != null ? write : true;
    const f = func != null ? func : this.gl.LESS;
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
  setCullFace(enabled, face) {
    const f = face != null ? face : this.gl.BACK;
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
  setViewport(x, y, width, height) {
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
  invalidate() {
    this.currentProgram = null;
    this.boundTextures.fill(null);
    this.blend.enabled = false;
    this.depth.enabled = false;
    this.cull.enabled = false;
    this.viewport.x = -1;
  }
};

// src/renderer/shader-utils.ts
function compileShader(gl, type, source) {
  var _a;
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = (_a = gl.getShaderInfoLog(shader)) != null ? _a : "";
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}
function linkProgram(gl, vs, fs) {
  var _a;
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = (_a = gl.getProgramInfoLog(program)) != null ? _a : "";
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}
function getUniformLocations(gl, program, names) {
  const result = {};
  for (const name of names) {
    const loc = gl.getUniformLocation(program, name);
    if (loc !== null) result[name] = loc;
  }
  return result;
}
function getAttributeLocations(gl, program, names) {
  const result = {};
  for (const name of names) {
    result[name] = gl.getAttribLocation(program, name);
  }
  return result;
}

// src/renderer/webgl-device.ts
var WebGLDevice = class {
  constructor(canvas, config) {
    var _a, _b, _c, _d, _e, _f;
    this.canvas = canvas;
    const attrs = {
      antialias: (_a = config == null ? void 0 : config.antialias) != null ? _a : false,
      alpha: (_b = config == null ? void 0 : config.alpha) != null ? _b : false,
      premultipliedAlpha: (_c = config == null ? void 0 : config.premultipliedAlpha) != null ? _c : true,
      preserveDrawingBuffer: (_d = config == null ? void 0 : config.preserveDrawingBuffer) != null ? _d : false
    };
    const c = canvas;
    let gl = c.getContext("webgl2", attrs);
    let isWebGL2 = !!gl;
    if (!gl) {
      gl = c.getContext("webgl", attrs);
      isWebGL2 = false;
    }
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.isWebGL2 = isWebGL2;
    this.stateCache = new GLStateCache(gl);
    this.capabilities = this.detectCapabilities();
    (_e = c.addEventListener) == null ? void 0 : _e.call(c, "webglcontextlost", (e) => {
      e.preventDefault();
    });
    (_f = c.addEventListener) == null ? void 0 : _f.call(c, "webglcontextrestored", () => {
      this.stateCache.invalidate();
    });
  }
  detectCapabilities() {
    const gl = this.gl;
    return {
      webglVersion: this.isWebGL2 ? 2 : 1,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      instancedArrays: this.isWebGL2 || !!gl.getExtension("ANGLE_instanced_arrays"),
      vertexArrayObject: this.isWebGL2 || !!gl.getExtension("OES_vertex_array_object"),
      astc: !!gl.getExtension("WEBGL_compressed_texture_astc"),
      etc2: !!gl.getExtension("WEBGL_compressed_texture_etc"),
      pvrtc: !!gl.getExtension("WEBGL_compressed_texture_pvrtc"),
      floatTexture: !!gl.getExtension("OES_texture_float")
    };
  }
  clear(r, g, b, a) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
  setViewport(x, y, width, height) {
    this.stateCache.setViewport(x, y, width, height);
  }
  getDrawingBufferSize() {
    return {
      width: this.gl.drawingBufferWidth,
      height: this.gl.drawingBufferHeight
    };
  }
  createProgram(vertexSrc, fragmentSrc) {
    const vs = compileShader(this.gl, this.gl.VERTEX_SHADER, vertexSrc);
    const fs = compileShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentSrc);
    const program = linkProgram(this.gl, vs, fs);
    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);
    return program;
  }
  createBuffer() {
    const buf = this.gl.createBuffer();
    if (!buf) throw new Error("Failed to create buffer");
    return buf;
  }
  createTexture() {
    const tex = this.gl.createTexture();
    if (!tex) throw new Error("Failed to create texture");
    return tex;
  }
  destroyProgram(program) {
    this.gl.deleteProgram(program);
    if (this.stateCache.currentProgram === program) {
      this.stateCache.currentProgram = null;
    }
  }
  destroyBuffer(buffer) {
    this.gl.deleteBuffer(buffer);
  }
  destroyTexture(texture) {
    this.gl.deleteTexture(texture);
    for (let i = 0; i < this.stateCache.boundTextures.length; i++) {
      if (this.stateCache.boundTextures[i] === texture) {
        this.stateCache.boundTextures[i] = null;
      }
    }
  }
  useProgram(program) {
    this.stateCache.useProgram(program);
  }
  bindTexture(slot, texture) {
    this.stateCache.bindTexture(slot, texture);
  }
  setBlendState(enabled, srcFactor, dstFactor) {
    this.stateCache.setBlendState(enabled, srcFactor, dstFactor);
  }
  setDepthState(enabled, write, func) {
    this.stateCache.setDepthState(enabled, write, func);
  }
  setCullFace(enabled, face) {
    this.stateCache.setCullFace(enabled, face);
  }
};

// src/renderer/default-shaders.ts
var SPRITE_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
attribute vec4 aColor;

uniform mat4 uProjection;

varying vec2 vTexCoord;
varying vec4 vColor;

void main() {
  vTexCoord = aTexCoord;
  vColor = aColor;
  gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
}
`;
var SPRITE_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;

uniform sampler2D uTexture;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord) * vColor;
}
`;

// src/renderer/sprite-batcher.ts
var MAX_SPRITES_PER_BATCH = 2048;
var VERTICES_PER_SPRITE = 4;
var INDICES_PER_SPRITE = 6;
var FLOATS_PER_VERTEX = 5;
var SpriteBatcher = class {
  constructor(device) {
    this.currentTexture = null;
    this.spriteIdx = 0;
    this._drawCallCount = 0;
    this._spriteCount = 0;
    this.batching = false;
    this.device = device;
    this.gl = device.gl;
    this.program = device.createProgram(SPRITE_VERTEX_SHADER, SPRITE_FRAGMENT_SHADER);
    const gl = this.gl;
    this.aPosition = gl.getAttribLocation(this.program, "aPosition");
    this.aTexCoord = gl.getAttribLocation(this.program, "aTexCoord");
    this.aColor = gl.getAttribLocation(this.program, "aColor");
    this.uProjection = gl.getUniformLocation(this.program, "uProjection");
    this.uTexture = gl.getUniformLocation(this.program, "uTexture");
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
  get drawCallCount() {
    return this._drawCallCount;
  }
  get spriteCount() {
    return this._spriteCount;
  }
  begin(projectionMatrix) {
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
  draw(texture, x, y, width, height, rotation = 0, u0 = 0, v0 = 0, u1 = 1, v1 = 1, color = 4294967295) {
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
      this.vertexData[i] = x;
      this.vertexData[i + 1] = y;
      this.vertexData[i + 2] = u0;
      this.vertexData[i + 3] = v0;
      this.colorView[i + 4] = color;
      this.vertexData[i + 5] = x1;
      this.vertexData[i + 6] = y;
      this.vertexData[i + 7] = u1;
      this.vertexData[i + 8] = v0;
      this.colorView[i + 9] = color;
      this.vertexData[i + 10] = x1;
      this.vertexData[i + 11] = y1;
      this.vertexData[i + 12] = u1;
      this.vertexData[i + 13] = v1;
      this.colorView[i + 14] = color;
      this.vertexData[i + 15] = x;
      this.vertexData[i + 16] = y1;
      this.vertexData[i + 17] = u0;
      this.vertexData[i + 18] = v1;
      this.colorView[i + 19] = color;
    } else {
      const cx = x + width * 0.5;
      const cy = y + height * 0.5;
      const hw = width * 0.5;
      const hh = height * 0.5;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const corners = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh]
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
  end() {
    if (this.spriteIdx > 0) this.flush();
    this.batching = false;
  }
  flush() {
    if (this.spriteIdx === 0) return;
    const gl = this.gl;
    this.device.bindTexture(0, this.currentTexture);
    const floatCount = this.spriteIdx * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData.subarray(0, floatCount));
    gl.drawElements(gl.TRIANGLES, this.spriteIdx * INDICES_PER_SPRITE, gl.UNSIGNED_SHORT, 0);
    this._drawCallCount++;
    this.spriteIdx = 0;
  }
};

// src/renderer/mesh.ts
var Mesh = class {
  constructor(device, vertices, indices, stride) {
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
  bind(gl, attribs) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    for (const a of attribs) {
      gl.enableVertexAttribArray(a.location);
      gl.vertexAttribPointer(a.location, a.components, gl.FLOAT, false, this.stride, a.offset);
    }
  }
  draw(gl) {
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }
  unbind(gl, attribs) {
    for (const a of attribs) gl.disableVertexAttribArray(a.location);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
  destroy(device) {
    device.destroyBuffer(this._vbo);
    device.destroyBuffer(this._ibo);
  }
};

// src/math/constants.ts
var EPSILON = 1e-6;
var DEG_TO_RAD = Math.PI / 180;
var RAD_TO_DEG = 180 / Math.PI;

// src/math/mat4.ts
var Mat4 = class {
  constructor() {
    this.data = new Float32Array(16);
    this.data[0] = 1;
    this.data[5] = 1;
    this.data[10] = 1;
    this.data[15] = 1;
  }
  static identity(out) {
    const d = out.data;
    d[0] = 1;
    d[1] = 0;
    d[2] = 0;
    d[3] = 0;
    d[4] = 0;
    d[5] = 1;
    d[6] = 0;
    d[7] = 0;
    d[8] = 0;
    d[9] = 0;
    d[10] = 1;
    d[11] = 0;
    d[12] = 0;
    d[13] = 0;
    d[14] = 0;
    d[15] = 1;
  }
  static copy(a, out) {
    out.data.set(a.data);
  }
  static multiply(a, b, out) {
    const ae = a.data, be = b.data, oe = out.data;
    const a00 = ae[0], a01 = ae[4], a02 = ae[8], a03 = ae[12];
    const a10 = ae[1], a11 = ae[5], a12 = ae[9], a13 = ae[13];
    const a20 = ae[2], a21 = ae[6], a22 = ae[10], a23 = ae[14];
    const a30 = ae[3], a31 = ae[7], a32 = ae[11], a33 = ae[15];
    let b0 = be[0], b1 = be[1], b2 = be[2], b3 = be[3];
    oe[0] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[1] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[2] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[3] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;
    b0 = be[4];
    b1 = be[5];
    b2 = be[6];
    b3 = be[7];
    oe[4] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[5] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[6] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[7] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;
    b0 = be[8];
    b1 = be[9];
    b2 = be[10];
    b3 = be[11];
    oe[8] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[9] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[10] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[11] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;
    b0 = be[12];
    b1 = be[13];
    b2 = be[14];
    b3 = be[15];
    oe[12] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    oe[13] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    oe[14] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    oe[15] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;
  }
  static determinant(a) {
    const d = a.data;
    const a00 = d[0], a01 = d[4], a02 = d[8], a03 = d[12];
    const a10 = d[1], a11 = d[5], a12 = d[9], a13 = d[13];
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
  static invert(a, out) {
    const d = a.data;
    const a00 = d[0], a01 = d[4], a02 = d[8], a03 = d[12];
    const a10 = d[1], a11 = d[5], a12 = d[9], a13 = d[13];
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
    det = 1 / det;
    const o = out.data;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[3] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[4] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[7] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[8] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[9] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[12] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[13] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[14] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return true;
  }
  static transpose(a, out) {
    const d = a.data, o = out.data;
    if (d === o) {
      let t;
      t = d[1];
      o[1] = d[4];
      o[4] = t;
      t = d[2];
      o[2] = d[8];
      o[8] = t;
      t = d[3];
      o[3] = d[12];
      o[12] = t;
      t = d[6];
      o[6] = d[9];
      o[9] = t;
      t = d[7];
      o[7] = d[13];
      o[13] = t;
      t = d[11];
      o[11] = d[14];
      o[14] = t;
    } else {
      o[0] = d[0];
      o[1] = d[4];
      o[2] = d[8];
      o[3] = d[12];
      o[4] = d[1];
      o[5] = d[5];
      o[6] = d[9];
      o[7] = d[13];
      o[8] = d[2];
      o[9] = d[6];
      o[10] = d[10];
      o[11] = d[14];
      o[12] = d[3];
      o[13] = d[7];
      o[14] = d[11];
      o[15] = d[15];
    }
  }
  static translate(m, v, out) {
    const x = v.data[0], y = v.data[1], z = v.data[2];
    const d = m.data, o = out.data;
    if (d === o) {
      o[12] = d[0] * x + d[4] * y + d[8] * z + d[12];
      o[13] = d[1] * x + d[5] * y + d[9] * z + d[13];
      o[14] = d[2] * x + d[6] * y + d[10] * z + d[14];
      o[15] = d[3] * x + d[7] * y + d[11] * z + d[15];
    } else {
      const a00 = d[0], a01 = d[1], a02 = d[2], a03 = d[3];
      const a10 = d[4], a11 = d[5], a12 = d[6], a13 = d[7];
      const a20 = d[8], a21 = d[9], a22 = d[10], a23 = d[11];
      o[0] = a00;
      o[1] = a01;
      o[2] = a02;
      o[3] = a03;
      o[4] = a10;
      o[5] = a11;
      o[6] = a12;
      o[7] = a13;
      o[8] = a20;
      o[9] = a21;
      o[10] = a22;
      o[11] = a23;
      o[12] = a00 * x + a10 * y + a20 * z + d[12];
      o[13] = a01 * x + a11 * y + a21 * z + d[13];
      o[14] = a02 * x + a12 * y + a22 * z + d[14];
      o[15] = a03 * x + a13 * y + a23 * z + d[15];
    }
  }
  static rotate(m, rad, axis, out) {
    let x = axis.data[0], y = axis.data[1], z = axis.data[2];
    let len = Math.sqrt(x * x + y * y + z * z);
    if (len < EPSILON) return;
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const t = 1 - c;
    const a = m.data;
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const b00 = x * x * t + c, b01 = y * x * t + z * s, b02 = z * x * t - y * s;
    const b10 = x * y * t - z * s, b11 = y * y * t + c, b12 = z * y * t + x * s;
    const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
    const o = out.data;
    o[0] = a00 * b00 + a10 * b01 + a20 * b02;
    o[1] = a01 * b00 + a11 * b01 + a21 * b02;
    o[2] = a02 * b00 + a12 * b01 + a22 * b02;
    o[3] = a03 * b00 + a13 * b01 + a23 * b02;
    o[4] = a00 * b10 + a10 * b11 + a20 * b12;
    o[5] = a01 * b10 + a11 * b11 + a21 * b12;
    o[6] = a02 * b10 + a12 * b11 + a22 * b12;
    o[7] = a03 * b10 + a13 * b11 + a23 * b12;
    o[8] = a00 * b20 + a10 * b21 + a20 * b22;
    o[9] = a01 * b20 + a11 * b21 + a21 * b22;
    o[10] = a02 * b20 + a12 * b21 + a22 * b22;
    o[11] = a03 * b20 + a13 * b21 + a23 * b22;
    if (a !== o) {
      o[12] = a[12];
      o[13] = a[13];
      o[14] = a[14];
      o[15] = a[15];
    }
  }
  static rotateX(m, rad, out) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const d = m.data, o = out.data;
    const a10 = d[4], a11 = d[5], a12 = d[6], a13 = d[7];
    const a20 = d[8], a21 = d[9], a22 = d[10], a23 = d[11];
    if (d !== o) {
      o[0] = d[0];
      o[1] = d[1];
      o[2] = d[2];
      o[3] = d[3];
      o[12] = d[12];
      o[13] = d[13];
      o[14] = d[14];
      o[15] = d[15];
    }
    o[4] = a10 * c + a20 * s;
    o[5] = a11 * c + a21 * s;
    o[6] = a12 * c + a22 * s;
    o[7] = a13 * c + a23 * s;
    o[8] = a20 * c - a10 * s;
    o[9] = a21 * c - a11 * s;
    o[10] = a22 * c - a12 * s;
    o[11] = a23 * c - a13 * s;
  }
  static rotateY(m, rad, out) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const d = m.data, o = out.data;
    const a00 = d[0], a01 = d[1], a02 = d[2], a03 = d[3];
    const a20 = d[8], a21 = d[9], a22 = d[10], a23 = d[11];
    if (d !== o) {
      o[4] = d[4];
      o[5] = d[5];
      o[6] = d[6];
      o[7] = d[7];
      o[12] = d[12];
      o[13] = d[13];
      o[14] = d[14];
      o[15] = d[15];
    }
    o[0] = a00 * c - a20 * s;
    o[1] = a01 * c - a21 * s;
    o[2] = a02 * c - a22 * s;
    o[3] = a03 * c - a23 * s;
    o[8] = a00 * s + a20 * c;
    o[9] = a01 * s + a21 * c;
    o[10] = a02 * s + a22 * c;
    o[11] = a03 * s + a23 * c;
  }
  static rotateZ(m, rad, out) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const d = m.data, o = out.data;
    const a00 = d[0], a01 = d[1], a02 = d[2], a03 = d[3];
    const a10 = d[4], a11 = d[5], a12 = d[6], a13 = d[7];
    if (d !== o) {
      o[8] = d[8];
      o[9] = d[9];
      o[10] = d[10];
      o[11] = d[11];
      o[12] = d[12];
      o[13] = d[13];
      o[14] = d[14];
      o[15] = d[15];
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
  static scale(m, v, out) {
    const x = v.data[0], y = v.data[1], z = v.data[2];
    const d = m.data, o = out.data;
    o[0] = d[0] * x;
    o[1] = d[1] * x;
    o[2] = d[2] * x;
    o[3] = d[3] * x;
    o[4] = d[4] * y;
    o[5] = d[5] * y;
    o[6] = d[6] * y;
    o[7] = d[7] * y;
    o[8] = d[8] * z;
    o[9] = d[9] * z;
    o[10] = d[10] * z;
    o[11] = d[11] * z;
    o[12] = d[12];
    o[13] = d[13];
    o[14] = d[14];
    o[15] = d[15];
  }
  static perspective(fovY, aspect, near, far, out) {
    const f = 1 / Math.tan(fovY / 2);
    const o = out.data;
    o[0] = f / aspect;
    o[1] = 0;
    o[2] = 0;
    o[3] = 0;
    o[4] = 0;
    o[5] = f;
    o[6] = 0;
    o[7] = 0;
    o[8] = 0;
    o[9] = 0;
    o[11] = -1;
    o[12] = 0;
    o[13] = 0;
    o[15] = 0;
    if (far !== Infinity) {
      const nf = 1 / (near - far);
      o[10] = (far + near) * nf;
      o[14] = 2 * far * near * nf;
    } else {
      o[10] = -1;
      o[14] = -2 * near;
    }
  }
  static ortho(left, right, bottom, top, near, far, out) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    const o = out.data;
    o[0] = -2 * lr;
    o[1] = 0;
    o[2] = 0;
    o[3] = 0;
    o[4] = 0;
    o[5] = -2 * bt;
    o[6] = 0;
    o[7] = 0;
    o[8] = 0;
    o[9] = 0;
    o[10] = 2 * nf;
    o[11] = 0;
    o[12] = (left + right) * lr;
    o[13] = (top + bottom) * bt;
    o[14] = (far + near) * nf;
    o[15] = 1;
  }
  static lookAt(eye, center, up, out) {
    const ex = eye.data[0], ey = eye.data[1], ez = eye.data[2];
    const cx = center.data[0], cy = center.data[1], cz = center.data[2];
    const ux = up.data[0], uy = up.data[1], uz = up.data[2];
    let fx = cx - ex, fy = cy - ey, fz = cz - ez;
    let len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (len < EPSILON) return;
    len = 1 / len;
    fx *= len;
    fy *= len;
    fz *= len;
    let sx = fy * uz - fz * uy;
    let sy = fz * ux - fx * uz;
    let sz = fx * uy - fy * ux;
    len = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (len < EPSILON) {
      sx = 0;
      sy = 0;
      sz = 0;
    } else {
      len = 1 / len;
      sx *= len;
      sy *= len;
      sz *= len;
    }
    const upx = sy * fz - sz * fy;
    const upy = sz * fx - sx * fz;
    const upz = sx * fy - sy * fx;
    const o = out.data;
    o[0] = sx;
    o[1] = upx;
    o[2] = -fx;
    o[3] = 0;
    o[4] = sy;
    o[5] = upy;
    o[6] = -fy;
    o[7] = 0;
    o[8] = sz;
    o[9] = upz;
    o[10] = -fz;
    o[11] = 0;
    o[12] = -(sx * ex + sy * ey + sz * ez);
    o[13] = -(upx * ex + upy * ey + upz * ez);
    o[14] = fx * ex + fy * ey + fz * ez;
    o[15] = 1;
  }
  static getTranslation(m, out) {
    out.data[0] = m.data[12];
    out.data[1] = m.data[13];
    out.data[2] = m.data[14];
  }
  static getScaling(m, out) {
    const d = m.data;
    out.data[0] = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    out.data[1] = Math.sqrt(d[4] * d[4] + d[5] * d[5] + d[6] * d[6]);
    out.data[2] = Math.sqrt(d[8] * d[8] + d[9] * d[9] + d[10] * d[10]);
  }
  static equals(a, b) {
    for (let i = 0; i < 16; i++) {
      if (Math.abs(a.data[i] - b.data[i]) > EPSILON) return false;
    }
    return true;
  }
  static exactEquals(a, b) {
    for (let i = 0; i < 16; i++) {
      if (a.data[i] !== b.data[i]) return false;
    }
    return true;
  }
};

// src/math/vec3.ts
var Vec3 = class {
  constructor() {
    this.data = new Float32Array(3);
  }
  get x() {
    return this.data[0];
  }
  set x(v) {
    this.data[0] = v;
  }
  get y() {
    return this.data[1];
  }
  set y(v) {
    this.data[1] = v;
  }
  get z() {
    return this.data[2];
  }
  set z(v) {
    this.data[2] = v;
  }
  static set(out, x, y, z) {
    out.data[0] = x;
    out.data[1] = y;
    out.data[2] = z;
  }
  static copy(a, out) {
    out.data[0] = a.data[0];
    out.data[1] = a.data[1];
    out.data[2] = a.data[2];
  }
  static add(a, b, out) {
    out.data[0] = a.data[0] + b.data[0];
    out.data[1] = a.data[1] + b.data[1];
    out.data[2] = a.data[2] + b.data[2];
  }
  static sub(a, b, out) {
    out.data[0] = a.data[0] - b.data[0];
    out.data[1] = a.data[1] - b.data[1];
    out.data[2] = a.data[2] - b.data[2];
  }
  static scale(a, s, out) {
    out.data[0] = a.data[0] * s;
    out.data[1] = a.data[1] * s;
    out.data[2] = a.data[2] * s;
  }
  static mul(a, b, out) {
    out.data[0] = a.data[0] * b.data[0];
    out.data[1] = a.data[1] * b.data[1];
    out.data[2] = a.data[2] * b.data[2];
  }
  static dot(a, b) {
    return a.data[0] * b.data[0] + a.data[1] * b.data[1] + a.data[2] * b.data[2];
  }
  static cross(a, b, out) {
    const ax = a.data[0], ay = a.data[1], az = a.data[2];
    const bx = b.data[0], by = b.data[1], bz = b.data[2];
    out.data[0] = ay * bz - az * by;
    out.data[1] = az * bx - ax * bz;
    out.data[2] = ax * by - ay * bx;
  }
  static len(a) {
    return Math.sqrt(a.data[0] * a.data[0] + a.data[1] * a.data[1] + a.data[2] * a.data[2]);
  }
  static lengthSq(a) {
    return a.data[0] * a.data[0] + a.data[1] * a.data[1] + a.data[2] * a.data[2];
  }
  static distance(a, b) {
    const dx = b.data[0] - a.data[0];
    const dy = b.data[1] - a.data[1];
    const dz = b.data[2] - a.data[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  static distanceSq(a, b) {
    const dx = b.data[0] - a.data[0];
    const dy = b.data[1] - a.data[1];
    const dz = b.data[2] - a.data[2];
    return dx * dx + dy * dy + dz * dz;
  }
  static normalize(a, out) {
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
  static lerp(a, b, t, out) {
    out.data[0] = a.data[0] + t * (b.data[0] - a.data[0]);
    out.data[1] = a.data[1] + t * (b.data[1] - a.data[1]);
    out.data[2] = a.data[2] + t * (b.data[2] - a.data[2]);
  }
  static negate(a, out) {
    out.data[0] = -a.data[0];
    out.data[1] = -a.data[1];
    out.data[2] = -a.data[2];
  }
  static transformMat4(a, m, out) {
    const x = a.data[0], y = a.data[1], z = a.data[2];
    const d = m.data;
    const w = d[3] * x + d[7] * y + d[11] * z + d[15] || 1;
    out.data[0] = (d[0] * x + d[4] * y + d[8] * z + d[12]) / w;
    out.data[1] = (d[1] * x + d[5] * y + d[9] * z + d[13]) / w;
    out.data[2] = (d[2] * x + d[6] * y + d[10] * z + d[14]) / w;
  }
  static equals(a, b) {
    return Math.abs(a.data[0] - b.data[0]) <= EPSILON && Math.abs(a.data[1] - b.data[1]) <= EPSILON && Math.abs(a.data[2] - b.data[2]) <= EPSILON;
  }
  static exactEquals(a, b) {
    return a.data[0] === b.data[0] && a.data[1] === b.data[1] && a.data[2] === b.data[2];
  }
};

// src/renderer/camera3d.ts
var Camera3D = class {
  constructor() {
    this.viewMat = new Mat4();
    this.projMat = new Mat4();
    this.vpMat = new Mat4();
    this._mvp = new Mat4();
    this._eye = new Vec3();
    this._tgt = new Vec3();
    this._up = new Vec3();
  }
  setLookAt(eye, target, up) {
    Vec3.set(this._eye, eye[0], eye[1], eye[2]);
    Vec3.set(this._tgt, target[0], target[1], target[2]);
    Vec3.set(this._up, up[0], up[1], up[2]);
    Mat4.lookAt(this._eye, this._tgt, this._up, this.viewMat);
    Mat4.multiply(this.projMat, this.viewMat, this.vpMat);
  }
  setPerspective(fovY, aspect, near, far) {
    Mat4.perspective(fovY, aspect, near, far, this.projMat);
    Mat4.multiply(this.projMat, this.viewMat, this.vpMat);
  }
  // VP * translate(tx, ty, tz) — optimized for translation-only model matrix
  buildMVP(tx, ty, tz) {
    const v = this.vpMat.data, m = this._mvp.data;
    m[0] = v[0];
    m[1] = v[1];
    m[2] = v[2];
    m[3] = v[3];
    m[4] = v[4];
    m[5] = v[5];
    m[6] = v[6];
    m[7] = v[7];
    m[8] = v[8];
    m[9] = v[9];
    m[10] = v[10];
    m[11] = v[11];
    m[12] = v[0] * tx + v[4] * ty + v[8] * tz + v[12];
    m[13] = v[1] * tx + v[5] * ty + v[9] * tz + v[13];
    m[14] = v[2] * tx + v[6] * ty + v[10] * tz + v[14];
    m[15] = v[3] * tx + v[7] * ty + v[11] * tz + v[15];
    return m;
  }
  worldToScreen(wx2, wy, wz, screenW, screenH) {
    const v = this.vpMat.data;
    const cx = v[0] * wx2 + v[4] * wy + v[8] * wz + v[12];
    const cy = v[1] * wx2 + v[5] * wy + v[9] * wz + v[13];
    const cw = v[3] * wx2 + v[7] * wy + v[11] * wz + v[15];
    if (Math.abs(cw) < 1e-6) return null;
    return { x: (cx / cw + 1) * 0.5 * screenW, y: (1 - cy / cw) * 0.5 * screenH };
  }
};

// src/mahjong/tile-atlas-data.ts
var TILE_UV = {
  1: { u0: 0, v0: 0, u1: 0.0625, v1: 0.2 },
  2: { u0: 0.625, v0: 0, u1: 0.6875, v1: 0.2 },
  3: { u0: 0.25, v0: 0.2, u1: 0.3125, v1: 0.4 },
  4: { u0: 0.75, v0: 0.2, u1: 0.8125, v1: 0.4 },
  5: { u0: 0.4375, v0: 0.4, u1: 0.5, v1: 0.6 },
  6: { u0: 0.125, v0: 0.6, u1: 0.1875, v1: 0.8 },
  7: { u0: 0.8125, v0: 0.6, u1: 0.875, v1: 0.8 },
  8: { u0: 0.5, v0: 0.8, u1: 0.5625, v1: 1 },
  9: { u0: 0.875, v0: 0.8, u1: 0.9375, v1: 1 },
  11: { u0: 0.0625, v0: 0, u1: 0.125, v1: 0.2 },
  12: { u0: 0.125, v0: 0, u1: 0.1875, v1: 0.2 },
  13: { u0: 0.1875, v0: 0, u1: 0.25, v1: 0.2 },
  14: { u0: 0.25, v0: 0, u1: 0.3125, v1: 0.2 },
  15: { u0: 0.3125, v0: 0, u1: 0.375, v1: 0.2 },
  16: { u0: 0.375, v0: 0, u1: 0.4375, v1: 0.2 },
  17: { u0: 0.4375, v0: 0, u1: 0.5, v1: 0.2 },
  18: { u0: 0.5, v0: 0, u1: 0.5625, v1: 0.2 },
  19: { u0: 0.5625, v0: 0, u1: 0.625, v1: 0.2 },
  21: { u0: 0.6875, v0: 0, u1: 0.75, v1: 0.2 },
  22: { u0: 0.75, v0: 0, u1: 0.8125, v1: 0.2 },
  23: { u0: 0.8125, v0: 0, u1: 0.875, v1: 0.2 },
  24: { u0: 0.875, v0: 0, u1: 0.9375, v1: 0.2 },
  25: { u0: 0.9375, v0: 0, u1: 1, v1: 0.2 },
  26: { u0: 0, v0: 0.2, u1: 0.0625, v1: 0.4 },
  27: { u0: 0.0625, v0: 0.2, u1: 0.125, v1: 0.4 },
  28: { u0: 0.125, v0: 0.2, u1: 0.1875, v1: 0.4 },
  29: { u0: 0.1875, v0: 0.2, u1: 0.25, v1: 0.4 },
  31: { u0: 0.3125, v0: 0.2, u1: 0.375, v1: 0.4 },
  32: { u0: 0.375, v0: 0.2, u1: 0.4375, v1: 0.4 },
  33: { u0: 0.4375, v0: 0.2, u1: 0.5, v1: 0.4 },
  34: { u0: 0.5, v0: 0.2, u1: 0.5625, v1: 0.4 },
  35: { u0: 0.5625, v0: 0.2, u1: 0.625, v1: 0.4 },
  36: { u0: 0.625, v0: 0.2, u1: 0.6875, v1: 0.4 },
  37: { u0: 0.6875, v0: 0.2, u1: 0.75, v1: 0.4 },
  40: { u0: 0.8125, v0: 0.2, u1: 0.875, v1: 0.4 },
  41: { u0: 0.875, v0: 0.2, u1: 0.9375, v1: 0.4 },
  42: { u0: 0.9375, v0: 0.2, u1: 1, v1: 0.4 },
  43: { u0: 0, v0: 0.4, u1: 0.0625, v1: 0.6 },
  44: { u0: 0.0625, v0: 0.4, u1: 0.125, v1: 0.6 },
  45: { u0: 0.125, v0: 0.4, u1: 0.1875, v1: 0.6 },
  46: { u0: 0.1875, v0: 0.4, u1: 0.25, v1: 0.6 },
  47: { u0: 0.25, v0: 0.4, u1: 0.3125, v1: 0.6 },
  48: { u0: 0.3125, v0: 0.4, u1: 0.375, v1: 0.6 },
  49: { u0: 0.375, v0: 0.4, u1: 0.4375, v1: 0.6 },
  50: { u0: 0.5, v0: 0.4, u1: 0.5625, v1: 0.6 },
  51: { u0: 0.5625, v0: 0.4, u1: 0.625, v1: 0.6 },
  52: { u0: 0.625, v0: 0.4, u1: 0.6875, v1: 0.6 },
  53: { u0: 0.6875, v0: 0.4, u1: 0.75, v1: 0.6 },
  54: { u0: 0.75, v0: 0.4, u1: 0.8125, v1: 0.6 },
  55: { u0: 0.8125, v0: 0.4, u1: 0.875, v1: 0.6 },
  56: { u0: 0.875, v0: 0.4, u1: 0.9375, v1: 0.6 },
  57: { u0: 0.9375, v0: 0.4, u1: 1, v1: 0.6 },
  58: { u0: 0, v0: 0.6, u1: 0.0625, v1: 0.8 },
  59: { u0: 0.0625, v0: 0.6, u1: 0.125, v1: 0.8 },
  60: { u0: 0.1875, v0: 0.6, u1: 0.25, v1: 0.8 },
  61: { u0: 0.25, v0: 0.6, u1: 0.3125, v1: 0.8 },
  62: { u0: 0.3125, v0: 0.6, u1: 0.375, v1: 0.8 },
  63: { u0: 0.375, v0: 0.6, u1: 0.4375, v1: 0.8 },
  64: { u0: 0.4375, v0: 0.6, u1: 0.5, v1: 0.8 },
  65: { u0: 0.5, v0: 0.6, u1: 0.5625, v1: 0.8 },
  66: { u0: 0.5625, v0: 0.6, u1: 0.625, v1: 0.8 },
  67: { u0: 0.625, v0: 0.6, u1: 0.6875, v1: 0.8 },
  68: { u0: 0.6875, v0: 0.6, u1: 0.75, v1: 0.8 },
  69: { u0: 0.75, v0: 0.6, u1: 0.8125, v1: 0.8 },
  70: { u0: 0.875, v0: 0.6, u1: 0.9375, v1: 0.8 },
  71: { u0: 0.9375, v0: 0.6, u1: 1, v1: 0.8 },
  72: { u0: 0, v0: 0.8, u1: 0.0625, v1: 1 },
  73: { u0: 0.0625, v0: 0.8, u1: 0.125, v1: 1 },
  74: { u0: 0.125, v0: 0.8, u1: 0.1875, v1: 1 },
  75: { u0: 0.1875, v0: 0.8, u1: 0.25, v1: 1 },
  76: { u0: 0.25, v0: 0.8, u1: 0.3125, v1: 1 },
  77: { u0: 0.3125, v0: 0.8, u1: 0.375, v1: 1 },
  78: { u0: 0.375, v0: 0.8, u1: 0.4375, v1: 1 },
  79: { u0: 0.4375, v0: 0.8, u1: 0.5, v1: 1 },
  80: { u0: 0.5625, v0: 0.8, u1: 0.625, v1: 1 },
  81: { u0: 0.625, v0: 0.8, u1: 0.6875, v1: 1 },
  82: { u0: 0.6875, v0: 0.8, u1: 0.75, v1: 1 },
  83: { u0: 0.75, v0: 0.8, u1: 0.8125, v1: 1 },
  84: { u0: 0.8125, v0: 0.8, u1: 0.875, v1: 1 }
};

// src/mahjong/level-configs.ts
var LevelLoopMin = 116;
var manualLevels = [
  { Level: 1, CombieCount: 3, RandomCount: 3, Time: 100, CreateTime: 2, Scale: 1.2, MJList: [11, 15, 19, 1, 5, 9, 21, 25, 29] },
  { Level: 2, CombieCount: 20, RandomCount: 20, Time: 270, CreateTime: 2.5, Scale: 1, MJList: [14, 15, 16, 17, 18, 19, 1, 2, 3, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 4, 5, 6] },
  { Level: 3, CombieCount: 25, RandomCount: 25, Time: 300, CreateTime: 2.5, Scale: 1, MJList: [11, 12, 13, 14, 15, 16, 17, 41, 42, 43, 44, 45, 46, 47, 2, 3, 4, 5, 6, 7, 8, 35, 31, 34] },
  { Level: 4, CombieCount: 30, RandomCount: 30, Time: 330, CreateTime: 2.5, Scale: 1, MJList: [17, 18, 19, 1, 2, 3, 4, 5, 6, 7, 8, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 25, 26, 27, 28, 31] },
  { Level: 5, CombieCount: 35, RandomCount: 32, Time: 360, CreateTime: 2.5, Scale: 1, MJList: [11, 12, 21, 22, 23, 24, 25, 26, 27, 28, 29, 50, 32, 33, 35, 41, 42, 43, 44, 45, 46, 47, 48, 49, 15, 16, 17] },
  { Level: 6, CombieCount: 36, RandomCount: 32, Time: 370, CreateTime: 2.5, Scale: 1, MJList: [12, 15, 21, 22, 23, 24, 25, 27, 37, 41, 42, 43, 44, 35, 19, 45, 11, 31, 32, 34, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55] }
];
var randomCountFor7to30 = [32, 32, 33, 34, 34, 34, 34, 35, 36, 36, 37, 38, 39, 40, 40, 41, 42, 43, 44, 44, 45, 46, 47, 48];
var cyclePattern = [
  [61, 48, 620],
  [62, 49, 630],
  [63, 50, 630],
  [64, 51, 630],
  [70, 56, 630]
];
function generateLevels() {
  const levels = [...manualLevels];
  for (let lv = 7; lv <= 30; lv++) {
    levels.push({ Level: lv, CombieCount: 30 + lv, RandomCount: randomCountFor7to30[lv - 7], Time: 310 + lv * 10, CreateTime: 2.5, Scale: 1, MJList: [] });
  }
  for (let lv = 31; lv <= 120; lv++) {
    const [cc, rc, time] = cyclePattern[(lv - 31) % 5];
    levels.push({ Level: lv, CombieCount: cc, RandomCount: rc, Time: time, CreateTime: 2.5, Scale: 1, MJList: [] });
  }
  return levels;
}
var LevelConfs = generateLevels();
var randomMjListA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37];
var randomMjListB = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84];
function shuffle(arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function buildTilePool(cfg) {
  let types;
  if (cfg.MJList.length > 0) {
    types = shuffle([...cfg.MJList]).slice(0, cfg.RandomCount);
  } else {
    const combined = shuffle([...randomMjListA, ...randomMjListB]);
    types = combined.slice(0, cfg.RandomCount);
  }
  const pool = [];
  let extra = cfg.CombieCount - types.length;
  for (let i = 0; i < types.length; i++) {
    pool.push(types[i], types[i], types[i]);
    if (extra > 0) {
      pool.push(types[i], types[i], types[i]);
      extra--;
    }
  }
  return shuffle(pool);
}

// src/mahjong/tile-mesh-data.ts
var H = 0.7071067811865476;
var Q = 0.5;
var G = 0.9121320343559642;
var _vd = [
  // px,   py,   pz,    nx,   ny,   nz,    u,      v
  // ─── corner C0 +X+Y+Z  v0-6 ───
  1.5,
  0.7,
  1.7,
  1,
  0,
  0,
  0,
  0,
  1.4121320343559642,
  0.7,
  1.9121320343559642,
  H,
  0,
  H,
  0,
  0,
  1.2,
  0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  1.4121320343559642,
  G,
  1.7,
  H,
  H,
  0,
  0,
  0,
  1.35,
  G,
  1.85,
  Q,
  H,
  Q,
  0,
  0,
  1.2,
  G,
  1.9121320343559642,
  0,
  H,
  H,
  0,
  0,
  1.2,
  1,
  1.7,
  0,
  1,
  0,
  0,
  0,
  // ─── corner C1 +X+Y-Z  v7-13 ───
  1.5,
  0.7,
  -1.7,
  1,
  0,
  0,
  0,
  0,
  1.4121320343559642,
  0.7,
  -1.9121320343559642,
  H,
  0,
  -H,
  0,
  0,
  1.2,
  0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  1.4121320343559642,
  G,
  -1.7,
  H,
  H,
  0,
  0,
  0,
  1.35,
  G,
  -1.85,
  Q,
  H,
  -Q,
  0,
  0,
  1.2,
  G,
  -1.9121320343559642,
  0,
  H,
  -H,
  0,
  0,
  1.2,
  1,
  -1.7,
  0,
  1,
  0,
  0,
  0,
  // ─── corner C2 -X+Y-Z  v14-20 ───
  -1.5,
  0.7,
  -1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.4121320343559642,
  0.7,
  -1.9121320343559642,
  -H,
  0,
  -H,
  0,
  0,
  -1.2,
  0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  -1.4121320343559642,
  G,
  -1.7,
  -H,
  H,
  0,
  0,
  0,
  -1.35,
  G,
  -1.85,
  -Q,
  H,
  -Q,
  0,
  0,
  -1.2,
  G,
  -1.9121320343559642,
  0,
  H,
  -H,
  0,
  0,
  -1.2,
  1,
  -1.7,
  0,
  1,
  0,
  0,
  0,
  // ─── corner C3 -X+Y+Z  v21-27 ───
  -1.5,
  0.7,
  1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.4121320343559642,
  0.7,
  1.9121320343559642,
  -H,
  0,
  H,
  0,
  0,
  -1.2,
  0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  -1.4121320343559642,
  G,
  1.7,
  -H,
  H,
  0,
  0,
  0,
  -1.35,
  G,
  1.85,
  -Q,
  H,
  Q,
  0,
  0,
  -1.2,
  G,
  1.9121320343559642,
  0,
  H,
  H,
  0,
  0,
  -1.2,
  1,
  1.7,
  0,
  1,
  0,
  0,
  0,
  // ─── corner C4 +X-Y+Z  v28-34 ───
  1.5,
  -0.7,
  1.7,
  1,
  0,
  0,
  0,
  0,
  1.4121320343559642,
  -0.7,
  1.9121320343559642,
  H,
  0,
  H,
  0,
  0,
  1.2,
  -0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  1.4121320343559642,
  -G,
  1.7,
  H,
  -H,
  0,
  0,
  0,
  1.35,
  -G,
  1.85,
  Q,
  -H,
  Q,
  0,
  0,
  1.2,
  -G,
  1.9121320343559642,
  0,
  -H,
  H,
  0,
  0,
  1.2,
  -1,
  1.7,
  0,
  -1,
  0,
  0,
  0,
  // ─── corner C5 +X-Y-Z  v35-41 ───
  1.5,
  -0.7,
  -1.7,
  1,
  0,
  0,
  0,
  0,
  1.4121320343559642,
  -0.7,
  -1.9121320343559642,
  H,
  0,
  -H,
  0,
  0,
  1.2,
  -0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  1.4121320343559642,
  -G,
  -1.7,
  H,
  -H,
  0,
  0,
  0,
  1.35,
  -G,
  -1.85,
  Q,
  -H,
  -Q,
  0,
  0,
  1.2,
  -G,
  -1.9121320343559642,
  0,
  -H,
  -H,
  0,
  0,
  1.2,
  -1,
  -1.7,
  0,
  -1,
  0,
  0,
  0,
  // ─── corner C6 -X-Y-Z  v42-48 ───
  -1.5,
  -0.7,
  -1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.4121320343559642,
  -0.7,
  -1.9121320343559642,
  -H,
  0,
  -H,
  0,
  0,
  -1.2,
  -0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  -1.4121320343559642,
  -G,
  -1.7,
  -H,
  -H,
  0,
  0,
  0,
  -1.35,
  -G,
  -1.85,
  -Q,
  -H,
  -Q,
  0,
  0,
  -1.2,
  -G,
  -1.9121320343559642,
  0,
  -H,
  -H,
  0,
  0,
  -1.2,
  -1,
  -1.7,
  0,
  -1,
  0,
  0,
  0,
  // ─── corner C7 -X-Y+Z  v49-55 ───
  -1.5,
  -0.7,
  1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.4121320343559642,
  -0.7,
  1.9121320343559642,
  -H,
  0,
  H,
  0,
  0,
  -1.2,
  -0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  -1.4121320343559642,
  -G,
  1.7,
  -H,
  -H,
  0,
  0,
  0,
  -1.35,
  -G,
  1.85,
  -Q,
  -H,
  Q,
  0,
  0,
  -1.2,
  -G,
  1.9121320343559642,
  0,
  -H,
  H,
  0,
  0,
  -1.2,
  -1,
  1.7,
  0,
  -1,
  0,
  0,
  0,
  // ─── top face  v56-59 ───
  -1.2,
  1,
  -1.7,
  0,
  1,
  0,
  1e-3,
  1e-3,
  // v56 fix
  -1.2,
  1,
  1.7,
  0,
  1,
  0,
  0,
  1,
  1.2,
  1,
  1.7,
  0,
  1,
  0,
  1,
  1,
  1.2,
  1,
  -1.7,
  0,
  1,
  0,
  1,
  0,
  // ─── bottom face  v60-63 ───
  1.2,
  -1,
  1.7,
  0,
  -1,
  0,
  0,
  0,
  1.2,
  -1,
  -1.7,
  0,
  -1,
  0,
  0,
  0,
  -1.2,
  -1,
  -1.7,
  0,
  -1,
  0,
  0,
  0,
  -1.2,
  -1,
  1.7,
  0,
  -1,
  0,
  0,
  0,
  // ─── right face  v64-67 ───
  1.5,
  0.7,
  1.7,
  1,
  0,
  0,
  0,
  0,
  1.5,
  0.7,
  -1.7,
  1,
  0,
  0,
  0,
  0,
  1.5,
  -0.7,
  1.7,
  1,
  0,
  0,
  0,
  0,
  1.5,
  -0.7,
  -1.7,
  1,
  0,
  0,
  0,
  0,
  // ─── left face  v68-71 ───
  -1.5,
  0.7,
  -1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.5,
  0.7,
  1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.5,
  -0.7,
  -1.7,
  -1,
  0,
  0,
  0,
  0,
  -1.5,
  -0.7,
  1.7,
  -1,
  0,
  0,
  0,
  0,
  // ─── front face  v72-75 ───
  1.2,
  0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  -1.2,
  0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  1.2,
  -0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  -1.2,
  -0.7,
  2,
  0,
  0,
  1,
  0,
  0,
  // ─── back face  v76-79 ───
  1.2,
  0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  -1.2,
  0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  1.2,
  -0.7,
  -2,
  0,
  0,
  -1,
  0,
  0,
  -1.2,
  -0.7,
  -2,
  0,
  0,
  -1,
  0,
  0
];
var TILE_VERTS = new Float32Array(_vd);
var TILE_INDICES = new Uint16Array([
  // 6 flat faces
  56,
  57,
  58,
  56,
  58,
  59,
  60,
  62,
  61,
  60,
  63,
  62,
  64,
  66,
  65,
  65,
  66,
  67,
  68,
  70,
  69,
  69,
  70,
  71,
  72,
  73,
  74,
  73,
  75,
  74,
  76,
  78,
  77,
  77,
  78,
  79,
  // 8 corner patches  (6 tris × 8 = 48)
  0,
  3,
  1,
  1,
  3,
  4,
  1,
  4,
  2,
  2,
  4,
  5,
  3,
  6,
  4,
  4,
  6,
  5,
  7,
  8,
  10,
  8,
  11,
  10,
  8,
  9,
  11,
  9,
  12,
  11,
  10,
  11,
  13,
  11,
  12,
  13,
  14,
  17,
  15,
  15,
  17,
  18,
  15,
  18,
  16,
  16,
  18,
  19,
  17,
  20,
  18,
  18,
  20,
  19,
  21,
  22,
  24,
  22,
  25,
  24,
  22,
  23,
  25,
  23,
  26,
  25,
  24,
  25,
  27,
  25,
  26,
  27,
  28,
  29,
  31,
  29,
  32,
  31,
  29,
  30,
  32,
  30,
  33,
  32,
  31,
  32,
  34,
  32,
  33,
  34,
  35,
  38,
  36,
  36,
  38,
  39,
  36,
  39,
  37,
  37,
  39,
  40,
  38,
  41,
  39,
  39,
  41,
  40,
  42,
  43,
  45,
  43,
  46,
  45,
  43,
  44,
  46,
  44,
  47,
  46,
  45,
  46,
  48,
  46,
  47,
  48,
  49,
  52,
  50,
  50,
  52,
  53,
  50,
  53,
  51,
  51,
  53,
  54,
  52,
  55,
  53,
  53,
  55,
  54,
  // 12 edge strips  (4 tris × 12 = 48)
  0,
  1,
  28,
  1,
  29,
  28,
  1,
  2,
  29,
  2,
  30,
  29,
  7,
  35,
  8,
  8,
  35,
  36,
  8,
  36,
  9,
  9,
  36,
  37,
  14,
  15,
  42,
  15,
  43,
  42,
  15,
  16,
  43,
  16,
  44,
  43,
  21,
  49,
  22,
  22,
  49,
  50,
  22,
  50,
  23,
  23,
  50,
  51,
  2,
  5,
  23,
  5,
  26,
  23,
  5,
  6,
  26,
  6,
  27,
  26,
  9,
  16,
  12,
  12,
  16,
  19,
  12,
  19,
  13,
  13,
  19,
  20,
  30,
  51,
  33,
  33,
  51,
  54,
  33,
  54,
  34,
  34,
  54,
  55,
  37,
  40,
  44,
  40,
  47,
  44,
  40,
  41,
  47,
  41,
  48,
  47,
  0,
  7,
  3,
  3,
  7,
  10,
  3,
  10,
  6,
  6,
  10,
  13,
  14,
  21,
  17,
  17,
  21,
  24,
  17,
  24,
  20,
  20,
  24,
  27,
  28,
  31,
  35,
  31,
  38,
  35,
  31,
  34,
  38,
  34,
  41,
  38,
  42,
  45,
  49,
  45,
  52,
  49,
  45,
  48,
  52,
  48,
  55,
  52
]);

// src/wx-mahjong.cts
(function mahjongGame() {
  const TAG = "[MJ]";
  const log = (...a) => {
    a.unshift(TAG);
    console.info.apply(console, a);
  };
  const warn = (...a) => {
    a.unshift(TAG);
    console.warn.apply(console, a);
  };
  const MAX_SLOT = 7;
  const TILE_W = 64;
  const TILE_H = 86;
  const TILE_SHADOW = 4;
  const GRID_COLS = 5;
  const GRID_ROWS = 7;
  const TSPACE_X = 3.2;
  const TSPACE_Z = 4.2;
  const TSPACE_Y = 2.2;
  const SPAWN_Y = 16;
  function packABGR(r, g, b, a) {
    return ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | r & 255) >>> 0;
  }
  const WHITE = packABGR(255, 255, 255, 255);
  const SHADOW = packABGR(0, 0, 0, 120);
  const OVERLAY = packABGR(0, 0, 0, 200);
  const GREEN = packABGR(34, 197, 94, 255);
  const RED = packABGR(239, 68, 68, 255);
  const YELLOW = packABGR(234, 179, 8, 255);
  const GRAY = packABGR(71, 85, 105, 255);
  const SLOT_BG = packABGR(30, 41, 59, 255);
  const VERT_3D = `attribute vec3 a_pos;attribute vec3 a_norm;attribute vec2 a_uv;uniform mat4 u_mvp;varying mediump vec3 v_norm;varying mediump vec2 v_uv;void main(){gl_Position=u_mvp*vec4(a_pos,1.0);v_norm=a_norm;v_uv=a_uv;}`;
  const FRAG_3D = `precision mediump float;varying vec3 v_norm;varying vec2 v_uv;uniform sampler2D u_tex;uniform vec4 u_uv_rect;uniform float u_dim;void main(){vec3 L=normalize(vec3(0.3,1.0,0.5));float ndl=max(0.0,dot(normalize(v_norm),L));float isFace=step(0.0005,v_uv.x+v_uv.y);vec4 col;if(isFace>0.5){vec2 auv=u_uv_rect.xy+v_uv*(u_uv_rect.zw-u_uv_rect.xy);col=texture2D(u_tex,auv);}else{float lit=0.3+0.7*ndl;col=vec4(vec3(0.92,0.87,0.72)*lit,1.0);}gl_FragColor=vec4(col.rgb*u_dim,col.a);}`;
  let prog3d = null;
  let tileMesh = null;
  let camera3d = new Camera3D();
  let aPos3 = 0, aNorm3 = 0, aUV3 = 0;
  let uMVP3 = null;
  let uTex3 = null;
  let uUVR3 = null;
  let uDim3 = null;
  let canvas = null;
  let W = 390, H2 = 844;
  let device;
  let batcher;
  let proj;
  let whiteTex;
  let tileTex = null;
  let digitTex = null;
  const DIGIT_W = 14;
  const DIGIT_H = 20;
  let lblStart = null;
  let lblNext = null;
  let lblRetry = null;
  const lblProp = [null, null, null, null];
  function computeVP() {
    const fovH = 20 * Math.PI / 180;
    const fovY = 2 * Math.atan(Math.tan(fovH * 0.5) / (W / H2));
    camera3d.setLookAt([0, 35, 45], [0, 5, 0], [0, 1, 0]);
    camera3d.setPerspective(fovY, W / H2, 1, 1e3);
  }
  function setup3D() {
    var _a;
    const gl = device.gl;
    try {
      prog3d = device.createProgram(VERT_3D, FRAG_3D);
      const attrs = getAttributeLocations(gl, prog3d, ["a_pos", "a_norm", "a_uv"]);
      const unifs = getUniformLocations(gl, prog3d, ["u_mvp", "u_tex", "u_uv_rect", "u_dim"]);
      aPos3 = attrs["a_pos"];
      aNorm3 = attrs["a_norm"];
      aUV3 = attrs["a_uv"];
      uMVP3 = unifs["u_mvp"];
      uTex3 = unifs["u_tex"];
      uUVR3 = unifs["u_uv_rect"];
      uDim3 = unifs["u_dim"];
      tileMesh = new Mesh(device, TILE_VERTS, TILE_INDICES, 32);
      computeVP();
      log("3D ok");
      return true;
    } catch (e) {
      warn("3D fail", (_a = e == null ? void 0 : e.message) != null ? _a : e);
      return false;
    }
  }
  function makeTextTex(text, w, h, fontSize) {
    try {
      const off = wx.createCanvas();
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2);
      const imgData = ctx.getImageData(0, 0, w, h);
      const gl = device.gl;
      const tex = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imgData.data.buffer));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    } catch (e) {
      warn("makeTextTex", e);
      return null;
    }
  }
  function setupRenderer() {
    var _a;
    try {
      canvas = wx.createCanvas();
      W = canvas.width || 390;
      H2 = canvas.height || 844;
      device = new WebGLDevice(canvas, { alpha: false, antialias: false });
      batcher = new SpriteBatcher(device);
      proj = new Mat4();
      Mat4.ortho(0, W, H2, 0, -1, 1, proj);
      const gl = device.gl;
      whiteTex = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whiteTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      try {
        const off = wx.createCanvas();
        off.width = 140;
        off.height = 20;
        const offCtx = off.getContext("2d");
        offCtx.fillStyle = "#000000";
        offCtx.fillRect(0, 0, 140, 20);
        offCtx.fillStyle = "#ffffff";
        offCtx.font = "bold 16px monospace";
        offCtx.textAlign = "left";
        offCtx.textBaseline = "top";
        for (let i = 0; i <= 9; i++) offCtx.fillText(String(i), i * 14 + 1, 2);
        const imgData = offCtx.getImageData(0, 0, 140, 20);
        digitTex = device.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, digitTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 140, 20, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imgData.data.buffer));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } catch (e) {
        warn("digit tex", e);
      }
      lblStart = makeTextTex("\u5F00\u59CB", 140, 40, 28);
      lblNext = makeTextTex("\u4E0B\u4E00\u5173", 160, 40, 26);
      lblRetry = makeTextTex("\u91CD\u8BD5", 140, 40, 28);
      lblProp[0] = makeTextTex("\u6D17\u724C", 52, 20, 14);
      lblProp[1] = makeTextTex("\u79FB\u51FA", 52, 20, 14);
      lblProp[2] = makeTextTex("\u6D88\u9664", 52, 20, 14);
      lblProp[3] = makeTextTex("+\u65F6\u95F4", 52, 20, 14);
      setup3D();
      log("renderer ok", W + "x" + H2);
      return true;
    } catch (e) {
      warn("renderer fail", (_a = e == null ? void 0 : e.message) != null ? _a : e);
      return false;
    }
  }
  let tileTexReady = false;
  function loadTileAtlas(cb) {
    if (typeof wx.createImage !== "function") {
      cb();
      return;
    }
    const img = wx.createImage();
    img.onload = () => {
      const gl = device.gl;
      tileTex = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tileTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tileTexReady = true;
      log("tile atlas ok");
      cb();
    };
    img.onerror = (e) => {
      warn("tile atlas err", e);
      cb();
    };
    img.src = "assets/11.png";
  }
  function createAudio(src) {
    if (typeof wx.createInnerAudioContext !== "function") return null;
    const a = wx.createInnerAudioContext();
    a.src = src;
    a.volume = 1;
    a.onError((e) => warn("audio", src, e == null ? void 0 : e.errMsg));
    return a;
  }
  let sndClick, sndCombie, sndFail, sndWin;
  function setupAudio() {
    sndClick = createAudio("assets/audio/click.mp3");
    sndCombie = createAudio("assets/audio/combie.mp3");
    sndFail = createAudio("assets/audio/fail.mp3");
    sndWin = createAudio("assets/audio/win.mp3");
  }
  function play(snd) {
    if (!snd) return;
    try {
      snd.stop();
      snd.play();
    } catch (e) {
    }
  }
  let scene = "home";
  let currentLevel = 1;
  let cfg;
  let worldTiles = [];
  let slotTiles = [];
  let timerSec = 0;
  let timerAccum = 0;
  let matchedGroups = 0;
  let totalGroups = 0;
  let gameEnded = false;
  let tapEnabled = true;
  const props = { xiPai: 1, yiChu: 1, xiaochu: 1, shiZhong: 1 };
  function saveLevel() {
    try {
      if (wx.setStorageSync) wx.setStorageSync("mj_level", currentLevel);
    } catch (e) {
    }
  }
  function loadLevel() {
    try {
      if (wx.getStorageSync) {
        const v = wx.getStorageSync("mj_level");
        if (v) currentLevel = Math.max(1, Number(v));
      }
    } catch (e) {
    }
  }
  const HUD_H = 64;
  const SLOT_H = 90;
  const SLOT_Y = () => H2 - SLOT_H + 10;
  const PLAY_BOT = () => H2 - SLOT_H;
  function slotTargetX(i) {
    return W / (MAX_SLOT + 1) * (i + 1);
  }
  function slotTargetY() {
    return SLOT_Y() + TILE_H / 2;
  }
  function tileWorldPos(col, row, layer) {
    return {
      twx: (col - (GRID_COLS - 1) * 0.5) * TSPACE_X,
      twy: layer * TSPACE_Y,
      twz: (row - (GRID_ROWS - 1) * 0.5) * TSPACE_Z
    };
  }
  function generateStackedLayout(count) {
    const result = [];
    const occupied = /* @__PURE__ */ new Set();
    let l = 0;
    while (result.length < count && l < 12) {
      const valid = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (l === 0 || occupied.has(`${c},${r},${l - 1}`)) {
            if (!occupied.has(`${c},${r},${l}`)) valid.push({ col: c, row: r, layer: l });
          }
        }
      }
      for (const p of shuffle(valid)) {
        if (result.length >= count) break;
        result.push(p);
        occupied.add(`${p.col},${p.row},${p.layer}`);
      }
      l++;
    }
    return result;
  }
  function computeBlocked(tiles) {
    const pos = /* @__PURE__ */ new Set();
    for (const t of tiles) if (!t.removing) pos.add(`${t.col},${t.row},${t.layer}`);
    for (const t of tiles) t.blocked = !t.removing && pos.has(`${t.col},${t.row},${t.layer + 1}`);
  }
  function makeWorldTile(id, pos) {
    var _a;
    const { twx, twy, twz } = tileWorldPos(pos.col, pos.row, pos.layer);
    const sc = (_a = camera3d.worldToScreen(twx, twy + 1, twz, W, H2)) != null ? _a : { x: W / 2, y: H2 / 2 };
    return {
      id,
      col: pos.col,
      row: pos.row,
      layer: pos.layer,
      wx: twx,
      wy: SPAWN_Y,
      wz: twz,
      twx,
      twy,
      twz,
      sx: sc.x,
      sy: sc.y,
      animating: true,
      animT: 0,
      depth: pos.layer * 1e3 + pos.row * GRID_COLS + pos.col,
      blocked: false,
      removing: false,
      removeT: 0
    };
  }
  function startGame(level) {
    const lv = Math.max(1, Math.min(level, LevelConfs.length));
    const loopLv = lv > LevelConfs.length ? (lv - LevelLoopMin) % (LevelConfs.length - LevelLoopMin) + LevelLoopMin : lv;
    cfg = LevelConfs[loopLv - 1];
    const pool = buildTilePool(cfg);
    totalGroups = cfg.CombieCount;
    matchedGroups = 0;
    timerSec = cfg.Time;
    timerAccum = 0;
    gameEnded = false;
    tapEnabled = true;
    worldTiles = [];
    slotTiles = [];
    const layout = generateStackedLayout(pool.length);
    worldTiles = layout.map((pos, i) => makeWorldTile(pool[i], pos));
    computeBlocked(worldTiles);
    scene = "game";
    log("level", level, "tiles", pool.length, "groups", totalGroups);
  }
  function insertToSlot(id, fromX, fromY) {
    if (slotTiles.length >= MAX_SLOT) return false;
    let pos = slotTiles.length;
    for (let i = 0; i < slotTiles.length; i++) {
      if (slotTiles[i].id > id) {
        pos = i;
        break;
      }
    }
    while (pos < slotTiles.length && slotTiles[pos].id === id) pos++;
    slotTiles.splice(pos, 0, {
      id,
      x: fromX,
      y: fromY,
      tx: slotTargetX(pos),
      ty: slotTargetY(),
      animating: true,
      animT: 0,
      removing: false,
      removeT: 0
    });
    for (let i = 0; i < slotTiles.length; i++) {
      slotTiles[i].tx = slotTargetX(i);
      slotTiles[i].ty = slotTargetY();
    }
    return true;
  }
  function checkMatch() {
    let s = 0, e = 0;
    const arr = slotTiles;
    while (e < arr.length) {
      if (e - s === 3) return doMatch(s);
      if (arr[s].id === arr[e].id) {
        e++;
      } else {
        s++;
        e++;
      }
    }
    if (e - s === 3) return doMatch(s);
    return false;
  }
  function doMatch(s) {
    play(sndCombie);
    for (let i = s; i < s + 3; i++) slotTiles[i].removing = true;
    matchedGroups++;
    setTimeout(() => {
      slotTiles = slotTiles.filter((t) => !t.removing);
      for (let i = 0; i < slotTiles.length; i++) {
        slotTiles[i].tx = slotTargetX(i);
        slotTiles[i].animating = true;
      }
      checkWin();
    }, 300);
    return true;
  }
  function checkMatchPossible() {
    let s = 0, e = 0;
    while (e < slotTiles.length) {
      if (e - s === 3) return true;
      if (slotTiles[s].id === slotTiles[e].id) {
        e++;
      } else {
        s++;
        e++;
      }
    }
    return e - s === 3;
  }
  function checkLose() {
    if (gameEnded) return;
    if (slotTiles.length >= MAX_SLOT && !checkMatchPossible()) triggerLose();
  }
  function checkWin() {
    if (gameEnded) return;
    if (matchedGroups >= totalGroups) triggerWin();
    else if (worldTiles.length === 0 && slotTiles.every((t) => !t.removing)) checkLose();
  }
  function triggerWin() {
    gameEnded = true;
    tapEnabled = false;
    play(sndWin);
    currentLevel++;
    saveLevel();
    setTimeout(() => {
      scene = "pass";
    }, 600);
  }
  function triggerLose() {
    if (gameEnded) return;
    gameEnded = true;
    tapEnabled = false;
    play(sndFail);
    setTimeout(() => {
      scene = "lose";
    }, 600);
  }
  function propXiPai() {
    if (props.xiPai <= 0 || gameEnded) return;
    props.xiPai--;
    const allIds = [];
    for (const t of worldTiles) allIds.push(t.id);
    for (const t of slotTiles) allIds.push(t.id);
    slotTiles = [];
    const shuffledIds = shuffle(allIds);
    const layout = generateStackedLayout(shuffledIds.length);
    worldTiles = layout.map((pos, i) => makeWorldTile(shuffledIds[i], pos));
    computeBlocked(worldTiles);
  }
  function propYiChu() {
    var _a, _b;
    if (props.yiChu <= 0 || gameEnded || slotTiles.length === 0) return;
    props.yiChu--;
    const returned = slotTiles.splice(0, slotTiles.length);
    for (let i = 0; i < slotTiles.length; i++) {
      slotTiles[i].tx = slotTargetX(i);
      slotTiles[i].animating = true;
    }
    const stackTop = {};
    for (const t of worldTiles) {
      if (t.removing) continue;
      const k = `${t.col},${t.row}`;
      stackTop[k] = Math.max((_a = stackTop[k]) != null ? _a : -1, t.layer);
    }
    const emptyCells = [];
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < GRID_COLS; c++)
        if (!(`${c},${r}` in stackTop)) emptyCells.push(`${c},${r}`);
    const candidates = shuffle([...emptyCells, ...Object.keys(stackTop)]);
    for (let i = 0; i < returned.length; i++) {
      const st = returned[i];
      const key = candidates[i % candidates.length];
      const [c, r] = key.split(",").map(Number);
      const layer = ((_b = stackTop[key]) != null ? _b : -1) + 1;
      stackTop[key] = layer;
      worldTiles.push(makeWorldTile(st.id, { col: c, row: r, layer }));
    }
    computeBlocked(worldTiles);
  }
  function propXiaoChu() {
    if (props.xiaochu <= 0 || gameEnded || worldTiles.length < 3) return;
    props.xiaochu--;
    const counts = {};
    for (let i = 0; i < worldTiles.length; i++) {
      const t = worldTiles[i];
      if (!counts[t.id]) counts[t.id] = [];
      counts[t.id].push(i);
    }
    const target = Object.keys(counts).find((k) => counts[Number(k)].length >= 3);
    if (!target) return;
    const idxs = counts[Number(target)].slice(0, 3);
    for (const idx of idxs.sort((a, b) => b - a)) {
      worldTiles[idx].removing = true;
      worldTiles[idx].removeT = 0;
    }
    matchedGroups++;
    setTimeout(() => {
      worldTiles = worldTiles.filter((t) => !t.removing);
      computeBlocked(worldTiles);
      play(sndCombie);
      checkWin();
    }, 400);
  }
  function propShiZhong() {
    if (props.shiZhong <= 0 || gameEnded) return;
    props.shiZhong--;
    timerSec = Math.min(timerSec + 120, cfg.Time);
  }
  let lastTapX = -1, lastTapY = -1;
  let touchDown = false, touchDownX = 0, touchDownY = 0;
  function hitTestWorld(tx, ty) {
    let best = -1, bestDepth = -1;
    for (let i = 0; i < worldTiles.length; i++) {
      const t = worldTiles[i];
      if (t.removing || t.blocked) continue;
      const y1 = t.wy + 1;
      const dx = 1.2, dz = 1.7;
      let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
      const corners = [
        camera3d.worldToScreen(t.wx - dx, y1, t.wz - dz, W, H2),
        camera3d.worldToScreen(t.wx - dx, y1, t.wz + dz, W, H2),
        camera3d.worldToScreen(t.wx + dx, y1, t.wz + dz, W, H2),
        camera3d.worldToScreen(t.wx + dx, y1, t.wz - dz, W, H2)
      ];
      for (const c of corners) {
        if (!c) continue;
        if (c.x < mnX) mnX = c.x;
        if (c.x > mxX) mxX = c.x;
        if (c.y < mnY) mnY = c.y;
        if (c.y > mxY) mxY = c.y;
      }
      if (tx >= mnX && tx <= mxX && ty >= mnY && ty <= mxY) {
        if (t.depth > bestDepth) {
          bestDepth = t.depth;
          best = i;
        }
      }
    }
    return best;
  }
  const PROP_BTN_W = 52, PROP_BTN_H = 36;
  const PROP_BTNS = [
    { key: "xiPai", label: "\u6D17\u724C", x: 0 },
    { key: "yiChu", label: "\u79FB\u51FA", x: 1 },
    { key: "xiaochu", label: "\u6D88\u9664", x: 2 },
    { key: "shiZhong", label: "+\u65F6\u95F4", x: 3 }
  ];
  function propBtnX(i) {
    return 4 + i * (PROP_BTN_W + 4);
  }
  function propBtnY() {
    return H2 - SLOT_H - PROP_BTN_H - 4;
  }
  function hitTestPropBtn(tx, ty) {
    const by = propBtnY();
    for (let i = 0; i < PROP_BTNS.length; i++) {
      const bx = propBtnX(i);
      if (tx >= bx && tx <= bx + PROP_BTN_W && ty >= by && ty <= by + PROP_BTN_H) return PROP_BTNS[i].key;
    }
    return null;
  }
  let uiButtons = [];
  function hitBtn(tx, ty) {
    for (const b of uiButtons) {
      if (tx >= b.x && tx <= b.x + b.w && ty >= b.y && ty <= b.y + b.h) return b.id;
    }
    return null;
  }
  function setupTouch() {
    if (typeof wx.onTouchStart !== "function") return;
    wx.onTouchStart((e) => {
      var _a, _b;
      const t = ((_a = e.touches) == null ? void 0 : _a[0]) || ((_b = e.changedTouches) == null ? void 0 : _b[0]);
      if (!t) return;
      touchDown = true;
      touchDownX = t.clientX;
      touchDownY = t.clientY;
    });
    wx.onTouchEnd((e) => {
      var _a;
      if (!touchDown) return;
      touchDown = false;
      const t = (_a = e.changedTouches) == null ? void 0 : _a[0];
      if (!t) return;
      const tx = t.clientX, ty = t.clientY;
      if (Math.abs(tx - touchDownX) > 12 || Math.abs(ty - touchDownY) > 12) return;
      lastTapX = tx;
      lastTapY = ty;
      const btn = hitBtn(tx, ty);
      if (btn) {
        handleBtnTap(btn);
        return;
      }
      if (scene === "game" && tapEnabled) {
        const prop = hitTestPropBtn(tx, ty);
        if (prop) {
          handlePropTap(prop);
          return;
        }
        const idx = hitTestWorld(tx, ty);
        if (idx >= 0) {
          const t2 = worldTiles[idx];
          play(sndClick);
          worldTiles.splice(idx, 1);
          computeBlocked(worldTiles);
          const ok = insertToSlot(t2.id, t2.sx, t2.sy);
          if (!ok) {
            worldTiles.push(__spreadProps(__spreadValues({}, t2), { animating: false }));
            return;
          }
          checkMatch();
          setTimeout(() => {
            checkLose();
          }, 350);
        }
      }
    });
  }
  function handleBtnTap(id) {
    if (id === "start" || id === "retry") {
      startGame(currentLevel);
    } else if (id === "next") {
      startGame(currentLevel);
    }
  }
  function handlePropTap(key) {
    if (key === "xiPai") propXiPai();
    else if (key === "yiChu") propYiChu();
    else if (key === "xiaochu") propXiaoChu();
    else if (key === "shiZhong") propShiZhong();
  }
  function drawRect(x, y, w, h, color) {
    batcher.draw(whiteTex, x, y, w, h, 0, 0, 0, 1, 1, color);
  }
  function drawTile(id, cx, cy, alpha01, rot, scale = 1) {
    const uv = TILE_UV[id];
    const tex = tileTexReady && tileTex ? tileTex : whiteTex;
    const tileColor = tileTexReady ? packABGR(255, 255, 255, Math.round(alpha01 * 255)) : packABGR(200, 160, 80, Math.round(alpha01 * 255));
    const tw = TILE_W * scale, th = TILE_H * scale;
    if (tileTexReady && uv) {
      batcher.draw(tex, cx - tw / 2, cy - th / 2, tw, th, rot, uv.u0, uv.v0, uv.u1, uv.v1, tileColor);
    } else {
      const hue = id * 37 % 360;
      const fallback = hsvToRGB(hue, 0.7, 0.8, Math.round(alpha01 * 255));
      batcher.draw(whiteTex, cx - tw / 2, cy - th / 2, tw, th, rot, 0, 0, 1, 1, fallback);
    }
  }
  function hsvToRGB(h, s, v, a) {
    const c = v * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    return packABGR(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), a);
  }
  function drawNumber(n, cx, cy, charH, color) {
    const str = String(Math.max(0, Math.floor(n)));
    const charW = charH * (DIGIT_W / DIGIT_H), totalW = str.length * charW;
    const startX = cx - totalW / 2;
    for (let i = 0; i < str.length; i++) {
      const d = parseInt(str[i]);
      const u0 = d / 10, u1 = (d + 1) / 10;
      if (digitTex) {
        batcher.draw(digitTex, startX + i * charW, cy - charH / 2, charW, charH, 0, u0, 0, u1, 1, color);
      } else {
        batcher.draw(whiteTex, startX + i * charW, cy - charH / 2, charW - 1, charH, 0, 0, 0, 1, 1, color);
      }
    }
  }
  function drawLabel(tex, cx, cy, w, h, color) {
    if (!tex) return;
    batcher.draw(tex, cx - w / 2, cy - h / 2, w, h, 0, 0, 0, 1, 1, color);
  }
  function renderWorldTiles3D() {
    var _a, _b, _c, _d;
    if (!prog3d || !tileMesh) return;
    const gl = device.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    device.setDepthState(true, true, gl.LESS);
    device.setCullFace(true, gl.BACK);
    device.useProgram(prog3d);
    const attribs = [
      { location: aPos3, components: 3, offset: 0 },
      { location: aNorm3, components: 3, offset: 12 },
      { location: aUV3, components: 2, offset: 24 }
    ];
    tileMesh.bind(gl, attribs);
    device.bindTexture(0, tileTexReady && tileTex ? tileTex : whiteTex);
    gl.uniform1i(uTex3, 0);
    for (const t of worldTiles) {
      if (t.removing && t.removeT >= 1) continue;
      gl.uniformMatrix4fv(uMVP3, false, camera3d.buildMVP(t.wx, t.wy, t.wz));
      const uv = TILE_UV[t.id];
      gl.uniform4f(uUVR3, (_a = uv == null ? void 0 : uv.u0) != null ? _a : 0, (_b = uv == null ? void 0 : uv.v0) != null ? _b : 0, (_c = uv == null ? void 0 : uv.u1) != null ? _c : 1, (_d = uv == null ? void 0 : uv.v1) != null ? _d : 1);
      const removeFade = t.removing ? Math.max(0, 1 - t.removeT * 2) : 1;
      gl.uniform1f(uDim3, (t.blocked ? 0.55 : 1) * removeFade);
      tileMesh.draw(gl);
    }
    tileMesh.unbind(gl, attribs);
    device.setDepthState(false);
    device.setCullFace(false);
  }
  let lastT = 0, fps = 0, fpsAcc = 0, fpsN = 0;
  function render(ts) {
    const dt = lastT ? Math.min(0.05, (ts - lastT) / 1e3) : 0;
    lastT = ts;
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc >= 1) {
      fps = fpsN / fpsAcc;
      fpsAcc = 0;
      fpsN = 0;
    }
    if (scene === "game" && !gameEnded) {
      timerAccum += dt;
      if (timerAccum >= 1) {
        timerSec = Math.max(0, timerSec - 1);
        timerAccum -= 1;
      }
      if (timerSec <= 0 && !gameEnded) triggerLose();
    }
    for (const t of worldTiles) {
      if (t.removing) {
        t.removeT = Math.min(1, t.removeT + dt * 4);
      } else if (t.animating) {
        t.animT = Math.min(1, t.animT + dt * 6);
        const ease = 1 - Math.pow(1 - t.animT, 3);
        t.wx = t.twx;
        t.wy = SPAWN_Y + (t.twy - SPAWN_Y) * ease;
        t.wz = t.twz;
        if (t.animT >= 1) {
          t.wy = t.twy;
          t.animating = false;
        }
      }
      const sc = camera3d.worldToScreen(t.wx, t.wy + 1, t.wz, W, H2);
      if (sc) {
        t.sx = sc.x;
        t.sy = sc.y;
      }
    }
    for (const t of slotTiles) {
      if (t.removing) {
        t.removeT = Math.min(1, t.removeT + dt * 5);
      } else {
        const dx = t.tx - t.x, dy = t.ty - t.y, spd = dt * 12;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          t.x = t.tx;
          t.y = t.ty;
          t.animating = false;
        } else {
          t.x += dx * Math.min(1, spd);
          t.y += dy * Math.min(1, spd);
        }
      }
    }
    device.setViewport(0, 0, W, H2);
    device.clear(0.06, 0.09, 0.16, 1);
    uiButtons = [];
    if (scene === "home") {
      renderHome();
    } else if (scene === "game") {
      renderGame(dt);
    } else if (scene === "pass") {
      renderPass();
    } else if (scene === "lose") {
      renderLose();
    }
    requestFrame(render);
  }
  function renderHome() {
    batcher.begin(proj);
    drawRect(0, 0, W, H2, packABGR(8, 15, 30, 255));
    drawRect(0, 0, W, 88, packABGR(10, 24, 60, 255));
    drawRect(0, 86, W, 2, packABGR(59, 130, 246, 180));
    const sampleIds = [1, 11, 21, 31, 41, 51, 61, 71];
    const tScale = 1.25;
    const tw = TILE_W * tScale, th = TILE_H * tScale;
    const gap = 10;
    const gridW = 4 * tw + 3 * gap;
    const ox = (W - gridW) / 2 + tw / 2;
    const oy = 136 + th / 2;
    for (let i = 0; i < sampleIds.length; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = ox + col * (tw + gap);
      const y = oy + row * (th + gap);
      drawRect(x - tw / 2 + TILE_SHADOW, y - th / 2 + TILE_SHADOW, tw, th, SHADOW);
      drawTile(sampleIds[i], x, y, 1, 0, tScale);
    }
    const starY = H2 * 0.59;
    for (let s = -1; s <= 1; s++) {
      const sx = W / 2 + s * 68, r = 14;
      batcher.draw(whiteTex, sx - r, starY - r, 2 * r, 2 * r, Math.PI / 4, 0, 0, 1, 1, YELLOW);
      const ri = 6;
      batcher.draw(whiteTex, sx - ri, starY - ri, 2 * ri, 2 * ri, Math.PI / 4, 0, 0, 1, 1, WHITE);
    }
    const lvY = H2 * 0.62;
    drawRect(W / 2 - 130, lvY, 260, 64, packABGR(10, 20, 50, 255));
    drawRect(W / 2 - 128, lvY + 2, 256, 60, packABGR(30, 58, 138, 255));
    drawNumber(currentLevel, W / 2, lvY + 32, 32, YELLOW);
    const startBtn = { x: W / 2 - 90, y: H2 * 0.76, w: 180, h: 58, id: "start" };
    uiButtons.push(startBtn);
    drawRect(startBtn.x + 3, startBtn.y + 4, startBtn.w, startBtn.h, SHADOW);
    drawRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h, GREEN);
    drawLabel(lblStart, startBtn.x + startBtn.w * 0.38, startBtn.y + startBtn.h / 2, 96, 36, WHITE);
    drawNumber(currentLevel, startBtn.x + startBtn.w * 0.78, startBtn.y + startBtn.h / 2, 26, YELLOW);
    drawNumber(Math.round(fps), W - 28, H2 - 16, 14, GRAY);
    batcher.end();
  }
  function renderGame(_dt) {
    renderWorldTiles3D();
    batcher.begin(proj);
    const playBot = PLAY_BOT();
    drawRect(0, playBot, W, SLOT_H, SLOT_BG);
    drawRect(0, playBot, W, 2, packABGR(71, 85, 105, 255));
    for (let i = 0; i < MAX_SLOT; i++) {
      const sx = slotTargetX(i) - TILE_W / 2;
      const sy = slotTargetY() - TILE_H / 2;
      drawRect(sx - 2, sy - 2, TILE_W + 4, TILE_H + 4, packABGR(51, 65, 85, 255));
      drawRect(sx, sy, TILE_W, TILE_H, packABGR(24, 34, 52, 255));
    }
    for (const t of slotTiles) {
      const alpha = t.removing ? 1 - t.removeT : 1;
      const scale = t.removing ? 1 + t.removeT * 0.4 : 1;
      drawRect(
        t.x - TILE_W / 2 + TILE_SHADOW * 0.5,
        t.y - TILE_H / 2 + TILE_SHADOW * 0.5,
        TILE_W * scale,
        TILE_H * scale,
        packABGR(0, 0, 0, Math.round(alpha * 60))
      );
      drawTile(t.id, t.x, t.y, alpha, 0, scale);
    }
    const pby = propBtnY();
    for (let i = 0; i < PROP_BTNS.length; i++) {
      const pb = PROP_BTNS[i];
      const pbx = propBtnX(i);
      const count = props[pb.key];
      const color = count > 0 ? packABGR(37, 99, 235, 255) : GRAY;
      drawRect(pbx, pby, PROP_BTN_W, PROP_BTN_H, color);
      const ic = packABGR(255, 255, 255, count > 0 ? 230 : 110);
      drawLabel(lblProp[i], pbx + PROP_BTN_W / 2, pby + PROP_BTN_H * 0.62, PROP_BTN_W - 2, 19, ic);
      if (count > 0) drawNumber(count, pbx + PROP_BTN_W - 8, pby + 5, 13, YELLOW);
    }
    drawRect(0, 0, W, HUD_H, packABGR(15, 23, 42, 255));
    drawRect(0, HUD_H - 2, W, 2, packABGR(30, 58, 138, 255));
    const timerColor = timerSec > 30 ? WHITE : timerSec > 10 ? YELLOW : RED;
    drawNumber(timerSec, W / 2, HUD_H / 2, 28, timerColor);
    const timerRatio = cfg ? timerSec / cfg.Time : 1;
    const barColor = timerSec > 30 ? GREEN : timerSec > 10 ? YELLOW : RED;
    drawRect(0, HUD_H - 6, W, 4, packABGR(30, 41, 59, 255));
    drawRect(0, HUD_H - 6, Math.round(W * timerRatio), 4, barColor);
    drawNumber(currentLevel, 30, HUD_H / 2, 20, packABGR(148, 163, 184, 255));
    const prog2 = totalGroups > 0 ? matchedGroups / totalGroups : 0;
    drawRect(W - 54, 8, 50, 16, packABGR(30, 41, 59, 255));
    drawRect(W - 54, 8, Math.round(50 * prog2), 16, GREEN);
    batcher.end();
  }
  function renderPass() {
    renderGame(0);
    batcher.begin(proj);
    drawRect(0, 0, W, H2, packABGR(0, 0, 0, 170));
    const cx = W / 2, cy = H2 / 2;
    drawRect(cx - 144, cy - 134, 288, 268, packABGR(10, 20, 60, 255));
    drawRect(cx - 140, cy - 130, 280, 260, packABGR(30, 58, 138, 255));
    drawRect(cx - 140, cy - 130, 280, 4, YELLOW);
    drawRect(cx - 140, cy + 126, 280, 4, YELLOW);
    drawRect(cx - 140, cy - 130, 4, 260, YELLOW);
    drawRect(cx + 136, cy - 130, 4, 260, YELLOW);
    const starCols = [cx - 60, cx, cx + 60];
    for (const sx of starCols) {
      const r = 18, ri = 7, sy = cy - 100;
      batcher.draw(whiteTex, sx - r, sy - r, 2 * r, 2 * r, Math.PI / 4, 0, 0, 1, 1, YELLOW);
      batcher.draw(whiteTex, sx - ri, sy - ri, 2 * ri, 2 * ri, Math.PI / 4, 0, 0, 1, 1, WHITE);
    }
    drawNumber(currentLevel - 1, cx, cy - 32, 46, YELLOW);
    drawRect(cx - 100, cy + 18, 200, 2, packABGR(59, 130, 246, 200));
    const nextBtn = { x: cx - 90, y: cy + 30, w: 180, h: 58, id: "next" };
    uiButtons.push(nextBtn);
    drawRect(nextBtn.x + 3, nextBtn.y + 4, nextBtn.w, nextBtn.h, SHADOW);
    drawRect(nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h, GREEN);
    drawLabel(lblNext, nextBtn.x + nextBtn.w * 0.4, nextBtn.y + nextBtn.h / 2, 110, 36, WHITE);
    drawNumber(currentLevel, nextBtn.x + nextBtn.w * 0.8, nextBtn.y + nextBtn.h / 2, 28, YELLOW);
    batcher.end();
  }
  function renderLose() {
    renderGame(0);
    batcher.begin(proj);
    drawRect(0, 0, W, H2, packABGR(0, 0, 0, 170));
    const cx = W / 2, cy = H2 / 2;
    drawRect(cx - 144, cy - 124, 288, 248, packABGR(30, 5, 5, 255));
    drawRect(cx - 140, cy - 120, 280, 240, packABGR(100, 20, 20, 255));
    drawRect(cx - 140, cy - 120, 280, 4, RED);
    drawRect(cx - 140, cy + 116, 280, 4, RED);
    drawRect(cx - 140, cy - 120, 4, 240, RED);
    drawRect(cx + 136, cy - 120, 4, 240, RED);
    const xc = cx, xyc = cy - 62, r3 = 22;
    batcher.draw(whiteTex, xc - r3, xyc - 4, 2 * r3, 8, Math.PI / 4, 0, 0, 1, 1, RED);
    batcher.draw(whiteTex, xc - r3, xyc - 4, 2 * r3, 8, -Math.PI / 4, 0, 0, 1, 1, RED);
    drawNumber(currentLevel, cx, cy - 12, 40, packABGR(255, 100, 100, 255));
    drawRect(cx - 100, cy + 24, 200, 2, packABGR(200, 50, 50, 200));
    const retryBtn = { x: cx - 90, y: cy + 34, w: 180, h: 58, id: "retry" };
    uiButtons.push(retryBtn);
    drawRect(retryBtn.x + 3, retryBtn.y + 4, retryBtn.w, retryBtn.h, SHADOW);
    drawRect(retryBtn.x, retryBtn.y, retryBtn.w, retryBtn.h, packABGR(220, 38, 38, 255));
    drawLabel(lblRetry, retryBtn.x + retryBtn.w * 0.38, retryBtn.y + retryBtn.h / 2, 96, 36, WHITE);
    drawNumber(currentLevel, retryBtn.x + retryBtn.w * 0.78, retryBtn.y + retryBtn.h / 2, 26, YELLOW);
    batcher.end();
  }
  function requestFrame(cb) {
    if (canvas && typeof canvas.requestAnimationFrame === "function") canvas.requestAnimationFrame(cb);
    else if (typeof requestAnimationFrame === "function") requestAnimationFrame(cb);
    else setTimeout(() => cb(Date.now()), 16);
  }
  const state = { caseId: "mahjong-3d", hasWx: typeof wx !== "undefined", summary: "booting" };
  log("start");
  if (state.hasWx && typeof wx.onError === "function") wx.onError((m) => console.error(TAG, m));
  if (!setupRenderer()) {
    state.summary = "fail";
  } else {
    loadLevel();
    setupAudio();
    loadTileAtlas(() => {
      setupTouch();
      requestFrame(render);
      state.summary = "running";
      log("game running, level=", currentLevel);
    });
  }
  if (typeof globalThis !== "undefined") globalThis.__MJ_GAME__ = state;
  module.exports = state;
})();
