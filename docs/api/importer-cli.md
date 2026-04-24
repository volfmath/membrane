# Importer / Compiler CLI 规格

> **职责**: 约定 Phase 1 的单向导入、格式校验、编译命令，形成 `内容源 -> canonical -> runtime bundle` 的标准链路。

---

## 命令设计原则

1. **拆分阶段**: 导入、校验、编译分开，便于定位问题
2. **单向**: 只把外部内容归一化到 canonical format，不做 round-trip
3. **可脚本化**: 命令适合 CI、benchmark、批量导入
4. **显式输出**: 导入报告和编译报告都是一等产物

## 命令概览

```bash
membrane import cocos --input ./cocos-project --output ./canonical
membrane validate canonical --input ./canonical
membrane compile --input ./canonical --output ./membrane-build
```

## `membrane import cocos`

把 Cocos Creator 项目导入为 canonical format。

### 用法

```bash
membrane import cocos \
  --input ./cocos-project \
  --output ./canonical \
  --scene level_01 \
  --report ./canonical/import-report.json \
  --strict
```

### 参数

| 参数 | 说明 |
|------|------|
| `--input <dir>` | Cocos 项目根目录 |
| `--output <dir>` | canonical 输出目录 |
| `--scene <id>` | 只导入指定 scene；缺省为全部 |
| `--report <file>` | import report 输出路径；缺省为 `<output>/import-report.json` |
| `--include-library` | 允许读取 Cocos `library/` 目录辅助解析 |
| `--strict` | 出现 unsupported component 时返回非 0 退出码 |
| `--dry-run` | 只打印统计和告警，不落盘 |

### 输出

```text
canonical/
├── scenes/
├── prefabs/
├── assets.json
└── import-report.json
```

### 退出码

| 退出码 | 含义 |
|------|------|
| `0` | 成功 |
| `1` | 参数错误 / 输入目录不存在 |
| `2` | 解析失败 |
| `3` | `--strict` 下存在 unsupported / warning 升级为失败 |

## `membrane validate canonical`

用 JSON Schema 和额外规则校验 canonical 输出。

### 用法

```bash
membrane validate canonical --input ./canonical
```

### 校验内容

- JSON Schema 是否通过
- `sceneId` / `prefabId` / `assetId` 是否唯一
- `entity.parent` 是否引用存在实体
- `Sprite.atlas` / `Sprite.frame` 是否引用合法
- `import-report.json` 结构是否完整

### 退出码

| 退出码 | 含义 |
|------|------|
| `0` | 校验通过 |
| `1` | 输入目录或文件缺失 |
| `2` | JSON 解析失败 |
| `3` | Schema 校验失败 |
| `4` | 跨文件引用失败 |

## `membrane compile`

把 canonical format 编译为 runtime bundle。

### 用法

```bash
membrane compile \
  --input ./canonical \
  --output ./membrane-build \
  --scene level_01 \
  --bundle-name assets.wxpak
```

### 参数

| 参数 | 说明 |
|------|------|
| `--input <dir>` | canonical 目录 |
| `--output <dir>` | 编译输出目录 |
| `--scene <id>` | 只编译指定 scene；缺省为全部 |
| `--bundle-name <file>` | bundle 名；缺省为 `assets.wxpak` |
| `--pretty` | 以便于调试的形式输出 manifest / report |
| `--no-scene-pack` | scene 不打进 bundle，仅输出中间文件用于调试 |

### 输出

```text
membrane-build/
├── manifest.json
├── bundles/
│   └── assets.wxpak
└── reports/
    └── compile-report.json
```

`manifest.json` 必须至少包含：

```json
{
  "version": 1,
  "scenes": [
    {
      "id": "level_01",
      "bundle": "bundles/assets.wxpak",
      "assetId": 1001
    }
  ]
}
```

## 推荐流水线

```bash
membrane import cocos --input ./demo/cocos --output ./tmp/canonical
membrane validate canonical --input ./tmp/canonical
membrane compile --input ./tmp/canonical --output ./tmp/build
pnpm run preview:runtime -- --manifest ./tmp/build/manifest.json --scene level_01
```

## CI 场景

```bash
membrane import cocos --input ./fixtures/cocos-demo --output ./artifacts/canonical --strict
membrane validate canonical --input ./artifacts/canonical
membrane compile --input ./artifacts/canonical --output ./artifacts/build
pnpm test -- tests/runtime
```

## Phase 1 约束

1. importer 发现 unsupported component 时必须写入 `import-report.json`
2. validate 不依赖运行时，仅检查源格式和引用正确性
3. compile 可以忽略未支持组件，但不能忽略缺失资源引用
4. CLI 产物应可重复生成，相同输入得到稳定输出

## 与 MCP 的关系

Phase 2 的 MCP 主要读写 canonical format，而不是直接修改 runtime bundle。也就是说：

```
MCP / AI / 可视化编辑器
          │
          ▼
Canonical Format
          │
          ▼
membrane compile
          │
          ▼
Runtime Bundle
```
