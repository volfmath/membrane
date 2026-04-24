# Development Log

> 这个文件记录当前阶段已经落地的改动、验证状态和下一步计划。它不是路线图替代品，而是“现在仓库里到底推进到了哪里”的短日志。

---

## 2026-04-24

### 已完成

- 重写 Phase 1 方向：
  - 从“无痛迁移 / 20% 提升承诺”改成
  - `canonical format + 单向导入链路 + runtime 验证`

- 补齐 canonical / import / compile 规格：
  - `docs/api/canonical-format.md`
  - `docs/api/importer-cli.md`
  - `docs/schema/*.json`

- 把“每一步都必须可测试”写进路线图：
  - 测试层级 `L0 -> L4`
  - Step 10 / 12 / 13 / 14 子切片
  - 微信真机验证前置到 Step 1 / 6 / 7 / 8 / 10 / 11 / 12

- 建立微信 smoke 通道：
  - `docs/wx-smoke-workflow.md`
  - `docs/wx-smoke-log.md`
  - `wx-project/` 最小壳工程

- 补 `wx-smoke-bootstrap` 最小实现：
  - `src/wx-smoke-bootstrap.cts`
  - `wx-project/game.js`
  - `wx-project/dist/index.js`
  - `wx-project/assets/bootstrap.txt`

- 把根目录脚手架接到微信 smoke：
  - `package.json#packageManager`
  - `package.json#scripts.build:wx-smoke`
  - `package.json#scripts.smoke:wx:local`

### 已完成 — 运行时核心 (Steps 2–11)

- **Math 库** (Step 2–3): Vec2, Vec3, Mat4, MathPool — 零 GC、Float32Array 背板、out 参数模式 (64 tests)
- **ECS 核心** (Step 4–5): EntityManager (16-bit gen + 16-bit index)、ComponentRegistry、ComponentStorage (SoA Table + SparseSet 双模式)、BigInt 64-bit archetype bitmask、Change Detection (Bevy 风格 tick)、ArchetypeQuery、phase-ordered Scheduler、World facade (52 tests)
- **平台抽象** (Step 6): PlatformAdapter 接口、BrowserAdapter、WxAdapter（含 raf 四级 fallback）
- **WebGL 渲染** (Step 7–8): GLStateCache (冗余 GL 调用消除)、shader-utils、WebGLDevice (context lost/restored)、SpriteBatcher (2048 sprites/batch) (8 tests)
- **资源格式** (Step 9): BundleWriter/BundleReader — WXGE magic、TOC + data、零拷贝 subarray 视图 (14 tests)
- **Engine + Plugin** (Step 10): Engine 主循环 (raf + dt clamp + FPS)、MembranePlugin 函数式系统 (17 tests)
- **输入系统** (Step 11): InputManager — 事件缓冲、10 点触控、零 GC 对象池、tap/swipe 手势检测 (28 tests)

**总计: 184 tests 全通过, TypeScript strict 模式干净**

### 微信 Smoke 验证

- **wx-smoke-bootstrap**: ✅ DevTools + 真机通过
- **wx-smoke-runtime**: ✅ DevTools + 真机通过
  - Canvas2D 模式 (主 canvas 直接渲染)
  - 16 个弹跳彩色方块, 触摸生成新方块, FPS 显示
  - DevTools: WebGL 模式可用, ~58 FPS (iPhone 12/13 Pro 模拟)

### 发现的微信平台问题

| 问题 | 表现 | 解法 |
|------|------|------|
| `wx.requestAnimationFrame` 不存在 | DevTools 中循环不启动 | canvas.raf → global raf → wx.raf → setTimeout 四级 fallback |
| 只有第一个 canvas 可见 | HUD 画在第二个 canvas 上，屏幕黑 | 所有渲染都在主 canvas 上 |
| 跨 canvas drawImage 真机失败 | WebGL 渲染到二级 canvas + drawImage 合成，真机黑屏 | 强制 Canvas2D；WebGL 需直接用主 canvas |
| ES2020 语法不兼容 | `?.` / `??` 运行报错 | esbuild `--target=es6` |

### 下一步

1. Step 12: Cocos Creator 单向导入链路
2. `wx-smoke-webgl`: 主 canvas 直接 WebGL 渲染验证
3. Step 13: 微信发布流程
