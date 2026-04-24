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
  - `wx-project/game.js`
  - `wx-project/dist/index.js`
  - `wx-project/assets/bootstrap.txt`

### 当前状态

- 本地 Node 验证已通过：
  - `node wx-project/dist/index.js`
  - `node wx-project/game.js`

- 微信开发者工具 / 真机验证：
  - **还没执行**
  - 当前处于“可进 DevTools 做第一轮 smoke”的状态

### 当前最小 smoke 目标

第一次 `wx-smoke-bootstrap` 只需要验证：
- `wx-project/` 能被微信开发者工具导入
- 手机扫码可进入
- `game.js` 启动日志可见
- toast 可见
- `dist/index.js` 被加载
- 屏幕状态面板显示：
  - `canvas: ready`
  - `raf: running`
  - `readFile: ready`
  - `touch: pending`，触摸后切换

### 下一步

1. 真正执行一次 `wx-smoke-bootstrap`
2. 把结果记入 `docs/wx-smoke-log.md`
3. 若通过，再推进 `wx-smoke-platform`
4. 若失败，优先修平台壳工程，不往后堆功能

### 风险 / 未决事项

- 还没验证 `wx.createCanvas()` 在当前开发者工具版本下的行为
- 还没验证 `assets/bootstrap.txt` 的路径在小游戏文件系统中是否直接可读
- 还没验证 toast / console / 2D canvas 在真机和 DevTools 是否一致
