# ECS World API 规格

> **职责**: 门面类，组合 EntityManager + ComponentRegistry + ComponentStorage + Scheduler，提供统一的高层 API。

---

## World

```typescript
interface WorldConfig { maxEntities?: number; }

class World {
  readonly entities: EntityManager;
  readonly registry: ComponentRegistry;
  readonly storage: ComponentStorage;
  readonly scheduler: Scheduler;
  readonly currentTick: number;

  constructor(config?: WorldConfig);

  createEntity(): EntityId;
  destroyEntity(id: EntityId): void;
  isAlive(id: EntityId): boolean;
  addComponent(id: EntityId, componentId: ComponentId): this;
  removeComponent(id: EntityId, componentId: ComponentId): void;
  hasComponent(id: EntityId, componentId: ComponentId): boolean;
  query(): ArchetypeQueryBuilder;
  addSystem(system: System): void;
  removeSystem(system: System): void;
  update(dt: number): void;
  reset(): void;
  readonly entityCount: number;
}
```

## update 内部流程

```
World.update(dt)
  │
  ├─ storage.advanceTick()          // 全局 Tick 递增
  │
  ├─ scheduler.update(this, dt)     // 按 Phase 执行所有 System
  │   ├─ PreUpdate systems
  │   ├─ Update systems
  │   ├─ PostUpdate systems
  │   ├─ PreRender systems
  │   ├─ Render systems
  │   └─ PostRender systems
  │
  └─ (返回，由 Engine 控制下一帧)
```

## 关键约束

1. **单一入口**: 游戏代码通过 World 操作，不直接调用子模块
2. **销毁顺序**: destroyEntity 先清 Component 再回收 ID
3. **链式调用**: addComponent 返回 this
4. **update 不可嵌套**
5. **Tick 递增**: 每次 update 自动推进全局 Tick（驱动 Change Detection）

## 使用示例

```typescript
const world = new World({ maxEntities: 4096 });
const transformId = world.registry.register('Transform', TransformSchema);
world.addSystem(new MovementSystem(transformId));

const player = world.createEntity();
world.addComponent(player, transformId);

function gameLoop(dt: number) { world.update(dt); }
```

## 依赖关系

- **依赖**: `ecs/entity-manager`、`ecs/component-registry`、`ecs/component-storage`、`ecs/scheduler`、`ecs/query`
- 被 `core/engine` 和所有 System 使用
