# Asset Pipeline API 规格

> **职责**: 定义自定义二进制 Bundle 格式，提供写入（构建工具侧）和读取（运行时侧）能力。

---

## Bundle 二进制格式

```
Header (32 bytes): magic(u32 0x57584745) + version(u16) + flags(u16) + assetCount(u32) + tocOffset(u32) + dataOffset(u32) + reserved(u32×3)
TOC (13 bytes × N): assetId(u32) + assetType(u8) + offset(u32) + size(u32)
Data Section: 原始 asset 数据
```

## AssetType 枚举

```typescript
enum AssetType { Texture=1, Audio=2, Scene=3, Animation=4, Shader=5, Binary=6, JSON=7 }
```

## BundleWriter（构建工具侧）

```typescript
class BundleWriter {
  constructor();
  addAsset(assetId: number, type: AssetType, data: ArrayBuffer | Uint8Array): void;
  serialize(): ArrayBuffer;
  readonly assetCount: number;
}
```

## BundleReader（运行时侧）

```typescript
class BundleReader {
  constructor(buffer: ArrayBuffer);   // 解析 Header + TOC
  readonly header: BundleHeader;
  readonly entries: ReadonlyArray<TocEntry>;
  getAssetData(assetId: number): Uint8Array;   // 零拷贝视图
  getEntry(assetId: number): TocEntry | null;
  getAssetIdsByType(type: AssetType): number[];
  hasAsset(assetId: number): boolean;
}
```

## AssetManager

```typescript
class AssetManager {
  constructor(platform: PlatformAdapter);
  loadBundle(path: string): Promise<BundleReader>;
  loadTexture(bundle: BundleReader, assetId: number, device: WebGLDevice): Promise<WebGLTexture>;
  unloadBundle(bundle: BundleReader): void;
  getLoadedBundle(path: string): BundleReader | null;
}
```

## 关键约束

1. Magic 校验: 必须为 0x57584745
2. 版本兼容: version > 1 时抛错
3. 零拷贝读取: getAssetData 返回 Uint8Array 视图
4. Little-Endian 字节序
5. TOC 内部用 Map 加速查找

## 依赖关系

- **依赖**: `platform/platform-adapter`
- 被 `core/engine`、`renderer/texture`、`audio/audio-manager` 使用
