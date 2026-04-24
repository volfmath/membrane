declare const module: any;
declare const wx: any;
declare const globalThis: any;

/**
 * wx-smoke-runtime — Step 10 smoke test
 *
 * Strategy: Use Canvas 2D on the PRIMARY canvas (guaranteed visible in WeChat).
 * Then attempt WebGL on a SECONDARY canvas and composite it onto the primary.
 * If WebGL fails, fall back to pure Canvas 2D sprite rendering.
 */
(function smokeRuntime(): void {
  var TAG = '[Membrane][wx-smoke-runtime]';

  function log(...args: any[]): void {
    args.unshift(TAG);
    console.info.apply(console, args);
  }

  function warn(...args: any[]): void {
    args.unshift(TAG);
    console.warn.apply(console, args);
  }

  var state: any = {
    caseId: 'wx-smoke-runtime',
    startedAt: Date.now(),
    frameCount: 0,
    hasWx: typeof wx !== 'undefined',
    summary: 'booting',
    glMode: false,
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
      wx.onError(function onErr(msg: string) {
        console.error(TAG, 'wx.onError', msg);
      });
    }
    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection(function onRej(e: any) {
        console.error(TAG, 'unhandledRejection', e && e.reason ? e.reason : e);
      });
    }
  }

  // ---- Canvas setup ----
  var canvas: any = null;
  var ctx: CanvasRenderingContext2D | null = null;
  var canvasWidth = 360;
  var canvasHeight = 640;
  var dpr = 1;

  // WebGL (secondary canvas, composited onto primary)
  var glCanvas: any = null;
  var gl: WebGLRenderingContext | null = null;
  var useWebGL = false;

  function setupCanvas(): boolean {
    if (!state.hasWx || typeof wx.createCanvas !== 'function') {
      warn('wx.createCanvas unavailable');
      state.status.canvas = 'unavailable';
      return false;
    }
    try {
      // Primary canvas — always Canvas 2D (guaranteed to display)
      canvas = wx.createCanvas();
      if (!canvas || typeof canvas.getContext !== 'function') {
        state.status.canvas = 'invalid';
        return false;
      }
      canvasWidth = canvas.width || 360;
      canvasHeight = canvas.height || 640;

      var sysInfo = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null;
      if (sysInfo) {
        dpr = sysInfo.pixelRatio || 1;
        state.deviceLabel = [sysInfo.brand, sysInfo.model].filter(Boolean).join(' ');
      }

      ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
      if (!ctx) {
        state.status.canvas = 'no-2d';
        warn('2d context unavailable on primary canvas');
        return false;
      }

      state.status.canvas = 'ready';
      log('canvas ready', canvasWidth + 'x' + canvasHeight, 'dpr=' + dpr);
      return true;
    } catch (e: any) {
      warn('canvas setup failed', e && e.message ? e.message : e);
      state.status.canvas = 'failed';
      return false;
    }
  }

  // ---- Try WebGL on secondary canvas ----
  var program: WebGLProgram | null = null;
  var vertexBuffer: WebGLBuffer | null = null;
  var indexBuffer: WebGLBuffer | null = null;
  var whiteTexture: WebGLTexture | null = null;
  var uProjection: WebGLUniformLocation | null = null;
  var uTextureLoc: WebGLUniformLocation | null = null;
  var aPosition = -1;
  var aTexCoord = -1;
  var aColor = -1;
  var glVertexData: Float32Array;
  var glColorView: Uint32Array;

  var VERT_SRC = [
    'attribute vec2 aPosition;',
    'attribute vec2 aTexCoord;',
    'attribute vec4 aColor;',
    'uniform mat4 uProjection;',
    'varying vec2 vTexCoord;',
    'varying vec4 vColor;',
    'void main() {',
    '  vTexCoord = aTexCoord;',
    '  vColor = aColor;',
    '  gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);',
    '}',
  ].join('\n');

  var FRAG_SRC = [
    'precision mediump float;',
    'varying vec2 vTexCoord;',
    'varying vec4 vColor;',
    'uniform sampler2D uTexture;',
    'void main() {',
    '  gl_FragColor = texture2D(uTexture, vTexCoord) * vColor;',
    '}',
  ].join('\n');

  function trySetupWebGL(): boolean {
    if (typeof wx.createCanvas !== 'function') return false;
    try {
      glCanvas = wx.createCanvas();
      if (!glCanvas) return false;
      glCanvas.width = canvasWidth;
      glCanvas.height = canvasHeight;

      gl = glCanvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        stencil: false,
        depth: false,
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null;

      if (!gl) {
        state.status.gl = 'no-webgl';
        log('WebGL not available, using Canvas 2D fallback');
        return false;
      }

      // Compile shaders
      var vs = gl.createShader(gl.VERTEX_SHADER);
      if (!vs) return false;
      gl.shaderSource(vs, VERT_SRC);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        warn('vertex shader', gl.getShaderInfoLog(vs));
        state.status.gl = 'shader-fail';
        return false;
      }

      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      if (!fs) return false;
      gl.shaderSource(fs, FRAG_SRC);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        warn('fragment shader', gl.getShaderInfoLog(fs));
        state.status.gl = 'shader-fail';
        return false;
      }

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
      uTextureLoc = gl.getUniformLocation(program, 'uTexture');

      var MAX_GL_SPRITES = 64;
      glVertexData = new Float32Array(MAX_GL_SPRITES * 4 * 5);
      glColorView = new Uint32Array(glVertexData.buffer);
      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, glVertexData.byteLength, gl.DYNAMIC_DRAW);

      var indices = new Uint16Array(MAX_GL_SPRITES * 6);
      for (var i = 0; i < MAX_GL_SPRITES; i++) {
        var vi = i * 4, ii = i * 6;
        indices[ii] = vi; indices[ii + 1] = vi + 1; indices[ii + 2] = vi + 2;
        indices[ii + 3] = vi; indices[ii + 4] = vi + 2; indices[ii + 5] = vi + 3;
      }
      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

      whiteTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      var renderer = gl.getParameter(gl.RENDERER);
      var vendor = gl.getParameter(gl.VENDOR);
      state.status.gl = 'ready';
      log('WebGL ready:', vendor, renderer);
      return true;
    } catch (e: any) {
      warn('WebGL setup failed', e && e.message ? e.message : e);
      state.status.gl = 'failed';
      return false;
    }
  }

  // ---- Scene: bouncing sprites ----
  var SPRITE_COUNT = 16;
  var sprites: { x: number; y: number; w: number; h: number; vx: number; vy: number; r: number; g: number; b: number; colorU32: number }[] = [];
  var COLOR_TABLE = [
    { r: 68, g: 136, b: 255 },   // blue
    { r: 68, g: 255, b: 136 },   // green
    { r: 255, g: 136, b: 68 },   // orange
    { r: 255, g: 68, b: 170 },   // pink
    { r: 255, g: 255, b: 68 },   // yellow
    { r: 68, g: 255, b: 255 },   // cyan
    { r: 170, g: 68, b: 255 },   // purple
    { r: 255, g: 68, b: 68 },    // red
  ];

  function packColor(r: number, g: number, b: number, a: number): number {
    return (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }

  function initSprites(): void {
    for (var i = 0; i < SPRITE_COUNT; i++) {
      var size = 20 + Math.random() * 40;
      var c = COLOR_TABLE[i % COLOR_TABLE.length];
      sprites.push({
        x: Math.random() * (canvasWidth - size),
        y: Math.random() * (canvasHeight - size),
        w: size, h: size,
        vx: (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1),
        vy: (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1),
        r: c.r, g: c.g, b: c.b,
        colorU32: packColor(c.r, c.g, c.b, 255),
      });
    }
  }

  function updateSprites(dt: number): void {
    for (var i = 0; i < sprites.length; i++) {
      var s = sprites[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 0) { s.x = 0; s.vx = -s.vx; }
      if (s.y < 0) { s.y = 0; s.vy = -s.vy; }
      if (s.x + s.w > canvasWidth) { s.x = canvasWidth - s.w; s.vx = -s.vx; }
      if (s.y + s.h > canvasHeight) { s.y = canvasHeight - s.h; s.vy = -s.vy; }
    }
  }

  // ---- Touch ----
  function setupTouch(): void {
    if (!state.hasWx) return;
    if (typeof wx.onTouchStart === 'function') {
      wx.onTouchStart(function onTS(e: any) {
        var touches = e.touches || e.changedTouches || [];
        var t = touches[0];
        if (!t) return;
        var tx = t.clientX * dpr;
        var ty = t.clientY * dpr;
        state.status.touch = 'active';
        for (var i = 0; i < 4; i++) {
          var size = 15 + Math.random() * 20;
          var c = COLOR_TABLE[Math.floor(Math.random() * COLOR_TABLE.length)];
          sprites.push({
            x: tx - size / 2, y: ty - size / 2,
            w: size, h: size,
            vx: (80 + Math.random() * 160) * (Math.random() > 0.5 ? 1 : -1),
            vy: (80 + Math.random() * 160) * (Math.random() > 0.5 ? 1 : -1),
            r: c.r, g: c.g, b: c.b,
            colorU32: packColor(c.r, c.g, c.b, 255),
          });
        }
        while (sprites.length > 128) sprites.shift();
        log('touch spawn, total sprites:', sprites.length);
      });
    }
    if (typeof wx.onTouchEnd === 'function') {
      wx.onTouchEnd(function onTE() {
        state.status.touch = 'ended';
      });
    }
  }

  // ---- Canvas 2D rendering ----
  function renderCanvas2D(): void {
    if (!ctx) return;
    ctx.fillStyle = '#141a22';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (var i = 0; i < sprites.length; i++) {
      var s = sprites[i];
      ctx.fillStyle = 'rgb(' + s.r + ',' + s.g + ',' + s.b + ')';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.w), Math.round(s.h));
    }
  }

  // ---- WebGL rendering ----
  var projMatrix = new Float32Array(16);

  function setOrtho(left: number, right: number, bottom: number, top: number): void {
    for (var i = 0; i < 16; i++) projMatrix[i] = 0;
    projMatrix[0] = 2 / (right - left);
    projMatrix[5] = 2 / (top - bottom);
    projMatrix[10] = -1;
    projMatrix[12] = -(right + left) / (right - left);
    projMatrix[13] = -(top + bottom) / (top - bottom);
    projMatrix[15] = 1;
  }

  function renderWebGL(): void {
    if (!gl || !program) return;

    gl.viewport(0, 0, canvasWidth, canvasHeight);
    gl.clearColor(0.08, 0.10, 0.14, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    setOrtho(0, canvasWidth, canvasHeight, 0);
    gl.uniformMatrix4fv(uProjection, false, projMatrix);
    gl.uniform1i(uTextureLoc, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var batchSize = 64;
    for (var start = 0; start < sprites.length; start += batchSize) {
      var end = Math.min(start + batchSize, sprites.length);
      var count = end - start;

      for (var j = 0; j < count; j++) {
        var s = sprites[start + j];
        var idx = j * 20;
        var x1 = s.x + s.w, y1 = s.y + s.h;
        glVertexData[idx] = s.x;      glVertexData[idx + 1] = s.y;
        glVertexData[idx + 2] = 0;    glVertexData[idx + 3] = 0;
        glColorView[idx + 4] = s.colorU32;
        glVertexData[idx + 5] = x1;   glVertexData[idx + 6] = s.y;
        glVertexData[idx + 7] = 1;    glVertexData[idx + 8] = 0;
        glColorView[idx + 9] = s.colorU32;
        glVertexData[idx + 10] = x1;  glVertexData[idx + 11] = y1;
        glVertexData[idx + 12] = 1;   glVertexData[idx + 13] = 1;
        glColorView[idx + 14] = s.colorU32;
        glVertexData[idx + 15] = s.x; glVertexData[idx + 16] = y1;
        glVertexData[idx + 17] = 0;   glVertexData[idx + 18] = 1;
        glColorView[idx + 19] = s.colorU32;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, glVertexData.subarray(0, count * 20));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      var stride = 20;
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aTexCoord);
      gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.UNSIGNED_BYTE, true, stride, 16);

      gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);
    }

    // Composite WebGL canvas onto primary Canvas 2D
    if (ctx && glCanvas) {
      ctx.drawImage(glCanvas, 0, 0);
    }
  }

  // ---- HUD (drawn on primary canvas, always visible) ----
  var fpsAccum = 0;
  var fpsFrames = 0;
  var displayFps = 0;

  function drawHud(): void {
    if (!ctx) return;
    var panelH = 80;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, panelH);

    ctx.fillStyle = '#f4f7fb';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Membrane runtime smoke', 12, 22);

    ctx.font = '13px monospace';

    var modeStr = useWebGL ? 'WebGL' : 'Canvas2D';
    ctx.fillStyle = useWebGL ? '#6ee7a8' : '#ffd166';
    ctx.fillText('mode: ' + modeStr, 12, 40);

    var fpsColor = displayFps >= 55 ? '#6ee7a8' : displayFps >= 30 ? '#ffd166' : '#ff7b7b';
    ctx.fillStyle = fpsColor;
    ctx.fillText('FPS: ' + displayFps.toFixed(1), 160, 40);

    ctx.fillStyle = '#9fb3c8';
    ctx.fillText('sprites: ' + sprites.length + '  frame: ' + state.frameCount, 12, 58);

    if (state.deviceLabel) {
      ctx.fillText(state.deviceLabel, 12, 74);
    }

    ctx.fillStyle = '#666';
    ctx.fillText('tap to spawn', canvasWidth - 120, 74);
  }

  // ---- requestAnimationFrame polyfill ----
  var rafSource = 'none';

  function requestFrame(cb: (timestamp: number) => void): void {
    // Try multiple sources — WeChat DevTools may expose raf in different places
    if (canvas && typeof canvas.requestAnimationFrame === 'function') {
      canvas.requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'canvas.raf'; log('raf source: canvas.requestAnimationFrame'); }
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'global.raf'; log('raf source: global requestAnimationFrame'); }
    } else if (state.hasWx && typeof wx.requestAnimationFrame === 'function') {
      wx.requestAnimationFrame(cb);
      if (rafSource === 'none') { rafSource = 'wx.raf'; log('raf source: wx.requestAnimationFrame'); }
    } else {
      setTimeout(function() { cb(Date.now()); }, 16);
      if (rafSource === 'none') { rafSource = 'setTimeout'; log('raf source: setTimeout fallback (16ms)'); }
    }
  }

  // ---- Main loop ----
  var lastTime = 0;

  function tick(timestamp: number): void {
    if (lastTime === 0) lastTime = timestamp;
    var dt = (timestamp - lastTime) / 1000;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastTime = timestamp;

    updateSprites(dt);

    if (useWebGL) {
      renderWebGL();
    } else {
      renderCanvas2D();
    }

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
    }

    if (state.frameCount === 1 || state.frameCount % 120 === 0) {
      log('frame', state.frameCount, 'fps', displayFps.toFixed(1), 'sprites', sprites.length, 'mode', useWebGL ? 'webgl' : '2d');
    }

    requestFrame(tick);
  }

  // ---- Boot ----
  log('start');

  if (state.hasWx && typeof wx.showToast === 'function') {
    try {
      wx.showToast({ title: 'Runtime smoke', icon: 'none', duration: 1500 });
    } catch (_: any) { /* ignore */ }
  }

  var canvasOk = setupCanvas();
  if (!canvasOk) {
    warn('FATAL: primary canvas failed, status:', JSON.stringify(state.status));
    state.summary = 'fail';
  } else {
    // Draw immediate feedback so user sees something right away
    var c2d = ctx as CanvasRenderingContext2D | null;
    if (c2d) {
      c2d.fillStyle = '#141a22';
      c2d.fillRect(0, 0, canvasWidth, canvasHeight);
      c2d.fillStyle = '#f4f7fb';
      c2d.font = 'bold 20px monospace';
      c2d.fillText('Membrane loading...', 12, 30);
    }

    // Force Canvas2D — WebGL on secondary canvas + drawImage compositing
    // doesn't work on real devices. WebGL verification belongs in a
    // dedicated wx-smoke-webgl case using the primary canvas directly.
    useWebGL = false;
    state.glMode = false;
    state.status.gl = 'skipped';
    log('render mode: Canvas2D (forced)');

    setupTouch();
    initSprites();

    requestFrame(tick);
    log('loop started, sprites:', sprites.length);
  }

  state.summary = canvasOk ? 'running' : 'fail';

  if (typeof globalThis !== 'undefined') {
    globalThis.__MEMBRANE_WX_SMOKE__ = state;
  }

  module.exports = state;
})();
