import type { PlatformAdapter, RequestOptions, ResponseData, PerformanceInfo } from './types';

declare const wx: {
  createCanvas(): unknown;
  getSystemInfoSync(): { screenWidth: number; screenHeight: number; pixelRatio: number };
  getFileSystemManager(): {
    readFile(opts: { filePath: string; success(res: { data: ArrayBuffer }): void; fail(err: { errMsg: string }): void }): void;
    readFileSync(path: string, encoding?: string): string | ArrayBuffer;
  };
  createImage(): unknown;
  request(opts: unknown): void;
  getPerformance(): { now(): number };
  requestAnimationFrame(cb: (time: number) => void): number;
  cancelAnimationFrame(id: number): void;
  onMemoryWarning(cb: (res: { level: number }) => void): void;
};

export class WxAdapter implements PlatformAdapter {
  readonly name = 'wx' as const;
  private _canvas: unknown = null;
  private perf = typeof wx !== 'undefined' && typeof wx.getPerformance === 'function' ? wx.getPerformance() : null;

  getCanvas(): unknown {
    if (!this._canvas) {
      this._canvas = wx.createCanvas();
    }
    return this._canvas;
  }

  getWebGLContext(canvas: unknown, attributes?: WebGLContextAttributes): unknown {
    const c = canvas as { getContext(type: string, attrs?: WebGLContextAttributes): unknown };
    const gl = c.getContext('webgl2', attributes) ?? c.getContext('webgl', attributes);
    if (!gl) throw new Error('WebGL not supported on wx');
    return gl;
  }

  resizeCanvas(_canvas: unknown, _width: number, _height: number): void {
    // wx canvas auto-sizes to screen
  }

  getScreenSize(): { width: number; height: number } {
    const info = wx.getSystemInfoSync();
    return { width: info.screenWidth, height: info.screenHeight };
  }

  getDevicePixelRatio(): number {
    return wx.getSystemInfoSync().pixelRatio || 1;
  }

  readFile(path: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: path,
        success: (res) => resolve(res.data),
        fail: (err) => reject(new Error(`readFile failed: ${err.errMsg}`)),
      });
    });
  }

  readTextFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const data = wx.getFileSystemManager().readFileSync(path, 'utf8');
        resolve(data as string);
      } catch (e) {
        reject(e);
      }
    });
  }

  loadImage(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const img = wx.createImage() as { src: string; onload: (() => void) | null; onerror: ((e: unknown) => void) | null };
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`loadImage failed: ${path} ${e}`));
      img.src = path;
    });
  }

  request(options: RequestOptions): Promise<ResponseData> {
    return new Promise((resolve, reject) => {
      wx.request({
        url: options.url,
        method: options.method ?? 'GET',
        header: options.headers,
        data: options.body,
        responseType: options.responseType ?? 'text',
        success: (res: { statusCode: number; data: unknown; header: Record<string, string> }) => {
          resolve({ status: res.statusCode, data: res.data, headers: res.header });
        },
        fail: (err: { errMsg: string }) => reject(new Error(err.errMsg)),
      } as unknown);
    });
  }

  now(): number {
    return this.perf ? this.perf.now() : Date.now();
  }

  requestAnimationFrame(callback: (time: number) => void): number {
    return wx.requestAnimationFrame(callback);
  }

  cancelAnimationFrame(id: number): void {
    wx.cancelAnimationFrame(id);
  }

  onMemoryWarning(callback: (level: 'low' | 'critical') => void): void {
    wx.onMemoryWarning((res) => {
      callback(res.level >= 10 ? 'critical' : 'low');
    });
  }

  getPerformanceInfo(): PerformanceInfo {
    return { usedJSHeapSize: 0, jsHeapSizeLimit: 0 };
  }
}
