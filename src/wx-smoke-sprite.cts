declare const module: any;
declare const wx: any;
declare const globalThis: any;

import { WebGLDevice } from './renderer/webgl-device';
import { SpriteBatcher } from './renderer/sprite-batcher';
import { World } from './ecs/world';
import { EntityManager } from './ecs/entity-manager';
import { Mat4 } from './math/mat4';
import type { EntityId } from './ecs/types';

(function smokeSprite(): void {
  var TAG = '[Membrane][wx-smoke-sprite]';

  function log(...args: any[]): void {
    args.unshift(TAG);
    console.info.apply(console, args);
  }

  function warn(...args: any[]): void {
    args.unshift(TAG);
    console.warn.apply(console, args);
  }

  var state: any = {
    caseId: 'wx-smoke-sprite',
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

  // ---- Canvas setup ----
  var canvas: any = null;
  var canvasWidth = 360;
  var canvasHeight = 640;
  var dpr = 1;

  function setupCanvas(): boolean {
    if (!state.hasWx || typeof wx.createCanvas !== 'function') {
      warn('wx.createCanvas unavailable');
      return false;
    }
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
      log('canvas ready', canvasWidth + 'x' + canvasHeight, 'dpr=' + dpr);
      return true;
    } catch (e: any) {
      warn('canvas setup failed', e?.message ?? e);
      return false;
    }
  }

  // ---- Runtime ----
  var device: WebGLDevice;
  var batcher: SpriteBatcher;
  var world: World;
  var whiteTexture: WebGLTexture;
  var spriteTexture: WebGLTexture | null = null;
  var spriteLoaded = false;
  var spriteWidth = 0;
  var spriteHeight = 0;
  var projMatrix: Mat4;

  var TRANSFORM_SCHEMA = {
    x: { type: Float32Array },
    y: { type: Float32Array },
    vx: { type: Float32Array },
    vy: { type: Float32Array },
    size: { type: Float32Array, default: 48 },
    rotation: { type: Float32Array },
    rotSpeed: { type: Float32Array },
    useTexture: { type: Uint8Array, default: 1 },
    colorU32: { type: Uint32Array },
  };

  var transformId: number;
  var entityIds: EntityId[] = [];

  function packABGR(r: number, g: number, b: number, a: number): number {
    return (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }

  var WHITE = packABGR(255, 255, 255, 255);

  var TINT_TABLE = [
    WHITE,
    packABGR(255, 200, 200, 255),
    packABGR(200, 255, 200, 255),
    packABGR(200, 200, 255, 255),
    packABGR(255, 255, 200, 255),
    packABGR(255, 200, 255, 255),
    packABGR(200, 255, 255, 255),
  ];

  function setupRuntime(): boolean {
    try {
      device = new WebGLDevice(canvas, { alpha: false, antialias: false });
      log('WebGLDevice created, version:', device.capabilities.webglVersion);

      batcher = new SpriteBatcher(device);

      world = new World({ maxEntities: 256 });
      world.registry.register('Transform', TRANSFORM_SCHEMA);
      transformId = world.registry.getId('Transform');

      // 1x1 white fallback texture
      var gl = device.gl;
      whiteTexture = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      projMatrix = new Mat4();
      Mat4.ortho(0, canvasWidth, canvasHeight, 0, -1, 1, projMatrix);

      log('runtime ready');
      return true;
    } catch (e: any) {
      warn('runtime setup failed:', e?.message ?? e);
      return false;
    }
  }

  // ---- Load sprite image ----
  function loadSpriteImage(): void {
    if (!state.hasWx || typeof wx.createImage !== 'function') {
      warn('wx.createImage unavailable, using colored quads');
      createInitialEntities();
      return;
    }

    var img = wx.createImage();
    img.onload = function() {
      log('image loaded:', img.width + 'x' + img.height);
      spriteWidth = img.width;
      spriteHeight = img.height;

      var gl = device.gl;
      spriteTexture = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      spriteLoaded = true;
      log('texture created from image');
      createInitialEntities();
    };
    img.onerror = function(e: any) {
      warn('image load failed:', e);
      createInitialEntities();
    };
    img.src = 'assets/com_icon_phb.png';
  }

  function createInitialEntities(): void {
    var COUNT = 12;
    for (var i = 0; i < COUNT; i++) {
      spawnEntity(
        60 + Math.random() * (canvasWidth - 120),
        60 + Math.random() * (canvasHeight - 120),
        32 + Math.random() * 48,
        true,
        i,
      );
    }
    log('created', COUNT, 'sprite entities');
  }

  function spawnEntity(x: number, y: number, size: number, textured: boolean, index: number): void {
    if (world.entityCount >= 200) return;
    var eid = world.createEntity();
    world.addComponent(eid, transformId);
    var idx = EntityManager.getIndex(eid);

    var xf = world.storage.getField(transformId, 'x');
    var yf = world.storage.getField(transformId, 'y');
    var vxf = world.storage.getField(transformId, 'vx');
    var vyf = world.storage.getField(transformId, 'vy');
    var sf = world.storage.getField(transformId, 'size');
    var rf = world.storage.getField(transformId, 'rotation');
    var rsf = world.storage.getField(transformId, 'rotSpeed');
    var tf = world.storage.getField(transformId, 'useTexture');
    var cf = world.storage.getField(transformId, 'colorU32');

    xf[idx] = x;
    yf[idx] = y;
    vxf[idx] = (40 + Math.random() * 80) * (Math.random() > 0.5 ? 1 : -1);
    vyf[idx] = (40 + Math.random() * 80) * (Math.random() > 0.5 ? 1 : -1);
    sf[idx] = size;
    rf[idx] = Math.random() * Math.PI * 2;
    rsf[idx] = (0.5 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1);
    tf[idx] = textured && spriteLoaded ? 1 : 0;
    cf[idx] = TINT_TABLE[index % TINT_TABLE.length];

    entityIds.push(eid);
  }

  // ---- Touch ----
  function setupTouch(): void {
    if (!state.hasWx || typeof wx.onTouchStart !== 'function') return;
    wx.onTouchStart(function(e: any) {
      var touches = e.touches || e.changedTouches || [];
      var t = touches[0];
      if (!t) return;
      var tx = t.clientX * dpr;
      var ty = t.clientY * dpr;
      for (var i = 0; i < 3; i++) {
        spawnEntity(tx, ty, 28 + Math.random() * 40, true, entityIds.length + i);
      }
      log('touch spawn, total:', world.entityCount);
    });
  }

  // ---- Main loop ----
  var fpsAccum = 0;
  var fpsFrames = 0;
  var displayFps = 0;
  var lastTime = 0;

  function tick(timestamp: number): void {
    if (lastTime === 0) lastTime = timestamp;
    var dt = (timestamp - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastTime = timestamp;

    // Update
    var xField = world.storage.getField(transformId, 'x');
    var yField = world.storage.getField(transformId, 'y');
    var vxField = world.storage.getField(transformId, 'vx');
    var vyField = world.storage.getField(transformId, 'vy');
    var sizeField = world.storage.getField(transformId, 'size');
    var rotField = world.storage.getField(transformId, 'rotation');
    var rotSpeedField = world.storage.getField(transformId, 'rotSpeed');
    var useTexField = world.storage.getField(transformId, 'useTexture');
    var colorField = world.storage.getField(transformId, 'colorU32');

    for (var i = 0; i < entityIds.length; i++) {
      var idx = EntityManager.getIndex(entityIds[i]);
      var sz = sizeField[idx];

      xField[idx] += vxField[idx] * dt;
      yField[idx] += vyField[idx] * dt;
      rotField[idx] += rotSpeedField[idx] * dt;

      if (xField[idx] < 0) { xField[idx] = 0; vxField[idx] = -vxField[idx]; }
      if (yField[idx] < 0) { yField[idx] = 0; vyField[idx] = -vyField[idx]; }
      if (xField[idx] + sz > canvasWidth) { xField[idx] = canvasWidth - sz; vxField[idx] = -vxField[idx]; }
      if (yField[idx] + sz > canvasHeight) { yField[idx] = canvasHeight - sz; vyField[idx] = -vyField[idx]; }
    }

    world.update(dt);

    // Render
    device.setViewport(0, 0, canvasWidth, canvasHeight);
    device.clear(0.06, 0.07, 0.11, 1.0);

    batcher.begin(projMatrix);
    for (var i = 0; i < entityIds.length; i++) {
      var idx = EntityManager.getIndex(entityIds[i]);
      var tex = (useTexField[idx] && spriteTexture) ? spriteTexture : whiteTexture;
      batcher.draw(
        tex,
        xField[idx], yField[idx],
        sizeField[idx], sizeField[idx],
        rotField[idx],
        0, 0, 1, 1,
        colorField[idx],
      );
    }
    batcher.end();

    // HUD: FPS bar
    state.frameCount++;
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1.0) {
      displayFps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    var fpsRatio = Math.min(displayFps / 60, 1);
    var barW = canvasWidth * fpsRatio;
    var barColor = fpsRatio > 0.9 ? packABGR(110, 231, 168, 255)
                 : fpsRatio > 0.5 ? packABGR(255, 209, 102, 255)
                 : packABGR(255, 123, 123, 255);

    batcher.begin(projMatrix);
    batcher.draw(whiteTexture, 0, 0, canvasWidth, 8, 0, 0, 0, 1, 1, packABGR(20, 20, 30, 200));
    batcher.draw(whiteTexture, 0, 0, barW, 8, 0, 0, 0, 1, 1, barColor);
    batcher.end();

    if (state.frameCount === 1 || state.frameCount % 120 === 0) {
      log('frame', state.frameCount, 'fps', displayFps.toFixed(1),
          'entities', world.entityCount, 'textured', spriteLoaded,
          'drawCalls', batcher.drawCallCount);
    }

    requestFrame(tick);
  }

  // ---- RAF polyfill ----
  var rafSource = 'none';
  function requestFrame(cb: (t: number) => void): void {
    if (canvas && typeof canvas.requestAnimationFrame === 'function') {
      canvas.requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'canvas.raf'; log('raf source: canvas.raf'); }
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'global.raf'; log('raf source: global.raf'); }
    } else if (state.hasWx && typeof wx.requestAnimationFrame === 'function') {
      wx.requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'wx.raf'; log('raf source: wx.raf'); }
    } else {
      setTimeout(function() { cb(Date.now()); }, 16);
      if (rafSource === 'none') { rafSource = 'setTimeout'; log('raf source: setTimeout'); }
    }
  }

  // ---- Boot ----
  log('start');

  if (state.hasWx && typeof wx.showToast === 'function') {
    try { wx.showToast({ title: 'Sprite smoke', icon: 'none', duration: 1500 }); } catch (_: any) {}
  }

  var canvasOk = setupCanvas();
  if (!canvasOk) {
    warn('FATAL: canvas failed');
    state.summary = 'fail';
  } else {
    var runtimeOk = setupRuntime();
    if (!runtimeOk) {
      warn('FATAL: runtime failed');
      state.summary = 'runtime-fail';
    } else {
      setupTouch();
      loadSpriteImage();
      requestFrame(tick);
      state.summary = 'running';
      log('sprite smoke started');
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__MEMBRANE_WX_SMOKE__ = state;
  }
  module.exports = state;
})();
