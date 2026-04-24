# Engine & Plugin API 规格

> **职责**: 引擎主循环 + 函数式 Plugin 系统。引擎核心只有 ECS + 主循环，渲染、音频、物理全部通过 Plugin 注册，esbuild tree-shaking 自动剔除未使用的模块。

> **灵感来源**: Bevy 的 Plugin 架构 — 任何 `fn(&mut App)` 即是 Plugin。

---

## Plugin

```typescript
type MembranePlugin = (engine: Engine) => void;
```

Plugin 就是一个函数。接收 Engine 实例，在内部注册 Component、System、资源等。**没有类继承、没有生命周期钩子、没有配置对象** — 就是一个函数调用。

### 内置 Plugin

```typescript
// 2D 精灵渲染
const spritePlugin: MembranePlugin = (engine) => {
  const spriteId = engine.world.registry.register('Sprite', SpriteSchema);
  const cameraId = engine.world.registry.register('Camera', CameraSchema);
  engine.world.addSystem(new SpriteRenderSystem(engine.device, spriteId, cameraId));
};

// 音频
const audioPlugin: MembranePlugin = (engine) => {
  engine.audio = new AudioManager(engine.platform);
};

// 内置 Transform + Movement
const transformPlugin: MembranePlugin = (engine) => {
  const transformId = engine.world.registry.register('Transform', TransformSchema);
  engine.world.addSystem(new TransformSystem(transformId));
};
```

### 用户自定义 Plugin

```typescript
const bulletPlugin: MembranePlugin = (engine) => {
  const bulletId = engine.world.registry.register('Bullet', {
    velX: { type: Float32Array, default: 0 },
    velY: { type: Float32Array, default: 0 },
    lifetime: { type: Float32Array, default: 3 },
  });
  const deadId = engine.world.registry.register('Dead', {}, StorageType.SparseSet);
  
  engine.world.addSystem(new BulletMoveSystem(bulletId));
  engine.world.addSystem(new BulletLifetimeSystem(bulletId, deadId));
};
```

## Engine

```typescript
interface EngineConfig {
  canvas?: HTMLCanvasElement | WXCanvas;
  maxEntities?: number;
  targetFPS?: number;       // 默认 60
}

class Engine {
  readonly platform: PlatformAdapter;
  readonly world: World;
  readonly device: WebGLDevice;
  readonly batcher: SpriteBatcher;
  audio: AudioManager | null;
  
  private plugins: MembranePlugin[];
  private running: boolean;
  private lastTime: number;
  
  constructor(config?: EngineConfig);
  
  // Plugin 注册（必须在 start 之前调用）
  use(plugin: MembranePlugin): this;
  
  // 启动主循环
  start(): void;
  
  // 停止主循环
  stop(): void;
  
  // 单帧更新（供测试用）
  tick(dt: number): void;
  
  // 状态
  readonly fps: number;
  readonly frameCount: number;
  readonly isRunning: boolean;
}
```

## 主循环

```typescript
// Engine 内部实现
private loop(timestamp: number): void {
  if (!this.running) return;
  
  const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);  // 上限 50ms
  this.lastTime = timestamp;
  
  this.world.update(dt);
  
  this.frameCount++;
  this.platform.requestAnimationFrame((t) => this.loop(t));
}
```

## 初始化流程

```
const engine = new Engine({ maxEntities: 4096 });

// 注册 Plugin（顺序无关，但建议先基础后业务）
engine
  .use(transformPlugin)    // 基础: Transform
  .use(spritePlugin)       // 渲染: Sprite
  .use(audioPlugin)        // 音频
  .use(bulletPlugin)       // 业务逻辑
  .use(myGamePlugin);      // 游戏入口

// 启动
engine.start();
```

## 为什么是函数而不是类

| 方案 | 优点 | 缺点 |
|------|------|------|
| **函数 Plugin** ✅ | 极简、tree-shaking 友好、无继承链 | 无生命周期钩子 |
| 类 Plugin | 可以有 init/dispose | 需要 class 定义、import 成本高、tree-shaking 困难 |
| 配置对象 | 声明式 | 不灵活、需要解释器 |

函数式 Plugin 对 esbuild tree-shaking 最友好：**没被 `engine.use()` 的 Plugin，其内部的 Component Schema、System 类、Shader 代码全部被剔除**，主包自然瘦。

## Plugin 依赖

Plugin 之间没有显式依赖声明。如果 Plugin B 依赖 Plugin A 注册的 Component：
- **方案 1**（推荐）: Plugin B 内部 `registry.getId('Transform')` 查找已注册的 Component
- **方案 2**: Plugin B 自己也注册一遍（重复注册返回已有 ID，不报错）

```typescript
// Plugin B 依赖 Transform
const renderPlugin: MembranePlugin = (engine) => {
  // 查找已注册的 Transform（由 transformPlugin 注册）
  const transformId = engine.world.registry.getId('Transform');
  if (transformId === -1) throw new Error('renderPlugin requires transformPlugin');
  
  engine.world.addSystem(new SpriteRenderSystem(engine.device, transformId));
};
```

## 关键约束

1. **use 必须在 start 之前**: Plugin 在 start 时按注册顺序依次执行
2. **Plugin 执行是同步的**: Plugin 函数内不能 await（资源加载放到 System 里异步处理）
3. **Plugin 不可卸载**: 注册后不能移除（简化实现）
4. **Engine 单例**: 一个页面只有一个 Engine 实例
5. **链式调用**: `engine.use()` 返回 this

## 微信小游戏入口示例

```typescript
// game.ts — 微信小游戏主包入口
import { Engine, transformPlugin, spritePlugin, audioPlugin } from 'membrane';
import { myGamePlugin } from './game-plugin';

const engine = new Engine({ maxEntities: 4096, targetFPS: 60 });

engine
  .use(transformPlugin)
  .use(spritePlugin)
  .use(audioPlugin)
  .use(myGamePlugin)
  .start();
```

esbuild 打包后，只包含实际 use 的模块代码，未引用的（如物理、粒子）自动剔除。

## 依赖关系

- **依赖**: `ecs/world`、`renderer/webgl-device`、`renderer/sprite-batcher`、`platform/platform-adapter`
- 被游戏入口代码使用
- Plugin 按需依赖具体模块
