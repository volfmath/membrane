# WeChat Smoke Log

> 这个文件是固定模板。每次做微信开发者工具或真机 smoke，都在末尾追加一条记录，不要只在聊天里口头说明。

---

## 记录模板

```text
Date:
Commit:
Branch:
Smoke Case:
Operator:

DevTools Version:
Device:
OS:
WeChat Version:

Build Source:
  - dist synced from:
  - assets version:

Expected:
Actual:

Result:
  - PASS / FAIL

Artifacts:
  - screenshot:
  - console log:
  - extra report:

Notes:
```

---

## 示例

```text
Date: 2026-04-24
Commit: abcdef1
Branch: main
Smoke Case: wx-smoke-bootstrap
Operator: codex

DevTools Version: 1.06.x
Device: iPhone 13
OS: iOS 18.x
WeChat Version: 8.0.x

Build Source:
  - dist synced from: dist/index.js
  - assets version: bootstrap only

Expected:
  - project opens in DevTools
  - phone scan launches
  - startup log visible

Actual:
  - DevTools opened successfully
  - phone scan succeeded
  - startup log printed once

Result:
  - PASS

Artifacts:
  - screenshot: wx-project/reports/2026-04-24-bootstrap.png
  - console log: startup log only
  - extra report: none

Notes:
  - no runtime smoke yet
```
