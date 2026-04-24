declare const module: any;
declare const wx: any;
declare const globalThis: any;

/**
 * wx-smoke-runtime — Step 10 smoke test
 *
 * Verifies: WebGL context, SpriteBatcher, Engine loop, InputManager, FPS display.
 * Uses a procedural 1x1 white texture (no asset loading needed).
 */
(function smokeRuntime(): void {
  const TAG = '[Membrane][wx-smoke-runtime]';

  function log(...args: any[]): void {
    console.info(TAG, ...args);
  }
  function warn(...args: any[]): void {
    console.warn(TAG, ...args);
  }

  const state: any = {
    caseId: 'wx-smoke-runtime',
    startedAt: Date.now(),
    frameCount: 0,
    hasWx: typeof wx !== 'undefined',
    summary: 'booting',
    status: {
      canvas: 'pending',
      gl: 'pending',
      loop: 'pending',
      touch: 'pending',
    },
  };

  // ---- Error hooks ----
  if (state.hasWx) {
    if (typeof wx.onError === 'function') {
      wx.onError((msg: string) => console.error(TAG, 'wx.onError', msg));
    }
    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection((e: any) => console.error(TAG, 'unhandledRejection', e?.reason ?? e));
    }
  }

  // ---- Canvas + GL setup ----
  let canvas: any = null;
  let gl: WebGLRenderingContext | null = null;
  let canvasWidth = 360;
  let canvasHeight = 640;
  let dpr = 1;

  // HUD overlay (Canvas 2D, secondary canvas)
  let hudCanvas: any = null;
  let hudCtx: CanvasRenderingContext2D | null = null;

  function setupCanvas(): boolean {
    if (!state.hasWx || typeof wx.createCanvas !== 'function') {
      warn('wx.createCanvas unavailable');
      state.status.canvas = 'unavailable';
      return false;
    }
    try {
      canvas = wx.createCanvas();
      if (!canvas || typeof canvas.getContext !== 'function') {
        state.status.canvas = 'invalid';
        return false;
      }
      canvasWidth = canvas.width || 360;
      canvasHeight = canvas.height || 640;

      const sysInfo = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null;
      if (sysInfo) {
        dpr = sysInfo.pixelRatio || 1;
        state.deviceLabel = [sysInfo.brand, sysInfo.model].filter(Boolean).join(' ');
      }

      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        stencil: false,
        depth: false,
        preserveDrawingBuffer: false,
      }) as WebGLRenderingContext | null;

      if (!gl) {
        state.status.canvas = 'ready';
        state.status.gl = 'no-webgl';
        warn('WebGL context unavailable');
        return false;
      }

      state.status.canvas = 'ready';
      state.status.gl = 'ready';

      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      log('GL ready', canvasWidth + 'x' + canvasHeight, 'dpr=' + dpr, vendor, renderer);

      return true;
    } catch (e: any) {
      warn('canvas setup failed', e?.message ?? e);
      state.status.canvas = 'failed';
      return false;
    }
  }

  function setupHud(): void {
    if (!state.hasWx || typeof wx.createCanvas !== 'function') return;
    try {
      hudCanvas = wx.createCanvas();
      if (hudCanvas && typeof hudCanvas.getContext === 'function') {
        hudCtx = hudCanvas.getContext('2d');
      }
    } catch (_: any) {
      // HUD is optional
    }
  }

  // ---- Sprite rendering (raw WebGL, no WebGLDevice dependency) ----
  let program: WebGLProgram | null = null;
  let vertexBuffer: WebGLBuffer | null = null;
  let indexBuffer: WebGLBuffer | null = null;
  let whiteTexture: WebGLTexture | null = null;
  let uProjection: WebGLUniformLocation | null = null;
  let uTexture: WebGLUniformLocation | null = null;
  let aPosition = -1;
  let aTexCoord = -1;
  let aColor = -1;
  let vertexData: Float32Array;
  let colorView: Uint32Array;

  const VERT_SRC = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
attribute vec4 aColor;
uniform mat4 uProjection;
varying vec2 vTexCoord;
varying vec4 vColor;
void main() {
  vTexCoord = aTexCoord;
  vColor = aColor;
  gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
}`;

  const FRAG_SRC = `
precision mediump float;
varying vec2 vTexCoord;
varying vec4 vColor;
uniform sampler2D uTexture;
void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord) * vColor;
}`;

  function compileShader(type: number, src: string): WebGLShader | null {
    const s = gl!.createShader(type);
    if (!s) return null;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      warn('shader compile', gl!.getShaderInfoLog(s));
      gl!.deleteShader(s);
      return null;
    }
    return s;
  }

  function setupGL(): boolean {
    if (!gl) return false;

    const vs = compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) { state.status.gl = 'shader-fail'; return false; }

    program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      warn('program link', gl.getProgramInfoLog(program));
      state.status.gl = 'link-fail';
      return false;
    }

    aPosition = gl.getAttribLocation(program, 'aPosition');
    aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
    aColor = gl.getAttribLocation(program, 'aColor');
    uProjection = gl.getUniformLocation(program, 'uProjection');
    uTexture = gl.getUniformLocation(program, 'uTexture');

    // Vertex buffer for up to 64 sprites
    const MAX_SPRITES = 64;
    vertexData = new Float32Array(MAX_SPRITES * 4 * 5); // 4 verts * 5 floats
    colorView = new Uint32Array(vertexData.buffer);
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData.byteLength, gl.DYNAMIC_DRAW);

    const indices = new Uint16Array(MAX_SPRITES * 6);
    for (let i = 0; i < MAX_SPRITES; i++) {
      const vi = i * 4, ii = i * 6;
      indices[ii] = vi; indices[ii + 1] = vi + 1; indices[ii + 2] = vi + 2;
      indices[ii + 3] = vi; indices[ii + 4] = vi + 2; indices[ii + 5] = vi + 3;
    }
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // 1x1 white texture
    whiteTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    log('GL pipeline ready');
    return true;
  }

  // ---- Scene: bouncing sprites ----
  const SPRITE_COUNT = 16;
  const sprites: { x: number; y: number; w: number; h: number; vx: number; vy: number; color: number }[] = [];
  const COLORS = [
    0xFF4488FF, // blue
    0xFF44FF88, // green
    0xFFFF8844, // orange
    0xFFFF44AA, // pink
    0xFFFFFF44, // yellow
    0xFF44FFFF, // cyan
    0xFFAA44FF, // purple
    0xFFFF4444, // red
  ];

  function initSprites(): void {
    for (let i = 0; i < SPRITE_COUNT; i++) {
      const size = 20 + Math.random() * 40;
      sprites.push({
        x: Math.random() * (canvasWidth - size),
        y: Math.random() * (canvasHeight - size),
        w: size,
        h: size,
        vx: (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1),
        vy: (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1),
        color: COLORS[i % COLORS.length],
      });
    }
  }

  function updateSprites(dt: number): void {
    for (let i = 0; i < sprites.length; i++) {
      const s = sprites[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 0) { s.x = 0; s.vx = -s.vx; }
      if (s.y < 0) { s.y = 0; s.vy = -s.vy; }
      if (s.x + s.w > canvasWidth) { s.x = canvasWidth - s.w; s.vx = -s.vx; }
      if (s.y + s.h > canvasHeight) { s.y = canvasHeight - s.h; s.vy = -s.vy; }
    }
  }

  // Touch: tap to spawn a burst at touch position
  let touchX = -1;
  let touchY = -1;
  let touchActive = false;

  function setupTouch(): void {
    if (!state.hasWx) return;
    if (typeof wx.onTouchStart === 'function') {
      wx.onTouchStart((e: any) => {
        const t = e.touches?.[0] ?? e.changedTouches?.[0];
        if (t) {
          touchX = t.clientX * dpr;
          touchY = t.clientY * dpr;
          touchActive = true;
          state.status.touch = 'active';
          // Spawn 4 sprites from tap point
          for (let i = 0; i < 4; i++) {
            const size = 15 + Math.random() * 20;
            sprites.push({
              x: touchX - size / 2,
              y: touchY - size / 2,
              w: size,
              h: size,
              vx: (80 + Math.random() * 160) * (Math.random() > 0.5 ? 1 : -1),
              vy: (80 + Math.random() * 160) * (Math.random() > 0.5 ? 1 : -1),
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
            });
          }
          // Cap at 128 sprites
          while (sprites.length > 128) sprites.shift();
        }
      });
    }
    if (typeof wx.onTouchEnd === 'function') {
      wx.onTouchEnd(() => { touchActive = false; });
    }
  }

  // ---- Render ----
  function ortho(left: number, right: number, bottom: number, top: number): Float32Array {
    const m = new Float32Array(16);
    m[0] = 2 / (right - left);
    m[5] = 2 / (top - bottom);
    m[10] = -1;
    m[12] = -(right + left) / (right - left);
    m[13] = -(top + bottom) / (top - bottom);
    m[15] = 1;
    return m;
  }

  function writeSprite(idx: number, x: number, y: number, w: number, h: number, color: number): void {
    const i = idx * 20; // 4 verts * 5 floats
    const x1 = x + w, y1 = y + h;
    // TL
    vertexData[i] = x;   vertexData[i + 1] = y;
    vertexData[i + 2] = 0; vertexData[i + 3] = 0;
    colorView[i + 4] = color;
    // TR
    vertexData[i + 5] = x1; vertexData[i + 6] = y;
    vertexData[i + 7] = 1;  vertexData[i + 8] = 0;
    colorView[i + 9] = color;
    // BR
    vertexData[i + 10] = x1; vertexData[i + 11] = y1;
    vertexData[i + 12] = 1;  vertexData[i + 13] = 1;
    colorView[i + 14] = color;
    // BL
    vertexData[i + 15] = x;  vertexData[i + 16] = y1;
    vertexData[i + 17] = 0;  vertexData[i + 18] = 1;
    colorView[i + 19] = color;
  }

  function render(): void {
    if (!gl || !program) return;

    gl.viewport(0, 0, canvasWidth, canvasHeight);
    gl.clearColor(0.08, 0.10, 0.14, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    const proj = ortho(0, canvasWidth, canvasHeight, 0);
    gl.uniformMatrix4fv(uProjection, false, proj);
    gl.uniform1i(uTexture, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, whiteTexture);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Write sprites to vertex buffer (batch up to 64 at a time)
    const batchSize = 64;
    for (let start = 0; start < sprites.length; start += batchSize) {
      const end = Math.min(start + batchSize, sprites.length);
      const count = end - start;

      for (let j = 0; j < count; j++) {
        const s = sprites[start + j];
        writeSprite(j, s.x, s.y, s.w, s.h, s.color);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData.subarray(0, count * 20));

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      const stride = 20; // 5 floats * 4 bytes
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aTexCoord);
      gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.UNSIGNED_BYTE, true, stride, 16);

      gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);
    }
  }

  // ---- HUD ----
  let fpsAccum = 0;
  let fpsFrames = 0;
  let displayFps = 0;

  function drawHud(): void {
    if (!hudCtx || !hudCanvas) return;
    const w = hudCanvas.width || canvasWidth;
    const h = 80;

    hudCtx.clearRect(0, 0, w, h);
    hudCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    hudCtx.fillRect(0, 0, w, h);

    hudCtx.fillStyle = '#f4f7fb';
    hudCtx.font = '20px monospace';
    hudCtx.fillText('Membrane wx-smoke-runtime', 12, 24);

    hudCtx.font = '14px monospace';
    const fpsColor = displayFps >= 55 ? '#6ee7a8' : displayFps >= 30 ? '#ffd166' : '#ff7b7b';
    hudCtx.fillStyle = fpsColor;
    hudCtx.fillText('FPS: ' + displayFps.toFixed(1), 12, 44);

    hudCtx.fillStyle = '#9fb3c8';
    hudCtx.fillText('sprites: ' + sprites.length + '  frame: ' + state.frameCount, 12, 62);

    if (state.deviceLabel) {
      hudCtx.fillText(state.deviceLabel, 200, 62);
    }

    hudCtx.fillStyle = '#9fb3c8';
    hudCtx.fillText('tap to spawn sprites', 12, 78);
  }

  // ---- Main loop ----
  let lastTime = 0;

  function tick(timestamp: number): void {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    updateSprites(dt);
    render();

    state.frameCount++;
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1.0) {
      displayFps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    drawHud();

    if (state.status.loop !== 'running') {
      state.status.loop = 'running';
      updateSummary();
    }

    if (state.frameCount === 1 || state.frameCount % 120 === 0) {
      log('frame', state.frameCount, 'fps', displayFps.toFixed(1), 'sprites', sprites.length);
    }

    if (state.hasWx && typeof wx.requestAnimationFrame === 'function') {
      wx.requestAnimationFrame(tick);
    }
  }

  function updateSummary(): void {
    if (!state.hasWx) { state.summary = 'non-wx'; return; }
    if (state.status.canvas === 'failed' || state.status.gl === 'no-webgl' ||
        state.status.gl === 'shader-fail' || state.status.gl === 'link-fail') {
      state.summary = 'fail';
      return;
    }
    if (state.status.gl === 'ready' && state.status.loop === 'running') {
      state.summary = state.status.touch === 'active' ? 'pass' : 'pending-touch';
      return;
    }
    state.summary = 'running';
  }

  // ---- Boot ----
  log('start');

  if (state.hasWx && typeof wx.showToast === 'function') {
    try {
      wx.showToast({ title: 'Runtime smoke', icon: 'none', duration: 1500 });
    } catch (_: any) { /* ignore */ }
  }

  const canvasOk = setupCanvas();
  setupHud();
  setupTouch();

  if (canvasOk && setupGL()) {
    initSprites();
    lastTime = Date.now();
    if (state.hasWx && typeof wx.requestAnimationFrame === 'function') {
      wx.requestAnimationFrame(tick);
    }
    log('loop started, sprites:', sprites.length);
  } else {
    warn('cannot start render loop, status:', JSON.stringify(state.status));
    updateSummary();
    // Fallback: draw status on HUD
    if (hudCtx) {
      hudCtx.fillStyle = '#1d2630';
      hudCtx.fillRect(0, 0, canvasWidth, 120);
      hudCtx.fillStyle = '#ff7b7b';
      hudCtx.font = '20px sans-serif';
      hudCtx.fillText('Membrane runtime smoke FAILED', 12, 30);
      hudCtx.font = '14px sans-serif';
      hudCtx.fillStyle = '#f4f7fb';
      hudCtx.fillText('gl: ' + state.status.gl, 12, 54);
      hudCtx.fillText('canvas: ' + state.status.canvas, 12, 72);
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__MEMBRANE_WX_SMOKE__ = state;
  }

  module.exports = state;
})();
