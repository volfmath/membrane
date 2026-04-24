import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../src/core/engine';
import type { MembranePlugin } from '../../src/core/engine';
import type { PlatformAdapter } from '../../src/platform/types';
import { SystemPhase } from '../../src/ecs/system';
import type { System } from '../../src/ecs/system';
import type { World } from '../../src/ecs/world';

function createMockPlatform(): PlatformAdapter {
  let rafCallback: ((time: number) => void) | null = null;
  let currentTime = 0;

  return {
    name: 'browser' as const,
    getCanvas: () => null,
    getWebGLContext: () => null,
    resizeCanvas: () => {},
    getScreenSize: () => ({ width: 800, height: 600 }),
    getDevicePixelRatio: () => 1,
    readFile: async () => new ArrayBuffer(0),
    readTextFile: async () => '',
    loadImage: async () => null,
    request: async () => ({ status: 200, data: null, headers: {} }),
    now: () => currentTime,
    requestAnimationFrame: (cb: (time: number) => void) => {
      rafCallback = cb;
      return 1;
    },
    cancelAnimationFrame: () => { rafCallback = null; },
    onMemoryWarning: () => {},
    getPerformanceInfo: () => ({ usedJSHeapSize: 0, jsHeapSizeLimit: 0 }),
    _setTime(t: number) { currentTime = t; },
    _fireRaf() {
      if (rafCallback) {
        const cb = rafCallback;
        rafCallback = null;
        cb(currentTime);
      }
    },
  } as PlatformAdapter & { _setTime(t: number): void; _fireRaf(): void };
}

type MockPlatform = ReturnType<typeof createMockPlatform> & {
  _setTime(t: number): void;
  _fireRaf(): void;
};

describe('Engine', () => {
  it('creates with default config', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    expect(engine.frameCount).toBe(0);
    expect(engine.fps).toBe(0);
    expect(engine.isRunning).toBe(false);
  });

  it('tick() advances frameCount', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    engine.tick(1 / 60);
    expect(engine.frameCount).toBe(1);
    engine.tick(1 / 60);
    expect(engine.frameCount).toBe(2);
  });

  it('tick() calls world.update', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    const updateCalls: number[] = [];

    const system: System = {
      name: 'tracker',
      phase: SystemPhase.Update,
      query: null,
      enabled: true,
      update(_w: World, dt: number) { updateCalls.push(dt); },
    };
    engine.world.addSystem(system);

    engine.tick(0.016);
    engine.tick(0.032);
    expect(updateCalls).toEqual([0.016, 0.032]);
  });

  it('start() and stop() control running state', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    expect(engine.isRunning).toBe(false);
    engine.start();
    expect(engine.isRunning).toBe(true);
    engine.stop();
    expect(engine.isRunning).toBe(false);
  });

  it('start() is idempotent', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    engine.start();
    engine.start();
    expect(engine.isRunning).toBe(true);
    engine.stop();
  });

  it('loop advances frameCount via raf', () => {
    const mock = createMockPlatform() as MockPlatform;
    const engine = new Engine({ platform: mock });

    mock._setTime(0);
    engine.start();

    mock._setTime(16);
    mock._fireRaf();
    expect(engine.frameCount).toBe(1);

    mock._setTime(32);
    mock._fireRaf();
    expect(engine.frameCount).toBe(2);

    engine.stop();
  });

  it('loop clamps dt to 50ms', () => {
    const mock = createMockPlatform() as MockPlatform;
    const engine = new Engine({ platform: mock });
    const dtValues: number[] = [];

    engine.world.addSystem({
      name: 'dtTracker',
      phase: SystemPhase.Update,
      query: null,
      enabled: true,
      update(_w: World, dt: number) { dtValues.push(dt); },
    });

    mock._setTime(0);
    engine.start();

    mock._setTime(500);
    mock._fireRaf();
    expect(dtValues[0]).toBeCloseTo(0.05, 5);

    engine.stop();
  });
});

describe('Plugin system', () => {
  it('use() returns this for chaining', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    const plugin: MembranePlugin = () => {};
    const result = engine.use(plugin);
    expect(result).toBe(engine);
  });

  it('plugins execute in registration order on start', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    const order: string[] = [];

    engine
      .use(() => order.push('A'))
      .use(() => order.push('B'))
      .use(() => order.push('C'));

    engine.start();
    expect(order).toEqual(['A', 'B', 'C']);
    engine.stop();
  });

  it('plugins execute in order on first tick', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    const order: string[] = [];

    engine.use(() => order.push('A')).use(() => order.push('B'));
    engine.tick(0.016);
    expect(order).toEqual(['A', 'B']);
  });

  it('plugins only execute once', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    let count = 0;

    engine.use(() => count++);
    engine.tick(0.016);
    engine.tick(0.016);
    expect(count).toBe(1);
  });

  it('plugins receive the engine instance', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    let receivedEngine: Engine | null = null;

    engine.use((e) => { receivedEngine = e; });
    engine.start();
    expect(receivedEngine).toBe(engine);
    engine.stop();
  });

  it('plugin can register components and systems', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform, maxEntities: 256 });

    const velocityPlugin: MembranePlugin = (e) => {
      e.world.registry.register('Velocity', {
        vx: { type: Float32Array, default: 0 },
        vy: { type: Float32Array, default: 0 },
      });
    };

    engine.use(velocityPlugin);
    engine.tick(0.016);

    const id = engine.world.registry.getId('Velocity');
    expect(id).not.toBe(-1);
  });

  it('throws if use() called after start()', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    engine.start();
    expect(() => engine.use(() => {})).toThrow('Plugins must be registered before start()');
    engine.stop();
  });

  it('throws if use() called after tick()', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    engine.tick(0.016);
    expect(() => engine.use(() => {})).toThrow('Plugins must be registered before start()');
  });
});

describe('ComponentRegistry.getId', () => {
  it('returns id for registered component', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });

    const id = engine.world.registry.register('Position', {
      x: { type: Float32Array },
      y: { type: Float32Array },
    });

    expect(engine.world.registry.getId('Position')).toBe(id);
  });

  it('returns -1 for unknown component', () => {
    const platform = createMockPlatform();
    const engine = new Engine({ platform });
    expect(engine.world.registry.getId('NonExistent')).toBe(-1);
  });
});
