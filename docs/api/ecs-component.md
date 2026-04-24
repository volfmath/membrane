# ECS ComponentStorage API 规格

> **职责**: 以 SoA（Structure of Arrays）布局存储所有 Component 数据，通过位掩码管理实体的 Component 组合（Archetype）。

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

const HiddenSchema: ComponentSchema = {};   // 标签组件，无数据
```

## ComponentId 与 Archetype 掩码

```typescript
type ComponentId = number;
const MAX_COMPONENT_TYPES = 64;
type ArchetypeMask = bigint;
function componentBit(id: ComponentId): ArchetypeMask;   // 1n << BigInt(id)
```

## ComponentRegistry

```typescript
class ComponentRegistry {
  register(name: string, schema: ComponentSchema): ComponentId;
  getSchema(id: ComponentId): ComponentSchema;
  getName(id: ComponentId): string;
  readonly count: number;
}
```

## ComponentStorage

```typescript
class ComponentStorage {
  constructor(registry: ComponentRegistry, capacity: number);
  addComponent(entityIndex: number, componentId: ComponentId): void;
  removeComponent(entityIndex: number, componentId: ComponentId): void;
  hasComponent(entityIndex: number, componentId: ComponentId): boolean;
  getArchetype(entityIndex: number): ArchetypeMask;
  getField(componentId: ComponentId, fieldName: string): TypedArray;
  getFields(componentId: ComponentId): Record<string, TypedArray>;
  clearEntity(entityIndex: number): void;
  reset(): void;
}
```

## 内存布局

```
Component "Transform" (id=0), capacity=4:
posX: Float32Array  [ entity0.posX, entity1.posX, entity2.posX, entity3.posX ]
posY: Float32Array  [ entity0.posY, entity1.posY, entity2.posY, entity3.posY ]
...
```

所有 TypedArray 在注册时一次性分配，不动态扩容。

## 关键约束

1. **容量固定**: TypedArray 长度 = maxEntities
2. **直接索引**: getField() 返回的数组按 entityIndex 直接索引
3. **不验证存活**: 热路径不检查实体存活（由调用方保证）
4. **标签组件**: Schema 为 {} 的不分配 TypedArray
5. **数据不清零**: removeComponent 仅清掩码位

## 使用示例

```typescript
const registry = new ComponentRegistry();
const transformId = registry.register('Transform', TransformSchema);
const storage = new ComponentStorage(registry, 1024);

storage.addComponent(0, transformId);
const posX = storage.getField(transformId, 'posX');
posX[0] = 100;
```

## 依赖关系

- **依赖**: `ecs/entity-manager`
- 被 `ecs/query`、`ecs/system`、`ecs/world` 使用
