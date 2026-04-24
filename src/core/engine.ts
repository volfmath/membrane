import type { PlatformAdapter } from '../platform/types';
import { createPlatformAdapter } from '../platform/create-platform-adapter';
import { World } from '../ecs/world';

export type MembranePlugin = (engine: Engine) => void;

export interface EngineConfig {
  canvas?: unknown;
  maxEntities?: number;
  targetFPS?: number;
  platform?: PlatformAdapter;
}

export class Engine {
  readonly platform: PlatformAdapter;
  readonly world: World;

  private plugins: MembranePlugin[] = [];
  private pluginApplied = false;
  private running = false;
  private lastTime = 0;
  private _frameCount = 0;
  private _fps = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private fpsLastUpdate = 0;
  private rafId = 0;
  private readonly targetDt: number;

  constructor(config?: EngineConfig) {
    this.platform = config?.platform ?? createPlatformAdapter();
    this.world = new World({ maxEntities: config?.maxEntities ?? 65536 });
    this.targetDt = 1 / (config?.targetFPS ?? 60);
  }

  get frameCount(): number { return this._frameCount; }
  get fps(): number { return this._fps; }
  get isRunning(): boolean { return this.running; }

  use(plugin: MembranePlugin): this {
    if (this.pluginApplied) {
      throw new Error('Plugins must be registered before start()');
    }
    this.plugins.push(plugin);
    return this;
  }

  start(): void {
    if (this.running) return;

    if (!this.pluginApplied) {
      for (const plugin of this.plugins) {
        plugin(this);
      }
      this.pluginApplied = true;
    }

    this.running = true;
    this.lastTime = this.platform.now();
    this.fpsLastUpdate = this.lastTime;
    this.fpsAccum = 0;
    this.fpsFrames = 0;

    this.rafId = this.platform.requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.platform.cancelAnimationFrame(this.rafId);
  }

  tick(dt: number): void {
    if (!this.pluginApplied) {
      for (const plugin of this.plugins) {
        plugin(this);
      }
      this.pluginApplied = true;
    }

    this.world.update(dt);
    this._frameCount++;
  }

  private loop(timestamp: number): void {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.world.update(dt);
    this._frameCount++;

    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 1.0) {
      this._fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.rafId = this.platform.requestAnimationFrame((t) => this.loop(t));
  }
}
