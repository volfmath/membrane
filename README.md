<p align="center">
  <img src="dc2d461a8904718e19047ea2e508e4c5c39ca11f875a19a41fbf3fc3ecd88d06.png" width="260" alt="Membrane Game Engine" />
</p>

<h3 align="center">The Runtime Layer for AI-Native Games</h3>

---

Membrane 是一个面向微信小游戏平台的轻量级 TypeScript 游戏引擎。零 DOM 依赖，原生 WebGL 渲染，基于数据导向设计的 ECS 架构，专为移动端低 GC 压力优化。

## 特性

- **ECS World** — Archetype 原型模式，TypedArray SoA 组件存储，代际实体 ID
- **WebGL 渲染器** — 2D 精灵批处理、3D Mesh 支持、GL 状态缓存消除冗余驱动调用
- **数学库** — `Vec2`、`Vec3`、`Mat4`，基于对象池的 `Float32Array` 操作，零 GC
- **资源管线** — 自定义二进制 Bundle 格式，读写器确定性输出
- **平台抽象层** — 统一接口覆盖微信小游戏（`wx.*`）与浏览器双环境
- **输入系统** — 多点触控与手势事件管理
- **Plugin 系统** — 函数式插件架构，模块化扩展引擎能力

## 快速开始

```bash
pnpm install
pnpm test          # 单元测试
pnpm typecheck     # TypeScript 类型检查
pnpm build         # 构建引擎库
```

### 微信小游戏

```bash
pnpm build:wx-mahjong
```

用微信开发者工具打开 `wx-project/`，扫码在真机运行。

## 模块结构

```
src/
├── core/        # 引擎入口、主循环
├── ecs/         # World、EntityManager、ComponentStorage、Scheduler
├── renderer/    # WebGLDevice、SpriteBatcher、Mesh、Camera3D
├── math/        # Vec2、Vec3、Mat4、MathPool
├── asset/       # Bundle 格式读写
├── audio/       # 音效/BGM 管理
├── input/       # 输入系统
├── platform/    # 微信 + 浏览器适配器
└── canonical/   # 场景描述格式
```

## API 文档

| 模块 | 文档 |
|------|------|
| Engine & Plugin | [docs/api/engine.md](./docs/api/engine.md) |
| Math 库 | [docs/api/math.md](./docs/api/math.md) |
| ECS EntityManager | [docs/api/ecs-entity.md](./docs/api/ecs-entity.md) |
| ECS ComponentStorage | [docs/api/ecs-component.md](./docs/api/ecs-component.md) |
| ECS System Scheduler | [docs/api/ecs-system.md](./docs/api/ecs-system.md) |
| ECS World | [docs/api/ecs-world.md](./docs/api/ecs-world.md) |
| WebGL 渲染器 | [docs/api/renderer.md](./docs/api/renderer.md) |
| SpriteBatcher | [docs/api/sprite-batcher.md](./docs/api/sprite-batcher.md) |
| Platform Adapter | [docs/api/platform.md](./docs/api/platform.md) |
| Input System | [docs/api/input.md](./docs/api/input.md) |
| Asset Pipeline | [docs/api/asset.md](./docs/api/asset.md) |
| Audio | [docs/api/audio.md](./docs/api/audio.md) |
| Canonical Format | [docs/api/canonical-format.md](./docs/api/canonical-format.md) |

## 性能参考

| 指标 | 数值 |
|------|------|
| Entity creation (50,000) | 0.7ms |
| World.update（3 个 System，10,000 实体） | 0.1ms |
| Query iterate（10,000 实体） | 0.036ms |
| Scene load from bundle（50 实体） | 0.1ms |
| Bundle 体积 | ~178 bytes / entity |

## 微信平台须知

- `requestAnimationFrame` 挂在 canvas 对象上，不是 `wx` 全局
- 只有第一个 `wx.createCanvas()` 是可见 canvas，后续均为离屏
- 跨 canvas `drawImage` 合成（WebGL→2D）真机不可用
- 构建必须使用 `--target=es6`

## 命令

```bash
pnpm test                  # 单元测试
pnpm typecheck             # TypeScript 严格模式检查
pnpm build                 # 构建引擎库
pnpm build:wx-smoke        # 构建 bootstrap smoke
pnpm build:wx-engine       # 构建 engine smoke（完整 runtime 栈）
pnpm build:wx-scene        # 构建 scene smoke（场景渲染）
pnpm build:wx-mahjong      # 构建 demo 游戏
pnpm build:compile-fixture # 编译 Cocos 项目到 JSON fixture
pnpm mcp                   # 启动 MCP server
```

## License

MIT
