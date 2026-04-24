# Platform Adapter API 规格

> **职责**: 抽象平台差异，提供统一的 Canvas、文件读取、网络请求等接口。开发用 BrowserAdapter，上线用 WxAdapter。

---

## PlatformAdapter 接口

```typescript
interface PlatformAdapter {
  readonly name: 'browser' | 'wx';
  getCanvas(): HTMLCanvasElement | WxCanvas;
  getWebGLContext(canvas, attributes?: WebGLContextAttributes): WebGLRenderingContext | WebGL2RenderingContext;
  resizeCanvas(canvas, width: number, height: number): void;
  getScreenSize(): { width: number; height: number };
  getDevicePixelRatio(): number;
  readFile(path: string): Promise<ArrayBuffer>;
  readTextFile(path: string): Promise<string>;
  loadImage(path: string): Promise<HTMLImageElement | WxImage>;
  request(options: RequestOptions): Promise<ResponseData>;
  now(): number;
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(id: number): void;
  onMemoryWarning(callback: (level: 'low' | 'critical') => void): void;
  getPerformanceInfo(): PerformanceInfo;
}
```

## 辅助类型

```typescript
interface RequestOptions { url: string; method?: string; headers?: Record<string,string>; body?: string|ArrayBuffer; responseType?: string; }
interface ResponseData { status: number; data: any; headers: Record<string,string>; }
interface PerformanceInfo { usedJSHeapSize: number; jsHeapSizeLimit: number; }
```

## 工厂函数

```typescript
function createPlatformAdapter(): PlatformAdapter {
  if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') return new WxAdapter();
  return new BrowserAdapter();
}
```

## 关键约束

1. 所有平台差异封装在 Adapter 内
2. Canvas 单例
3. 所有文件/图片加载返回 Promise
4. BrowserAdapter 优先开发，WxAdapter 最后集成
5. 引擎核心不直接引用 document/window/wx

## 依赖关系

- **无外部依赖**
- 被 `renderer/webgl-device`、`asset/asset-manager`、`core/engine` 使用
