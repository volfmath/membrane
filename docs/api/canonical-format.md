# Canonical Format API 规格

> **职责**: 定义 Membrane 的可读源格式，作为导入器、未来工具链、MCP、AI 连接器之间的稳定边界。运行时不直接消费它，而是由编译器把它转换为 runtime bundle。

---

## 设计目标

1. **AI 可读**: 文本 JSON，字段语义直白，可 diff，可生成，可被 MCP 直接读写
2. **ECS 友好**: 以 `entity + components` 为主，不以 hierarchy 作为主数据结构
3. **单向归一化**: Cocos / Unity / 未来自研工具链都先归一化到同一套 canonical format
4. **可编译**: 编译阶段能稳定映射到 bundle / asset id / SoA 布局
5. **可扩展**: Phase 1 只要求少量 built-in components，其他 component 允许渐进加入

## 分层

```
外部内容源（Cocos / Unity / 自研工具）
          │
          ▼
Canonical Format
  ├── scenes/*.scene.json
  ├── prefabs/*.prefab.json
  ├── assets.json
  └── import-report.json
          │
          ▼
Compiler
          │
          ▼
Runtime Format
  ├── manifest.json
  ├── bundles/*.wxpak
  └── compile-report.json
```

## 目录结构

```text
canonical/
├── scenes/
│   └── level_01.scene.json
├── prefabs/
│   └── enemy.prefab.json
├── assets.json
└── import-report.json
```

`prefabs/` 是可选目录。Phase 1 的 importer 可以直接展平 prefab，不强制保留 prefab 边界。

## 文件类型

| 文件 | 作用 |
|------|------|
| `scenes/*.scene.json` | 场景源文件，包含实体列表和可选事件表 |
| `prefabs/*.prefab.json` | 可复用模板，结构与 scene 类似，但不作为独立关卡入口 |
| `assets.json` | 资源清单、atlas/frame 映射、scene/prefab 路径 |
| `import-report.json` | 导入警告、unsupported 组件、源项目统计 |

## 命名与 ID 约束

- `sceneId`、`prefabId`、`assetId`、`entity.id` 必须在各自作用域内唯一
- 推荐使用稳定字符串 ID，例如 `player`, `enemy/slime_01`, `ui.main_camera`
- importer 不应把源引擎的临时 instance id 直接暴露为 canonical id
- `entity.parent` 是可选的显式父引用，`null` 表示根实体
- hierarchy 只影响 authoring 语义，不应阻止后续编译为扁平 ECS 数据

## Scene 文件

```json
{
  "format": "membrane.scene",
  "version": 1,
  "sceneId": "level_01",
  "name": "Level 01",
  "metadata": {
    "source": "cocos",
    "sourceFile": "assets/scenes/level_01.scene"
  },
  "entities": [
    {
      "id": "player",
      "name": "Player",
      "parent": null,
      "enabled": true,
      "components": {
        "Transform": {
          "x": 100,
          "y": 200,
          "rotation": 0,
          "scaleX": 1,
          "scaleY": 1
        },
        "Sprite": {
          "atlas": "main",
          "frame": "player_idle",
          "order": 10
        },
        "Tags": {
          "values": ["player"]
        }
      }
    }
  ],
  "events": [
    {
      "id": "pickup_coin",
      "on": "tag:player touch tag:collectible",
      "do": ["destroy:target", "score:+1"]
    }
  ]
}
```

## Prefab 文件

Prefab 结构与 Scene 相同，但 `format` 为 `membrane.prefab`，顶层主键为 `prefabId`。

```json
{
  "format": "membrane.prefab",
  "version": 1,
  "prefabId": "enemy/slime",
  "name": "Slime",
  "entities": []
}
```

## Asset 文件

```json
{
  "format": "membrane.assets",
  "version": 1,
  "scenes": [
    { "id": "level_01", "path": "scenes/level_01.scene.json" }
  ],
  "prefabs": [
    { "id": "enemy/slime", "path": "prefabs/enemy_slime.prefab.json" }
  ],
  "atlases": [
    {
      "id": "main",
      "image": "textures/main.png",
      "width": 1024,
      "height": 1024,
      "frames": [
        { "id": "player_idle", "x": 0, "y": 0, "width": 64, "height": 64, "pivotX": 0.5, "pivotY": 0.5 }
      ]
    }
  ],
  "audio": [
    { "id": "bgm.main", "path": "audio/bgm_main.mp3", "kind": "bgm" }
  ]
}
```

## Import Report

```json
{
  "format": "membrane.import-report",
  "version": 1,
  "source": {
    "kind": "cocos",
    "root": "./cocos-project"
  },
  "summary": {
    "sceneCount": 1,
    "entityCount": 42,
    "warningCount": 2,
    "unsupportedCount": 3
  },
  "issues": [
    {
      "severity": "warning",
      "code": "UNSUPPORTED_COMPONENT",
      "sceneId": "level_01",
      "entityId": "Canvas/ScoreLabel",
      "component": "cc.Label",
      "message": "Phase 1 importer does not support cc.Label; entity kept without label rendering."
    }
  ]
}
```

## Built-in Components（Phase 1）

### Transform

```typescript
interface TransformComponent {
  x?: number;
  y?: number;
  z?: number;
  rotation?: number;   // degrees
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  anchorX?: number;    // default 0.5
  anchorY?: number;    // default 0.5
}
```

### Sprite

```typescript
interface SpriteComponent {
  atlas: string;
  frame: string;
  order?: number;
  color?: string;      // #RRGGBBAA
  flipX?: boolean;
  flipY?: boolean;
  visible?: boolean;
}
```

### Camera

```typescript
interface CameraComponent {
  mode?: 'orthographic';
  size?: number;
  near?: number;
  far?: number;
  clearColor?: string; // #RRGGBBAA
}
```

### Tags

```typescript
interface TagsComponent {
  values: string[];
}
```

### PrefabRef

```typescript
interface PrefabRefComponent {
  prefabId: string;
  inheritTransform?: boolean;
  overrides?: Record<string, unknown>;
}
```

## TypeScript 参考接口

```typescript
type CanonicalComponentValue = Record<string, unknown>;

interface CanonicalEntity {
  id: string;
  name?: string;
  parent?: string | null;
  enabled?: boolean;
  components: Record<string, CanonicalComponentValue>;
}

interface CanonicalEvent {
  id: string;
  on: string;
  do: string | string[];
}

interface CanonicalSceneFile {
  format: 'membrane.scene';
  version: 1;
  sceneId: string;
  name?: string;
  metadata?: Record<string, unknown>;
  entities: CanonicalEntity[];
  events?: CanonicalEvent[];
}

interface CanonicalPrefabFile {
  format: 'membrane.prefab';
  version: 1;
  prefabId: string;
  name?: string;
  metadata?: Record<string, unknown>;
  entities: CanonicalEntity[];
  events?: CanonicalEvent[];
}
```

## 编译约束

1. Canonical 文件不要求零拷贝，目标是可读和稳定
2. Compiler 负责把字符串 ID 映射为运行时 asset id / entity template id
3. Compiler 可以重排实体和组件顺序，但不能改变语义
4. `parent` 关系必须在编译阶段显式解析，不允许运行时依赖源引擎 hierarchy 规则
5. unsupported component 不能静默吞掉，必须进入 `import-report.json`

## Phase 1 范围

- 必须支持: `Transform`, `Sprite`, `Tags`, `Camera`
- 可选支持: `PrefabRef`
- 默认不支持: `Label`, `Animation`, `Physics`, `CustomScript`
- 允许保留未来扩展 component，但 Phase 1 compiler 可以选择忽略并报 warning

## Schema 文件

- `docs/schema/canonical-scene.schema.json`
- `docs/schema/canonical-prefab.schema.json`
- `docs/schema/canonical-assets.schema.json`
- `docs/schema/import-report.schema.json`

这些 schema 用于 `membrane validate canonical`。
