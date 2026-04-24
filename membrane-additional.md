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

### Phase 1 —— 寄生：用性能杀死迁移成本

**目标**：让现有 Unity / Cocos 小游戏用 Membrane 导出工具重新打包，**直接提升 20% 性能**，零代码修改。

```
现有小游戏项目 (Unity / Cocos Creator)
         │
         ▼
  Membrane 导出工具
  ├── 解析 Cocos .scene / .prefab（JSON 格式）
  ├── 解析 Unity AssetBundle / WebGL Build
  ├── 转换为 Membrane 内部格式（ECS 场景数据 + Bundle 资源包）
  └── 脚本组件 → 事件表映射（渐进支持）
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

**20% 性能提升来源**：

| 优化手段 | 对比 Cocos/Unity 适配层 | 预估提升 |
|---------|----------------------|---------|
| 零 DOM 依赖 | Cocos 仍依赖部分 DOM 模拟层 | 3-5% |
| SoA ECS 内存布局 | Cocos 基于 OOP 节点树，Cache miss 严重 | 5-8% |
| GL 状态缓存 | Cocos 有缓存但粒度粗 | 2-3% |
| SpriteBatcher 合批 | Cocos 合批策略保守 | 3-5% |
| 零 GC 数学运算 | Cocos 数学库每次运算分配新对象 | 2-4% |
| 自定义 Bundle 零拷贝 | Cocos 资源加载有额外拷贝开销 | 1-2% |

**关键策略**：不要求用户改代码。导出工具做翻译层，把现有项目转成 Membrane 格式。用户只需要"导出 → 运行 → 看到帧率提升"。迁移成本趋近于零，用户没有理由不试。

**验证里程碑**：
1. 找一个开源 Cocos Creator 小游戏 demo，用导出工具转换
2. 对比原版和 Membrane 版的帧率、DrawCall 数、内存占用
3. 达到 ≥15% 性能提升即可对外宣传

---

### Phase 2 —— 替代：AI-Native 创作平台

Phase 1 证明运行时够强之后，把 Unity / Cocos 的编辑器彻底甩掉。

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

2D 小游戏的本质极其简单：

```
场景 = 图层列表
  每个图层 = 一堆精灵
    每个精灵 = 图片引用 + Transform + 标签

逻辑 = 事件表
  on(触发条件) → do(动作列表)
```

JSON 示例：
```json
{
  "scene": "level_01",
  "layers": [
    {
      "name": "entities",
      "sprites": [
        { "img": "player.png", "x": 100, "y": 200, "tags": ["player", "physics"] },
        { "img": "coin.png",   "x": 300, "y": 200, "tags": ["collectible"] }
      ]
    }
  ],
  "events": [
    { "on": "tag:player touch tag:collectible", "do": "destroy:target, score:+1" }
  ]
}
```

具体格式是实现细节，随时可调。**但格式的稳定性是核心资产，上下两层能否解耦取决于此。**

---

## AI 在引擎中的定位

| 层级 | AI 角色 | 说明 |
|------|---------|------|
| 内容生产端（Phase 2） | **主力** | 策划、美术、代码全由 AI + MCP 连接器生产 |
| 导出工具（Phase 1） | **辅助** | AI 辅助解析脚本组件、生成事件表映射 |
| 运行时逻辑层 | **可选** | NPC AI 行为等，后期探索 |
| 运行时调度层 | **不介入** | 保持确定性和性能可预测 |

---

## 一句话总结

> Phase 1：寄生在 Unity/Cocos 生态上，用性能优势零成本获客。
> Phase 2：客户到手后，用 AI-Native 创作平台把旧引擎扔进垃圾桶。
