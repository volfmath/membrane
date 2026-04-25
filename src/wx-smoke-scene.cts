declare const module: any;
declare const require: any;
declare const wx: any;
declare const globalThis: any;

import { WebGLDevice } from './renderer/webgl-device';
import { SpriteBatcher } from './renderer/sprite-batcher';
import { World } from './ecs/world';
import { EntityManager } from './ecs/entity-manager';
import { Mat4 } from './math/mat4';
import { loadSceneData } from './canonical/scene-loader';
import type { SceneLoaderConfig } from './canonical/scene-loader';
import type { CompiledSceneData } from './canonical/loader-types';
import type { EntityId } from './ecs/types';

(function smokeScene(): void {
  var TAG = '[Membrane][wx-smoke-scene]';

  function log(...args: any[]): void {
    args.unshift(TAG);
    console.info.apply(console, args);
  }

  function warn(...args: any[]): void {
    args.unshift(TAG);
    console.warn.apply(console, args);
  }

  var state: any = {
    caseId: 'wx-smoke-scene',
    startedAt: Date.now(),
    frameCount: 0,
    hasWx: typeof wx !== 'undefined',
    summary: 'booting',
  };

  if (state.hasWx) {
    if (typeof wx.onError === 'function') {
      wx.onError(function(msg: string) { console.error(TAG, 'wx.onError', msg); });
    }
    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection(function(e: any) { console.error(TAG, 'unhandledRejection', e?.reason ?? e); });
    }
  }

  // ---- Component schemas ----
  var TRANSFORM_SCHEMA = {
    x: { type: Float32Array },
    y: { type: Float32Array },
    rotation: { type: Float32Array },
    scaleX: { type: Float32Array, default: 1 },
    scaleY: { type: Float32Array, default: 1 },
  };

  var SPRITE_SCHEMA = {
    order: { type: Int32Array },
    flipX: { type: Uint8Array },
    flipY: { type: Uint8Array },
    visible: { type: Uint8Array, default: 1 },
  };

  var CAMERA_SCHEMA = {
    size: { type: Float32Array, default: 320 },
    near: { type: Float32Array, default: 1 },
    far: { type: Float32Array, default: 2000 },
  };

  var LOADER_CONFIG: SceneLoaderConfig = {
    componentFieldMap: new Map([
      ['Transform', ['x', 'y', 'rotation', 'scaleX', 'scaleY']],
      ['Sprite', ['order', 'flipX', 'flipY', 'visible']],
      ['Camera', ['size', 'near', 'far']],
    ]),
  };

  // ---- Canvas ----
  var canvas: any = null;
  var canvasWidth = 360;
  var canvasHeight = 640;
  var dpr = 1;

  function setupCanvas(): boolean {
    if (!state.hasWx || typeof wx.createCanvas !== 'function') return false;
    try {
      canvas = wx.createCanvas();
      if (!canvas) return false;
      canvasWidth = canvas.width || 360;
      canvasHeight = canvas.height || 640;
      var sysInfo = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null;
      if (sysInfo) {
        dpr = sysInfo.pixelRatio || 1;
        state.deviceLabel = [sysInfo.brand, sysInfo.model].filter(Boolean).join(' ');
      }
      log('canvas', canvasWidth + 'x' + canvasHeight, 'dpr=' + dpr);
      return true;
    } catch (e: any) {
      warn('canvas failed', e?.message ?? e);
      return false;
    }
  }

  // ---- Color helpers ----
  function packABGR(r: number, g: number, b: number, a: number): number {
    return (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }

  function hslToABGR(h: number, s: number, l: number): number {
    h = h % 360;
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return packABGR(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
      255
    );
  }

  // ---- Runtime ----
  var device: WebGLDevice;
  var batcher: SpriteBatcher;
  var world: World;
  var whiteTexture: WebGLTexture;
  var projMatrix: Mat4;

  var transformId: number;
  var spriteId: number;
  var cameraId: number;

  var loadedEntityIds: EntityId[] = [];
  var loadedSceneId = '';
  var currentSceneIndex = 0;

  // Scene fixture data — loaded from file or embedded
  var fixtureScenes: CompiledSceneData[] = [];

  function loadFixture(): boolean {
    try {
      // Try to require the fixture (works in CJS bundle)
      var fixture = require('../assets/scene-data');
      if (fixture && fixture.scenes) {
        fixtureScenes = fixture.scenes;
        log('loaded fixture:', fixtureScenes.length, 'scenes');
        for (var i = 0; i < fixtureScenes.length; i++) {
          log('  scene:', fixtureScenes[i].sceneId, 'entities:', fixtureScenes[i].entities.length);
        }
        return true;
      }
      warn('fixture has no scenes');
      return false;
    } catch (e: any) {
      warn('failed to load fixture:', e?.message ?? e);
      return false;
    }
  }

  function setupRuntime(): boolean {
    try {
      device = new WebGLDevice(canvas, { alpha: false, antialias: false });
      log('WebGLDevice v' + device.capabilities.webglVersion);

      batcher = new SpriteBatcher(device);

      world = new World({ maxEntities: 4096 });
      world.registry.register('Transform', TRANSFORM_SCHEMA);
      world.registry.register('Sprite', SPRITE_SCHEMA);
      world.registry.register('Camera', CAMERA_SCHEMA);
      transformId = world.registry.getId('Transform');
      spriteId = world.registry.getId('Sprite');
      cameraId = world.registry.getId('Camera');

      var gl = device.gl;
      whiteTexture = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      projMatrix = new Mat4();
      Mat4.ortho(0, canvasWidth, canvasHeight, 0, -1, 1, projMatrix);

      return true;
    } catch (e: any) {
      warn('runtime setup failed:', e?.message ?? e);
      return false;
    }
  }

  function loadCurrentScene(): void {
    // Reset world
    world.reset();
    loadedEntityIds = [];

    if (fixtureScenes.length === 0) return;

    var sceneData = fixtureScenes[currentSceneIndex % fixtureScenes.length];
    loadedSceneId = sceneData.sceneId;

    var result = loadSceneData(sceneData, world, LOADER_CONFIG);
    loadedEntityIds = result.entityIds;

    log('loaded scene:', loadedSceneId, 'entities:', result.entityCount);

    // Count component types
    var spriteCount = 0;
    var cameraCount = 0;
    for (var eid of loadedEntityIds) {
      if (world.hasComponent(eid, spriteId)) spriteCount++;
      if (world.hasComponent(eid, cameraId)) cameraCount++;
    }
    log('  sprites:', spriteCount, 'cameras:', cameraCount);
  }

  // ---- Touch: tap to switch scene ----
  function setupTouch(): void {
    if (!state.hasWx || typeof wx.onTouchStart !== 'function') return;
    wx.onTouchStart(function() {
      currentSceneIndex++;
      loadCurrentScene();
      log('switched to scene', currentSceneIndex % fixtureScenes.length, ':', loadedSceneId);
    });
  }

  // ---- Render ----
  var fpsAccum = 0;
  var fpsFrames = 0;
  var displayFps = 0;
  var lastTime = 0;

  function render(): void {
    device.setViewport(0, 0, canvasWidth, canvasHeight);
    device.clear(0.06, 0.07, 0.10, 1.0);

    batcher.begin(projMatrix);

    var xField = world.storage.getField(transformId, 'x');
    var yField = world.storage.getField(transformId, 'y');
    var sxField = world.storage.getField(transformId, 'scaleX');
    var syField = world.storage.getField(transformId, 'scaleY');
    var orderField = world.storage.getField(spriteId, 'order');

    // Map Cocos coordinates to screen:
    // Cocos origin is typically bottom-left, we use top-left
    // Apply simple scale and offset to fit entities on screen
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < loadedEntityIds.length; i++) {
      var idx = EntityManager.getIndex(loadedEntityIds[i]);
      var ex = xField[idx], ey = yField[idx];
      if (ex < minX) minX = ex;
      if (ex > maxX) maxX = ex;
      if (ey < minY) minY = ey;
      if (ey > maxY) maxY = ey;
    }

    var rangeX = maxX - minX || 1;
    var rangeY = maxY - minY || 1;
    var padding = 40;
    var viewW = canvasWidth - padding * 2;
    var viewH = canvasHeight - padding * 2 - 60; // leave room for HUD
    var scale = Math.min(viewW / rangeX, viewH / rangeY) * 0.9;

    for (var i = 0; i < loadedEntityIds.length; i++) {
      var eid = loadedEntityIds[i];
      var idx = EntityManager.getIndex(eid);

      var screenX = padding + (xField[idx] - minX) * scale;
      var screenY = 60 + padding + (yField[idx] - minY) * scale;

      var hasSprite = world.hasComponent(eid, spriteId);
      var hasCamera = world.hasComponent(eid, cameraId);

      var color: number;
      var size = 6;

      if (hasCamera) {
        color = packABGR(100, 149, 237, 255);
        size = 12;
      } else if (hasSprite) {
        color = hslToABGR((i * 47 + 30) % 360, 65, 55);
        size = 8;
      } else {
        color = packABGR(100, 100, 120, 180);
        size = 5;
      }

      var sx = sxField[idx] || 1;
      var sy = syField[idx] || 1;
      var w = Math.min(size * Math.abs(sx), 40);
      var h = Math.min(size * Math.abs(sy), 40);

      batcher.draw(whiteTexture, screenX - w / 2, screenY - h / 2, w, h, 0, 0, 0, 1, 1, color);
    }

    batcher.end();

    // HUD bar
    var fpsRatio = Math.min(displayFps / 60, 1);
    var barColor = fpsRatio > 0.9 ? packABGR(110, 231, 168, 255)
                 : fpsRatio > 0.5 ? packABGR(255, 209, 102, 255)
                 : packABGR(255, 123, 123, 255);

    batcher.begin(projMatrix);
    // Background bar
    batcher.draw(whiteTexture, 0, 0, canvasWidth, 50, 0, 0, 0, 1, 1, packABGR(15, 15, 25, 220));
    // FPS bar
    batcher.draw(whiteTexture, 0, 46, canvasWidth * fpsRatio, 4, 0, 0, 0, 1, 1, barColor);
    // Scene indicator dots
    for (var s = 0; s < fixtureScenes.length; s++) {
      var dotColor = s === (currentSceneIndex % fixtureScenes.length)
        ? packABGR(110, 231, 168, 255)
        : packABGR(80, 80, 100, 200);
      batcher.draw(whiteTexture, 10 + s * 14, 8, 10, 10, 0, 0, 0, 1, 1, dotColor);
    }
    // Entity count bar (proportional)
    var entityRatio = Math.min(loadedEntityIds.length / 200, 1);
    batcher.draw(whiteTexture, 80, 10, canvasWidth - 90, 6, 0, 0, 0, 1, 1, packABGR(40, 40, 60, 200));
    batcher.draw(whiteTexture, 80, 10, (canvasWidth - 90) * entityRatio, 6, 0, 0, 0, 1, 1, packABGR(170, 68, 255, 200));
    // Sprite count bar
    var sprCount = 0;
    for (var i = 0; i < loadedEntityIds.length; i++) {
      if (world.hasComponent(loadedEntityIds[i], spriteId)) sprCount++;
    }
    var sprRatio = loadedEntityIds.length > 0 ? sprCount / loadedEntityIds.length : 0;
    batcher.draw(whiteTexture, 80, 20, canvasWidth - 90, 6, 0, 0, 0, 1, 1, packABGR(40, 40, 60, 200));
    batcher.draw(whiteTexture, 80, 20, (canvasWidth - 90) * sprRatio, 6, 0, 0, 0, 1, 1, packABGR(68, 255, 136, 200));
    batcher.end();
  }

  function tick(timestamp: number): void {
    if (lastTime === 0) lastTime = timestamp;
    var dt = (timestamp - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastTime = timestamp;

    render();

    state.frameCount++;
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1.0) {
      displayFps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    if (state.frameCount === 1 || state.frameCount % 120 === 0) {
      log('frame', state.frameCount, 'fps', displayFps.toFixed(1),
          'scene', loadedSceneId, 'entities', loadedEntityIds.length);
    }

    requestFrame(tick);
  }

  var rafSource = 'none';
  function requestFrame(cb: (t: number) => void): void {
    if (canvas && typeof canvas.requestAnimationFrame === 'function') {
      canvas.requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'canvas.raf'; }
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'global.raf'; }
    } else if (state.hasWx && typeof wx.requestAnimationFrame === 'function') {
      wx.requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'wx.raf'; }
    } else {
      setTimeout(function() { cb(Date.now()); }, 16);
      if (rafSource === 'none') { rafSource = 'setTimeout'; }
    }
  }

  // ---- Boot ----
  log('start');

  if (state.hasWx && typeof wx.showToast === 'function') {
    try { wx.showToast({ title: 'Scene smoke', icon: 'none', duration: 1500 }); } catch (_: any) {}
  }

  var ok = setupCanvas();
  if (!ok) { state.summary = 'canvas-fail'; warn('canvas failed'); }
  else {
    ok = loadFixture();
    if (!ok) { state.summary = 'fixture-fail'; warn('fixture load failed'); }
    else {
      ok = setupRuntime();
      if (!ok) { state.summary = 'runtime-fail'; warn('runtime failed'); }
      else {
        loadCurrentScene();
        setupTouch();
        requestFrame(tick);
        state.summary = 'running';
        log('scene rendering started, tap to switch scenes');
      }
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__MEMBRANE_WX_SMOKE__ = state;
  }
  module.exports = state;
})();
