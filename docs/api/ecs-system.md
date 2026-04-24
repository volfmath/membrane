# ECS System Scheduler API 规格

> **职责**: 定义 System 接口与执行阶段，提供 Archetype Query 构建器（含 Changed/Added 过滤器），按 Phase 顺序调度所有 System。

---

## SystemPhase

```typescript
enum SystemPhase {
  PreUpdate = 0, Update = 1, PostUpdate = 2, PreRender = 3, Render = 4, PostRender = 5,
}
```

执行顺序严格固定：`PreUpdate → Update → PostUpdate → PreRender → Render → PostRender`

## System 接口

```typescript
interface System {
  readonly name: string;
  readonly phase: SystemPhase;
  readonly query: ArchetypeQuery | null;
  update(world: World, dt: number, matchedEntities: Uint32Array, matchedCount: number): void;
  enabled: boolean;
}
```

## ArchetypeQuery

```typescript
class ArchetypeQueryBuilder {
  with(...componentIds: ComponentId[]): this;
  without(...componentIds: ComponentId[]): this;
  changed(...componentIds: ComponentId[]): this;   // 仅匹配自上次 System 执行后被修改的
  added(...componentIds: ComponentId[]): this;     // 仅匹配自上次 System 执行后被新增的
  build(): ArchetypeQuery;
}

class ArchetypeQuery {
  readonly withMask: ArchetypeMask;
  readonly withoutMask: ArchetypeMask;
  readonly changedIds: ReadonlyArray<ComponentId>;   // Change Detection 过滤
  readonly addedIds: ReadonlyArray<ComponentId>;     // Added Detection 过滤
  
  // Archetype 掩码匹配（快速路径，先筛选组件组合）
  matchesArchetype(archetype: ArchetypeMask): boolean;
  // match = (archetype & withMask) === withMask && (archetype & withoutMask) === 0n
  
  // 实体级细粒度过滤（慢路径，检查 changedTick / addedTick）
  matchesEntity(entityIndex: number, storage: ComponentStorage, lastRunTick: number): boolean;
}
```

### Change Detection 查询流程（灵感来源: Bevy ECS）

```
Scheduler.update(world, dt)
  │
  ├─ 对每个 System:
  │   ├─ 记录 lastRunTick = system 上次执行时的 world tick
  │   ├─ 快速路径: 用 withMask/withoutMask 筛选候选实体 → matchBuffer
  │   ├─ 如果 query 有 changed/added 过滤器:
  │   │   └─ 慢路径: 遍历 matchBuffer，逐个检查 changedTick/addedTick > lastRunTick
  │   │       └─ 不匹配的从 matchBuffer 中剔除
  │   ├─ 调用 system.update(world, dt, matchBuffer, matchCount)
  │   └─ 更新 system.lastRunTick = currentTick
  │
  └─ world.storage.advanceTick()
```

**性能特征**:
- 不使用 changed/added 过滤器的 System → 零额外开销（只走快速路径）
- 使用 changed 过滤器的 System → 额外遍历 matchBuffer 检查 Tick，但跳过大量静止实体

## Scheduler

```typescript
class Scheduler {
  addSystem(system: System): void;
  removeSystem(system: System): void;
  getSystems(phase: SystemPhase): ReadonlyArray<System>;
  getAllSystems(): ReadonlyArray<System>;
  update(world: World, dt: number): void;
  
  // 每个 System 的上次执行 Tick（用于 Change Detection）
  getLastRunTick(system: System): number;
}
```

内部用预分配 `matchBuffer: Uint32Array` 收集匹配实体，避免每帧 GC。

## 关键约束

1. Phase 顺序不可变
2. 同 Phase 内按注册顺序执行
3. matchBuffer 预分配复用，不产生 GC
4. System 不可重复注册
5. dt 为秒（60fps 时 ≈ 0.01667）
6. changed/added 过滤器只在有 Change Detection 需求时使用，高频 System 不需要
7. 每个 System 维护独立的 lastRunTick，互不干扰

## 使用示例

### 高频 System（每帧全量遍历，不用 Change Detection）

```typescript
class MovementSystem implements System {
  readonly name = 'Movement';
  readonly phase = SystemPhase.Update;
  readonly query: ArchetypeQuery;
  enabled = true;

  constructor(transformId: ComponentId, velocityId: ComponentId) {
    this.query = new ArchetypeQueryBuilder()
      .with(transformId, velocityId)
      .build();
  }

  update(world: World, dt: number, entities: Uint32Array, count: number): void {
    const posX = world.storage.getField(transformId, 'posX');
    const velX = world.storage.getField(velocityId, 'velX');
    for (let i = 0; i < count; i++) {
      const e = entities[i];
      posX[e] += velX[e] * dt;
    }
    // 注意: 修改了 Transform 数据，标记变更
    for (let i = 0; i < count; i++) {
      world.storage.markChanged(entities[i], transformId);
    }
  }
}
```

### 低频 System（用 Changed 过滤，只处理变更实体）

```typescript
class WorldMatrixSystem implements System {
  readonly name = 'WorldMatrix';
  readonly phase = SystemPhase.PreRender;
  readonly query: ArchetypeQuery;
  enabled = true;

  constructor(transformId: ComponentId) {
    this.query = new ArchetypeQueryBuilder()
      .with(transformId)
      .changed(transformId)   // 只处理 Transform 被修改过的实体
      .build();
  }

  update(world: World, dt: number, entities: Uint32Array, count: number): void {
    // count 可能远小于总实体数（大量静止实体被跳过）
    for (let i = 0; i < count; i++) {
      recomputeWorldMatrix(entities[i], world);
    }
  }
}
```

### Added 过滤示例

```typescript
class InitSpriteSystem implements System {
  readonly name = 'InitSprite';
  readonly phase = SystemPhase.PreRender;
  readonly query: ArchetypeQuery;
  enabled = true;

  constructor(spriteId: ComponentId) {
    this.query = new ArchetypeQueryBuilder()
      .with(spriteId)
      .added(spriteId)   // 只处理本帧新添加 Sprite 组件的实体
      .build();
  }

  update(world: World, dt: number, entities: Uint32Array, count: number): void {
    for (let i = 0; i < count; i++) {
      loadTextureForSprite(entities[i], world);
    }
  }
}
```

## 依赖关系

- **依赖**: `ecs/entity-manager`、`ecs/component-storage`
- 被 `ecs/world`、`core/engine` 使用
