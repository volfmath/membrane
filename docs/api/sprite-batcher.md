# SpriteBatcher API 规格

> **职责**: 2D 精灵批渲染器 — 将多个精灵合并为最少的 DrawCall 提交给 WebGL。

---

## 顶点格式

每精灵 4 顶点 × 5 float 属性：`[posX, posY, u, v, color(u32)]`，每顶点 20 bytes。
索引模式：`0,1,2, 0,2,3`（两个三角形组成四边形）。

## 常量

```typescript
const MAX_SPRITES_PER_BATCH = 2048;
const VERTICES_PER_SPRITE = 4;
const INDICES_PER_SPRITE = 6;
const FLOATS_PER_VERTEX = 5;
```

## SpriteBatcher

```typescript
class SpriteBatcher {
  constructor(device: WebGLDevice);
  begin(projectionMatrix: Mat4): void;
  draw(texture: WebGLTexture, x: number, y: number, width: number, height: number,
       rotation?: number, u0?: number, v0?: number, u1?: number, v1?: number, color?: number): void;
  end(): void;
  readonly drawCallCount: number;
  readonly spriteCount: number;
}
```

## Flush 策略

触发条件：纹理切换 → Blend 变化 → 缓冲区满（2048 精灵）。
Flush = `bufferSubData` + `drawElements`。

## 内置 Shader

Vertex: `aPosition(vec2) + aTexCoord(vec2) + aColor(vec4)` → `uProjection * position`
Fragment: `texture2D(uTexture, vTexCoord) * vColor`

## 关键约束

1. 必须在 begin/end 之间调用 draw
2. 零 GC：顶点数据写入预分配 Float32Array
3. 索引缓冲在构造时预生成
4. Color 以 ABGR u32 pack

## 使用示例

```typescript
const batcher = new SpriteBatcher(device);
batcher.begin(projMatrix);
batcher.draw(heroTex, 400, 300, 64, 64);
for (let i = 0; i < 100; i++) batcher.draw(heroTex, i * 8, 200, 32, 32);
batcher.end();
// drawCallCount = 1 (同纹理合批)
```

## 依赖关系

- **依赖**: `renderer/webgl-device`、`math/mat4`
- 被 `ecs/built-in-systems/sprite-render-system`、`core/engine` 使用
