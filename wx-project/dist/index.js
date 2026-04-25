"use strict";

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

// src/ecs/types.ts
var INVALID_ENTITY = 4294967295;
var ENTITY_INDEX_BITS = 16;
var ENTITY_INDEX_MASK = 65535;
var ENTITY_GEN_MASK = 65535;
var MAX_ENTITIES = 1 << ENTITY_INDEX_BITS;

// src/ecs/entity-manager.ts
var EntityManager = class {
  constructor(config) {
    var _a;
    const max = (_a = config == null ? void 0 : config.maxEntities) != null ? _a : MAX_ENTITIES;
    if (max < 1 || max > MAX_ENTITIES) {
      throw new Error(`maxEntities must be between 1 and ${MAX_ENTITIES}`);
    }
    this._capacity = max;
    this.generations = new Uint16Array(max);
    this.freeList = new Uint16Array(max);
    this.freeCount = 0;
    this._aliveCount = 0;
    this.nextNewIndex = 0;
  }
  get aliveCount() {
    return this._aliveCount;
  }
  get capacity() {
    return this._capacity;
  }
  create() {
    let index;
    if (this.freeCount > 0) {
      index = this.freeList[--this.freeCount];
    } else if (this.nextNewIndex < this._capacity) {
      index = this.nextNewIndex++;
    } else {
      throw new Error("EntityManager capacity exhausted");
    }
    this._aliveCount++;
    const gen = this.generations[index];
    return (gen & ENTITY_GEN_MASK) << 16 | index & ENTITY_INDEX_MASK;
  }
  destroy(id) {
    if (id === INVALID_ENTITY) return;
    const index = id & ENTITY_INDEX_MASK;
    const gen = id >>> 16 & ENTITY_GEN_MASK;
    if (index >= this.nextNewIndex) return;
    if (this.generations[index] !== gen) return;
    this.generations[index] = gen + 1 & ENTITY_GEN_MASK;
    this.freeList[this.freeCount++] = index;
    this._aliveCount--;
  }
  isAlive(id) {
    if (id === INVALID_ENTITY) return false;
    const index = id & ENTITY_INDEX_MASK;
    const gen = id >>> 16 & ENTITY_GEN_MASK;
    if (index >= this.nextNewIndex) return false;
    return this.generations[index] === gen;
  }
  static getIndex(id) {
    return id & ENTITY_INDEX_MASK;
  }
  static getGeneration(id) {
    return id >>> 16 & ENTITY_GEN_MASK;
  }
  reset() {
    this.generations.fill(0);
    this.freeCount = 0;
    this._aliveCount = 0;
    this.nextNewIndex = 0;
  }
};

// src/ecs/component-registry.ts
var MAX_COMPONENT_TYPES = 64;
function componentBit(id) {
  return /* @__PURE__ */ BigInt("1") << BigInt(id);
}
var ComponentRegistry = class {
  constructor() {
    this.components = [];
    this.nameToId = /* @__PURE__ */ new Map();
  }
  register(name, schema, storage = 0 /* Table */) {
    if (this.nameToId.has(name)) {
      throw new Error(`Component "${name}" already registered`);
    }
    if (this.components.length >= MAX_COMPONENT_TYPES) {
      throw new Error(`Cannot register more than ${MAX_COMPONENT_TYPES} component types`);
    }
    const id = this.components.length;
    this.components.push({ name, schema, storage });
    this.nameToId.set(name, id);
    return id;
  }
  getSchema(id) {
    return this.components[id].schema;
  }
  getStorageType(id) {
    return this.components[id].storage;
  }
  getName(id) {
    return this.components[id].name;
  }
  getId(name) {
    var _a;
    return (_a = this.nameToId.get(name)) != null ? _a : -1;
  }
  get count() {
    return this.components.length;
  }
};

// src/ecs/component-storage.ts
var SPARSE_INVALID = 4294967295;
var ComponentStorage = class {
  constructor(registry, capacity) {
    this.tableFields = /* @__PURE__ */ new Map();
    this.sparseSets = /* @__PURE__ */ new Map();
    this.changedTicks = /* @__PURE__ */ new Map();
    this.addedTicks = /* @__PURE__ */ new Map();
    this._currentTick = 0;
    this.registry = registry;
    this._capacity = capacity;
    this.archetypes = new BigUint64Array(capacity);
    for (let id = 0; id < registry.count; id++) {
      this.allocateComponent(id);
    }
  }
  allocateComponent(id) {
    const schema = this.registry.getSchema(id);
    const storageType = this.registry.getStorageType(id);
    this.changedTicks.set(id, new Uint32Array(this._capacity));
    this.addedTicks.set(id, new Uint32Array(this._capacity));
    if (storageType === 0 /* Table */) {
      const fields = /* @__PURE__ */ new Map();
      for (const [name, def] of Object.entries(schema)) {
        const arr = new def.type(this._capacity);
        if (def.default !== void 0 && def.default !== 0) {
          arr.fill(def.default);
        }
        fields.set(name, arr);
      }
      this.tableFields.set(id, fields);
    } else {
      const fieldNames = Object.keys(schema);
      const fields = /* @__PURE__ */ new Map();
      const initialDenseCapacity = 64;
      for (const name of fieldNames) {
        const def = schema[name];
        fields.set(name, new def.type(initialDenseCapacity));
      }
      const sparse = new Uint32Array(this._capacity);
      sparse.fill(SPARSE_INVALID);
      this.sparseSets.set(id, {
        sparse,
        dense: new Uint32Array(initialDenseCapacity),
        denseCount: 0,
        fields
      });
    }
  }
  ensureComponent(id) {
    if (!this.changedTicks.has(id)) {
      this.allocateComponent(id);
    }
  }
  get capacity() {
    return this._capacity;
  }
  get currentTick() {
    return this._currentTick;
  }
  addComponent(entityIndex, componentId) {
    var _a, _b;
    const bit = componentBit(componentId);
    if (this.archetypes[entityIndex] & bit) return;
    this.archetypes[entityIndex] |= bit;
    this.ensureComponent(componentId);
    this.addedTicks.get(componentId)[entityIndex] = this._currentTick;
    this.changedTicks.get(componentId)[entityIndex] = this._currentTick;
    const storageType = this.registry.getStorageType(componentId);
    if (storageType === 0 /* Table */) {
      const schema = this.registry.getSchema(componentId);
      const fields = this.tableFields.get(componentId);
      for (const [name, def] of Object.entries(schema)) {
        fields.get(name)[entityIndex] = (_a = def.default) != null ? _a : 0;
      }
    } else {
      const ss = this.sparseSets.get(componentId);
      const denseIdx = ss.denseCount;
      if (denseIdx >= ss.dense.length) {
        this.growSparseSet(ss, componentId);
      }
      ss.sparse[entityIndex] = denseIdx;
      ss.dense[denseIdx] = entityIndex;
      ss.denseCount++;
      const schema = this.registry.getSchema(componentId);
      for (const [name, def] of Object.entries(schema)) {
        ss.fields.get(name)[denseIdx] = (_b = def.default) != null ? _b : 0;
      }
    }
  }
  growSparseSet(ss, componentId) {
    const newCap = ss.dense.length * 2;
    const newDense = new Uint32Array(newCap);
    newDense.set(ss.dense);
    ss.dense = newDense;
    const schema = this.registry.getSchema(componentId);
    for (const [name, def] of Object.entries(schema)) {
      const oldArr = ss.fields.get(name);
      const newArr = new def.type(newCap);
      newArr.set(oldArr);
      ss.fields.set(name, newArr);
    }
  }
  removeComponent(entityIndex, componentId) {
    const bit = componentBit(componentId);
    if (!(this.archetypes[entityIndex] & bit)) return;
    this.archetypes[entityIndex] &= ~bit;
    const storageType = this.registry.getStorageType(componentId);
    if (storageType === 1 /* SparseSet */) {
      const ss = this.sparseSets.get(componentId);
      const denseIdx = ss.sparse[entityIndex];
      if (denseIdx === SPARSE_INVALID) return;
      const lastIdx = ss.denseCount - 1;
      if (denseIdx !== lastIdx) {
        const lastEntity = ss.dense[lastIdx];
        ss.dense[denseIdx] = lastEntity;
        ss.sparse[lastEntity] = denseIdx;
        for (const [, arr] of ss.fields) {
          arr[denseIdx] = arr[lastIdx];
        }
      }
      ss.sparse[entityIndex] = SPARSE_INVALID;
      ss.denseCount--;
    }
  }
  hasComponent(entityIndex, componentId) {
    return (this.archetypes[entityIndex] & componentBit(componentId)) !== /* @__PURE__ */ BigInt("0");
  }
  getArchetype(entityIndex) {
    return this.archetypes[entityIndex];
  }
  getField(componentId, fieldName) {
    const storageType = this.registry.getStorageType(componentId);
    if (storageType === 0 /* Table */) {
      return this.tableFields.get(componentId).get(fieldName);
    }
    return this.sparseSets.get(componentId).fields.get(fieldName);
  }
  getFields(componentId) {
    const storageType = this.registry.getStorageType(componentId);
    const result = {};
    if (storageType === 0 /* Table */) {
      for (const [name, arr] of this.tableFields.get(componentId)) {
        result[name] = arr;
      }
    } else {
      for (const [name, arr] of this.sparseSets.get(componentId).fields) {
        result[name] = arr;
      }
    }
    return result;
  }
  getSparseSetDense(componentId) {
    const ss = this.sparseSets.get(componentId);
    if (!ss) return null;
    return { dense: ss.dense, count: ss.denseCount };
  }
  markChanged(entityIndex, componentId) {
    this.changedTicks.get(componentId)[entityIndex] = this._currentTick;
  }
  isChanged(entityIndex, componentId, sinceTick) {
    return this.changedTicks.get(componentId)[entityIndex] > sinceTick;
  }
  isAdded(entityIndex, componentId, sinceTick) {
    return this.addedTicks.get(componentId)[entityIndex] > sinceTick;
  }
  advanceTick() {
    return ++this._currentTick;
  }
  clearEntity(entityIndex) {
    const mask = this.archetypes[entityIndex];
    if (mask === /* @__PURE__ */ BigInt("0")) return;
    for (let id = 0; id < this.registry.count; id++) {
      if (mask & componentBit(id)) {
        this.removeComponent(entityIndex, id);
      }
    }
    this.archetypes[entityIndex] = /* @__PURE__ */ BigInt("0");
  }
  reset() {
    this.archetypes.fill(/* @__PURE__ */ BigInt("0"));
    for (const [, ticks] of this.changedTicks) ticks.fill(0);
    for (const [, ticks] of this.addedTicks) ticks.fill(0);
    for (const [, ss] of this.sparseSets) {
      ss.sparse.fill(SPARSE_INVALID);
      ss.denseCount = 0;
    }
    this._currentTick = 0;
  }
};

// src/ecs/system.ts
var PHASE_COUNT = 6;

// src/ecs/scheduler.ts
var Scheduler = class {
  constructor(capacity) {
    this.phases = [];
    this.lastRunTicks = /* @__PURE__ */ new Map();
    for (let i = 0; i < PHASE_COUNT; i++) this.phases.push([]);
    this.matchBuffer = new Uint32Array(capacity);
  }
  addSystem(system) {
    const list = this.phases[system.phase];
    if (list.indexOf(system) !== -1) {
      throw new Error(`System "${system.name}" already registered`);
    }
    list.push(system);
    this.lastRunTicks.set(system, 0);
  }
  removeSystem(system) {
    const list = this.phases[system.phase];
    const idx = list.indexOf(system);
    if (idx !== -1) {
      list.splice(idx, 1);
      this.lastRunTicks.delete(system);
    }
  }
  getSystems(phase) {
    return this.phases[phase];
  }
  getAllSystems() {
    const result = [];
    for (const list of this.phases) result.push(...list);
    return result;
  }
  getLastRunTick(system) {
    var _a;
    return (_a = this.lastRunTicks.get(system)) != null ? _a : 0;
  }
  update(world, dt) {
    var _a;
    for (let phase = 0; phase < PHASE_COUNT; phase++) {
      const systems = this.phases[phase];
      for (let s = 0; s < systems.length; s++) {
        const system = systems[s];
        if (!system.enabled) continue;
        const query = system.query;
        let matchCount = 0;
        if (query !== null) {
          const lastTick = (_a = this.lastRunTicks.get(system)) != null ? _a : 0;
          const hasTickFilters = query.hasTickFilters;
          const capacity = world.storage.capacity;
          for (let e = 0; e < capacity; e++) {
            const arch = world.storage.getArchetype(e);
            if (arch === /* @__PURE__ */ BigInt("0")) continue;
            if (!query.matchesArchetype(arch)) continue;
            if (hasTickFilters && !query.matchesEntity(e, world.storage, lastTick)) continue;
            this.matchBuffer[matchCount++] = e;
          }
        }
        system.update(world, dt, this.matchBuffer, matchCount);
        this.lastRunTicks.set(system, world.storage.currentTick);
      }
    }
  }
};

// src/ecs/query.ts
var ArchetypeQuery = class {
  constructor(withMask, withoutMask, changedIds, addedIds) {
    this.withMask = withMask;
    this.withoutMask = withoutMask;
    this.changedIds = changedIds;
    this.addedIds = addedIds;
  }
  matchesArchetype(archetype) {
    return (archetype & this.withMask) === this.withMask && (archetype & this.withoutMask) === /* @__PURE__ */ BigInt("0");
  }
  matchesEntity(entityIndex, storage, lastRunTick) {
    for (const cid of this.changedIds) {
      if (!storage.isChanged(entityIndex, cid, lastRunTick)) return false;
    }
    for (const cid of this.addedIds) {
      if (!storage.isAdded(entityIndex, cid, lastRunTick)) return false;
    }
    return true;
  }
  get hasTickFilters() {
    return this.changedIds.length > 0 || this.addedIds.length > 0;
  }
};
var ArchetypeQueryBuilder = class {
  constructor() {
    this._withIds = [];
    this._withoutIds = [];
    this._changedIds = [];
    this._addedIds = [];
  }
  with(...componentIds) {
    this._withIds.push(...componentIds);
    return this;
  }
  without(...componentIds) {
    this._withoutIds.push(...componentIds);
    return this;
  }
  changed(...componentIds) {
    this._changedIds.push(...componentIds);
    return this;
  }
  added(...componentIds) {
    this._addedIds.push(...componentIds);
    return this;
  }
  build() {
    let withMask = /* @__PURE__ */ BigInt("0");
    for (const id of this._withIds) withMask |= componentBit(id);
    let withoutMask = /* @__PURE__ */ BigInt("0");
    for (const id of this._withoutIds) withoutMask |= componentBit(id);
    return new ArchetypeQuery(withMask, withoutMask, this._changedIds, this._addedIds);
  }
};

// src/ecs/world.ts
var World = class {
  constructor(config) {
    var _a;
    const max = (_a = config == null ? void 0 : config.maxEntities) != null ? _a : 65536;
    this.entities = new EntityManager({ maxEntities: max });
    this.registry = new ComponentRegistry();
    this.storage = new ComponentStorage(this.registry, max);
    this.scheduler = new Scheduler(max);
  }
  get currentTick() {
    return this.storage.currentTick;
  }
  get entityCount() {
    return this.entities.aliveCount;
  }
  createEntity() {
    return this.entities.create();
  }
  destroyEntity(id) {
    if (!this.entities.isAlive(id)) return;
    const index = EntityManager.getIndex(id);
    this.storage.clearEntity(index);
    this.entities.destroy(id);
  }
  isAlive(id) {
    return this.entities.isAlive(id);
  }
  addComponent(id, componentId) {
    const index = EntityManager.getIndex(id);
    this.storage.ensureComponent(componentId);
    this.storage.addComponent(index, componentId);
    return this;
  }
  removeComponent(id, componentId) {
    const index = EntityManager.getIndex(id);
    this.storage.removeComponent(index, componentId);
  }
  hasComponent(id, componentId) {
    const index = EntityManager.getIndex(id);
    return this.storage.hasComponent(index, componentId);
  }
  query() {
    return new ArchetypeQueryBuilder();
  }
  addSystem(system) {
    this.scheduler.addSystem(system);
  }
  removeSystem(system) {
    this.scheduler.removeSystem(system);
  }
  update(dt) {
    this.storage.advanceTick();
    this.scheduler.update(this, dt);
  }
  reset() {
    this.entities.reset();
    this.storage.reset();
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

// src/canonical/scene-loader.ts
function loadSceneData(sceneData, world, config) {
  const entityIds = [];
  const idMap = /* @__PURE__ */ new Map();
  for (const compiled of sceneData.entities) {
    const entityId = world.createEntity();
    const entityIndex = EntityManager.getIndex(entityId);
    entityIds.push(entityId);
    idMap.set(compiled.id, entityId);
    for (const [compName, compData] of Object.entries(compiled.components)) {
      const componentId = world.registry.getId(compName);
      if (componentId === -1) continue;
      world.addComponent(entityId, componentId);
      const fieldNames = config.componentFieldMap.get(compName);
      if (!fieldNames) continue;
      for (const fieldName of fieldNames) {
        const value = compData[fieldName];
        if (value === void 0 || value === null) continue;
        if (typeof value !== "number") continue;
        const field = world.storage.getField(componentId, fieldName);
        field[entityIndex] = value;
      }
      world.storage.markChanged(entityIndex, componentId);
    }
  }
  return {
    sceneId: sceneData.sceneId,
    entityCount: entityIds.length,
    entityIds,
    idMap
  };
}

// src/wx-smoke-scene.cts
(function smokeScene() {
  var TAG = "[Membrane][wx-smoke-scene]";
  function log(...args) {
    args.unshift(TAG);
    console.info.apply(console, args);
  }
  function warn(...args) {
    args.unshift(TAG);
    console.warn.apply(console, args);
  }
  var state = {
    caseId: "wx-smoke-scene",
    startedAt: Date.now(),
    frameCount: 0,
    hasWx: typeof wx !== "undefined",
    summary: "booting"
  };
  if (state.hasWx) {
    if (typeof wx.onError === "function") {
      wx.onError(function(msg) {
        console.error(TAG, "wx.onError", msg);
      });
    }
    if (typeof wx.onUnhandledRejection === "function") {
      wx.onUnhandledRejection(function(e) {
        var _a;
        console.error(TAG, "unhandledRejection", (_a = e == null ? void 0 : e.reason) != null ? _a : e);
      });
    }
  }
  var TRANSFORM_SCHEMA = {
    x: { type: Float32Array },
    y: { type: Float32Array },
    rotation: { type: Float32Array },
    scaleX: { type: Float32Array, default: 1 },
    scaleY: { type: Float32Array, default: 1 }
  };
  var SPRITE_SCHEMA = {
    order: { type: Int32Array },
    flipX: { type: Uint8Array },
    flipY: { type: Uint8Array },
    visible: { type: Uint8Array, default: 1 }
  };
  var CAMERA_SCHEMA = {
    size: { type: Float32Array, default: 320 },
    near: { type: Float32Array, default: 1 },
    far: { type: Float32Array, default: 2e3 }
  };
  var LOADER_CONFIG = {
    componentFieldMap: /* @__PURE__ */ new Map([
      ["Transform", ["x", "y", "rotation", "scaleX", "scaleY"]],
      ["Sprite", ["order", "flipX", "flipY", "visible"]],
      ["Camera", ["size", "near", "far"]]
    ])
  };
  var canvas = null;
  var canvasWidth = 360;
  var canvasHeight = 640;
  var dpr = 1;
  function setupCanvas() {
    var _a;
    if (!state.hasWx || typeof wx.createCanvas !== "function") return false;
    try {
      canvas = wx.createCanvas();
      if (!canvas) return false;
      canvasWidth = canvas.width || 360;
      canvasHeight = canvas.height || 640;
      var sysInfo = typeof wx.getSystemInfoSync === "function" ? wx.getSystemInfoSync() : null;
      if (sysInfo) {
        dpr = sysInfo.pixelRatio || 1;
        state.deviceLabel = [sysInfo.brand, sysInfo.model].filter(Boolean).join(" ");
      }
      log("canvas", canvasWidth + "x" + canvasHeight, "dpr=" + dpr);
      return true;
    } catch (e) {
      warn("canvas failed", (_a = e == null ? void 0 : e.message) != null ? _a : e);
      return false;
    }
  }
  function packABGR(r, g, b, a) {
    return (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  function hslToABGR(h, s, l) {
    h = h % 360;
    s /= 100;
    l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(h / 60 % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
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
    return packABGR(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
      255
    );
  }
  var device;
  var batcher;
  var world;
  var whiteTexture;
  var projMatrix;
  var transformId;
  var spriteId;
  var cameraId;
  var loadedEntityIds = [];
  var loadedSceneId = "";
  var currentSceneIndex = 0;
  var fixtureScenes = [];
  function loadFixture() {
    var _a;
    try {
      var fixture = require("../assets/scene-data");
      if (fixture && fixture.scenes) {
        fixtureScenes = fixture.scenes;
        log("loaded fixture:", fixtureScenes.length, "scenes");
        for (var i = 0; i < fixtureScenes.length; i++) {
          log("  scene:", fixtureScenes[i].sceneId, "entities:", fixtureScenes[i].entities.length);
        }
        return true;
      }
      warn("fixture has no scenes");
      return false;
    } catch (e) {
      warn("failed to load fixture:", (_a = e == null ? void 0 : e.message) != null ? _a : e);
      return false;
    }
  }
  function setupRuntime() {
    var _a;
    try {
      device = new WebGLDevice(canvas, { alpha: false, antialias: false });
      log("WebGLDevice v" + device.capabilities.webglVersion);
      batcher = new SpriteBatcher(device);
      world = new World({ maxEntities: 4096 });
      world.registry.register("Transform", TRANSFORM_SCHEMA);
      world.registry.register("Sprite", SPRITE_SCHEMA);
      world.registry.register("Camera", CAMERA_SCHEMA);
      transformId = world.registry.getId("Transform");
      spriteId = world.registry.getId("Sprite");
      cameraId = world.registry.getId("Camera");
      var gl = device.gl;
      whiteTexture = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255])
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      projMatrix = new Mat4();
      Mat4.ortho(0, canvasWidth, canvasHeight, 0, -1, 1, projMatrix);
      return true;
    } catch (e) {
      warn("runtime setup failed:", (_a = e == null ? void 0 : e.message) != null ? _a : e);
      return false;
    }
  }
  function loadCurrentScene() {
    world.reset();
    loadedEntityIds = [];
    if (fixtureScenes.length === 0) return;
    var sceneData = fixtureScenes[currentSceneIndex % fixtureScenes.length];
    loadedSceneId = sceneData.sceneId;
    var result = loadSceneData(sceneData, world, LOADER_CONFIG);
    loadedEntityIds = result.entityIds;
    log("loaded scene:", loadedSceneId, "entities:", result.entityCount);
    var spriteCount = 0;
    var cameraCount = 0;
    for (var eid of loadedEntityIds) {
      if (world.hasComponent(eid, spriteId)) spriteCount++;
      if (world.hasComponent(eid, cameraId)) cameraCount++;
    }
    log("  sprites:", spriteCount, "cameras:", cameraCount);
  }
  function setupTouch() {
    if (!state.hasWx || typeof wx.onTouchStart !== "function") return;
    wx.onTouchStart(function() {
      currentSceneIndex++;
      loadCurrentScene();
      log("switched to scene", currentSceneIndex % fixtureScenes.length, ":", loadedSceneId);
    });
  }
  var fpsAccum = 0;
  var fpsFrames = 0;
  var displayFps = 0;
  var lastTime = 0;
  function render() {
    device.setViewport(0, 0, canvasWidth, canvasHeight);
    device.clear(0.06, 0.07, 0.1, 1);
    batcher.begin(projMatrix);
    var xField = world.storage.getField(transformId, "x");
    var yField = world.storage.getField(transformId, "y");
    var sxField = world.storage.getField(transformId, "scaleX");
    var syField = world.storage.getField(transformId, "scaleY");
    var orderField = world.storage.getField(spriteId, "order");
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < loadedEntityIds.length; i++) {
      var idx = EntityManager.getIndex(loadedEntityIds[i]);
      var ex = xField[idx], ey = yField[idx];
      if (ex < minX) minX = ex;
      if (ex > maxX) maxX = ex;
      if (ey < minY) minY = ey;
      if (ey > maxY) maxY = ey;
    }
    var rangeX = maxX - minX || 1;
    var rangeY = maxY - minY || 1;
    var padding = 40;
    var viewW = canvasWidth - padding * 2;
    var viewH = canvasHeight - padding * 2 - 60;
    var scale = Math.min(viewW / rangeX, viewH / rangeY) * 0.9;
    for (var i = 0; i < loadedEntityIds.length; i++) {
      var eid = loadedEntityIds[i];
      var idx = EntityManager.getIndex(eid);
      var screenX = padding + (xField[idx] - minX) * scale;
      var screenY = 60 + padding + (yField[idx] - minY) * scale;
      var hasSprite = world.hasComponent(eid, spriteId);
      var hasCamera = world.hasComponent(eid, cameraId);
      var color;
      var size = 6;
      if (hasCamera) {
        color = packABGR(100, 149, 237, 255);
        size = 12;
      } else if (hasSprite) {
        color = hslToABGR((i * 47 + 30) % 360, 65, 55);
        size = 8;
      } else {
        color = packABGR(100, 100, 120, 180);
        size = 5;
      }
      var sx = sxField[idx] || 1;
      var sy = syField[idx] || 1;
      var w = Math.min(size * Math.abs(sx), 40);
      var h = Math.min(size * Math.abs(sy), 40);
      batcher.draw(whiteTexture, screenX - w / 2, screenY - h / 2, w, h, 0, 0, 0, 1, 1, color);
    }
    batcher.end();
    var fpsRatio = Math.min(displayFps / 60, 1);
    var barColor = fpsRatio > 0.9 ? packABGR(110, 231, 168, 255) : fpsRatio > 0.5 ? packABGR(255, 209, 102, 255) : packABGR(255, 123, 123, 255);
    batcher.begin(projMatrix);
    batcher.draw(whiteTexture, 0, 0, canvasWidth, 50, 0, 0, 0, 1, 1, packABGR(15, 15, 25, 220));
    batcher.draw(whiteTexture, 0, 46, canvasWidth * fpsRatio, 4, 0, 0, 0, 1, 1, barColor);
    for (var s = 0; s < fixtureScenes.length; s++) {
      var dotColor = s === currentSceneIndex % fixtureScenes.length ? packABGR(110, 231, 168, 255) : packABGR(80, 80, 100, 200);
      batcher.draw(whiteTexture, 10 + s * 14, 8, 10, 10, 0, 0, 0, 1, 1, dotColor);
    }
    var entityRatio = Math.min(loadedEntityIds.length / 200, 1);
    batcher.draw(whiteTexture, 80, 10, canvasWidth - 90, 6, 0, 0, 0, 1, 1, packABGR(40, 40, 60, 200));
    batcher.draw(whiteTexture, 80, 10, (canvasWidth - 90) * entityRatio, 6, 0, 0, 0, 1, 1, packABGR(170, 68, 255, 200));
    var sprCount = 0;
    for (var i = 0; i < loadedEntityIds.length; i++) {
      if (world.hasComponent(loadedEntityIds[i], spriteId)) sprCount++;
    }
    var sprRatio = loadedEntityIds.length > 0 ? sprCount / loadedEntityIds.length : 0;
    batcher.draw(whiteTexture, 80, 20, canvasWidth - 90, 6, 0, 0, 0, 1, 1, packABGR(40, 40, 60, 200));
    batcher.draw(whiteTexture, 80, 20, (canvasWidth - 90) * sprRatio, 6, 0, 0, 0, 1, 1, packABGR(68, 255, 136, 200));
    batcher.end();
  }
  function tick(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    var dt = (timestamp - lastTime) / 1e3;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastTime = timestamp;
    render();
    state.frameCount++;
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1) {
      displayFps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }
    if (state.frameCount === 1 || state.frameCount % 120 === 0) {
      log(
        "frame",
        state.frameCount,
        "fps",
        displayFps.toFixed(1),
        "scene",
        loadedSceneId,
        "entities",
        loadedEntityIds.length
      );
    }
    requestFrame(tick);
  }
  var rafSource = "none";
  function requestFrame(cb) {
    if (canvas && typeof canvas.requestAnimationFrame === "function") {
      canvas.requestAnimationFrame(cb);
      if (rafSource === "none") {
        rafSource = "canvas.raf";
      }
    } else if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(cb);
      if (rafSource === "none") {
        rafSource = "global.raf";
      }
    } else if (state.hasWx && typeof wx.requestAnimationFrame === "function") {
      wx.requestAnimationFrame(cb);
      if (rafSource === "none") {
        rafSource = "wx.raf";
      }
    } else {
      setTimeout(function() {
        cb(Date.now());
      }, 16);
      if (rafSource === "none") {
        rafSource = "setTimeout";
      }
    }
  }
  log("start");
  if (state.hasWx && typeof wx.showToast === "function") {
    try {
      wx.showToast({ title: "Scene smoke", icon: "none", duration: 1500 });
    } catch (_) {
    }
  }
  var ok = setupCanvas();
  if (!ok) {
    state.summary = "canvas-fail";
    warn("canvas failed");
  } else {
    ok = loadFixture();
    if (!ok) {
      state.summary = "fixture-fail";
      warn("fixture load failed");
    } else {
      ok = setupRuntime();
      if (!ok) {
        state.summary = "runtime-fail";
        warn("runtime failed");
      } else {
        loadCurrentScene();
        setupTouch();
        requestFrame(tick);
        state.summary = "running";
        log("scene rendering started, tap to switch scenes");
      }
    }
  }
  if (typeof globalThis !== "undefined") {
    globalThis.__MEMBRANE_WX_SMOKE__ = state;
  }
  module.exports = state;
})();
