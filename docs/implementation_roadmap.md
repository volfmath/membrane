# 实现路线图 & 测试策略

> 每一步都必须可独立测试验证，不依赖后续步骤。

---

## Step 1 — 项目脚手架

**目标**: 搭建 TypeScript 项目基础设施，确保构建和测试流程跑通。

**交付物**:
- `package.json` — 项目元数据与脚本
- `tsconfig.json` — TypeScript 配置（target: ES2020, module: ESNext）
- `vitest.config.ts` — 测试框架配置
- `src/index.ts` — 空入口文件
- `tests/sanity.test.ts` — 第一个测试用例

**技术选型**:

| 工具 | 选择 | 理由 |
|------|------|------|
| 构建 | esbuild | 极快，适合库打包，输出单文件 JS |
| 测试 | vitest | 原生 TS 支持，API 兼容 Jest |
| 格式化 | 无（后续按需加） | 最小化初始依赖 |

**目录结构**:
```
wxge/
├── src/
│   ├── math/
│   ├── ecs/
│   ├── renderer/
│   ├── platform/
│   ├── asset/
│   ├── audio/
│   └── index.ts
├── tests/
│   ├── math/
│   ├── ecs/
│   ├── renderer/
│   └── asset/
├── test-visual/          # 浏览器视觉测试页面
├── docs/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**测试验证**:
```bash
npm install
npm run build   # esbuild 编译成功，输出 dist/wxge.js
npm test        # vitest 跑通 sanity.test.ts
```

**完成标准**:
- [x] `npm run build` 零错误输出 `dist/wxge.js`
- [x] `npm test` 通过，输出 1 passed

---

## Step 2 — Math 库

**目标**: 实现零 GC 的向量/矩阵运算库，所有操作写入 `out` 参数。

**前置依赖**: Step 1

**交付物**:
- `src/math/vec2.ts`
- `src/math/vec3.ts`
- `src/math/mat4.ts`
- `src/math/math-pool.ts` — 对象池
- `src/math/index.ts` — 统一导出
- `tests/math/*.test.ts`

**关键设计决策**:
- 所有 Vec/Mat 内部用 `Float32Array` 存储
- 所有运算函数签名：`static op(a, b, out): void` — 不返回新对象
- `MathPool` 提供 `get()` / `release()` 管理临时变量
- 精度容差常量 `EPSILON = 1e-6`

**测试验证**:
```bash
npm test -- tests/math/
```

测试用例覆盖：
- Vec2/Vec3: add, sub, scale, dot, cross, normalize, length, lerp
- Mat4: identity, multiply, translate, rotate, scale, invert, perspective, ortho, lookAt
- Pool: get/release 循环不泄漏，pool 耗尽时的行为
- 边界值: 零向量 normalize、奇异矩阵 invert
- 精度: 连续运算累积误差在 EPSILON 范围内

**完成标准**:
- [x] 所有单元测试通过
- [x] 无任何 `new Vec3()` / `new Mat4()` 出现在运算函数中（grep 验证）
- [x] Pool 压力测试（10000 次 get/release）无内存增长

---

## Step 3 — ECS EntityManager

**目标**: 实现实体管理器 — 创建、销毁、ID 复用与 generation 防悬空。

**前置依赖**: Step 1

**交付物**:
- `src/ecs/entity-manager.ts`
- `src/ecs/types.ts` — EntityId 类型、常量
- `tests/ecs/entity-manager.test.ts`

**关键设计决策**:
- EntityId = u32: 高 16 位 generation，低 16 位 index
- 预分配容量（默认 65536），禁止动态扩容
- 空闲列表（freeList）复用已销毁实体的 index
- `isAlive(id)` 通过比对 generation 判断

**测试验证**:
```bash
npm test -- tests/ecs/entity-manager.test.ts
```

测试用例覆盖：
- 创建实体，ID 递增
- 销毁实体后，再创建复用相同 index，但 generation 不同
- `isAlive` 对已销毁实体返回 false
- `isAlive` 对 generation 不匹配的 ID 返回 false
- 容量耗尽时 `create()` 抛异常或返回 INVALID_ENTITY
- 重复销毁同一实体不崩溃
- 批量创建/销毁循环，验证 freeList 正确性

**完成标准**:
- [x] 所有单元测试通过
- [x] 创建 65536 个实体无错误
- [x] 销毁后复用验证 generation 递增

---

## Step 4 — ECS ComponentStorage

**目标**: 实现 SoA 布局的 Component 存储，支持注册、添加、移除、查询。

**前置依赖**: Step 3

**交付物**:
- `src/ecs/component-storage.ts` — 泛型 SoA 存储
- `src/ecs/component-registry.ts` — Component 类型注册表
- `src/ecs/archetype.ts` — Archetype 位掩码管理
- `tests/ecs/component-storage.test.ts`

**关键设计决策**:
- 每种 Component 用唯一 `componentId: number`（0-63，支持 64 种组件类型，用 BigInt64 位掩码）
- Component Schema 定义字段名和 TypedArray 类型：`{ posX: Float32Array, posY: Float32Array, ... }`
- Archetype 用位掩码表示实体拥有的 Component 集合
- `addComponent(entity, componentId)` — 设置位掩码，初始化 SoA 数据
- `removeComponent(entity, componentId)` — 清除位掩码
- `getStorage<T>(componentId)` — 返回对应 SoA 数组引用

**测试验证**:
```bash
npm test -- tests/ecs/component-storage.test.ts
```

测试用例覆盖：
- 注册 Transform Component，验证 SoA 数组已分配
- 添加 Component 到实体，写入数据，读回验证
- 移除 Component，验证位掩码清除
- 查询某实体的 Archetype 位掩码
- 多种 Component 组合：实体同时拥有 Transform + Sprite
- 对已销毁实体操作的行为
- 内存布局验证：连续实体的同字段数据在内存中连续

**完成标准**:
- [x] 所有单元测试通过
- [x] SoA 布局验证：posX[0], posX[1], posX[2]... 内存连续
- [x] 位掩码正确反映 Component 组合

---

## Step 5 — ECS System Scheduler

**目标**: 实现 System 注册、Phase 分组、Archetype Query 过滤与调度执行。

**前置依赖**: Step 4

**交付物**:
- `src/ecs/system.ts` — System 接口与 SystemPhase 枚举
- `src/ecs/query.ts` — ArchetypeQuery 构建器
- `src/ecs/scheduler.ts` — 按 Phase 排序执行 System
- `src/ecs/world.ts` — World 门面类（组合 EntityManager + Storage + Scheduler）
- `tests/ecs/system.test.ts`
- `tests/ecs/query.test.ts`

**关键设计决策**:
- System 是一个接口：`{ query, phase, update(world, dt) }`
- 6 个 Phase 按固定顺序执行：PreUpdate → Update → PostUpdate → PreRender → Render → PostRender
- 同一 Phase 内的 System 按注册顺序执行
- Query 构建器: `world.query().with(Transform, Sprite).without(Hidden).build()`
- Query 结果是匹配实体的迭代器（遍历所有实体，检查位掩码）

**测试验证**:
```bash
npm test -- tests/ecs/system.test.ts tests/ecs/query.test.ts
```

测试用例覆盖：
- 注册 3 个不同 Phase 的 System，验证执行顺序
- Query with(A, B) 只匹配同时拥有 A 和 B 的实体
- Query without(C) 排除拥有 C 的实体
- 实体动态添加/移除 Component 后，Query 结果即时更新
- `world.update(dt)` 调用所有 System，传入正确的 dt
- System 内部通过 Query 迭代实体并修改 Component 数据
- 空世界（无实体）调用 update 不崩溃

**完成标准**:
- [x] 所有单元测试通过
- [x] Phase 执行顺序严格正确
- [x] Query 过滤逻辑正确，增删 Component 后实时反映

---

## Step 6 — Platform Adapter 抽象层

**目标**: 定义平台抽象接口，实现 BrowserAdapter（用于开发测试），预留 WxAdapter 接口。

**前置依赖**: Step 1

**交付物**:
- `src/platform/platform-adapter.ts` — 抽象接口
- `src/platform/browser-adapter.ts` — 浏览器实现
- `src/platform/wx-adapter.ts` — 微信小游戏实现（接口骨架，方法抛 TODO）
- `test-visual/platform-test.html` — 浏览器测试页面

**关键设计决策**:
- 接口方法：`getCanvas()`, `getWebGLContext()`, `readFile()`, `request()`, `onMemoryWarning()`, `getPerformance()`
- BrowserAdapter: 使用标准 DOM API（document.createElement, fetch, canvas.getContext）
- WxAdapter: 使用 wx.* API（后续在微信开发者工具中测试）
- 通过工厂函数 `createAdapter()` 自动检测环境

**测试验证**:
```
浏览器打开 test-visual/platform-test.html，验证：
1. 页面显示一个 Canvas 元素
2. 控制台输出 "WebGL context created successfully"
3. 控制台输出 Canvas 尺寸信息
```

**完成标准**:
- [x] BrowserAdapter 能获取 Canvas 和 WebGL Context
- [x] 接口定义完整，WxAdapter 骨架编译通过
- [x] 浏览器测试页面能正常运行

---

## Step 7 — WebGL Device + 状态缓存

**目标**: 封装 WebGL Context，实现状态缓存（避免冗余 GL 调用），跑通最基本的渲染。

**前置依赖**: Step 6

**交付物**:
- `src/renderer/webgl-device.ts` — WebGL 上下文封装
- `src/renderer/gl-state-cache.ts` — GL 状态缓存
- `src/renderer/shader.ts` — Shader 编译/链接工具
- `test-visual/webgl-test.html` — 视觉测试页

**关键设计决策**:
- 优先 WebGL2，自动降级 WebGL1
- 状态缓存项：bound textures, blend state, depth/stencil, viewport, current program
- 每次 `setState()` 先 diff，相同状态跳过 GL 调用
- Shader 编译错误统一包装，输出可读错误信息

**测试验证**:
```
浏览器打开 test-visual/webgl-test.html，验证：
1. 整屏显示指定颜色（如：cornflower blue #6495ED）— 证明 clearColor 工作
2. 控制台输出 WebGL 版本信息
3. 控制台输出 GL 扩展支持列表
```

**完成标准**:
- [x] 浏览器中看到纯色画面
- [x] 状态缓存逻辑正确（可通过计数验证跳过的 GL 调用数）
- [x] Shader 编译/链接成功，语法错误能正确报错

---

## Step 8 — SpriteBatcher（2D 核心）

**目标**: 实现 2D 精灵批渲染器，能在屏幕上绘制纹理四边形。

**前置依赖**: Step 2（Mat4 投影矩阵）, Step 7

**交付物**:
- `src/renderer/sprite-batcher.ts` — 批渲染器
- `src/renderer/texture.ts` — 纹理加载/管理
- `src/renderer/default-shaders.ts` — 内置 sprite shader
- `test-visual/sprite-test.html` — 视觉测试页

**关键设计决策**:
- 预分配顶点缓冲：`MAX_SPRITES = 2048`，每精灵 4 顶点 × 5 属性（x,y,u,v,color）
- 索引缓冲预生成（0,1,2, 0,2,3 模式）
- Flush 触发条件：纹理切换 / Blend 变化 / 缓冲区满
- 使用 `gl.bufferSubData` 更新顶点数据（避免重新分配）
- Sprite 默认 shader：position + texcoord + vertex color

**测试验证**:
```
浏览器打开 test-visual/sprite-test.html，验证：
1. 屏幕上显示一个白色方块（纯色纹理，1x1 白像素）
2. 显示多个不同颜色的方块（顶点着色）
3. 显示一张加载的 PNG 纹理
4. 控制台输出 DrawCall 计数（验证批合并生效）
```

**完成标准**:
- [x] 能渲染纯色方块
- [x] 能渲染纹理精灵
- [x] 多个相同纹理精灵合并为 1 个 DrawCall
- [x] 纹理切换时正确 flush

---

## Step 9 — Bundle 格式（二进制资源包）

**目标**: 实现自定义二进制 Bundle 格式的写入和读取。

**前置依赖**: Step 1

**交付物**:
- `src/asset/bundle-format.ts` — 二进制格式常量与类型
- `src/asset/bundle-writer.ts` — 序列化（构建工具侧）
- `src/asset/bundle-reader.ts` — 反序列化（运行时侧）
- `src/asset/asset-manager.ts` — 资源管理器骨架
- `tests/asset/bundle.test.ts`

**关键设计决策**:
- Magic number: `0x57584745` ("WXGE")
- Header 32 bytes: magic + version + flags + asset_count + toc_offset + data_offset
- TOC 条目：asset_id (u32) + type (u8) + offset (u32) + size (u32) = 13 bytes/条目
- Asset 类型枚举：Texture=1, Audio=2, Scene=3, Animation=4, Shader=5
- Reader 先解析 Header + TOC（索引），按需读取 Data Section

**测试验证**:
```bash
npm test -- tests/asset/bundle.test.ts
```

测试用例覆盖：
- 创建 Bundle（含 3 个不同类型 asset），写入 ArrayBuffer
- 从 ArrayBuffer 读取，验证 Header 解析正确
- TOC 条目数量和类型匹配
- 每个 Asset 数据读出与原始数据 byte-by-byte 一致
- Magic number 错误时抛异常
- 版本号不匹配时的处理
- 空 Bundle（0 个 asset）的边界情况

**完成标准**:
- [x] 写入→读取 round-trip 完全一致
- [x] 错误格式检测正常工作
- [x] 所有单元测试通过

---

## Step 10 — 集成：ECS + 渲染跑通场景

**目标**: 将 ECS World 与渲染管线集成，在浏览器中跑通一个完整的小场景。

**前置依赖**: Step 5, Step 8

**交付物**:
- `src/ecs/built-in-systems/transform-system.ts` — 计算世界矩阵
- `src/ecs/built-in-systems/sprite-render-system.ts` — 收集可见精灵，提交给 Batcher
- `src/ecs/built-in-components.ts` — 内置 Component 定义（Transform, Sprite, Camera）
- `src/core/engine.ts` — Engine 主循环（requestAnimationFrame）
- `test-visual/integration-test.html` — 集成测试页

**关键设计决策**:
- Engine 主循环：`requestAnimationFrame` → 计算 dt → `world.update(dt)` → 渲染
- TransformSystem (PreRender phase)：遍历有 Transform 的实体，计算 world matrix
- SpriteRenderSystem (Render phase)：遍历有 Transform + Sprite 的实体，提交 draw 指令
- Camera Component 控制投影矩阵

**测试验证**:
```
浏览器打开 test-visual/integration-test.html，验证：
1. 屏幕上显示多个精灵
2. 精灵在移动（有一个简单的 MovementSystem 修改 Transform）
3. 帧率显示在左上角
4. 控制台无错误
```

**完成标准**:
- [x] ECS System 正确驱动渲染
- [x] 精灵位移动画流畅运行
- [x] 帧率稳定在 60fps（桌面浏览器）
- [x] DrawCall 数量合理（相同纹理合批）

---

## 步骤依赖关系

```
Step 1 (脚手架)
  ├── Step 2 (Math) ──────────────────┐
  ├── Step 3 (EntityManager)          │
  │     └── Step 4 (ComponentStorage) │
  │           └── Step 5 (Scheduler)──┼── Step 10 (集成)
  ├── Step 6 (Platform Adapter)       │
  │     └── Step 7 (WebGL Device)     │
  │           └── Step 8 (Batcher) ───┘
  └── Step 9 (Bundle 格式)
```

Step 2/3/6/9 可以并行开发，互不依赖。
