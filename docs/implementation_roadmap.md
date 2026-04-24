# 实现路线图

> Phase 1 先做运行时、canonical format 和单向导入链路，用现有项目作为内容源验证 runtime、资源管线和性能预算。
> Phase 2 做 AI-Native 创作平台，用 MCP 连接器替代传统编辑器。
> 每一步都必须可独立测试验证。

---

## 规划原则：每一步都要可测试

### 1. 每一步只引入一种新风险

不要在同一个 step 里同时引入：
- 新数据格式
- 新运行时子系统
- 新平台适配
- 新内容来源

一个 step 最好只回答一个问题，例如：
- “TypedArray SoA 能不能正确存取？”
- “浏览器里能不能稳定创建 WebGL 上下文？”
- “Cocos `.scene` 能不能稳定转成 canonical scene？”

而不是在一个 step 里同时回答“能不能导入、编译、加载、渲染、对比原版”。

### 2. 每一步必须有一个主测试入口

每一步都必须能指向一个明确入口，且优先选最便宜的那个：

1. `pnpm test -- ...`（单元测试）
2. `pnpm run ...`（CLI / 集成测试）
3. `test-visual/*.html`（浏览器视觉验证）
4. 微信开发者工具
5. 真机扫码

如果一个 step 只能靠“人工感觉差不多”来判断，那它就还没切对。

### 3. 每一步必须有固定 fixture

不要把“真实项目终于跑通”当作唯一测试方式。每一步都要有对应夹具：
- unit fixture：最小输入对象 / schema 样例
- integration fixture：最小 scene / prefab / bundle
- visual fixture：固定测试页和固定截图预期
- platform fixture：固定 wx-project 模板

这样失败时才能定位是“实现错了”还是“内容太复杂”。

### 4. 每一步必须产出机器可校验结果

优先产出这些东西：
- `json` / `schema`
- `manifest`
- `report`
- `bundle`
- 可断言的计数或状态

不要只产出“一个大功能”，要产出能被下游命令继续消费的中间产物。

### 5. 每一步都要写清楚“不做什么”

可测试的前提之一，是范围被严格封死。

例如：
- Step 12 Phase 1 只支持 `Transform / Sprite / Tags / Camera`
- `Label / Animation / Physics / CustomScript` 默认不承诺支持
- 只做单向 import，不做 round-trip

如果不写清楚不做什么，测试边界就会不断膨胀。

### 6. 自动化优先于人工验证

顺序应该始终是：

`Schema / Unit` → `CLI / Integration` → `Browser Visual` → `DevTools` → `Real Device`

不要反过来。越靠后的测试越贵，越不适合承担“第一次发现问题”的责任。

---

## 测试层级约定

| 层级 | 名称 | 入口 | 用途 |
|------|------|------|------|
| L0 | Unit | `pnpm test -- ...` | 纯逻辑 / 数据结构 / 零 GC 约束 |
| L1 | Schema / CLI | `pnpm run ...` | 导入、校验、编译、报告 |
| L2 | Browser Visual | `test-visual/*.html` | WebGL / 输入 / 音频 / 渲染结果 |
| L3 | WX DevTools | `wx-project/` | 平台 API 适配、包体、文件系统 |
| L4 | Real Device | 手机扫码 | 真机帧率、触摸、音频、中后台行为 |

**切分规则**:
- 新 step 最好只新增一个层级
- L2 之前必须已有 L0/L1 支撑
- L4 只做 smoke / 验收，不做第一现场排错

---

## Step 模板（建议统一）

以后新增 step，尽量都按这个模板写：

```text
### Step N — 名称

**目标**:
只描述一个核心问题。

**不包含**:
明确列出这个 step 不打算解决的内容。

**交付物**:
- 文件
- 命令
- 中间产物

**测试夹具**:
- 最小输入
- 最小场景
- 最小资源

**主测试入口**:
pnpm test -- ...

**通过标准**:
- 机器可断言
- 尽量避免“人工目测为主”

**失败信号**:
- 什么情况算失败
- 失败时首先查看哪个 report / fixture
```

---

# Phase 1 — 高性能运行时 + Canonical Format + 导入链路

## Part A：核心运行时

### Step 1 — 项目脚手架

**目标**: TypeScript + esbuild + Vitest 基础设施跑通。

**交付物**:
- `package.json` / `tsconfig.json` / `vitest.config.ts`
- `src/index.ts` — 空入口
- `tests/sanity.test.ts` — 第一个测试

**技术选型**:

| 工具 | 选择 | 理由 |
|------|------|------|
| 构建 | esbuild | 极快，输出单文件 JS，适合库打包 |
| 测试 | vitest | 原生 TS，兼容 Jest API |
| 包管理 | pnpm | 快速、节省磁盘 |

**目录结构**:
```
membrane/
├── src/
│   ├── math/
│   ├── ecs/
│   ├── renderer/
│   ├── platform/
│   ├── asset/
│   ├── audio/
│   └── index.ts
├── tests/
│   ├── math/
│   ├── ecs/
│   ├── renderer/
│   └── asset/
├── test-visual/          # 浏览器视觉测试页
├── tools/                # Phase 1 导入 / 编译工具
│   ├── cocos-importer/
│   ├── unity-importer/
│   └── compiler/
├── docs/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**测试验证**:
```bash
pnpm install
pnpm build    # esbuild → dist/membrane.js
pnpm test     # vitest 1 passed
```

**完成标准**: `pnpm build` 零错误，`pnpm test` 通过。

---

### Step 2 — Math 库（零 GC）

**目标**: 向量/矩阵运算库，所有操作写入 `out` 参数，不分配新对象。

**前置依赖**: Step 1

**交付物**: `src/math/` (vec2, vec3, mat4, math-pool) + 单元测试

**关键设计**:
- `Float32Array` 内部存储
- 所有运算: `static op(out, a, b): void` — 零 GC
- `MathPool` cursor 分配，帧末重置
- `EPSILON = 1e-6`

**测试**:
```bash
pnpm test -- tests/math/
```

覆盖：
- Vec2/Vec3: add, sub, scale, dot, cross, normalize, length, lerp
- Mat4: identity, multiply, translate, rotate, scale, invert, perspective, ortho
- Pool: 10000 次 get/release 无内存增长
- 边界: 零向量 normalize、奇异矩阵 invert

---

### Step 3 — ECS EntityManager

**目标**: 实体创建、销毁、ID 复用、generation 防悬空引用。

**前置依赖**: Step 1

**交付物**: `src/ecs/entity-manager.ts` + `src/ecs/types.ts` + 单元测试

**关键设计**:
- EntityId = u32: 高 16 位 generation，低 16 位 index
- 预分配容量 65536，freeList LIFO 复用
- `INVALID_ENTITY = 0xFFFFFFFF`

**测试**:
```bash
pnpm test -- tests/ecs/entity-manager.test.ts
```

覆盖：
- 创建 → ID 递增
- 销毁 → 复用 index，generation 递增
- `isAlive` 对已销毁实体返回 false
- 容量耗尽行为
- 批量创建/销毁循环正确性

---

### Step 4 — ECS ComponentStorage（SoA + SparseSet + Change Detection）

**目标**: 双模式 Component 存储（Table SoA + SparseSet）+ 变更检测。**灵感来源: Bevy ECS。**

**前置依赖**: Step 3

**交付物**: `src/ecs/component-storage.ts` + `component-registry.ts` + `archetype.ts` + 单元测试

**关键设计**:
- Component Schema 定义字段名和 TypedArray 类型
- `componentId: 0-63`，BigInt 64 位掩码
- Archetype = 实体的 Component 组合位掩码
- `getField()` 返回 TypedArray 视图，直接按 entityIndex 访问
- **StorageType 双模式**: `Table`（默认，SoA 列式）/ `SparseSet`（频繁增删的标签组件）
- **Change Detection**: 每个 Component 每个实体维护 `changedTick: Uint32Array` + `addedTick: Uint32Array`，全局 Tick 每帧递增

**测试**:
```bash
pnpm test -- tests/ecs/component-storage.test.ts
```

覆盖：
- 注册 Component → SoA 数组已分配
- 添加 / 移除 Component → 位掩码正确更新
- 连续实体的同字段数据内存连续（SoA 验证）
- 多种 Component 组合
- **SparseSet**: 注册标签组件（storage=SparseSet），频繁增删不影响 Table 存储
- **Change Detection**: 修改数据 + markChanged → isChanged 返回 true；未修改 → false
- **Added Detection**: addComponent 后 isAdded 返回 true；下一帧后返回 false
- **Tick 推进**: advanceTick 正确递增

---

### Step 5 — ECS System Scheduler + World + Query Filters

**目标**: System 注册、Phase 分组、Archetype Query（含 Changed/Added 过滤器）、World 门面。

**前置依赖**: Step 4

**交付物**: `src/ecs/system.ts` + `query.ts` + `scheduler.ts` + `world.ts` + 单元测试

**关键设计**:
- 6 Phase: PreUpdate → Update → PostUpdate → PreRender → Render → PostRender
- Query: `with(A, B).without(C)` → BigInt 位掩码匹配
- **Changed/Added 过滤器**: `query().with(A).changed(A).build()` — 只遍历本帧被修改过的实体（灵感来源: Bevy ECS）
- World 组合 EntityManager + ComponentStorage + Scheduler
- Scheduler 预分配 matchBuffer，遍历实体时零 GC
- 每个 System 维护独立的 `lastRunTick`，用于 Change Detection 比较

**测试**:
```bash
pnpm test -- tests/ecs/
```

覆盖：
- 3 个不同 Phase 的 System，验证执行顺序
- Query with/without 过滤逻辑
- 动态增删 Component 后 Query 实时更新
- World.update(dt) 全链路
- **Changed 过滤**: 修改 Transform → Changed(Transform) 查询命中；未修改 → 跳过
- **Added 过滤**: 新增 Sprite → Added(Sprite) 查询命中；已有 → 跳过
- **混合过滤**: `with(Transform).changed(Transform).without(Hidden)` 组合查询

---

### Step 6 — Platform Adapter

**目标**: 平台抽象接口 + BrowserAdapter 实现。

**前置依赖**: Step 1

**交付物**: `src/platform/` (platform-adapter, browser-adapter, wx-adapter 骨架) + 浏览器测试页

**关键设计**:
- 接口: `getCanvas()`, `getWebGLContext()`, `readFile()`, `loadImage()`, `now()`, `requestAnimationFrame()`
- 触摸输入: `onTouchStart/Move/End` — Phase 1 需要交互
- BrowserAdapter: 标准 DOM API
- WxAdapter: `wx.*` API 骨架
- 工厂函数: `createPlatformAdapter()` 自动检测环境

**测试**:
```
浏览器打开 test-visual/platform-test.html:
1. Canvas 元素显示
2. 控制台: "WebGL context created"
3. 触摸/鼠标事件回调触发
```

---

### Step 7 — WebGL Device + 状态缓存

**目标**: 封装 WebGL Context，状态缓存避免冗余 GL 调用。

**前置依赖**: Step 6

**交付物**: `src/renderer/` (webgl-device, gl-state-cache, shader) + 浏览器测试页

**关键设计**:
- WebGL1 优先，自动启用 WebGL2 更优路径（能力检测）
- GLStateCache: bound textures, blend, depth, viewport, program
- `setState()` 先 diff，相同状态跳过 GL 调用
- Shader 编译错误统一包装

**测试**:
```
浏览器打开 test-visual/webgl-test.html:
1. 整屏 cornflower blue (#6495ED) — clearColor 工作
2. 控制台: WebGL 版本 + GL 扩展列表
```

---

### Step 8 — SpriteBatcher

**目标**: 2D 精灵批渲染器，合批减少 DrawCall。

**前置依赖**: Step 2 (Mat4), Step 7

**交付物**: `src/renderer/` (sprite-batcher, texture, default-shaders) + 浏览器测试页

**关键设计**:
- MAX_SPRITES = 2048，每精灵 4 顶点 × 5 float (x,y,u,v,color)
- 索引缓冲预生成 (0,1,2, 0,2,3)
- Flush 条件: 纹理切换 / Blend 变化 / 缓冲区满
- `bufferSubData` 更新（不重新分配）
- Color: ABGR u32 pack

**测试**:
```
浏览器打开 test-visual/sprite-test.html:
1. 白色方块（1x1 纹理）
2. 多色方块（顶点着色）
3. PNG 纹理精灵
4. 控制台: DrawCall = 1（同纹理合批验证）
```

---

### Step 9 — Bundle 格式

**目标**: 自定义二进制 Bundle 格式 — 写入（构建工具侧）+ 读取（运行时侧）。

**前置依赖**: Step 1

**交付物**: `src/asset/` (bundle-format, bundle-writer, bundle-reader, asset-manager) + 单元测试

**关键设计**:
- Magic: `0x57584745` ("WXGE")
- Header 32B + TOC 13B × N + Data Section
- Little-Endian
- 零拷贝: `getAssetData()` 返回 `Uint8Array` 视图
- AssetType: Texture=1, Audio=2, Scene=3, Animation=4, Shader=5, Binary=6, JSON=7

**测试**:
```bash
pnpm test -- tests/asset/bundle.test.ts
```

覆盖：Write → Read round-trip、Magic 校验、空 Bundle 边界

---

### Step 10 — 集成：Engine + Plugin + ECS + 渲染

**目标**: 实现 Engine 主循环和函数式 Plugin 系统，用 Plugin 组装 ECS + 渲染管线，浏览器中跑通动画场景。**灵感来源: Bevy Plugin 架构。**

**前置依赖**: Step 5, Step 8

**交付物**:
- `src/core/engine.ts` — Engine 主循环 + Plugin 注册
- `src/core/plugins/transform-plugin.ts` — 内置 Transform Plugin
- `src/core/plugins/sprite-plugin.ts` — 内置 Sprite 渲染 Plugin
- `src/ecs/built-in-systems/` (transform-system, sprite-render-system)
- `src/ecs/built-in-components.ts` (Transform, Sprite, Camera)
- 浏览器集成测试页

**关键设计**:
- `MembranePlugin = (engine: Engine) => void` — 函数即 Plugin
- `engine.use(plugin)` 链式注册
- 引擎核心只有 ECS + 主循环，渲染/音频/物理全是可选 Plugin
- esbuild tree-shaking 自动剔除未 use 的 Plugin 代码

**测试**:
```
浏览器打开 test-visual/integration-test.html:
1. 屏幕上显示多个精灵
2. 精灵在移动（MovementSystem 驱动）
3. 帧率显示在左上角，稳定 60fps
4. DrawCall 合批正常
5. 只注册 transformPlugin（不注册 spritePlugin）时，渲染代码不加载（tree-shaking 验证）
```

**建议执行切片**:

| 子切片 | 范围 | 主测试入口 | 通过标准 |
|--------|------|------------|----------|
| 10A | Engine tick + stop/start | `pnpm test -- tests/core/engine.test.ts` | `tick()` 推进 frameCount / fps 状态正确 |
| 10B | Plugin 注册与执行顺序 | `pnpm test -- tests/core/plugin.test.ts` | `use()` 顺序正确，重复注册行为明确 |
| 10C | Transform built-in plugin | `pnpm test -- tests/ecs/transform-system.test.ts` | 更新后 Transform 数据变化且 markChanged 正确 |
| 10D | Sprite render integration | `test-visual/integration-test.html` | 浏览器中精灵可见、DrawCall 合理 |
| 10E | tree-shaking smoke | `pnpm build` + bundle 检查 | 未 use 的 plugin 不进入主包 |

---

### 步骤依赖关系

```
Step 1 (脚手架)
  ├── Step 2 (Math) ──────────────────┐
  ├── Step 3 (EntityManager)          │
  │     └── Step 4 (ComponentStorage) │
  │           └── Step 5 (Scheduler)──┼── Step 10 (集成)
  ├── Step 6 (Platform Adapter)       │       │
  │     └── Step 7 (WebGL Device)     │       │
  │           └── Step 8 (Batcher) ───┘       │
  └── Step 9 (Bundle 格式) ──────────────── Step 11 (Audio)
                                              │
                                        Step 12 (导入链路)
                                              │
                                        Step 13 (Benchmark)
```

Step 2 / 3 / 6 / 9 可以并行开发，互不依赖。

---

## Part B：导入链路 + 运行时验证

### Step 11 — Audio Manager

**目标**: 音频播放封装 — SFX 对象池 + BGM 单实例。

**前置依赖**: Step 6 (Platform Adapter)

**交付物**: `src/audio/audio-manager.ts` + 浏览器测试页

**关键设计**:
- SFX: 预分配通道（默认 8），超限时停止最早播放的
- BGM: 单实例，支持淡入淡出
- Browser: Web Audio API (AudioContext + GainNode)
- 微信: `wx.createInnerAudioContext`
- `masterVolume` / `muted` / `dispose()`

**测试**:
```
浏览器打开 test-visual/audio-test.html:
1. 点击按钮播放 SFX
2. BGM 循环播放，淡入效果
3. masterVolume 滑块实时调节
```

---

### Step 12 — Cocos Creator 导入器 + Canonical Format

**目标**: 解析 Cocos Creator 项目，单向导入为 Membrane canonical format，并编译为 runtime bundle。**这是 Phase 1 的内容入口和运行时验证链路，不是兼容承诺。**

**前置依赖**: Step 10, Step 9

**交付物**:
- `tools/cocos-importer/scene-parser.ts` — 解析 `.scene` / `.prefab` (JSON)
- `tools/cocos-importer/component-mapper.ts` — Cocos 组件 → Membrane canonical component 映射
- `tools/cocos-importer/canonical-writer.ts` — 输出 canonical scene / asset 描述
- `tools/compiler/scene-compiler.ts` — canonical scene → runtime bundle / manifest
- `tools/cocos-importer/cli.ts` — 命令行入口
- `docs/api/canonical-format.md` — canonical scene / asset / import-report 规格
- `docs/api/importer-cli.md` — import / validate / compile CLI 约定
- 单元测试 + 集成测试

**关键设计**:

Cocos Creator `.scene` 文件是 JSON 格式，结构化程度高，解析工作量可控。Phase 1 只支持一小组标准组件，把它们转为 canonical format：

```
Cocos 节点树                        Membrane Canonical Format
──────────                        ─────────────────────────
cc.Node                    →      Entity
  ├── cc.UITransform       →      Transform
  ├── cc.Sprite            →      Sprite
  ├── SpriteAtlas          →      AssetRef / AtlasRef
  ├── Prefab               →      PrefabRef / 展平后的 EntityTemplate
  ├── 节点层级关系          →      可选 parent 字段（非主数据结构）
  └── 其他组件             →      unsupported + 导入报告
```

**难点与策略**:

| 难点 | 策略 |
|------|------|
| 自定义脚本组件 | Phase 1 先跳过，标记为 unsupported，输出导入报告；后续再探索 AI 辅助翻译 |
| hierarchy 结构 | 归一化为显式 `parent` 关系，避免继续依赖节点树作为主结构 |
| 资源引用（uuid） | 建立 uuid → assetId 映射表 |
| 坐标系差异 | Y 轴翻转 + anchor point 偏移 |
| Label / Animation / Physics | Phase 1 默认不承诺支持，后续按验证结果逐步补齐 |

**范围约束**:
- 只做单向 import，不做 round-trip
- 不承诺现有项目无痛迁移
- Phase 1 的目标是把真实内容送进 runtime，而不是完整复刻 Cocos 行为

**导入 / 编译流程**:
```
cocos-project/
  ├── assets/           ← 扫描所有 .scene / .prefab / 图片 / 音频
  └── library/          ← Cocos 编译后的资源（可选）

          │
          ▼

  membrane import cocos --input ./cocos-project --output ./canonical

          │
          ▼

  canonical/
  ├── scenes/
  │   └── level_01.scene.json  ← Canonical Scene（Entity + Components）
  ├── prefabs/
  │   └── enemy.prefab.json    ← 可选：Prefab Canonical 输出
  ├── assets.json              ← 资源描述 / atlas / frame 映射
  └── import-report.json       ← unsupported 组件 / 警告

          │
          ▼

  membrane validate canonical --input ./canonical

          │
          ▼

  membrane compile --input ./canonical --output ./membrane-build

          │
          ▼

  membrane-build/
  ├── manifest.json            ← Scene -> Bundle -> AssetId 映射
  ├── bundles/
  │   └── assets.wxpak         ← 二进制资源包（含 Scene / Texture / Audio）
  └── reports/
      └── compile-report.json  ← 编译统计 / 烘焙信息
```

**测试验证**:
```bash
# 单元测试: 解析器 + canonical format schema
pnpm test -- tests/tools/cocos-importer/

# 集成测试: 导入真实 Cocos demo 项目
pnpm run import:cocos -- --input ./test-fixtures/cocos-demo --output ./tmp/canonical
# 验证 canonical 输出结构
pnpm run validate:canonical -- --input ./tmp/canonical
pnpm run compile:scene -- --input ./tmp/canonical --output ./tmp/build
# 编译为 runtime bundle
# 在浏览器中加载编译场景，验证渲染结果
```

**建议执行切片**:

| 子切片 | 范围 | 主测试入口 | 通过标准 |
|--------|------|------------|----------|
| 12A | canonical schema + fixture | `membrane validate canonical --input ./fixtures/min-scene` | 最小 scene / prefab / assets / report 全通过 |
| 12B | `.scene/.prefab` parser | `pnpm test -- tests/tools/cocos-importer/parser.test.ts` | 能稳定读出节点、组件、引用 |
| 12C | component mapper | `pnpm test -- tests/tools/cocos-importer/mapper.test.ts` | `Transform / Sprite / Tags / Camera` 映射正确 |
| 12D | import-report | `pnpm test -- tests/tools/cocos-importer/report.test.ts` | unsupported 组件不会静默丢失 |
| 12E | import CLI | `pnpm run import:cocos -- --input ... --output ...` | 能稳定落 canonical 输出目录 |
| 12F | validate CLI | `pnpm run validate:canonical -- --input ...` | schema、引用、parent 关系全通过 |
| 12G | compile CLI | `pnpm run compile:scene -- --input ... --output ...` | 输出 `manifest.json` / `.wxpak` / `compile-report.json` |
| 12H | runtime smoke load | 浏览器加载编译结果 | 编译场景能被 runtime 加载并渲染 |

**建议出口条件**:
- 不要求“支持很多组件”
- 只要求“最小真实 Cocos demo 可以稳定导入、校验、编译、加载”
- 先把链路打通，再扩组件覆盖率

**不建议把 Step 12 当成单个大任务一次做完**。更合理的执行顺序是 `12A → 12B → 12C → 12D → 12E → 12F → 12G → 12H`。

---

### Step 13 — 运行时验证 + Benchmark

**目标**: 建立自动化验证和 benchmark 框架，证明 `Cocos -> canonical -> runtime bundle -> Membrane Runtime` 整条链路可用，并测量性能预算。

**前置依赖**: Step 12

**交付物**:
- `tools/benchmark/` — 性能测试框架
- `tools/benchmark/scenarios/` — 标准测试场景
- `docs/benchmark-results.md` — 测试报告模板

**测试场景**:

| 场景 | 内容 | 核心指标 |
|------|------|---------|
| 导入正确性 | canonical scene / import-report / asset 映射 | schema 校验, unsupported 列表 |
| 场景加载 | bundle 加载 + scene instantiate | 加载时间, 正确性 |
| 精灵压力测试 | 1000 / 5000 / 10000 个移动精灵 | FPS, DrawCall 数 |
| 实体创建销毁 | 每帧创建/销毁 100 个实体 | GC 暂停时间 |
| 纹理切换 | 100 种不同纹理混合渲染 | DrawCall 数, FPS |
| 资源加载 | 10MB Bundle 加载 | 加载时间, 内存占用 |
| 真实场景 | Cocos demo 导入后运行 | 正确性, FPS, DrawCall, 内存 |

**对比方式**:
```
1. `Cocos 项目 → canonical format → runtime bundle → Membrane Runtime` 全链路跑通
2. 对导入报告、场景结构、资源映射做自动校验
3. 在同一设备上记录 FPS / DrawCall / 内存
4. 若有可对照原版，再生成原版 vs Membrane 对比报告
```

**完成标准**:
- `import -> canonical -> compile -> runtime load` 全链路通过
- 真实导入场景在浏览器 / 微信环境中渲染正确
- 精灵压力测试: 5000 精灵 ≥ 55fps (桌面) / ≥ 30fps (中端手机)
- 零 GC 验证: 连续运行 60 秒，GC 暂停 < 2ms
- 若 Cocos 对照实验达到 **≥15% 性能提升**，可作为额外宣传数据，但不作为 Phase 1 出口条件

**建议执行切片**:

| 子切片 | 范围 | 主测试入口 | 通过标准 |
|--------|------|------------|----------|
| 13A | correctness harness | `pnpm run benchmark:correctness` | 场景加载、实体数、资源映射与预期一致 |
| 13B | sprite stress | `pnpm run benchmark:sprites` | 固定场景下输出 FPS / DrawCall 报告 |
| 13C | load benchmark | `pnpm run benchmark:load` | bundle 加载与 instantiate 时延可记录 |
| 13D | GC / churn benchmark | `pnpm run benchmark:gc` | 连续运行不出现异常 GC 峰值 |
| 13E | original vs membrane compare | `pnpm run benchmark:compare` | 若存在可对照场景，生成统一报告 |

**注意**:
- Step 13 的第一责任是“证明链路稳定”，不是“先证明性能领先”
- 没有 correctness harness 的 benchmark 几乎没有解释价值
- benchmark 报告必须可重复生成，不能只保留手工结论

---

### Step 14 — 微信小游戏适配 + 发布

**目标**: WxAdapter 实现 + 真机测试 + 发布流程。

**前置依赖**: Step 10, Step 6

**交付物**:
- `src/platform/wx-adapter.ts` — 完整实现
- `wx-project/` — 微信小游戏项目模板
- 真机测试报告

**关键设计**:
- `wx.createCanvas()` → WebGL Context
- `wx.getFileSystemManager()` → 文件读写
- `wx.createInnerAudioContext()` → 音频
- 触摸事件: `wx.onTouchStart/Move/End`
- 切后台: 自动暂停 BGM + 降帧率
- 分包: 主包 ≤ 3MB，引擎核心 + Shader 放子包

**测试**:
```
微信开发者工具:
1. 打开 wx-project/
2. 预览 → 手机扫码
3. 验证: 渲染正确、触摸响应、音频播放、帧率达标
```

**建议执行切片**:

| 子切片 | 范围 | 主测试入口 | 通过标准 |
|--------|------|------------|----------|
| 14A | WxAdapter 启动 | 微信开发者工具 | 能启动 canvas + RAF + 文件读取 |
| 14B | 渲染 / 输入 / 音频 parity | 微信开发者工具 | 基本功能与浏览器 smoke 一致 |
| 14C | subpackage / bundle load | 微信开发者工具 | `manifest + wxpak` 能正确加载 |
| 14D | 真机 smoke | 手机扫码 | 首屏可进、触摸正常、音频正常 |
| 14E | 真机稳定性 | 手机运行 5-10 分钟 | 无明显泄漏、切后台行为正确 |

**注意**:
- Step 14 不应该第一次发现“导入产物结构错了”或“runtime load 错了”
- 到 Step 14 时，L0/L1/L2 测试应该已经把大部分逻辑问题清掉
- 真机阶段主要验证平台差异，而不是承担基础回归测试

---

## Phase 1 里程碑总结

```
M1: Runtime 核心跑通 (Step 1-10)
    → 浏览器中 ECS + WebGL 渲染动画场景，60fps

M2: 单向导入链路 + 运行时验证 (Step 11-13)
    → Cocos demo 导入为 canonical format
    → 编译后在 Membrane 上运行
    → Benchmark 验证正确性、性能、包体和资源管线

M3: 微信发布 (Step 14)
    → 真机跑通，发布到微信小游戏平台
```

---

---

# Phase 2 — AI-Native 创作平台

> Phase 1 的运行时和数据格式是 Phase 2 的基础。Phase 2 不需要改运行时，只需要在上层建连接器。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                  创作平台（Notion-like 网页）                  │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │ 场景编辑器 │  │ 素材管理器 │  │ 逻辑编辑器 │  │ 预览窗口 │ │
│  │ (可视化)   │  │ (拖拽上传) │  │ (事件表)   │  │ (实时)   │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬────┘ │
│        └──────────────┼──────────────┘              │      │
│                       ▼                              │      │
│              MCP Protocol Layer                      │      │
│  ┌─────────────────────────────────────────────┐    │      │
│  │  Perplexity  │  GPT Image  │  Claude  │ ... │    │      │
│  │  策划案       │  2D 素材     │  代码     │     │    │      │
│  └─────────────────────────────────────────────┘    │      │
│                       │                              │      │
│                       ▼                              │      │
│            Membrane 场景数据 (JSON + Bundle)          │      │
│                       │                              │      │
└───────────────────────┼──────────────────────────────┘      │
                        │                                      │
                        ▼                                      │
              Membrane Runtime ◄───────────────────────────────┘
                        │
                        ▼
                 微信小游戏发布
```

## 步骤

### Step 15 — MCP 协议层

**目标**: 定义 Membrane 的 MCP (Model Context Protocol) 接口，让外部 AI 工具能读写游戏数据。

**交付物**:
- MCP Server 定义
- 暴露的 Resource / Tool 列表
- 接口文档

**MCP 暴露的能力**:
```
Resources (读):
  - membrane://scenes/{id}         → 场景数据
  - membrane://assets/{id}         → 素材元信息
  - membrane://events/{scene_id}   → 事件表
  - membrane://project/manifest    → 项目结构

Tools (写):
  - create_entity(scene, components)  → 创建实体
  - update_entity(id, components)     → 修改实体
  - delete_entity(id)                 → 删除实体
  - import_asset(type, data)          → 导入素材
  - add_event(scene, trigger, action) → 添加事件规则
  - preview(scene)                    → 触发实时预览
```

---

### Step 16 — AI 连接器

**目标**: 对接外部 AI 服务。

**连接器列表**:

| 连接器 | 对接服务 | 用途 |
|--------|---------|------|
| Perplexity | Perplexity API / MCP | 搜索参考、生成策划案、世界观 |
| GPT Image | OpenAI gptimage2 | 生成 2D 精灵、UI 元素、背景 |
| Claude | Anthropic API / MCP | 生成游戏逻辑代码、事件表、System 脚本 |
| 音效 AI | Suno / Stable Audio | 生成背景音乐、音效 |
| 本地化 | Claude / GPT | 多语言翻译 |

**工作流示例**:
```
用户: "做一个跑酷游戏，障碍物越来越快"

→ Perplexity: 搜索跑酷游戏设计最佳实践，生成 GDD 文档
→ GPT Image: 生成角色精灵、障碍物、背景素材
→ Claude: 生成 RunSystem (角色跑动)、ObstacleSpawner (障碍物生成)、
          DifficultySystem (难度递增逻辑)
→ 组装: 创建场景实体 + 事件表
→ Membrane Runtime: 实时预览
→ 用户满意 → 导出微信小游戏
```

---

### Step 17 — Notion-like 创作界面

**目标**: 网页版内容管理工具。

**核心功能**:
- 场景编辑器: 拖拽放置精灵、调整 Transform
- 素材管理器: 上传 / AI 生成 / 组织素材
- 事件表编辑器: 可视化 trigger → action 规则
- 实时预览: 右侧 iframe 嵌入 Membrane Runtime
- 版本管理: 场景数据 Git 化

**设计原则**:
- 对人: 漂亮的可视化界面，像 Notion 一样好用
- 对 AI: 底层全是结构化 JSON，MCP 直接读写
- 不做重 IDE: 不做 Unity 那样的 Inspector / Hierarchy / Console，保持极简

---

## Phase 2 里程碑

```
M4: MCP 协议层 (Step 15)
    → AI 能通过 MCP 读写 Membrane 场景数据

M5: AI 连接器 (Step 16)
    → "做一个跑酷游戏" → AI 端到端生成 → Membrane 运行

M6: 创作界面 (Step 17)
    → 网页版 Notion-like 编辑器 + AI 辅助创作
```

---

# 全局时间线

```
            Phase 1: 寄生                    Phase 2: 替代
    ┌──────────────────────────┐    ┌────────────────────────────┐
    │                          │    │                            │
    │  M1: Runtime 核心        │    │  M4: MCP 协议层            │
    │  (Step 1-10)             │    │  (Step 15)                 │
    │  ~6-8 周                 │    │  ~2 周                     │
    │          │               │    │          │                 │
    │          ▼               │    │          ▼                 │
    │  M2: 导入链路 + 验证     │    │  M5: AI 连接器             │
    │  (Step 11-13)            │    │  (Step 16)                 │
    │  ~4-6 周                 │    │  ~4 周                     │
    │          │               │    │          │                 │
    │          ▼               │    │          ▼                 │
    │  M3: 微信发布            │    │  M6: Notion-like 界面      │
    │  (Step 14)               │    │  (Step 17)                 │
    │  ~2 周                   │    │  ~6-8 周                   │
    │                          │    │                            │
    └──────────────────────────┘    └────────────────────────────┘
            ~12-16 周                       ~12-14 周
```

**Phase 1 总耗时**: 约 3-4 个月（Runtime + canonical format + 导入链路 + 微信发布）
**Phase 2 总耗时**: 约 3 个月（MCP + AI 连接器 + 创作界面）

---

# 附录：运行时潜在性能优势

## 为什么理论上会比 Cocos / Unity 适配层更快

### 1. 零 DOM 依赖

Cocos Creator 小游戏适配层仍有 DOM 模拟代码残留（事件系统、DOM-like 节点树）。Membrane 完全绕过，直接 `wx.createCanvas()` → WebGL。

### 2. SoA ECS vs OOP 节点树

```
Cocos (OOP):
for each node in sceneGraph:
  node.transform.update()     ← Cache miss（跳转到 transform 对象地址）
  node.sprite.render()        ← Cache miss（跳转到 sprite 对象地址）

Membrane (SoA ECS):
for i in 0..entityCount:
  posX[i] += velX[i] * dt     ← Cache hit（连续内存顺序访问）
  posY[i] += velY[i] * dt     ← Cache hit
```

### 3. 零 GC 数学库

```
Cocos:
let result = vec1.add(vec2)    ← 每次运算分配新 Vec3 对象 → GC 压力

Membrane:
Vec3.add(out, vec1, vec2)      ← 写入预分配的 out → 零 GC
```

### 4. 精细 GL 状态缓存

```
Membrane GLStateCache:
setState(blend: true)
setState(blend: true)   ← 跳过，不调 gl.enable(BLEND)
setState(blend: false)  ← 调用 gl.disable(BLEND)
```

### 5. SpriteBatcher 激进合批

```
同纹理精灵: 合并为 1 个 DrawCall
纹理图集: 所有使用同一图集的精灵 → 1 个 DrawCall
Cocos 合批更保守，需要节点在同一层级
```

### 6. 自定义 Bundle 零拷贝

```
Cocos: 加载 JSON meta → 解析 → 拷贝到内存 → 创建对象
Membrane: mmap-style Uint8Array 视图 → 零拷贝直接使用
```
