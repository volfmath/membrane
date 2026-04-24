# ECS EntityManager API 规格

> **职责**: 管理实体的创建、销毁与 ID 复用，通过 generation 机制防止悬空引用。

---

## 类型定义

```typescript
type EntityId = number;

const INVALID_ENTITY: EntityId = 0xFFFFFFFF;
const ENTITY_INDEX_BITS = 16;
const ENTITY_INDEX_MASK = 0xFFFF;
const ENTITY_GEN_BITS = 16;
const ENTITY_GEN_MASK = 0xFFFF;
const MAX_ENTITIES = 1 << ENTITY_INDEX_BITS;   // 65536
```

## ID 编码规则

```
EntityId (u32):
┌────────────────┬────────────────┐
│  generation(16) │   index(16)    │
└────────────────┴────────────────┘

编码: id = (generation << 16) | index
解码: index = id & 0xFFFF
      generation = (id >> 16) & 0xFFFF
```

## EntityManager

```typescript
interface EntityManagerConfig {
  maxEntities?: number;    // 默认 65536，最大 65536
}

class EntityManager {
  constructor(config?: EntityManagerConfig);
  create(): EntityId;
  destroy(id: EntityId): void;
  isAlive(id: EntityId): boolean;
  readonly aliveCount: number;
  readonly capacity: number;
  static getIndex(id: EntityId): number;
  static getGeneration(id: EntityId): number;
  reset(): void;
}
```

## 内部数据结构

```typescript
class EntityManager {
  private generations: Uint16Array;       // length = maxEntities
  private freeList: Uint16Array;          // LIFO 栈
  private freeCount: number;
  private _aliveCount: number;
  private nextNewIndex: number;
}
```

**分配策略**: 优先 freeList 弹出 → nextNewIndex++ → 容量耗尽抛错

**销毁策略**: isAlive 验证 → generations[index]++ → freeList 推入 → aliveCount--

## 关键约束

1. **容量固定**: 构造时预分配，运行时不扩容
2. **generation 溢出**: u16 回绕到 0，风险可接受
3. **线程安全**: 不保证，主线程执行
4. **INVALID_ENTITY**: 0xFFFFFFFF 不会被合法 create() 返回
5. **销毁幂等**: 对已死亡实体调用 destroy() 为 no-op

## 使用示例

```typescript
const em = new EntityManager({ maxEntities: 1024 });
const e1 = em.create();  // (0 << 16) | 0
const e2 = em.create();  // (0 << 16) | 1
em.destroy(e1);
const e3 = em.create();  // (1 << 16) | 0 — 复用 index 0，generation 递增
em.isAlive(e1);  // false
em.isAlive(e3);  // true
```

## 依赖关系

- **无外部依赖**
- 被 `ecs/component-storage`、`ecs/world`、`ecs/query` 使用
