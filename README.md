# Membrane

**The Runtime Layer for AI-Native Games**

> 引擎即协议层，而非工具链。对人是漂亮的界面，对 AI 是一堆可操作数据。

---

## 战略

**Phase 1 — 寄生**：先做一个高性能微信小游戏运行时（零 DOM、原生 WebGL、天然 ECS），再做一条从 Unity / Cocos 到 Membrane canonical format / runtime bundle 的单向导入链路，用现有项目验证运行时、资源管线和性能边界。

**Phase 2 — 替代**：把旧引擎扔进垃圾桶。创作平台像 Notion 一样，给你一堆 MCP 连接器 —— Perplexity 出策划案，GPT Image 生图，Claude 产出代码。

```
Phase 1                                Phase 2
──────                                ──────
Unity/Cocos 项目                     "做一个跑酷游戏"
      │                                    │
导入 / 编译工具                        MCP 连接器
      │                              ┌────┼────┐
      ▼                         Perplexity │  Claude
Membrane Canonical Format ◄──── GPT Image  │   ...
      │                                    │
      ▼                                    ▼
Membrane Runtime                    Membrane Runtime
      │                                    │
      ▼                                    ▼
 微信小游戏发布 ◄──────────────── 微信小游戏发布
```

## 文档

### 核心文档

| 文档 | 内容 |
|------|------|
| [产品方向与战略](./membrane-additional.md) | 两阶段战略、核心判断、技术优势分析 |
| [实现路线图](./docs/implementation_roadmap.md) | 17 步实现计划（Phase 1: Step 1-14, Phase 2: Step 15-17） |
| [引擎架构设计 v1](./wechat-minigame-runtime-engine.md) | WX-RT 完整设计：WASM、WebGL、ECS、微信适配 |
| [引擎设计 v2](./wechat_minigame_engine_design.md) | 精简版：ECS + WebGL + 资源管线 |

### API 规格文档

| 模块 | 文档 | 职责 |
|------|------|------|
| Engine & Plugin | [docs/api/engine.md](./docs/api/engine.md) | 主循环 + 函数式 Plugin 系统 *(Bevy 启发)* |
| Math 库 | [docs/api/math.md](./docs/api/math.md) | Vec2/Vec3/Mat4 零 GC 运算 |
| ECS EntityManager | [docs/api/ecs-entity.md](./docs/api/ecs-entity.md) | 实体创建/销毁/ID 复用 |
| ECS ComponentStorage | [docs/api/ecs-component.md](./docs/api/ecs-component.md) | SoA + SparseSet 双模式 + Change Detection *(Bevy 启发)* |
| ECS System Scheduler | [docs/api/ecs-system.md](./docs/api/ecs-system.md) | System 调度 + Changed/Added 查询过滤器 *(Bevy 启发)* |
| ECS World | [docs/api/ecs-world.md](./docs/api/ecs-world.md) | 门面类，组合 ECS 子系统 |
| WebGL 渲染器 | [docs/api/renderer.md](./docs/api/renderer.md) | WebGLDevice + 状态缓存 |
| SpriteBatcher | [docs/api/sprite-batcher.md](./docs/api/sprite-batcher.md) | 2D 精灵批渲染 |
| Platform Adapter | [docs/api/platform.md](./docs/api/platform.md) | 平台抽象层 |
| Input System | [docs/api/input.md](./docs/api/input.md) | 触摸/手势输入状态管理 |
| Asset Pipeline | [docs/api/asset.md](./docs/api/asset.md) | Bundle 二进制格式 |
| Audio | [docs/api/audio.md](./docs/api/audio.md) | 音效/BGM 管理 |
| Canonical Format | [docs/api/canonical-format.md](./docs/api/canonical-format.md) | AI 可读的场景 / 资源源格式 |
| Importer CLI | [docs/api/importer-cli.md](./docs/api/importer-cli.md) | 单向导入、校验、编译命令约定 |
| WeChat Smoke | [docs/wx-smoke-workflow.md](./docs/wx-smoke-workflow.md) | 真机 smoke 流程、checklist、记录方式 |
| Development Log | [docs/development-log.md](./docs/development-log.md) | 当前阶段改动、验证状态、下一步计划 |

## 核心技术优势

| 特性 | Membrane | Cocos/Unity 适配层 |
|------|----------|-------------------|
| DOM 依赖 | 零 | 有模拟层残留 |
| 内存布局 | SoA ECS (Cache 友好) | OOP 节点树 (Cache miss) |
| 数学运算 | 零 GC (out 参数) | 每次分配新对象 |
| GL 状态管理 | 精细 diff 缓存 | 粗粒度缓存 |
| 精灵合批 | 激进合批 (跨层级) | 保守合批 (同层级) |
| 资源读取 | 零拷贝 Uint8Array 视图 | 多次拷贝 |

## 实现进度

**Phase 1 · Steps 1–12H 已完成** — 287 tests 全通过，真机 smoke 验证通过，真实 Cocos 项目 E2E 管线验证通过

| Step | 模块 | 关键文件 | 测试 |
|------|------|----------|------|
| 1 | 项目脚手架 | `package.json`, `tsconfig.json`, `vitest.config.ts` | 1 |
| 2–3 | Math 库 | `src/math/` — Vec2, Vec3, Mat4, MathPool | 64 |
| 4–5 | ECS 核心 | `src/ecs/` — Entity, Component, Query, Scheduler, World | 52 |
| 6 | 平台抽象 | `src/platform/` — BrowserAdapter, WxAdapter | — |
| 7–8 | WebGL 渲染 | `src/renderer/` — GLStateCache, WebGLDevice, SpriteBatcher | 8 |
| 9 | 资源格式 | `src/asset/` — BundleWriter, BundleReader (WXGE binary) | 14 |
| 10 | Engine + Plugin | `src/core/engine.ts` — 主循环, MembranePlugin (Bevy 风格) | 17 |
| 11 | 输入系统 | `src/input/input-manager.ts` — 多点触控, 手势检测, 零 GC | 28 |
| 12A | Canonical Format | `src/canonical/` — 类型 + 校验器 + fixture | 40 |
| 12B–D | Cocos 导入器 | `tools/cocos-importer/` — 解析 + 映射 + 报告 | 34 |
| 12F | Validate 工具 | `tools/canonical/validate.ts` — canonical 目录校验 | 5 |
| 12G | Scene Compiler | `tools/compiler/scene-compiler.ts` — canonical→WXGE bundle | 13 |
| 12H | Scene Loader | `src/canonical/scene-loader.ts` — bundle→ECS World 实体加载 | 11 |

### 真机 Smoke 验证

| 用例 | 状态 | 日期 |
|------|------|------|
| `wx-smoke-bootstrap` | ✅ 通过 | 2026-04-24 |
| `wx-smoke-runtime` | ✅ 通过 (Canvas2D, 16 sprites, touch spawn, FPS) | 2026-04-24 |
| `wx-smoke-webgl` | 🔜 待验证 (WebGL on primary canvas, 24 sprites) | — |

### 微信平台经验

- `requestAnimationFrame` 在 canvas 对象上，不是 `wx` 全局
- 只有第一个 `wx.createCanvas()` 可见，后续 canvas 都是 off-screen
- 跨 canvas `drawImage` 合成（WebGL→2D）真机不工作
- 构建目标必须 `--target=es6`，ES2020 语法真机不支持

### Cocos 导入验证 (mahjong game)

| 指标 | 数值 |
|------|------|
| 场景数 | 3 (Loading, Home, MainGame) |
| 实体数 | 199 |
| 组件类型 | 19 种 (支持 3 / 不支持 16) |
| 校验 | 全部通过 canonical format validation |
| E2E | import → validate → compile → bundle read 全通过 |

### 下一步

- Step 13: 运行时验证 + Benchmark
- Step 14: 微信发布流程

## 命令

```bash
pnpm install          # 安装依赖
pnpm test             # 运行 287 个单元测试
pnpm typecheck        # TypeScript 严格模式检查
pnpm build            # 构建运行时库
pnpm build:wx-smoke   # 构建 bootstrap smoke → wx-project/dist/index.js
pnpm build:wx-runtime # 构建 runtime smoke → wx-project/dist/index.js
pnpm build:wx-webgl   # 构建 WebGL smoke → wx-project/dist/index.js
```

## License

MIT
