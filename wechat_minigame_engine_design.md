# 微信小游戏专用引擎 Runtime 设计文档

> **目标读者**: Claude / AI 工具辅助代码生成  
> **定位**: 专为微信小游戏优化的轻量级 Runtime，工具链支持 CocosCreator / Unity 导出，运行时原生 WebGL，架构基于 ECS。

---

## 1. 项目概述

### 1.1 核心设计目标

| 目标 | 描述 | 优先级 |
|------|------|--------|
| 高性能渲染 | 原生 WebGL 1.0/2.0，最小化 JS GC 压力 | P0 |
| ECS 数据架构 | Entity-Component-System，面向数据设计（DOD） | P0 |
| 最小化 Runtime | 只包含运行必要模块，无编辑器依赖 | P0 |
| 工具链兼容 | 支持 CocosCreator 导出格式 + Unity WebGL 导出格式 | P1 |
| 微信平台适配 | wx API 封装、分包加载、内存限制感知 | P1 |

### 1.2 技术约束（微信小游戏环境）

- **运行时**: 微信 APP 内置 V8/JavaScriptCore，**不是**浏览器
- **WebGL**: 支持 WebGL 1.0（全量），WebGL 2.0（iOS 15+ 高性能模式）
- **无 DOM**: 无 `document`、无 `window.location`，使用 `wx.canvas`
- **内存上限**: Android ~256MB，iOS ~512MB（实测更低）
- **包体限制**: 主包 4MB，分包每个 20MB，总计 80MB
- **线程模型**: 主线程 + Worker（无 SharedArrayBuffer，无 Atomics）

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  Tool Layer（工具链）                     │
│  CocosCreator Exporter Plugin  │  Unity WebGL Converter  │
│  → 导出场景描述 JSON/Binary     │  → WASM + 胶水层适配    │
└───────────────────┬─────────────────────────────────────┘
                    │ Scene Bundle (Binary)
┌───────────────────▼─────────────────────────────────────┐
│                  Runtime Core                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  ECS World  │  │ Render Graph│  │  Asset Pipeline │  │
│  │  (DOD核心)  │  │ (WebGL原生) │  │  (分包/流式加载) │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Math / SIMD │  │  Audio      │  │  wx Platform    │  │
│  │  (TypedArr) │  │  (wx.InnerAudio) │  │  Adapter   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                    │
         wx.canvas / WebGL Context
```

---

## 3. 模块详细设计

### 3.1 ECS World（核心）

**设计原则**: 面向数据（DOD），所有 Component 用 `TypedArray` 存储（SoA 布局），避免 GC。

#### 3.1.1 Entity Manager

```typescript
// 实体 ID 采用 32-bit 整数：高16位 generation，低16位 index
type EntityId = number; // u32

class EntityManager {
  // 空闲列表复用，generation 防悬空引用
  private freeList: Uint32Array;
  private generations: Uint16Array;
  
  create(): EntityId;
  destroy(id: EntityId): void;
  isAlive(id: EntityId): boolean;
}
```

**关键约束**:
- 最大实体数通过配置预分配（默认 65536）
- 禁止动态扩容（会触发 GC）

#### 3.1.2 Component Storage（SoA 布局）

每个 Component 类型独立 ArrayBuffer，按字段拆分存储：

```typescript
// 示例：Transform Component
class TransformStorage {
  // 分字段 SoA 存储，避免结构体内存对齐浪费
  posX: Float32Array;   // [entity0.x, entity1.x, ...]
  posY: Float32Array;
  posZ: Float32Array;
  rotX: Float32Array;
  rotY: Float32Array;
  rotZ: Float32Array;
  rotW: Float32Array;
  scaleX: Float32Array;
  scaleY: Float32Array;
  scaleZ: Float32Array;
  
  constructor(capacity: number) {
    const buffer = new SharedArrayBuffer(capacity * 10 * 4);
    // 或 ArrayBuffer（wx Worker 间通信用 postMessage 传递）
  }
}
```

**Component 注册表**:

| Component 类型 | 存储格式 | 大小/实体 |
|--------------|---------|---------|
| Transform | Float32Array × 10 | 40 bytes |
| Sprite | Uint32Array (atlas_id, frame_id, color) | 12 bytes |
| RigidBody2D | Float32Array × 6 | 24 bytes |
| Animator | Uint16Array × 4 | 8 bytes |
| Camera | Float32Array × 8 | 32 bytes |
| CustomTag | BitField (Uint32Array) | 4 bytes |

#### 3.1.3 System Scheduler

```typescript
interface System {
  readonly query: ArchetypeQuery;   // 声明所需 Component 集合
  readonly phase: SystemPhase;       // 执行阶段
  update(world: World, dt: number): void;
}

enum SystemPhase {
  PreUpdate,      // 输入处理
  Update,         // 游戏逻辑
  PostUpdate,     // 物理、动画
  PreRender,      // 渲染数据准备
  Render,         // 提交 WebGL 指令
  PostRender,     // 后处理
}
```

**Archetype 查询**（仿 Bevy/flecs）:

```typescript
// 示例：查询所有有 Transform + Sprite 且无 Hidden 的实体
const query = world.query()
  .with(Transform, Sprite)
  .without(Hidden)
  .build();
```

---

### 3.2 Render Graph（WebGL 渲染管线）

**设计原则**: 帧内零 GC，所有渲染指令写入预分配 CommandBuffer，批量提交。

#### 3.2.1 WebGL Context 管理

```typescript
class WebGLDevice {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private stateCache: GLStateCache;  // 状态缓存，避免冗余 gl.* 调用
  
  // 状态缓存项（每次提交前 diff）
  // - bound texture slots
  // - blend state
  // - depth/stencil state  
  // - viewport
  // - bound program
  
  getContext(canvas: WxCanvas): void {
    // 优先尝试 WebGL2，降级 WebGL1
    this.gl = canvas.getContext('webgl2') 
           ?? canvas.getContext('webgl');
  }
}
```

#### 3.2.2 Render Pass 架构

```
每帧渲染流程：

1. [ECS PreRender Phase]
   - TransformSystem: 计算 WorldMatrix（SIMD-like TypedArray 批量运算）
   - CullingSystem: 视锥裁剪 → 写入 VisibleSet (BitArray)
   - SortSystem: 按 depth + material 排序 → 生成 DrawList

2. [Render Pass]
   RenderGraph.execute(drawList):
     ├── ShadowPass (可选，仅3D)
     ├── OpaquePass
     │     └── Batcher: 合并相邻相同材质 DrawCall → instanced draw
     ├── TransparentPass (按深度排序)
     └── UIPass (Screen Space，独立图层)

3. [PostProcess Pass] (可选)
     └── Bloom / Color Grading (FrameBuffer Blit)
```

#### 3.2.3 Sprite Batcher（2D 性能核心）

```typescript
class SpriteBatcher {
  // 预分配顶点缓冲（避免帧内 realloc）
  private vbo: WebGLBuffer;
  private ibo: WebGLBuffer;
  private vertexData: Float32Array;  // [x,y,u,v,color] × 4顶点 × MAX_SPRITES
  
  // 每帧 flush 触发条件（按序检查）:
  // 1. 纹理图集切换
  // 2. Blend Mode 变化
  // 3. 缓冲区满 (MAX_SPRITES = 2048)
  
  flush(): void {
    gl.bufferSubData(ARRAY_BUFFER, 0, this.vertexData);
    gl.drawElements(TRIANGLES, this.indexCount, UNSIGNED_SHORT, 0);
  }
}
```

**DrawCall 预算**（微信小游戏参考值）:

| 场景类型 | 目标 DrawCall/帧 | 目标帧率 |
|---------|--------------|--------|
| 2D 休闲 | < 30 | 60 fps |
| 2D 策略 | < 60 | 30 fps |
| 3D 轻量 | < 100 | 30 fps |

#### 3.2.4 Shader 管理

```typescript
// Shader 变体系统（轻量版，避免运行时编译卡顿）
class ShaderLibrary {
  // 所有 Shader 在启动时预编译（Loading 阶段）
  // 禁止游戏运行时动态编译 Shader
  
  private programs: Map<ShaderKey, WebGLProgram>;
  
  // Uber Shader 宏定义（静态枚举，不支持动态分支）
  precompileVariants(variants: ShaderVariantDef[]): Promise<void>;
}
```

---

### 3.3 Asset Pipeline（资源管线）

#### 3.3.1 Bundle 格式

自定义二进制格式（替代 JSON，减少解析开销）：

```
Bundle Header (32 bytes):
  magic:      [0x57 0x58 0x47 0x45] "WXGE"
  version:    u16
  flags:      u16  (compressed, encrypted...)
  asset_count: u32
  toc_offset:  u32
  data_offset: u32

Table of Contents:
  [asset_id: u32, type: u8, offset: u32, size: u32] × N

Data Section:
  Raw asset data (textures: compressed KTX/basis, audio: mp3, mesh: custom)
```

#### 3.3.2 分包策略

```
主包 (~4MB):
  - Runtime Core JS
  - 启动场景资源
  - 核心 UI Atlas

分包 A - 关卡资源包 (≤20MB):
  - 关卡 Tilemap
  - 关卡音效

分包 B - 角色资源包 (≤20MB):
  - 角色 Sprite Atlas
  - 动画数据

按需加载 API:
  AssetManager.loadBundle('level_1').then(bundle => {
    world.instantiate(bundle.getScene('Level1'));
  });
```

#### 3.3.3 纹理压缩策略

| 平台 | 格式 | 备注 |
|------|------|------|
| Android (ASTC 支持) | ASTC 6×6 | 最优，需运行时检测 |
| Android (通用) | ETC2 | WebGL2 原生支持 |
| iOS | PVRTC / ASTC | ASTC 需 iOS 13+ |
| 降级 | PNG/WebP | 无损压缩，体积最大 |

**运行时自动选择**，通过 `gl.getExtension()` 检测能力后决定加载哪个版本。

---

### 3.4 Math 模块

**原则**: 全部使用 `Float32Array` 池化，禁止产生临时对象（避免 GC）。

```typescript
// 对象池化向量/矩阵操作
class Vec3 {
  static pool: Vec3Pool; // 预分配对象池
  
  // 所有操作写入 out 参数，不返回新对象
  static add(a: Vec3, b: Vec3, out: Vec3): void;
  static mulMat4(v: Vec3, m: Mat4, out: Vec3): void;
}

// 矩阵运算使用 TypedArray 直接操作
class Mat4 {
  data: Float32Array; // 16 floats, column-major
  
  // SIMD-like: 展开循环，利用 JIT 优化
  static multiply(a: Mat4, b: Mat4, out: Mat4): void;
}
```

---

### 3.5 wx Platform Adapter

封装微信平台 API，提供 Web 标准兼容接口：

```typescript
class WxPlatformAdapter {
  // Canvas
  getCanvas(): WxCanvas;
  
  // 文件系统（替代 fetch）
  readFile(path: string): Promise<ArrayBuffer>;
  
  // 网络（替代 XMLHttpRequest）
  request(options: WxRequestOptions): Promise<Response>;
  
  // 内存监控
  onMemoryWarning(callback: (level: 'low'|'critical') => void): void;
  
  // 性能监控
  getPerformance(): { memory: MemoryInfo; fps: number };
  
  // 震动、音频、社交等 wx 专属能力
  vibrate(type: 'short' | 'long'): void;
}
```

**内存压力响应策略**:

```
onMemoryWarning('low')    → 释放非活跃纹理 MipMap
onMemoryWarning('critical') → 暂停分包预加载 + 强制 GC hint + 释放离屏 FrameBuffer
```

---

### 3.6 Audio 模块

```typescript
// wx.createInnerAudioContext 封装
class AudioManager {
  private pool: Map<string, WxInnerAudioContext[]>;
  
  // 音效：使用对象池，控制同时播放数量（上限8）
  playSFX(id: string, volume?: number): void;
  
  // 背景音乐：单实例，支持淡入淡出
  playBGM(id: string, loop?: boolean): Promise<void>;
  stopBGM(fadeOut?: number): Promise<void>;
}
```

---

### 3.7 工具链接口（Exporter 规范）

#### 3.7.1 CocosCreator 导出插件

目标：将 CocosCreator 场景转换为本引擎 Bundle 格式。

**导出数据映射**:

| CocosCreator 概念 | 本引擎映射 | 说明 |
|-----------------|-----------|------|
| Node | Entity | 1:1 |
| Transform Component | TransformStorage | SoA 格式 |
| Sprite Component | SpriteStorage | 引用 Atlas ID |
| SpriteAtlas | Bundle Texture Atlas | 打包进 Bundle |
| Animation Clip | AnimationStorage (binary) | 关键帧二进制序列 |
| Prefab | EntityTemplate | 预实例化模板 |

**导出流程**:
1. 解析 CocosCreator `.scene` / `.prefab` 文件（JSON）
2. 提取资源依赖树
3. 打包 Atlas（TexturePacker 集成）
4. 序列化为 WXGE Bundle Binary
5. 输出分包清单

#### 3.7.2 Unity WebGL 导出路径

使用微信官方 Unity-to-MiniGame 转换工具作为预处理器：

```
Unity Project
    │
    ▼ (Unity WebGL Build)
WebGL Package (WASM + JS Glue)
    │
    ▼ (wx-miniGame-adapter 官方工具)
微信小游戏包
    │
    ▼ (本引擎 Unity Adapter Layer)
统一 ECS Runtime（可选薄层替换渲染部分）
```

**Unity 适配层职责**:
- 替换 Unity WebGL 的渲染调用为本引擎 RenderGraph（高性能模式）
- 或直接透传 Unity WebGL 渲染（兼容模式，牺牲部分性能）

---

## 4. 性能预算与指标

### 4.1 帧预算（60fps = 16.67ms/帧）

| 阶段 | 预算 | 说明 |
|------|------|------|
| ECS Update (全系统) | ≤ 3ms | 游戏逻辑 |
| Transform 计算 | ≤ 1ms | 矩阵 batch 运算 |
| 视锥裁剪 | ≤ 0.5ms | BitArray 操作 |
| Render Graph 排序 | ≤ 0.5ms | Radix Sort |
| WebGL 提交 | ≤ 5ms | GPU 驱动限制 |
| 剩余 Buffer | ≤ 6ms | 物理/音频/其他 |

### 4.2 内存预算（Android 256MB 上限）

| 类别 | 预算 |
|------|------|
| Runtime 代码 + 堆 | ≤ 30MB |
| 纹理 GPU 显存 | ≤ 80MB |
| ECS TypedArray 数据 | ≤ 20MB |
| 音频缓冲 | ≤ 10MB |
| 游戏逻辑 | ≤ 116MB |

---

## 5. 开发阶段规划

### Phase 1 — Runtime MVP（核心可跑）
- [ ] ECS World: EntityManager + 基础 Component Storage
- [ ] WebGL Device + SpriteBatcher（2D）
- [ ] wx Platform Adapter（Canvas + FileSystem）
- [ ] Bundle Loader（基础格式）
- [ ] Math 库（Vec2/Vec3/Mat4 池化）

### Phase 2 — 工具链（可从 Cocos 导出）
- [ ] CocosCreator 导出插件（Transform + Sprite + Atlas）
- [ ] Bundle 二进制格式完整实现
- [ ] 场景实例化系统

### Phase 3 — 高级特性
- [ ] Render Graph（Opaque/Transparent/UI Pass 分离）
- [ ] 纹理压缩自动选择（ASTC/ETC2/PVRTC）
- [ ] Shader 变体预编译系统
- [ ] Unity WebGL Adapter

### Phase 4 — 工具与生态
- [ ] 运行时调试面板（帧率/DrawCall/内存）
- [ ] 自动化性能回归测试
- [ ] 文档与示例项目

---

## 6. 关键技术决策记录（ADR）

### ADR-001: 为何用 TypedArray SoA 而非 Class 实例

**决策**: 所有 Component 数据存储在 `TypedArray`（SoA 布局），而非 JS Class 实例数组。

**原因**:
- JS 对象每个实例有 ~40-96 bytes 隐藏开销（V8 hidden class + 指针）
- TypedArray 内存连续，CPU cache 友好，遍历系统时效率提升 3-10x
- 彻底消除 GC（不产生临时对象），帧时间更稳定

**代价**: API 不如面向对象直观，需要额外封装层。

### ADR-002: 为何不用现有引擎（Cocos/Phaser/Pixi）

**决策**: 自研 Runtime，只支持微信小游戏，不追求跨平台。

**原因**:
- Cocos Creator Runtime 含大量不必要代码（编辑器适配、多平台兼容），包体和启动时间偏大
- Phaser/Pixi 基于 DOM/browser 假设，在小游戏需要大量 polyfill
- 自研可完全控制内存分配策略和 GC 行为

**代价**: 开发成本高，生态需自建。

### ADR-003: WebGL1 优先，WebGL2 渐进增强

**决策**: 核心渲染器基于 WebGL1，WebGL2 作为可选增强路径。

**原因**:
- iOS WebGL2 需要高性能模式 + iOS 15+，覆盖率不足
- WebGL1 + 扩展（instanced arrays, VAO）可覆盖 99% 小游戏渲染需求
- 渲染器设计为 capability-based，检测到 WebGL2 自动启用更优路径

### ADR-004: 禁止运行时 Shader 编译

**决策**: 所有 Shader 必须在 Loading 阶段预编译，游戏运行时禁止编译新 Shader。

**原因**:
- Shader 编译在移动端会造成 50-500ms 卡顿（GLStutter）
- 微信小游戏用户对卡顿容忍度低

**实现**: 导出工具在构建时分析材质依赖，生成所有变体列表，Runtime 在启动时批量编译。

---

## 7. 接口约定（供 AI 代码生成参考）

所有模块遵循以下约定：

```typescript
// 1. 无副作用的纯函数标记
/** @pure */
function transformPoint(point: Vec3, matrix: Mat4, out: Vec3): void;

// 2. 热路径函数标记（不得产生 GC，不得动态分配）
/** @hotpath @nogc */
function batcherFlush(batcher: SpriteBatcher, gl: WebGLRenderingContext): void;

// 3. 平台限制说明
/** @wx-only 仅微信小游戏环境可用 */
function getWxCanvas(): WxCanvas;

// 4. 性能预算注释
/** @budget 0.5ms/frame */
class CullingSystem implements System;
```

---

*文档版本: 0.1.0 | 状态: Draft*
