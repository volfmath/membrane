# Membrane

**The Runtime Layer for AI-Native Games**

> 引擎即协议层，而非工具链。对人是漂亮的界面，对 AI 是一堆可操作数据。

## 文档

- [引擎架构设计文档](./wechat-minigame-runtime-engine.md) — WX-RT Runtime 完整设计，包含模块架构、UML 类图、伪代码示例、包体优化建议
- [产品方向与设计哲学](./membrane-additional.md) — 核心想法、三层架构、开发路径规划

## 三层架构

```
内容管理层（Notion-like 网页工具）
    ├── AI 图像工具 → 生成 2D 素材
    ├── AI 代码工具 → 生成玩法逻辑
    └── MCP 连接器
           ↓
Membrane Runtime（ECS + WebGL + WASM）
           ↓
微信小游戏 发布
```

## 当前阶段

阶段一：先做运行时，从 Cocos Creator / Unity 导出格式跑通 Membrane Runtime。
