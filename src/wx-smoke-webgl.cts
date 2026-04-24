declare const module: any;
declare const wx: any;
declare const globalThis: any;

(function smokeWebGL(): void {
  var TAG = '[Membrane][wx-smoke-webgl]';

  function log(...args: any[]): void {
    args.unshift(TAG);
    console.info.apply(console, args);
  }

  function warn(...args: any[]): void {
    args.unshift(TAG);
    console.warn.apply(console, args);
  }

  var state: any = {
    caseId: 'wx-smoke-webgl',
    startedAt: Date.now(),
    frameCount: 0,
    hasWx: typeof wx !== 'undefined',
    summary: 'booting',
    status: {
      canvas: 'pending',
      gl: 'pending',
      shader: 'pending',
      loop: 'pending',
      touch: 'pending',
    },
  };

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

  // ---- Canvas + WebGL on PRIMARY canvas ----
  var canvas: any = null;
  var gl: WebGLRenderingContext | null = null;
  var canvasWidth = 360;
  var canvasHeight = 640;
  var dpr = 1;

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

      var sysInfo = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null;
      if (sysInfo) {
        dpr = sysInfo.pixelRatio || 1;
        state.deviceLabel = [sysInfo.brand, sysInfo.model].filter(Boolean).join(' ');
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

  // ---- WebGL setup directly on primary canvas ----
  var program: WebGLProgram | null = null;
  var vertexBuffer: WebGLBuffer | null = null;
  var indexBuffer: WebGLBuffer | null = null;
  var whiteTexture: WebGLTexture | null = null;
  var uProjection: WebGLUniformLocation | null = null;
  var uTextureLoc: WebGLUniformLocation | null = null;
  var aPosition = -1;
  var aTexCoord = -1;
  var aColor = -1;

  var MAX_SPRITES = 256;
  var glVertexData = new Float32Array(MAX_SPRITES * 4 * 5);
  var glColorView = new Uint32Array(glVertexData.buffer);

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

  function setupWebGL(): boolean {
    if (!canvas) return false;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        stencil: false,
        depth: false,
      }) as WebGLRenderingContext | null;

      if (!gl) {
        state.status.gl = 'no-webgl';
        warn('WebGL not available on primary canvas');
        return false;
      }

      state.status.gl = 'context-ok';
      var renderer = gl.getParameter(gl.RENDERER);
      var vendor = gl.getParameter(gl.VENDOR);
      var version = gl.getParameter(gl.VERSION);
      log('WebGL context:', vendor, renderer, version);

      var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      var maxUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
      log('limits: maxTexSize=' + maxTex, 'maxTexUnits=' + maxUnits);

      var exts = gl.getSupportedExtensions() || [];
      log('extensions (' + exts.length + '):', exts.join(', '));

      // Compile shaders
      var vs = gl.createShader(gl.VERTEX_SHADER);
      if (!vs) { state.status.shader = 'no-vs'; return false; }
      gl.shaderSource(vs, VERT_SRC);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        warn('vertex shader fail:', gl.getShaderInfoLog(vs));
        state.status.shader = 'vs-fail';
        return false;
      }

      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      if (!fs) { state.status.shader = 'no-fs'; return false; }
      gl.shaderSource(fs, FRAG_SRC);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        warn('fragment shader fail:', gl.getShaderInfoLog(fs));
        state.status.shader = 'fs-fail';
        return false;
      }

      program = gl.createProgram();
      if (!program) { state.status.shader = 'no-program'; return false; }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        warn('program link fail:', gl.getProgramInfoLog(program));
        state.status.shader = 'link-fail';
        return false;
      }

      gl.deleteShader(vs);
      gl.deleteShader(fs);

      aPosition = gl.getAttribLocation(program, 'aPosition');
      aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
      aColor = gl.getAttribLocation(program, 'aColor');
      uProjection = gl.getUniformLocation(program, 'uProjection');
      uTextureLoc = gl.getUniformLocation(program, 'uTexture');

      state.status.shader = 'ready';

      // Buffers
      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, glVertexData.byteLength, gl.DYNAMIC_DRAW);

      var indices = new Uint16Array(MAX_SPRITES * 6);
      for (var i = 0; i < MAX_SPRITES; i++) {
        var vi = i * 4, ii = i * 6;
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

      log('WebGL setup complete');
      return true;
    } catch (e: any) {
      warn('WebGL setup failed:', e && e.message ? e.message : e);
      state.status.gl = 'failed';
      return false;
    }
  }

  // ---- Sprites ----
  var sprites: { x: number; y: number; w: number; h: number; vx: number; vy: number; colorU32: number }[] = [];
  var INIT_SPRITES = 24;

  var COLOR_TABLE = [
    0xFF4488FF, // blue   (ABGR)
    0xFF88FF44, // green
    0xFF4488FF, // orange — recalc below
    0xFFAA44FF, // pink
    0xFF44FFFF, // yellow
    0xFFFFFF44, // cyan
    0xFFFF44AA, // purple
    0xFF4444FF, // red
  ];
  // Correct ABGR packing
  function packABGR(r: number, g: number, b: number, a: number): number {
    return (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  COLOR_TABLE = [
    packABGR(68, 136, 255, 255),
    packABGR(68, 255, 136, 255),
    packABGR(255, 136, 68, 255),
    packABGR(255, 68, 170, 255),
    packABGR(255, 255, 68, 255),
    packABGR(68, 255, 255, 255),
    packABGR(170, 68, 255, 255),
    packABGR(255, 68, 68, 255),
  ];

  function initSprites(): void {
    for (var i = 0; i < INIT_SPRITES; i++) {
      var size = 20 + Math.random() * 40;
      sprites.push({
        x: Math.random() * (canvasWidth - size),
        y: Math.random() * (canvasHeight - size),
        w: size, h: size,
        vx: (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1),
        vy: (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1),
        colorU32: COLOR_TABLE[i % COLOR_TABLE.length],
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
          sprites.push({
            x: tx - size / 2, y: ty - size / 2,
            w: size, h: size,
            vx: (80 + Math.random() * 160) * (Math.random() > 0.5 ? 1 : -1),
            vy: (80 + Math.random() * 160) * (Math.random() > 0.5 ? 1 : -1),
            colorU32: COLOR_TABLE[Math.floor(Math.random() * COLOR_TABLE.length)],
          });
        }
        while (sprites.length > MAX_SPRITES) sprites.shift();
        log('touch spawn, total:', sprites.length);
      });
    }
    if (typeof wx.onTouchEnd === 'function') {
      wx.onTouchEnd(function onTE() {
        state.status.touch = 'ended';
      });
    }
  }

  // ---- Render ----
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

  var drawCallCount = 0;

  function render(): void {
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

    drawCallCount = 0;
    var batchSize = MAX_SPRITES;

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
      drawCallCount++;
    }

    renderHud();
  }

  // ---- HUD rendered via WebGL quads ----
  // For simplicity, use a second 2D canvas for text overlay, composited via gl
  // Actually: WeChat only shows the first canvas. We can't overlay.
  // Solution: render HUD as colored quads in WebGL (no text, just indicator bars).

  var fpsAccum = 0;
  var fpsFrames = 0;
  var displayFps = 0;

  function renderHud(): void {
    if (!gl) return;

    // HUD: draw a thin bar at top showing FPS via color gradient
    // Green = 60fps, yellow = 30fps, red = <20fps
    var barH = 6;
    var fpsRatio = Math.min(displayFps / 60, 1);
    var barW = canvasWidth * fpsRatio;

    // We'll batch 2 quads: bg bar + fps bar
    var hudData = new Float32Array(2 * 4 * 5);
    var hudColor = new Uint32Array(hudData.buffer);

    var bgColor = packABGR(20, 20, 30, 200);
    var fpsColor = fpsRatio > 0.9 ? packABGR(110, 231, 168, 255)
                 : fpsRatio > 0.5 ? packABGR(255, 209, 102, 255)
                 : packABGR(255, 123, 123, 255);

    // BG bar (full width)
    hudData[0] = 0;           hudData[1] = 0;           hudData[2] = 0; hudData[3] = 0; hudColor[4] = bgColor;
    hudData[5] = canvasWidth; hudData[6] = 0;           hudData[7] = 1; hudData[8] = 0; hudColor[9] = bgColor;
    hudData[10] = canvasWidth;hudData[11] = barH;       hudData[12] = 1; hudData[13] = 1; hudColor[14] = bgColor;
    hudData[15] = 0;          hudData[16] = barH;       hudData[17] = 0; hudData[18] = 1; hudColor[19] = bgColor;

    // FPS bar
    hudData[20] = 0;    hudData[21] = 0;    hudData[22] = 0; hudData[23] = 0; hudColor[24] = fpsColor;
    hudData[25] = barW; hudData[26] = 0;    hudData[27] = 1; hudData[28] = 0; hudColor[29] = fpsColor;
    hudData[30] = barW; hudData[31] = barH; hudData[32] = 1; hudData[33] = 1; hudColor[34] = fpsColor;
    hudData[35] = 0;    hudData[36] = barH; hudData[37] = 0; hudData[38] = 1; hudColor[39] = fpsColor;

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, hudData);

    var stride = 20;
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.UNSIGNED_BYTE, true, stride, 16);

    gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
    drawCallCount++;
  }

  // ---- requestAnimationFrame polyfill ----
  var rafSource = 'none';

  function requestFrame(cb: (timestamp: number) => void): void {
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
      if (rafSource === 'none') { rafSource = 'setTimeout'; log('raf source: setTimeout fallback'); }
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
    render();

    state.frameCount++;
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1.0) {
      displayFps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    if (state.status.loop !== 'running') {
      state.status.loop = 'running';
    }

    if (state.frameCount === 1 || state.frameCount % 120 === 0) {
      log('frame', state.frameCount, 'fps', displayFps.toFixed(1),
          'sprites', sprites.length, 'drawCalls', drawCallCount);
    }

    requestFrame(tick);
  }

  // ---- Boot ----
  log('start');

  if (state.hasWx && typeof wx.showToast === 'function') {
    try {
      wx.showToast({ title: 'WebGL smoke', icon: 'none', duration: 1500 });
    } catch (_: any) { /* ignore */ }
  }

  var canvasOk = setupCanvas();
  if (!canvasOk) {
    warn('FATAL: primary canvas failed');
    state.summary = 'fail';
  } else {
    var glOk = setupWebGL();
    if (!glOk) {
      warn('FATAL: WebGL failed on primary canvas, status:', JSON.stringify(state.status));
      state.summary = 'webgl-fail';
    } else {
      setupTouch();
      initSprites();
      requestFrame(tick);
      log('loop started, sprites:', sprites.length);
      state.summary = 'running';
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__MEMBRANE_WX_SMOKE__ = state;
  }

  module.exports = state;
})();
