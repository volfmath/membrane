# Development Log

> 这个文件记录当前阶段已经落地的改动、验证状态和下一步计划。它不是路线图替代品，而是“现在仓库里到底推进到了哪里”的短日志。

---

## 2026-04-24

### 已完成

- 重写 Phase 1 方向：
  - 从“无痛迁移 / 20% 提升承诺”改成
  - `canonical format + 单向导入链路 + runtime 验证`

- 补齐 canonical / import / compile 规格：
  - `docs/api/canonical-format.md`
  - `docs/api/importer-cli.md`
  - `docs/schema/*.json`

- 把“每一步都必须可测试”写进路线图：
  - 测试层级 `L0 -> L4`
  - Step 10 / 12 / 13 / 14 子切片
  - 微信真机验证前置到 Step 1 / 6 / 7 / 8 / 10 / 11 / 12

- 建立微信 smoke 通道：
  - `docs/wx-smoke-workflow.md`
  - `docs/wx-smoke-log.md`
  - `wx-project/` 最小壳工程

- 补 `wx-smoke-bootstrap` 最小实现：
  - `src/wx-smoke-bootstrap.cts`
  - `wx-project/game.js`
  - `wx-project/dist/index.js`
  - `wx-project/assets/bootstrap.txt`

- 把根目录脚手架接到微信 smoke：
  - `package.json#packageManager`
  - `package.json#scripts.build:wx-smoke`
  - `package.json#scripts.smoke:wx:local`

### 已完成 — 运行时核心 (Steps 2–11)

- **Math 库** (Step 2–3): Vec2, Vec3, Mat4, MathPool — 零 GC、Float32Array 背板、out 参数模式 (64 tests)
- **ECS 核心** (Step 4–5): EntityManager (16-bit gen + 16-bit index)、ComponentRegistry、ComponentStorage (SoA Table + SparseSet 双模式)、BigInt 64-bit archetype bitmask、Change Detection (Bevy 风格 tick)、ArchetypeQuery、phase-ordered Scheduler、World facade (52 tests)
- **平台抽象** (Step 6): PlatformAdapter 接口、BrowserAdapter、WxAdapter（含 raf 四级 fallback）
- **WebGL 渲染** (Step 7–8): GLStateCache (冗余 GL 调用消除)、shader-utils、WebGLDevice (context lost/restored)、SpriteBatcher (2048 sprites/batch) (8 tests)
- **资源格式** (Step 9): BundleWriter/BundleReader — WXGE magic、TOC + data、零拷贝 subarray 视图 (14 tests)
- **Engine + Plugin** (Step 10): Engine 主循环 (raf + dt clamp + FPS)、MembranePlugin 函数式系统 (17 tests)
- **输入系统** (Step 11): InputManager — 事件缓冲、10 点触控、零 GC 对象池、tap/swipe 手势检测 (28 tests)

**总计: 184 tests 全通过, TypeScript strict 模式干净**

### 微信 Smoke 验证

- **wx-smoke-bootstrap**: ✅ DevTools + 真机通过
- **wx-smoke-runtime**: ✅ DevTools + 真机通过
  - Canvas2D 模式 (主 canvas 直接渲染)
  - 16 个弹跳彩色方块, 触摸生成新方块, FPS 显示
  - DevTools: WebGL 模式可用, ~58 FPS (iPhone 12/13 Pro 模拟)

### 发现的微信平台问题

| 问题 | 表现 | 解法 |
|------|------|------|
| `wx.requestAnimationFrame` 不存在 | DevTools 中循环不启动 | canvas.raf → global raf → wx.raf → setTimeout 四级 fallback |
| 只有第一个 canvas 可见 | HUD 画在第二个 canvas 上，屏幕黑 | 所有渲染都在主 canvas 上 |
| 跨 canvas drawImage 真机失败 | WebGL 渲染到二级 canvas + drawImage 合成，真机黑屏 | 强制 Canvas2D；WebGL 需直接用主 canvas |
| ES2020 语法不兼容 | `?.` / `??` 运行报错 | esbuild `--target=es6` |

### 已完成 — Cocos 导入链路 (Step 12A–D)

- **Canonical Format 类型系统** (Step 12A): 完整 TypeScript 接口定义 (Scene/Prefab/Assets/ImportReport)、4 种格式的 JSON 校验器、4 个最小测试 fixture (40 tests)
- **Cocos Scene 解析器** (Step 12B): 解析 Cocos Creator 3.x `.scene` 文件 (JSON 扁平数组)、节点树重建、组件引用解析、quaternion→degrees 旋转转换 (16 tests)
- **Component Mapper** (Step 12C): Cocos 节点→Canonical Entity 映射，支持 Transform/Sprite/Camera、unsupported component 报告、重复 ID 自动消歧 (13 tests)
- **完整导入管线** (Step 12D): `importCocosProject()` 函数，扫描项目目录、解析所有 scene、生成 canonical 输出 + assets 清单 + import report
- **真实项目集成验证** (Step 12E): 用 mahjong 游戏项目 (D:\majonggame) 验证，3 个 scene / 199 entities / 146 unsupported components 全部正确导入、校验通过 (5 tests)

**Step 12A-E 新增测试: 74 tests**

### Cocos 导入发现

| 发现 | 详情 |
|------|------|
| 自定义脚本组件 | `__type__` 为 hash (如 `63e65ZpqC5D2ZzaRpENZpag`)，非 `cc.*` 前缀 |
| 重复节点名 | 同名兄弟节点 (如多个 `TileIn`) 需要自动消歧后缀 |
| 真实项目规模 | mahjong: 3 scenes, 199 entities, 19 种不同组件类型 |
| 支持率 | Transform/Sprite/Camera 正确映射; cc.Label/Widget/Button/Animation 等 Phase 1 不支持 |

### 已完成 — Validate + Compile 工具链 (Step 12F–G)

- **Validate CLI** (Step 12F): `validateCanonicalDir()` 扫描 canonical 目录，校验所有 scene/prefab/assets/report 文件，返回结构化校验结果 (5 tests)
- **Scene Compiler** (Step 12G): `compileCanonicalDir()` 将 canonical scene 编译为 WXGE 二进制 bundle (.wxpak)，输出 manifest.json + compile-report.json (8 tests)
- **E2E 管线测试**: import → validate → compile → BundleReader 读回 — mahjong 项目 3 个场景完整走通 (5 tests)

**Step 12F-G 新增测试: 18 tests → 总计 276 tests 全通过**

### 已完成 — Runtime Scene Loader (Step 12H)

- **Loader Types** (Step 12H): `CompiledSceneData` / `CompiledEntity` 共享类型定义
- **Scene Loader** (Step 12H): `loadSceneFromBundle()` 从 WXGE bundle 读取场景并实例化 ECS 实体；`loadSceneData()` 从 JSON 数据直接加载；支持 `SceneLoaderConfig` 指定每个组件的字段映射
- **完整 round-trip**: BundleWriter → serialize → BundleReader → loadSceneFromBundle → ECS World 实体 + 组件数据验证 (11 tests)

**Step 12H 新增测试: 11 tests → 总计 287 tests 全通过**

### 已完成 — wx-smoke-webgl

- **wx-smoke-webgl**: WebGL 渲染直接使用主 canvas (不需要跨 canvas 合成)
  - 24 个彩色弹跳方块 + 触摸生成新方块
  - WebGL 上下文信息日志 (vendor/renderer/version/extensions)
  - FPS 条指示器 (绿=60fps, 黄=30fps, 红<20fps)
  - `pnpm build:wx-webgl` 构建 → `wx-project/dist/index.js`
  - 验证要点: 主 canvas WebGL 在真机是否工作 (之前跨 canvas 方案失败)

### 已完成 — Runtime Verification + Benchmark (Step 13)

- **Correctness Harness** (13A): round-trip 正确性验证、多场景加载、大场景 (200/500 实体)、Float32 精度边界、schema 默认值、真实项目 E2E 加载 (10 tests)
- **ECS Performance** (13C): entity creation (50k=0.7ms)、component access (10k×2=1.4ms)、field read (10k=0.035ms)、query iterate (5k/10k=0.036ms)、system update (3 systems 10k=0.1ms) (7 tests)
- **Entity Churn** (13D): 600-frame create/destroy cycle (100/frame=27ms)、generation 正确性、SparseSet add/remove stability、高频 create/destroy 无泄漏 (4 tests)
- **Bundle Load** (13E): write 50 scenes (0.05ms)、read 50 scenes (0.6ms)、loadSceneData (50 entities=0.09ms)、loadSceneFromBundle (0.1ms)、bundle size (178 bytes/entity) (5 tests)
- **Sprite Stress** (13B): `test-visual/sprite-stress.html` Canvas2D 占位，WebGL 版需 runtime browser bundle

**Step 13 新增测试: 26 tests → 总计 313 tests 全通过**

#### Benchmark 结果摘要

| 指标 | 数值 |
|------|------|
| Entity creation (50000) | 0.7ms |
| Component add + field write (10000×2) | 1.4ms |
| Field read throughput (10000) | 0.035ms |
| Query iterate (5000/10000) | 0.036ms |
| World.update (3 systems, 10000 entities) | 0.1ms |
| Scene load from bundle (50 entities) | 0.1ms |
| 600-frame churn (100 create+destroy/frame) | 27ms |
| Bundle size | ~178 bytes/entity |

### 下一步

1. Step 14: 微信发布流程
2. wx-smoke-imported-scene: 导入场景真机渲染验证
