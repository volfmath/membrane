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

## 核心技术优势

| 特性 | Membrane | Cocos/Unity 适配层 |
|------|----------|-------------------|
| DOM 依赖 | 零 | 有模拟层残留 |
| 内存布局 | SoA ECS (Cache 友好) | OOP 节点树 (Cache miss) |
| 数学运算 | 零 GC (out 参数) | 每次分配新对象 |
| GL 状态管理 | 精细 diff 缓存 | 粗粒度缓存 |
| 精灵合批 | 激进合批 (跨层级) | 保守合批 (同层级) |
| 资源读取 | 零拷贝 Uint8Array 视图 | 多次拷贝 |

## 当前阶段

Phase 1 · Step 1 → 项目脚手架搭建

## License

MIT
