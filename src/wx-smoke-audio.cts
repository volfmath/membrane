declare const module: any;
declare const wx: any;
declare const globalThis: any;

(function smokeAudio(): void {
  var TAG = '[Membrane][wx-smoke-audio]';
  function log(...args: any[]): void { args.unshift(TAG); console.info.apply(console, args); }
  function warn(...args: any[]): void { args.unshift(TAG); console.warn.apply(console, args); }

  var state: any = { caseId: 'wx-smoke-audio', hasWx: typeof wx !== 'undefined', summary: 'booting' };

  // ---- Canvas2D ----
  var canvas: any = null;
  var ctx: any = null;
  var canvasWidth = 390;
  var canvasHeight = 844;

  function setupCanvas(): boolean {
    try {
      canvas = wx.createCanvas();
      ctx = canvas.getContext('2d');
      canvasWidth = canvas.width || 390;
      canvasHeight = canvas.height || 844;
      return true;
    } catch (e: any) { warn('canvas fail', e?.message ?? e); return false; }
  }

  // ---- Status lines ----
  var lines: string[] = [];
  function addLine(s: string): void { lines.push(s); log(s); }

  // ---- Audio state ----
  var bgm: any = null;
  var bgmStatus = 'init';
  var isPlaying = false;
  var currentTime = 0;
  var duration = 0;

  // ---- File diagnostics ----
  var statResults: string[] = [];
  var workingPath = '';  // path that stat() confirmed exists

  function runDiagnostics(): void {
    if (typeof wx.getFileSystemManager !== 'function') {
      statResults.push('FSM: NOT AVAILABLE');
      setupAudio();
      return;
    }
    var fsm = wx.getFileSystemManager();
    var paths = ['assets/9.MP3', '/assets/9.MP3', 'assets/9.mp3'];
    var checked = 0;

    function checkNext(): void {
      if (checked >= paths.length) {
        setupAudio();
        return;
      }
      var p = paths[checked++];
      try {
        fsm.stat({
          path: p,
          success: function(res: any) {
            var sz = res && res.stats && res.stats.size ? res.stats.size : '?';
            statResults.push('stat OK: ' + p + ' (' + sz + 'B)');
            log('stat ok', p, sz);
            if (!workingPath) workingPath = p;
            checkNext();
          },
          fail: function(e: any) {
            statResults.push('stat FAIL: ' + p + ' — ' + (e.errMsg || e));
            checkNext();
          }
        });
      } catch (ex: any) {
        statResults.push('stat EX: ' + p + ' — ' + (ex.message || ex));
        checkNext();
      }
    }
    checkNext();
  }

  // ---- InnerAudioContext setup ----
  function setupAudio(): void {
    var srcToUse = workingPath || 'assets/9.MP3';
    addLine('audio src: ' + srcToUse);

    if (typeof wx.createInnerAudioContext !== 'function') {
      bgmStatus = 'API missing';
      addLine('InnerAudioContext: NOT AVAILABLE');
      return;
    }
    bgm = wx.createInnerAudioContext();
    bgm.src = srcToUse;
    bgm.loop = true;
    bgm.volume = 1.0;

    bgm.onCanplay(function() {
      bgmStatus = 'canplay';
      duration = bgm.duration || 0;
      addLine('canplay! dur=' + duration.toFixed(1));
    });
    bgm.onPlay(function() {
      isPlaying = true;
      bgmStatus = 'playing';
      addLine('PLAYING');
    });
    bgm.onPause(function() {
      isPlaying = false;
      bgmStatus = 'paused';
      addLine('paused');
    });
    bgm.onTimeUpdate(function() {
      currentTime = bgm.currentTime || 0;
      if (!duration) duration = bgm.duration || 0;
    });
    bgm.onError(function(e: any) {
      var msg = e?.errMsg || e?.errCode || JSON.stringify(e);
      bgmStatus = 'ERROR';
      addLine('ERR: ' + msg);
    });
    addLine('bgm created');
  }

  // ---- Copy fallback: package → USER_DATA ----
  function tryCopyAndPlay(): void {
    if (typeof wx.getFileSystemManager !== 'function') {
      addLine('FSM unavailable, skip copy');
      return;
    }
    if (typeof wx.env === 'undefined' || !wx.env.USER_DATA_PATH) {
      addLine('USER_DATA_PATH unavailable');
      return;
    }
    var destPath = wx.env.USER_DATA_PATH + '/smoke_audio_9.mp3';
    var srcPath = workingPath || 'assets/9.MP3';
    addLine('copy: ' + srcPath + ' → ' + destPath);
    wx.getFileSystemManager().copyFile({
      srcPath: srcPath,
      destPath: destPath,
      success: function() {
        addLine('copy OK → playing from USER_DATA');
        if (bgm) { bgm.destroy(); }
        bgm = wx.createInnerAudioContext();
        bgm.src = destPath;
        bgm.loop = true;
        bgm.onError(function(e: any) { addLine('copy-bgm ERR: ' + (e?.errMsg || e)); });
        bgm.onPlay(function() { isPlaying = true; bgmStatus = 'copy-playing'; addLine('copy PLAYING'); });
        bgm.play();
      },
      fail: function(e: any) {
        addLine('copy FAIL: ' + (e?.errMsg || e));
      }
    });
  }

  // ---- Web Audio beep (with proper async resume) ----
  var webCtx: any = null;
  var beepState = 'idle';

  function tryBeep(): void {
    try {
      if (!webCtx) {
        if (typeof wx.createWebAudioContext !== 'function') {
          addLine('WebAudio: NOT AVAILABLE');
          return;
        }
        webCtx = wx.createWebAudioContext();
        addLine('WebAudioCtx created state=' + webCtx.state);
      }

      var doBeep = function() {
        try {
          var osc = webCtx.createOscillator();
          var g = webCtx.createGain();
          g.gain.value = 0.3;
          osc.frequency.value = 880;
          osc.connect(g);
          g.connect(webCtx.destination);
          var t = webCtx.currentTime;
          osc.start(t);
          osc.stop(t + 0.3);
          beepState = 'sent';
          addLine('BEEP sent (state=' + webCtx.state + ')');
        } catch (e2: any) {
          beepState = 'err';
          addLine('beep inner err: ' + (e2?.message ?? e2));
        }
      };

      if (webCtx.state === 'suspended') {
        addLine('resuming WebAudio...');
        webCtx.resume().then(function() {
          addLine('resumed state=' + webCtx.state);
          doBeep();
        }).catch(function(e: any) {
          addLine('resume fail: ' + (e?.message ?? e));
          doBeep();  // try anyway
        });
      } else {
        doBeep();
      }
    } catch (e: any) {
      beepState = 'err';
      addLine('BEEP err: ' + (e?.message ?? e));
    }
  }

  // ---- Touch ----
  var tapCount = 0;

  function setupTouch(): void {
    if (typeof wx.onTouchStart !== 'function') return;
    wx.onTouchStart(function() {
      tapCount++;
      log('tap #' + tapCount);

      if (tapCount === 1) {
        // First tap: try play
        if (bgm) {
          if (isPlaying) { bgm.pause(); } else {
            addLine('tap1: calling play()');
            bgm.play();
          }
        }
      } else if (tapCount === 2) {
        // Second tap: try Web Audio beep
        tryBeep();
      } else if (tapCount === 3) {
        // Third tap: try copy fallback
        tryCopyAndPlay();
      } else {
        // Subsequent: toggle bgm or beep alternating
        if (tapCount % 2 === 1) {
          if (bgm) { if (isPlaying) { bgm.pause(); } else { bgm.play(); } }
        } else {
          tryBeep();
        }
      }
    });
  }

  // ---- Render ----
  var frame = 0;
  var lastT = 0;
  var fps = 0;
  var fpsAcc = 0;
  var fpsN = 0;

  function render(ts: number): void {
    if (lastT) {
      var dt = (ts - lastT) / 1000;
      fpsAcc += dt; fpsN++;
      if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    }
    lastT = ts;
    frame++;

    var W = canvasWidth, H = canvasHeight;
    var cx = W / 2;
    var fs = Math.max(13, Math.floor(W / 28));

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    // Title
    ctx.fillStyle = '#f0f0f0';
    ctx.font = 'bold ' + (fs + 2) + 'px sans-serif';
    ctx.fillText('Audio Smoke', cx, 40);

    // Tap guide
    ctx.font = (fs - 2) + 'px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Tap1=play  Tap2=beep  Tap3=copy+play', cx, 62);

    // File stat results
    var fy = 82;
    ctx.font = (fs - 3) + 'px monospace';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText('--- file stat ---', cx, fy);
    fy += 18;
    var statShow = statResults.length > 0 ? statResults : ['(running...)'];
    for (var i = 0; i < statShow.length && i < 4; i++) {
      var sr = statShow[i];
      ctx.fillStyle = sr.startsWith('stat OK') ? '#6ee7b7' : sr.startsWith('stat FAIL') ? '#f87171' : '#fbbf24';
      ctx.fillText(sr, cx, fy + i * 17);
    }
    fy += statShow.length * 17 + 6;

    // BGM status box
    ctx.fillStyle = bgmStatus === 'playing' || bgmStatus === 'copy-playing' ? '#14532d'
                  : bgmStatus === 'ERROR' ? '#450a0a' : '#1e293b';
    ctx.fillRect(20, fy, W - 40, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + fs + 'px sans-serif';
    ctx.fillText('BGM: ' + bgmStatus.toUpperCase(), cx, fy + 24);
    ctx.font = (fs - 3) + 'px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(currentTime.toFixed(1) + 's / ' + duration.toFixed(1) + 's', cx, fy + 44);
    ctx.fillText('tap#' + tapCount + '  play=' + String(isPlaying), cx, fy + 62);
    fy += 80;

    // Web Audio box
    ctx.fillStyle = beepState === 'sent' ? '#14532d' : beepState === 'err' ? '#450a0a' : '#1e293b';
    ctx.fillRect(20, fy, W - 40, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + (fs - 1) + 'px sans-serif';
    ctx.fillText('WebAudio: ' + (webCtx ? 'ctx=' + (webCtx.state || '?') + ' beep=' + beepState : 'untested'), cx, fy + 24);
    fy += 48;

    // Log lines (last 10)
    var logY = fy + 4;
    ctx.font = (fs - 4) + 'px monospace';
    var recent = lines.slice(-10);
    for (var j = 0; j < recent.length; j++) {
      ctx.fillStyle = recent[j].startsWith('ERR') || recent[j].includes('FAIL') ? '#f87171'
                    : recent[j].startsWith('PLAYING') || recent[j].startsWith('BEEP') ? '#6ee7b7'
                    : '#94a3b8';
      ctx.fillText(recent[j], cx, logY + j * 18);
    }

    // FPS
    ctx.fillStyle = fps > 30 ? '#4ade80' : '#facc15';
    ctx.font = (fs - 3) + 'px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('fps ' + fps.toFixed(0), W - 8, H - 8);

    requestFrame(render);
  }

  function requestFrame(cb: (t: number) => void): void {
    if (canvas && typeof canvas.requestAnimationFrame === 'function') { canvas.requestAnimationFrame(cb); }
    else if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(cb); }
    else { setTimeout(function() { cb(Date.now()); }, 16); }
  }

  // ---- Boot ----
  log('start');
  if (state.hasWx && typeof wx.onError === 'function') {
    wx.onError(function(m: string) { console.error(TAG, m); });
  }

  if (!setupCanvas()) {
    state.summary = 'fail';
  } else {
    addLine('hasWx=' + String(state.hasWx));
    runDiagnostics();
    setupTouch();
    requestFrame(render);
    state.summary = 'running';
  }

  if (typeof globalThis !== 'undefined') globalThis.__MEMBRANE_WX_SMOKE__ = state;
  module.exports = state;
})();
