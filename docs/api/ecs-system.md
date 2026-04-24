# ECS System Scheduler API 规格

> **职责**: 定义 System 接口与执行阶段，提供 Archetype Query 构建器，按 Phase 顺序调度所有 System。

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
  build(): ArchetypeQuery;
}

class ArchetypeQuery {
  readonly withMask: ArchetypeMask;
  readonly withoutMask: ArchetypeMask;
  matches(archetype: ArchetypeMask): boolean;
  // match = (archetype & withMask) === withMask && (archetype & withoutMask) === 0n
}
```

## Scheduler

```typescript
class Scheduler {
  addSystem(system: System): void;
  removeSystem(system: System): void;
  getSystems(phase: SystemPhase): ReadonlyArray<System>;
  getAllSystems(): ReadonlyArray<System>;
  update(world: World, dt: number): void;
}
```

内部用预分配 `matchBuffer: Uint32Array` 收集匹配实体，避免每帧 GC。

## 关键约束

1. Phase 顺序不可变
2. 同 Phase 内按注册顺序执行
3. matchBuffer 预分配复用，不产生 GC
4. System 不可重复注册
5. dt 为秒（60fps 时 ≈ 0.01667）

## 使用示例

```typescript
class MovementSystem implements System {
  readonly name = 'Movement';
  readonly phase = SystemPhase.Update;
  readonly query: ArchetypeQuery;
  enabled = true;

  constructor(transformId: ComponentId, velocityId: ComponentId) {
    this.query = new ArchetypeQueryBuilder().with(transformId, velocityId).build();
  }

  update(world: World, dt: number, entities: Uint32Array, count: number): void {
    const posX = world.storage.getField(transformId, 'posX');
    const velX = world.storage.getField(velocityId, 'velX');
    for (let i = 0; i < count; i++) {
      posX[entities[i]] += velX[entities[i]] * dt;
    }
  }
}
```

## 依赖关系

- **依赖**: `ecs/entity-manager`、`ecs/component-storage`
- 被 `ecs/world`、`core/engine` 使用
