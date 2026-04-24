# WebGL 渲染器 API 规格

> **职责**: 封装 WebGL Context，管理 GL 状态缓存，提供 Shader 编译/链接工具。

---

## WebGLDevice

```typescript
interface WebGLDeviceConfig {
  antialias?: boolean;
  alpha?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
}

class WebGLDevice {
  readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  readonly isWebGL2: boolean;
  readonly canvas: HTMLCanvasElement | WxCanvas;
  readonly capabilities: GLCapabilities;
  readonly stateCache: GLStateCache;

  constructor(canvas: HTMLCanvasElement | WxCanvas, config?: WebGLDeviceConfig);

  clear(r: number, g: number, b: number, a: number): void;
  setViewport(x: number, y: number, width: number, height: number): void;
  getDrawingBufferSize(): { width: number; height: number };
  createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram;
  createBuffer(): WebGLBuffer;
  createTexture(): WebGLTexture;
  destroyProgram(program: WebGLProgram): void;
  destroyBuffer(buffer: WebGLBuffer): void;
  destroyTexture(texture: WebGLTexture): void;
  useProgram(program: WebGLProgram): void;
  bindTexture(slot: number, texture: WebGLTexture): void;
  setBlendState(enabled: boolean, srcFactor?: GLenum, dstFactor?: GLenum): void;
  setDepthState(enabled: boolean, write?: boolean, func?: GLenum): void;
  setCullFace(enabled: boolean, face?: GLenum): void;
}
```

## GLCapabilities

```typescript
interface GLCapabilities {
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
```

## GLStateCache

每次状态设置前先比对缓存值，相同则跳过 GL 调用。缓存项：currentProgram、boundTextures、blendState、depthState、cullFace、viewport。

提供 `skippedCalls` 计数器用于性能监控。

## Shader 工具

```typescript
function compileShader(gl, type: GLenum, source: string): WebGLShader;
function linkProgram(gl, vs: WebGLShader, fs: WebGLShader): WebGLProgram;
function getUniformLocations(gl, program, names: string[]): Record<string, WebGLUniformLocation>;
function getAttributeLocations(gl, program, names: string[]): Record<string, number>;
```

## 关键约束

1. **WebGL1 优先**: WebGL2 通过 capability 检测可选启用
2. **状态缓存一致性**: 所有 GL 状态变更必须通过 WebGLDevice
3. **Context Lost**: 监听并处理 webglcontextlost/restored 事件
4. **Shader 预编译**: 运行时禁止编译新 Shader
5. **纹理 slot**: 最多使用 8 个（移动端安全值）

## 依赖关系

- **依赖**: `platform/platform-adapter`
- 被 `renderer/sprite-batcher`、`renderer/texture`、`core/engine` 使用
