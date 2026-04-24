# WeChat Smoke Workflow

> **职责**: 定义 Membrane 在微信开发者工具和真机上的固定 smoke 流程。目标不是替代单元测试，而是尽早发现 `wx.*` 平台差异，并让每次验证都走同一套低成本路径。

---

## 为什么要尽早接入

微信真机验证不应该第一次出现在 Step 14。

更合理的接入顺序是：
- Step 1：建流程，能打开 `wx-project/`，能扫码，能打启动日志
- Step 6：第一次功能性真机验证，覆盖 `canvas / RAF / touch / readFile`
- Step 7 / 8 / 10 / 11 / 12：每个关键子系统加一个固定 smoke case
- Step 14：发布前验收

重点不是“越早越全”，而是“越早越固定”。

## 固定 smoke 入口

仓库内固定使用：

```text
wx-project/
├── game.js
├── game.json
├── project.config.json
├── dist/
├── assets/
└── reports/
```

- `game.js`：最小 bootstrap
- `dist/`：本地构建产物落点；当前包含一个最小 `dist/index.js` smoke stub
- `assets/`：固定 smoke 资源，例如 `assets/bootstrap.txt`
- `reports/`：截图、日志、导出报告

## 统一执行流程

每次 smoke 尽量固定成下面 6 步：

1. 本地构建
2. 同步构建产物到 `wx-project/dist/`
3. 微信开发者工具打开 `wx-project/`
4. 开发者工具预览无红字报错
5. 手机扫码验证固定 smoke case
6. 把结果记录到 [wx-smoke-log.md](/E:/membrane/docs/wx-smoke-log.md)

推荐命令序列：

```bash
pnpm build
# 同步 dist 到 wx-project/dist（具体命令由后续工具链决定）
```

## 固定 smoke case

| 用例 ID | 最早步骤 | 目标 | 通过标准 |
|---------|----------|------|----------|
| `wx-smoke-bootstrap` | Step 1 | 项目导入、最小入口启动 | 开发者工具能打开，真机可启动并打印日志 |
| `wx-smoke-platform` | Step 6 | canvas / RAF / touch / file | 真机回调与日志正常 |
| `wx-smoke-webgl` | Step 7 | clearColor / GL 信息 | 真机 clearColor 正确，GL 信息可打印 |
| `wx-smoke-sprite` | Step 8 | 单 sprite / atlas frame | 真机 sprite 正确显示，无明显 UV 偏移 |
| `wx-smoke-runtime` | Step 10 | engine loop / moving sprite | 真机最小 runtime 场景可跑 |
| `wx-smoke-audio` | Step 11 | SFX / BGM / 中后台 | 真机音频行为正确 |
| `wx-smoke-imported-scene` | Step 12 | 导入链路最终产物 | 编译后的最小真实 scene 能在真机显示 |

## 每次 smoke 必查项

### 开发者工具

- 项目能正常导入
- `game.js` 启动无同步异常
- `dist/index.js` 能正常加载
- `assets/bootstrap.txt` 可作为固定 readFile smoke 夹具
- console 没有红字崩溃
- 若存在 `dist/index.js`，能正常加载

### 真机

- 可以扫码进入
- 首屏不白屏、不黑屏
- 日志或可视反馈与当前 smoke 用例一致
- 手势 / 音频 / 渲染行为符合该用例预期

### 记录

- 日期
- 分支 / commit
- smoke case
- 设备型号 / OS / 微信版本
- 开发者工具版本
- 结果：通过 / 失败
- 附件：截图、报错、日志摘要

## 失败时的定位顺序

失败后不要直接继续改大功能，先按这个顺序定位：

1. 看开发者工具 console
2. 看 `wx-project/game.js` 启动日志
3. 确认 `dist/` 是否是当前构建产物
4. 确认失败属于哪个 smoke case，而不是泛化成“微信不行”
5. 若是平台差异，再对照浏览器 smoke 看是否只在 `wx.*` 环境触发

## 不要做的事

- 不要每次都拿“当前最大场景”去手机上试
- 不要让真机第一次承担基础回归测试
- 不要只凭“目测差不多”就记为通过
- 不要把多个 smoke case 混成一个大 case

## 相关文件

- [wx-project/README.md](/E:/membrane/wx-project/README.md)
- [wx-smoke-log.md](/E:/membrane/docs/wx-smoke-log.md)
- [implementation_roadmap.md](/E:/membrane/docs/implementation_roadmap.md)
