# wx-project

这是 Membrane 的微信小游戏最小 smoke 壳工程。

它的目标不是承载正式 runtime，而是尽早提供一个**固定、低成本、可重复**的微信验证入口：
- Step 1：验证项目能导入、能扫码、能打启动日志
- Step 6 之后：逐步挂接 platform / webgl / sprite / runtime / audio / imported-scene smoke

---

## 目录

```text
wx-project/
├── game.js
├── game.json
├── project.config.json
├── dist/
├── assets/
└── reports/
```

## 文件职责

- `game.js`
  最小启动入口。优先打印启动日志，再尝试加载 `./dist/index.js`。

- `game.json`
  微信小游戏基础配置。

- `project.config.json`
  微信开发者工具项目配置。当前使用最小 smoke 配置，方便导入。

- `package.json`
  仅用于本地 Node smoke，把 `wx-project/*.js` 固定为 CommonJS；微信开发者工具会忽略它。

- `dist/`
  构建产物落点。当前仓库内先保留一个 `dist/index.js` smoke stub，保证 Step 1 就能验证 `require('./dist/index.js')` 这条链路；后续再由真实 `pnpm build` 产物替换。

- `assets/`
  固定 smoke 资源，例如 1x1 白纹理、测试图集、测试音频、`assets/bootstrap.txt` 这类读文件 smoke 夹具。

- `reports/`
  截图、错误日志、导入报告、手工记录附件。

## 当前阶段的使用方式

### Step 1

只验证：
- 开发者工具可以打开 `wx-project/`
- `game.js` 能启动
- `dist/index.js` smoke stub 能被加载
- `assets/bootstrap.txt` 可作为固定 readFile 夹具
- 真机扫码能进入
- console / toast 有固定启动反馈

**当前 bootstrap stub 的预期屏幕状态**:
- `summary: pending-touch`（未触摸前）
- `canvas: ready`
- `raf: running`
- `readFile: ready`
- `touch: pending`（未触摸前）
- 触摸屏幕后 `touch` 会切到 `start / move / end`
- 触摸成功后 `summary` 进入 `pass`
- `asset:` 行显示 `membrane-wx-smoke-bootstrap`

### Step 6 之后

每个 smoke case 都应尽量挂在同一壳工程里，而不是临时新建项目。

建议命名：
- `wx-smoke-bootstrap`
- `wx-smoke-platform`
- `wx-smoke-webgl`
- `wx-smoke-sprite`
- `wx-smoke-runtime`
- `wx-smoke-audio`
- `wx-smoke-imported-scene`

## 操作建议

1. 本地构建 runtime 或 smoke bundle
2. 同步到 `wx-project/dist/`
3. 微信开发者工具打开 `wx-project/`
4. 预览并扫码
5. 记录到 [docs/wx-smoke-log.md](/E:/membrane/docs/wx-smoke-log.md)

## 约束

- 不要把这个目录直接当正式发布工程
- 不要让它承载复杂业务逻辑
- 不要每次 smoke 都改一套新的目录结构
- 出问题先保留失败附件到 `reports/`

## 本地命令

```powershell
powershell -ExecutionPolicy Bypass -File ..\tools\wx-smoke\Invoke-LocalSmoke.ps1
powershell -ExecutionPolicy Bypass -File ..\tools\wx-smoke\Sync-WxSmoke.ps1 -SourceDist ..\dist\index.js -CaseId wx-smoke-platform
```

- `Invoke-LocalSmoke.ps1`：在 Node 里重跑当前 stub，并落 `reports/local-smoke.log`。
- `Sync-WxSmoke.ps1`：把构建出的文件或目录同步到 `wx-project/dist/`，并落 `reports/last-sync.json`。
- 后续步骤如果有资源目录，再补 `-SourceAssetsDir <path>`；需要清理旧产物时加 `-CleanDist` / `-CleanAssets`。
