# Math 库 API 规格

> **职责**: 提供零 GC 的向量/矩阵运算，所有操作写入 `out` 参数，内部数据用 `Float32Array` 存储。

---

## 常量

```typescript
const EPSILON: number = 1e-6;
const DEG_TO_RAD: number = Math.PI / 180;
const RAD_TO_DEG: number = 180 / Math.PI;
```

---

## Vec2

**存储**: `Float32Array(2)` — `[x, y]`

```typescript
class Vec2 {
  readonly data: Float32Array;

  constructor();                          // 从池分配，初始化为 [0, 0]
  
  get x(): number;
  set x(v: number);
  get y(): number;
  set y(v: number);

  static set(out: Vec2, x: number, y: number): void;
  static copy(a: Vec2, out: Vec2): void;
  static add(a: Vec2, b: Vec2, out: Vec2): void;
  static sub(a: Vec2, b: Vec2, out: Vec2): void;
  static scale(a: Vec2, s: number, out: Vec2): void;
  static mul(a: Vec2, b: Vec2, out: Vec2): void;
  static dot(a: Vec2, b: Vec2): number;
  static cross(a: Vec2, b: Vec2): number;
  static length(a: Vec2): number;
  static lengthSq(a: Vec2): number;
  static distance(a: Vec2, b: Vec2): number;
  static distanceSq(a: Vec2, b: Vec2): number;
  static normalize(a: Vec2, out: Vec2): void;
  static lerp(a: Vec2, b: Vec2, t: number, out: Vec2): void;
  static negate(a: Vec2, out: Vec2): void;
  static equals(a: Vec2, b: Vec2): boolean;
  static exactEquals(a: Vec2, b: Vec2): boolean;
}
```

---

## Vec3

**存储**: `Float32Array(3)` — `[x, y, z]`

```typescript
class Vec3 {
  readonly data: Float32Array;

  constructor();

  get x(): number; set x(v: number);
  get y(): number; set y(v: number);
  get z(): number; set z(v: number);

  static set(out: Vec3, x: number, y: number, z: number): void;
  static copy(a: Vec3, out: Vec3): void;
  static add(a: Vec3, b: Vec3, out: Vec3): void;
  static sub(a: Vec3, b: Vec3, out: Vec3): void;
  static scale(a: Vec3, s: number, out: Vec3): void;
  static mul(a: Vec3, b: Vec3, out: Vec3): void;
  static dot(a: Vec3, b: Vec3): number;
  static cross(a: Vec3, b: Vec3, out: Vec3): void;
  static length(a: Vec3): number;
  static lengthSq(a: Vec3): number;
  static distance(a: Vec3, b: Vec3): number;
  static distanceSq(a: Vec3, b: Vec3): number;
  static normalize(a: Vec3, out: Vec3): void;
  static lerp(a: Vec3, b: Vec3, t: number, out: Vec3): void;
  static negate(a: Vec3, out: Vec3): void;
  static transformMat4(a: Vec3, m: Mat4, out: Vec3): void;
  static equals(a: Vec3, b: Vec3): boolean;
  static exactEquals(a: Vec3, b: Vec3): boolean;
}
```

---

## Mat4

**存储**: `Float32Array(16)` — column-major 排列

```
内存布局 (column-major):
data[0]  = m00  data[4]  = m01  data[8]  = m02  data[12] = m03
data[1]  = m10  data[5]  = m11  data[9]  = m12  data[13] = m13
data[2]  = m20  data[6]  = m21  data[10] = m22  data[14] = m23
data[3]  = m30  data[7]  = m31  data[11] = m32  data[15] = m33
```

```typescript
class Mat4 {
  readonly data: Float32Array;
  constructor();

  static identity(out: Mat4): void;
  static copy(a: Mat4, out: Mat4): void;
  static multiply(a: Mat4, b: Mat4, out: Mat4): void;
  static invert(a: Mat4, out: Mat4): boolean;
  static transpose(a: Mat4, out: Mat4): void;
  static translate(m: Mat4, v: Vec3, out: Mat4): void;
  static rotate(m: Mat4, rad: number, axis: Vec3, out: Mat4): void;
  static rotateX(m: Mat4, rad: number, out: Mat4): void;
  static rotateY(m: Mat4, rad: number, out: Mat4): void;
  static rotateZ(m: Mat4, rad: number, out: Mat4): void;
  static scale(m: Mat4, v: Vec3, out: Mat4): void;
  static perspective(fovY: number, aspect: number, near: number, far: number, out: Mat4): void;
  static ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, out: Mat4): void;
  static lookAt(eye: Vec3, center: Vec3, up: Vec3, out: Mat4): void;
  static getTranslation(m: Mat4, out: Vec3): void;
  static getScaling(m: Mat4, out: Vec3): void;
  static equals(a: Mat4, b: Mat4): boolean;
  static exactEquals(a: Mat4, b: Mat4): boolean;
  static determinant(a: Mat4): number;
}
```

---

## MathPool — 临时对象池

```typescript
class MathPool {
  constructor(config: { vec2Count: number; vec3Count: number; mat4Count: number });
  getVec2(): Vec2;
  getVec3(): Vec3;
  getMat4(): Mat4;
  releaseAll(): void;
}
```

**约束**:
- `get*()` 内部用游标递增，不做 GC-visible 分配
- `releaseAll()` 仅重置游标为 0
- 池耗尽时抛 `Error('MathPool exhausted: vec3')`
- 池中对象不得跨帧持有

---

## 关键约束与不变量

1. **零 GC**: 所有运算函数禁止 `new`、禁止创建临时数组/对象
2. **out 参数可与输入重叠**: `Vec3.add(a, b, a)` 必须正确（a += b）
3. **Float32 精度**: `equals()` 使用 EPSILON 容差
4. **Column-major**: Mat4 与 WebGL `uniformMatrix4fv` 直接兼容
5. **弧度制**: 所有角度参数为弧度

---

## 使用示例

```typescript
const pool = new MathPool({ vec2Count: 32, vec3Count: 32, mat4Count: 8 });

function update() {
  const pos = pool.getVec3();
  const dir = pool.getVec3();
  const mvp = pool.getMat4();

  Vec3.set(pos, 1, 2, 3);
  Vec3.set(dir, 0, 0, -1);
  Vec3.normalize(dir, dir);
  Vec3.scale(dir, 5.0, dir);
  Vec3.add(pos, dir, pos);

  Mat4.identity(mvp);
  Mat4.translate(mvp, pos, mvp);
  gl.uniformMatrix4fv(loc, false, mvp.data);

  pool.releaseAll();
}
```

---

## 依赖关系

- **无外部依赖**
- 被以下模块使用：`ecs/built-in-systems/transform-system`、`renderer/sprite-batcher`、`renderer/webgl-device`
