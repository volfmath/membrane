export interface RequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
  responseType?: string;
}

export interface ResponseData {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

export interface PerformanceInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PlatformAdapter {
  readonly name: 'browser' | 'wx';
  getCanvas(): unknown;
  getWebGLContext(canvas: unknown, attributes?: WebGLContextAttributes): unknown;
  resizeCanvas(canvas: unknown, width: number, height: number): void;
  getScreenSize(): { width: number; height: number };
  getDevicePixelRatio(): number;
  readFile(path: string): Promise<ArrayBuffer>;
  readTextFile(path: string): Promise<string>;
  loadImage(path: string): Promise<unknown>;
  request(options: RequestOptions): Promise<ResponseData>;
  now(): number;
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(id: number): void;
  onMemoryWarning(callback: (level: 'low' | 'critical') => void): void;
  getPerformanceInfo(): PerformanceInfo;
}
