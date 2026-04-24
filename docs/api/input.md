# Input System API 规格

> **职责**: 将平台原始触摸/鼠标事件转换为游戏可用的输入状态，提供"这帧是否按下/抬起/拖拽"的查询接口。作为 ECS System 运行在 PreUpdate 阶段。

---

## 数据结构

```typescript
interface TouchPoint {
  id: number;           // 触摸标识符（多点触控区分用）
  x: number;            // 当前 X（Canvas 坐标）
  y: number;            // 当前 Y
  startX: number;       // 按下时 X
  startY: number;       // 按下时 Y
  deltaX: number;       // 本帧移动 ΔX
  deltaY: number;       // 本帧移动 ΔY
  phase: TouchPhase;    // 当前阶段
  timestamp: number;    // 事件时间戳
}

enum TouchPhase {
  Began = 0,    // 本帧刚按下
  Moved = 1,    // 持续按住且移动中
  Held = 2,     // 持续按住但未移动
  Ended = 3,    // 本帧刚抬起
  Cancelled = 4 // 被系统中断（来电、切后台）
}
```

## InputManager

```typescript
class InputManager {
  constructor(platform: PlatformAdapter);

  // —— 每帧由 InputSystem 调用 ——
  update(): void;   // 推进状态：Began→Held/Moved，清除上帧的 Ended

  // —— 触摸查询（游戏逻辑用）——
  readonly touchCount: number;
  getTouch(index: number): TouchPoint | null;
  getTouchById(id: number): TouchPoint | null;

  // —— 便捷查询（单点触控快捷方式）——
  readonly justPressed: boolean;    // 本帧刚按下
  readonly justReleased: boolean;   // 本帧刚抬起
  readonly isPressed: boolean;      // 当前按住
  readonly position: { x: number; y: number } | null;   // 当前触点位置
  readonly delta: { x: number; y: number };              // 本帧移动量

  // —— 手势检测 ——
  readonly isTap: boolean;          // 短按后抬起（< 200ms，移动 < 10px）
  readonly isSwipe: boolean;        // 快速滑动（移动 > 50px，时长 < 300ms）
  readonly swipeDirection: 'up' | 'down' | 'left' | 'right' | null;

  // —— 鼠标兼容（开发环境）——
  // BrowserAdapter 自动将 mousedown/mousemove/mouseup 映射为触摸事件
  // 游戏代码无需区分鼠标和触摸

  dispose(): void;
}
```

## InputSystem（ECS 集成）

```typescript
const inputPlugin: MembranePlugin = (engine) => {
  engine.input = new InputManager(engine.platform);

  engine.world.addSystem({
    name: 'Input',
    phase: SystemPhase.PreUpdate,
    query: null,  // 不查询实体，只更新 InputManager 状态
    enabled: true,
    update(world, dt) {
      engine.input.update();
    }
  });
};
```

## 内部状态机

```
平台触摸事件（异步到达）           InputManager 状态（每帧同步）
─────────────────────           ────────────────────────
touchStart(x, y)          →    缓冲到 pendingEvents 队列
touchMove(x, y)           →    缓冲到 pendingEvents 队列
touchEnd(x, y)            →    缓冲到 pendingEvents 队列

     ↓ update() 每帧消费队列 ↓

帧 N: touchStart 到达        →  TouchPhase.Began,  justPressed = true
帧 N+1: 无新事件             →  TouchPhase.Held,   justPressed = false
帧 N+1: touchMove 到达       →  TouchPhase.Moved,  delta 更新
帧 N+2: touchEnd 到达        →  TouchPhase.Ended,  justReleased = true
帧 N+3: update() 清理        →  触点移除,          justReleased = false
```

**关键**: 平台事件是异步回调（随时到达），但 InputManager 将其缓冲，在 `update()` 中统一消费，保证 System 读到的状态在一帧内一致。

## 手势检测逻辑

```
Tap 检测:
  touchStart → 记录 startTime + startPos
  touchEnd   → if (duration < 200ms && distance < 10px) → isTap = true

Swipe 检测:
  touchEnd   → if (distance > 50px && duration < 300ms)
             → swipeDirection = 移动量最大的轴方向
```

阈值可配置：
```typescript
interface InputConfig {
  tapMaxDuration?: number;    // 默认 200ms
  tapMaxDistance?: number;    // 默认 10px
  swipeMinDistance?: number;  // 默认 50px
  swipeMaxDuration?: number;  // 默认 300ms
}
```

## 坐标系

```
Canvas 坐标（左上角原点，像素单位）:
  (0, 0) ───────── (width, 0)
    │                    │
    │                    │
  (0, height) ──── (width, height)
```

- InputManager 输出的坐标是 Canvas 像素坐标，已乘 devicePixelRatio
- 游戏逻辑如需世界坐标，通过 Camera 逆投影变换

## 多点触控

```typescript
// 双指缩放检测示例
if (input.touchCount >= 2) {
  const t0 = input.getTouch(0)!;
  const t1 = input.getTouch(1)!;
  const currentDist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
  const prevDist = Math.hypot(
    (t1.x - t1.deltaX) - (t0.x - t0.deltaX),
    (t1.y - t1.deltaY) - (t0.y - t0.deltaY)
  );
  const pinchScale = currentDist / prevDist;
}
```

## 关键约束

1. **事件缓冲**: 平台事件异步到达，`update()` 统一消费，保证帧内状态一致
2. **零 GC**: TouchPoint 对象预分配（最多 10 个触点），不每帧 new
3. **相位准确**: `justPressed` / `justReleased` 只在对应帧为 true，下帧自动清除
4. **鼠标映射**: BrowserAdapter 将鼠标事件透明映射为 touch（id=0），开发/生产代码一致
5. **坐标已校准**: 已处理 Canvas 缩放和 devicePixelRatio
6. **最大触点数**: 预分配 10 个，超出忽略（微信环境最多 5 点）

## 使用示例

```typescript
// 在游戏 System 中使用
class PlayerControlSystem implements System {
  readonly name = 'PlayerControl';
  readonly phase = SystemPhase.Update;
  readonly query: ArchetypeQuery;
  enabled = true;

  update(world: World, dt: number, entities: Uint32Array, count: number): void {
    const input = engine.input;

    if (input.justPressed) {
      // 点击位置生成子弹
      spawnBullet(world, input.position!.x, input.position!.y);
    }

    if (input.isPressed) {
      // 拖拽移动玩家
      const posX = world.storage.getField(transformId, 'posX');
      const posY = world.storage.getField(transformId, 'posY');
      for (let i = 0; i < count; i++) {
        posX[entities[i]] += input.delta.x;
        posY[entities[i]] += input.delta.y;
      }
    }

    if (input.isSwipe) {
      // 滑动切换方向
      changeDirection(input.swipeDirection!);
    }
  }
}
```

## 依赖关系

- **依赖**: `platform/platform-adapter`
- 被游戏逻辑 System 使用
- 通过 `inputPlugin` 注册到 Engine
