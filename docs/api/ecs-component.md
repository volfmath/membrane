# ECS ComponentStorage API 规格

> **职责**: 以 SoA（Structure of Arrays）布局存储所有 Component 数据，通过位掩码管理实体的 Component 组合（Archetype）。支持 Table / SparseSet 双模式存储，内置 Change Detection 变更检测。

---

## Component Schema

```typescript
type TypedArrayConstructor = typeof Float32Array | typeof Float64Array | typeof Int8Array | typeof Int16Array | typeof Int32Array | typeof Uint8Array | typeof Uint16Array | typeof Uint32Array;

interface FieldDef {
  type: TypedArrayConstructor;
  default?: number;
}

interface ComponentSchema {
  [fieldName: string]: FieldDef;
}
```

## 存储模式（灵感来源: Bevy ECS）

```typescript
enum StorageType {
  Table = 0,      // SoA 列式存储，缓存友好，适合高频读写（Transform, Velocity）
  SparseSet = 1,  // HashMap 式存储，适合频繁增删的标签组件（Dead, Selected, Hit）
}
```

**选择原则**:

| 场景 | 推荐模式 | 原因 |
|------|---------|------|
| 每帧都要遍历的数据组件 (Transform, Sprite) | Table | 内存连续，Cache 命中率高 |
| 频繁增删的标签/状态组件 (Dead, Hit, Selected) | SparseSet | 增删 O(1)，不触发 Archetype 迁移开销 |
| 零数据的纯标签组件 (Hidden, Frozen) | SparseSet | 只需跟踪"有/无"，不需要数据布局 |

### 定义示例

```typescript
const TransformSchema: ComponentSchema = {
  posX: { type: Float32Array, default: 0 }, posY: { type: Float32Array, default: 0 }, posZ: { type: Float32Array, default: 0 },
  rotX: { type: Float32Array, default: 0 }, rotY: { type: Float32Array, default: 0 }, rotZ: { type: Float32Array, default: 0 }, rotW: { type: Float32Array, default: 1 },
  scaleX: { type: Float32Array, default: 1 }, scaleY: { type: Float32Array, default: 1 }, scaleZ: { type: Float32Array, default: 1 },
};

const SpriteSchema: ComponentSchema = {
  atlasId: { type: Uint32Array, default: 0 },
  frameId: { type: Uint32Array, default: 0 },
  color:   { type: Uint32Array, default: 0xFFFFFFFF },
};

const HiddenSchema: ComponentSchema = {};   // 标签组件，无数据，推荐 SparseSet
```

## ComponentId 与 Archetype 掩码

```typescript
type ComponentId = number;
const MAX_COMPONENT_TYPES = 64;
type ArchetypeMask = bigint;
function componentBit(id: ComponentId): ArchetypeMask;   // 1n << BigInt(id)
```

## Change Detection（变更检测，灵感来源: Bevy ECS）

每个 Component 的每个实体都有一个**变更 Tick**，记录最后一次写入的时刻。System 查询时可以用 `Changed` / `Added` 过滤器，**只遍历真正被修改过的实体，跳过静止不动的**。

```typescript
class ComponentStorage {
  // 全局 Tick，每次 world.update() 递增
  private currentTick: number;
  
  // 每个 Component 的变更 Tick 数组（按 entityIndex 索引）
  // changedTick[componentId][entityIndex] = 最后修改的 tick
  private changedTick: Map<ComponentId, Uint32Array>;
  
  // 每个 Component 的添加 Tick 数组
  // addedTick[componentId][entityIndex] = 添加时的 tick
  private addedTick: Map<ComponentId, Uint32Array>;
  
  // 标记实体的某个 Component 为已修改
  markChanged(entityIndex: number, componentId: ComponentId): void;
  
  // 检查实体的某个 Component 是否在 sinceTicke 之后被修改过
  isChanged(entityIndex: number, componentId: ComponentId, sinceTick: number): boolean;
  
  // 检查实体的某个 Component 是否在 sinceTick 之后被添加
  isAdded(entityIndex: number, componentId: ComponentId, sinceTick: number): boolean;
  
  // 推进全局 Tick（由 World.update 调用）
  advanceTick(): number;
}
```

**性能影响**：每个实体每个 Component 额外 8 bytes（2 × Uint32），对 4096 实体 × 10 种 Component = 320KB，完全可接受。

**使用原则**：
- 写入 Component 数据后必须调用 `markChanged`
- 高频 System（如 MovementSystem）直接遍历，不用 Change Detection
- 低频 System（如 RenderSortSystem、AnimationSystem）用 `Changed` 过滤，节省大量 CPU

## ComponentRegistry

```typescript
interface ComponentDef {
  name: string;
  schema: ComponentSchema;
  storage?: StorageType;  // 默认 Table
}

class ComponentRegistry {
  register(def: ComponentDef): ComponentId;
  register(name: string, schema: ComponentSchema, storage?: StorageType): ComponentId;
  getSchema(id: ComponentId): ComponentSchema;
  getStorageType(id: ComponentId): StorageType;
  getName(id: ComponentId): string;
  readonly count: number;
}
```

## ComponentStorage

```typescript
class ComponentStorage {
  constructor(registry: ComponentRegistry, capacity: number);
  
  // 基本操作
  addComponent(entityIndex: number, componentId: ComponentId): void;
  removeComponent(entityIndex: number, componentId: ComponentId): void;
  hasComponent(entityIndex: number, componentId: ComponentId): boolean;
  getArchetype(entityIndex: number): ArchetypeMask;
  
  // Table 模式: 返回 TypedArray 直接索引
  getField(componentId: ComponentId, fieldName: string): TypedArray;
  getFields(componentId: ComponentId): Record<string, TypedArray>;
  
  // Change Detection
  markChanged(entityIndex: number, componentId: ComponentId): void;
  isChanged(entityIndex: number, componentId: ComponentId, sinceTick: number): boolean;
  isAdded(entityIndex: number, componentId: ComponentId, sinceTick: number): boolean;
  advanceTick(): number;
  readonly currentTick: number;
  
  clearEntity(entityIndex: number): void;
  reset(): void;
}
```

## 内存布局

### Table 模式（默认）

```
Component "Transform" (id=0, storage=Table), capacity=4:
posX: Float32Array    [ entity0.posX, entity1.posX, entity2.posX, entity3.posX ]
posY: Float32Array    [ entity0.posY, entity1.posY, entity2.posY, entity3.posY ]
changedTick: Uint32Array [ tick0, tick1, tick2, tick3 ]
addedTick: Uint32Array   [ tick0, tick1, tick2, tick3 ]
```

### SparseSet 模式

```
Component "Hit" (id=5, storage=SparseSet):
sparse: Uint32Array[maxEntities]   // entityIndex → dense index (or INVALID)
dense:  Uint32Array[count]         // dense index → entityIndex
// 有数据字段时：每个字段一个等长于 dense 的 TypedArray
// 无数据字段时（纯标签）：仅 sparse + dense
```

SparseSet 的增删操作是 O(1)（swap-remove），不影响 Table 主存储。

## 关键约束

1. **Table 容量固定**: TypedArray 长度 = maxEntities，注册时一次性分配
2. **SparseSet 动态增长**: dense 数组按需扩容
3. **直接索引**: Table 模式 getField() 返回的数组按 entityIndex 直接索引
4. **不验证存活**: 热路径不检查实体存活（由调用方保证）
5. **标签组件**: Schema 为 {} 且 storage=SparseSet 的不分配数据 TypedArray
6. **数据不清零**: removeComponent 仅清掩码位（Table）或 swap-remove（SparseSet）
7. **markChanged 责任制**: 修改 Component 数据后必须调用 markChanged，否则 Change Detection 不生效

## 使用示例

```typescript
const registry = new ComponentRegistry();

// Table 模式（高频数据组件）
const transformId = registry.register('Transform', TransformSchema);  // 默认 Table

// SparseSet 模式（频繁增删的标签）
const hitId = registry.register('Hit', {}, StorageType.SparseSet);
const deadId = registry.register('Dead', {}, StorageType.SparseSet);

const storage = new ComponentStorage(registry, 4096);

// Table 操作
storage.addComponent(0, transformId);
const posX = storage.getField(transformId, 'posX');
posX[0] = 100;
storage.markChanged(0, transformId);

// SparseSet 操作（子弹命中 → 添加 Hit 标签 → 下一帧移除）
storage.addComponent(42, hitId);   // O(1)
storage.removeComponent(42, hitId); // O(1)

// Change Detection
const lastTick = storage.currentTick;
// ... 一帧过去 ...
if (storage.isChanged(0, transformId, lastTick)) {
  // Transform 被修改过，需要更新渲染数据
}
```

## 依赖关系

- **依赖**: `ecs/entity-manager`
- 被 `ecs/query`、`ecs/system`、`ecs/world` 使用
