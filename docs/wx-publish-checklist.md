# WeChat Mini-Game 发布检查清单

## 构建命令

```bash
# 引擎栈 smoke (WebGL + ECS + SpriteBatcher)
pnpm build:wx-engine

# 导入场景 smoke (mahjong 项目实体渲染)
pnpm build:compile-fixture   # 先编译 fixture (需要 D:/majonggame)
pnpm build:wx-scene

# 其他 smoke
pnpm build:wx-smoke           # bootstrap 最小验证
pnpm build:wx-runtime         # Canvas2D 精灵渲染
pnpm build:wx-webgl           # WebGL 直接渲染
```

所有构建产物输出到 `wx-project/dist/index.js`。

## DevTools 预览步骤

1. 打开微信开发者工具
2. 导入项目 → 选择 `wx-project/` 目录
3. AppID 使用测试号或已注册的小游戏 AppID
4. 点击「编译」或等待自动编译
5. 模拟器中应看到渲染画面

## 真机扫码验证

1. DevTools → 「预览」→ 生成二维码
2. 手机微信扫码打开
3. 观察屏幕渲染、触摸响应、FPS 表现
4. 切后台再切回来，确认不白屏

## 验证清单

### wx-smoke-engine

| 检查项 | 预期 |
|--------|------|
| Canvas 创建 | 全屏黑底 canvas 可见 |
| WebGL 渲染 | 20 个彩色方块在屏幕内移动 |
| 边界碰撞 | 方块碰到边缘反弹 |
| FPS bar | 顶部 4px 颜色条 (绿=60fps, 黄=30-50, 红<30) |
| 触摸生成 | 点击屏幕生成 3 个新方块 |
| 实体上限 | 200 个实体后停止生成 |
| 日志输出 | `[Membrane][wx-smoke-engine]` 前缀日志 |

### wx-smoke-scene

| 检查项 | 预期 |
|--------|------|
| Fixture 加载 | 日志显示 3 个场景 (Loading, Home, MainGame) |
| 实体渲染 | 彩色方块分布在屏幕上 |
| 颜色区分 | 蓝=Camera, 彩色=Sprite, 灰=Transform-only |
| 场景切换 | 触摸屏幕切换场景 |
| HUD 信息 | 底部显示实体数、Sprite 比例、FPS |
| 场景指示器 | 顶部白色圆点标识当前场景 |

### 通用检查

| 检查项 | 预期 |
|--------|------|
| 构建大小 | < 60KB (gzip 前) |
| 启动时间 | < 1s 看到画面 |
| 内存 | 无持续增长 (关注 DevTools Performance 面板) |
| 切后台恢复 | 切后台再切回不白屏、不崩溃 |
| wx.onError | 无未捕获异常 |

## 已知限制

- **无纹理加载**: 所有实体渲染为纯色方块 (Phase 1 不需要真实图片)
- **无音频**: AudioManager 存在但未集成到 smoke 中
- **BigInt 警告**: esbuild 提示 BigInt 不兼容 es2015 目标，现代微信客户端 (V8/JSC) 支持 BigInt
- **不支持的组件**: Cocos 导入的 19 种组件中仅 3 种 (Transform/Sprite/Camera) 有运行时支持
- **无分包**: 场景数据直接嵌入或作为 assets 文件，未做子包拆分

## 项目结构

```
wx-project/
├── project.config.json    # 微信项目配置
├── game.json              # 小游戏配置
├── dist/
│   └── index.js           # esbuild 构建产物 (选择不同 smoke 构建)
└── assets/
    └── scene-data.json    # 编译的 mahjong 场景 fixture (14B 用)
```
