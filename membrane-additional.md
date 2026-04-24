# Membrane — 产品方向与战略

> 引擎即协议层，而非工具链。对人是漂亮的界面，对 AI 是一堆可操作数据。

---

## 一句话定义

**Membrane** 是一个面向微信小游戏的高性能运行时，零 DOM 依赖、原生 WebGL 渲染、天然 ECS 架构。它不是又一个游戏引擎 —— 它是一层薄膜，一面对玩家呈现游戏画面，另一面对 AI 暴露结构化可操作数据。

---

## 核心判断

### 传统引擎的价值正在转移

Unity / Cocos Creator 的护城河是**工具链** —— 编辑器、材质系统、蓝图、组件面板。这些东西的本质是"让人类能生产游戏内容"。

AI 时代，这层工具链将被 AI 替代。引擎真正不可替代的部分只有一个：**运行时**。

Membrane 的策略：

```
不做工具链 → 运行时做到极致 → 工具层交给 AI
```

### 为什么从微信小游戏切入

- 平台约束（主包 ≤ 4MB、禁多线程、WXWebAssembly）天然逼出**薄运行时**架构
- 帧率容错空间比 PC / 原生移动端大，留出优化余量
- 市场验证快，发布门槛低
- 竞品（Cocos/Unity 小游戏适配层）臃肿，性能天花板低

---

## 两阶段战略

### Phase 1 —— 寄生：借用现有工具链验证运行时与数据格式

**目标**：先不做完整工具链，而是借用现有 Unity / Cocos 项目作为内容入口，做一条**单向 Import → Canonical Format → Runtime Bundle** 链路，用真实内容验证 Membrane Runtime、资源管线和性能边界。

```
现有小游戏项目 (Unity / Cocos Creator)
         │
         ▼
  Membrane 导入 / 编译工具
  ├── 解析 Cocos .scene / .prefab（JSON 格式）
  ├── 解析 Unity AssetBundle / WebGL Build（渐进支持）
  ├── 转换为 Membrane Canonical Format（Entity + Components + Assets）
  ├── 编译为 Runtime Bundle（Scene Manifest + .wxpak）
  └── 标记 unsupported 组件，生成导入报告
         │
         ▼
  Membrane Runtime 运行
  ├── 零 DOM —— 直接 wx.createCanvas() + WebGL
  ├── ECS SoA —— CPU Cache 友好，批量处理
  ├── SpriteBatcher —— 自动合批，最少 DrawCall
  ├── GLStateCache —— 跳过冗余 GL 调用
  ├── 零 GC 数学库 —— Float32Array + 对象池
  └── 自定义 Bundle —— 零拷贝资源读取
```

**运行时性能优势来源（验证指标，而非唯一承诺）**：

| 优化手段 | 对比 Cocos/Unity 适配层 | 预估提升 |
|---------|----------------------|---------|
| 零 DOM 依赖 | Cocos 仍依赖部分 DOM 模拟层 | 3-5% |
| SoA ECS 内存布局 | Cocos 基于 OOP 节点树，Cache miss 严重 | 5-8% |
| GL 状态缓存 | Cocos 有缓存但粒度粗 | 2-3% |
| SpriteBatcher 合批 | Cocos 合批策略保守 | 3-5% |
| 零 GC 数学运算 | Cocos 数学库每次运算分配新对象 | 2-4% |
| 自定义 Bundle 零拷贝 | Cocos 资源加载有额外拷贝开销 | 1-2% |

**关键策略**：Phase 1 不承诺完整兼容，也不追求 round-trip。它只做单向导入，把现有项目当作内容源和测试夹具；真正稳定的资产是 Membrane 的 canonical format，而不是对 Cocos / Unity 文件格式的长期依赖。

**验证里程碑**：
1. 定义一套适合 AI 阅读、也适合 ECS 编译的 canonical scene / sprite format
2. 找一个开源 Cocos Creator 小游戏 demo，导入为 canonical format，再编译为 runtime bundle
3. 在浏览器 / 微信环境中加载编译结果，验证渲染、资源、包体和性能预算
4. 如果与原版对比达到明显性能提升（如 ≥15%），可作为额外宣传数据；但这不是 Phase 1 的唯一出口条件

---

### Phase 2 —— 替代：AI-Native 创作平台

Phase 1 先借用现有工具链把 runtime 和数据格式跑通，Phase 2 再把 Unity / Cocos 的编辑器彻底甩掉。

**创作层变成 Notion-like 的网页工具**，对人是可视化的内容管理界面，对 AI 是一组 MCP 连接器。

```
创作平台（Notion-like 网页工具）
    │
    ├── MCP 连接器: Perplexity
    │   └── 出策划案、世界观、关卡设计文档
    │
    ├── MCP 连接器: GPT Image (gptimage2)
    │   └── 生成 2D 素材、UI 元素、角色立绘
    │
    ├── MCP 连接器: Claude
    │   └── 产出游戏逻辑代码、事件表、系统脚本
    │
    ├── MCP 连接器: 其他工具
    │   └── 音效生成、动画制作、本地化翻译...
    │
    └── 输出：Membrane 场景数据（结构化 JSON + 资源 Bundle）
              │
              ▼
        Membrane Runtime → 微信小游戏发布
```

**关键设计原则**：

1. **运行时不关心内容来源** —— 它只认数据格式。不管是人在编辑器里拖出来的、AI 生成的、还是从 Cocos 转过来的，只要符合 Membrane 内部格式，运行时一视同仁。

2. **格式稳定性是核心资产** —— 上下两层能解耦，全靠中间的数据格式。格式一旦定义，除非有极强的理由不要改。

3. **AI 是内容生产者，不是运行时决策者** —— AI 在编辑期生成内容，运行时保持确定性。不在渲染循环里调 LLM。

---

## 内部数据格式（草案）

Membrane 内部数据分两层：

1. **Canonical Format（给 AI / 导入器 / 未来工具链）**
   - 文本 JSON，可读、可 diff、可被 MCP 直接读写
   - 以 `entity + components` 为主，而不是传统 node tree / hierarchy
   - hierarchy 只作为可选 `parent` 关系存在，不再作为主数据结构
   - sprite / atlas / frame / tag 等引用全部显式化

2. **Runtime Format（给运行时）**
   - Scene manifest + compiled scene data + asset bundle
   - 预解析 asset id、atlas/frame、component layout
   - 目标是 SoA、零拷贝、按需加载

Canonical JSON 示例：
```json
{
  "scene": "level_01",
  "entities": [
    {
      "id": "player",
      "parent": null,
      "components": {
        "Transform": { "x": 100, "y": 200, "rotation": 0, "scaleX": 1, "scaleY": 1 },
        "Sprite": { "atlas": "main", "frame": "player_idle", "order": 10 },
        "Tags": { "values": ["player"] }
      }
    },
    {
      "id": "coin_01",
      "parent": null,
      "components": {
        "Transform": { "x": 300, "y": 200 },
        "Sprite": { "atlas": "main", "frame": "coin" },
        "Tags": { "values": ["collectible"] }
      }
    }
  ],
  "events": [
    { "on": "tag:player touch tag:collectible", "do": "destroy:target, score:+1" }
  ]
}
```

导入器负责把 Cocos / Unity 内容归一化到 Canonical Format；编译器负责把 Canonical Format 烘焙为 Runtime Format。**但格式的稳定性是核心资产，上下两层能否解耦取决于此。**

---

## AI 在引擎中的定位

| 层级 | AI 角色 | 说明 |
|------|---------|------|
| 内容生产端（Phase 2） | **主力** | 策划、美术、代码全由 AI + MCP 连接器生产 |
| 导入器 / 编译器（Phase 1） | **辅助** | AI 辅助补全映射、生成导入报告、翻译简单脚本为事件表 |
| 运行时逻辑层 | **可选** | NPC AI 行为等，后期探索 |
| 运行时调度层 | **不介入** | 保持确定性和性能可预测 |

---

## 一句话总结

> Phase 1：借用 Unity/Cocos 工具链，把 canonical format 和 runtime 跑通。
> Phase 2：客户到手后，用 AI-Native 创作平台把旧引擎扔进垃圾桶。
