import type { PlatformAdapter, RequestOptions, ResponseData, PerformanceInfo } from './types';

export class BrowserAdapter implements PlatformAdapter {
  readonly name = 'browser' as const;
  private _canvas: HTMLCanvasElement | null = null;
  private memoryWarningCallbacks: Array<(level: 'low' | 'critical') => void> = [];

  getCanvas(): HTMLCanvasElement {
    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
      document.body.appendChild(this._canvas);
    }
    return this._canvas;
  }

  getWebGLContext(canvas: HTMLCanvasElement, attributes?: WebGLContextAttributes): WebGLRenderingContext | WebGL2RenderingContext {
    const gl = canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
    if (!gl) throw new Error('WebGL not supported');
    return gl as WebGLRenderingContext | WebGL2RenderingContext;
  }

  resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
    canvas.width = width;
    canvas.height = height;
  }

  getScreenSize(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  getDevicePixelRatio(): number {
    return window.devicePixelRatio || 1;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`readFile failed: ${resp.status} ${path}`);
    return resp.arrayBuffer();
  }

  async readTextFile(path: string): Promise<string> {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`readTextFile failed: ${resp.status} ${path}`);
    return resp.text();
  }

  async loadImage(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`loadImage failed: ${path} ${e}`));
      img.src = path;
    });
  }

  async request(options: RequestOptions): Promise<ResponseData> {
    const resp = await fetch(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
    });
    const data = options.responseType === 'arraybuffer'
      ? await resp.arrayBuffer()
      : await resp.json();
    const headers: Record<string, string> = {};
    resp.headers.forEach((v, k) => { headers[k] = v; });
    return { status: resp.status, data, headers };
  }

  now(): number {
    return performance.now();
  }

  requestAnimationFrame(callback: (time: number) => void): number {
    return window.requestAnimationFrame(callback);
  }

  cancelAnimationFrame(id: number): void {
    window.cancelAnimationFrame(id);
  }

  onMemoryWarning(callback: (level: 'low' | 'critical') => void): void {
    this.memoryWarningCallbacks.push(callback);
  }

  getPerformanceInfo(): PerformanceInfo {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    return {
      usedJSHeapSize: mem?.usedJSHeapSize ?? 0,
      jsHeapSizeLimit: mem?.jsHeapSizeLimit ?? 0,
    };
  }
}
