(function bootstrapSmoke() {
  var smokeState = {
    caseId: 'wx-smoke-bootstrap',
    startedAt: Date.now(),
    frameCount: 0,
    hasWx: typeof wx !== 'undefined',
    canvasReady: false,
    rafReady: false,
    readFileReady: false,
    touchReady: false,
    lastTouchType: null,
    status: {
      bootstrap: 'running',
      canvas: 'pending',
      raf: 'pending',
      readFile: 'pending',
      touch: 'pending'
    }
  };

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Membrane][wx-smoke-bootstrap]');
    console.info.apply(console, args);
  }

  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Membrane][wx-smoke-bootstrap]');
    console.warn.apply(console, args);
  }

  function setStatus(key, value) {
    smokeState.status[key] = value;
    drawStatusPanel();
  }

  function drawTextLine(text, x, y, color, font) {
    if (!smokeState.ctx) {
      return;
    }

    smokeState.ctx.fillStyle = color || '#f4f7fb';
    smokeState.ctx.font = font || '12px sans-serif';
    smokeState.ctx.fillText(text, x, y);
  }

  function drawStatusPanel() {
    if (!smokeState.ctx) {
      return;
    }

    var ctx = smokeState.ctx;
    var width = smokeState.canvasWidth || 320;
    var panelHeight = 136;

    ctx.fillStyle = '#1d2630';
    ctx.fillRect(0, 0, width, panelHeight);

    drawTextLine('Membrane smoke', 20, 32, '#f4f7fb', '20px sans-serif');
    drawTextLine(smokeState.caseId, 20, 54, '#9fb3c8', '14px sans-serif');
    drawTextLine('canvas: ' + smokeState.status.canvas, 20, 78);
    drawTextLine('raf: ' + smokeState.status.raf, 20, 96);
    drawTextLine('readFile: ' + smokeState.status.readFile, 20, 114);
    drawTextLine('touch: ' + smokeState.status.touch, 20, 132);
    drawTextLine('frame: ' + smokeState.frameCount, 180, 78);

    if (smokeState.readFileText) {
      drawTextLine('asset: ' + smokeState.readFileText, 180, 96);
    }

    if (smokeState.deviceLabel) {
      drawTextLine(smokeState.deviceLabel, 180, 114, '#9fb3c8');
    }
  }

  function captureSystemInfo() {
    if (!smokeState.hasWx || typeof wx.getSystemInfoSync !== 'function') {
      return;
    }

    try {
      var info = wx.getSystemInfoSync();
      smokeState.systemInfo = info;
      smokeState.deviceLabel = [info.brand, info.model].filter(Boolean).join(' ');
      log('system info', smokeState.deviceLabel || 'unknown-device');
    } catch (error) {
      warn('getSystemInfoSync failed', error && error.message ? error.message : error);
    }
  }

  function setupCanvas() {
    if (!smokeState.hasWx || typeof wx.createCanvas !== 'function') {
      warn('wx.createCanvas is unavailable');
      setStatus('canvas', 'unavailable');
      return;
    }

    try {
      var canvas = wx.createCanvas();
      smokeState.canvasReady = !!canvas;

      if (!canvas || typeof canvas.getContext !== 'function') {
        warn('canvas created without getContext');
        setStatus('canvas', 'invalid');
        return;
      }

      var ctx = canvas.getContext('2d');
      if (!ctx) {
        warn('2d context unavailable');
        setStatus('canvas', 'no-2d-context');
        return;
      }

      var width = canvas.width || 320;
      var height = canvas.height || 180;

      smokeState.canvasWidth = width;
      smokeState.canvasHeight = height;
      smokeState.canvas = canvas;
      smokeState.ctx = ctx;

      setStatus('canvas', 'ready');
      drawStatusPanel();
      log('canvas ready', width + 'x' + height);
    } catch (error) {
      warn('canvas setup failed', error && error.message ? error.message : error);
      setStatus('canvas', 'failed');
    }
  }

  function setupTouch() {
    if (!smokeState.hasWx) {
      setStatus('touch', 'unavailable');
      return;
    }

    if (typeof wx.onTouchStart === 'function') {
      wx.onTouchStart(function onTouchStart() {
        smokeState.touchReady = true;
        smokeState.lastTouchType = 'start';
        setStatus('touch', 'start');
        log('touch start');
      });
    } else {
      setStatus('touch', 'unavailable');
    }

    if (typeof wx.onTouchMove === 'function') {
      wx.onTouchMove(function onTouchMove() {
        smokeState.lastTouchType = 'move';
        setStatus('touch', 'move');
      });
    }

    if (typeof wx.onTouchEnd === 'function') {
      wx.onTouchEnd(function onTouchEnd() {
        smokeState.lastTouchType = 'end';
        setStatus('touch', 'end');
        log('touch end');
      });
    }
  }

  function setupReadFileSmoke() {
    if (!smokeState.hasWx || typeof wx.getFileSystemManager !== 'function') {
      warn('wx.getFileSystemManager is unavailable');
      setStatus('readFile', 'unavailable');
      return;
    }

    try {
      var fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: 'assets/bootstrap.txt',
        encoding: 'utf8',
        success: function success(result) {
          smokeState.readFileReady = true;
          smokeState.readFileText = result && result.data ? String(result.data) : '';
          setStatus('readFile', 'ready');
          log('readFile ready', smokeState.readFileText);
        },
        fail: function fail(error) {
          setStatus('readFile', 'failed');
          warn('readFile failed', error && error.errMsg ? error.errMsg : error);
        }
      });
    } catch (error) {
      warn('readFile setup failed', error && error.message ? error.message : error);
      setStatus('readFile', 'failed');
    }
  }

  function tickFrame(timestamp) {
    smokeState.frameCount += 1;
    smokeState.lastFrameTimestamp = timestamp;
    smokeState.rafReady = true;
    if (smokeState.status.raf !== 'running') {
      setStatus('raf', 'running');
    }

    drawStatusPanel();

    if (smokeState.frameCount === 1 || smokeState.frameCount % 60 === 0) {
      log('frame', smokeState.frameCount);
    }

    if (smokeState.hasWx && typeof wx.requestAnimationFrame === 'function') {
      wx.requestAnimationFrame(tickFrame);
    }
  }

  function startLoop() {
    if (!smokeState.hasWx || typeof wx.requestAnimationFrame !== 'function') {
      warn('wx.requestAnimationFrame is unavailable');
      setStatus('raf', 'unavailable');
      return;
    }

    wx.requestAnimationFrame(tickFrame);
  }

  log('dist stub start');
  captureSystemInfo();
  setupCanvas();
  setupTouch();
  setupReadFileSmoke();
  startLoop();

  if (typeof globalThis !== 'undefined') {
    globalThis.__MEMBRANE_WX_SMOKE__ = smokeState;
  }

  module.exports = smokeState;
})();
