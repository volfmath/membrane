declare const module: any;
declare const wx: any;
declare const globalThis: any;

(function smokeUi(): void {
  var TAG = '[Membrane][wx-smoke-ui]';
  function log(...args: any[]): void { args.unshift(TAG); console.info.apply(console, args); }

  var state: any = { caseId: 'wx-smoke-ui', hasWx: typeof wx !== 'undefined', summary: 'booting' };

  // ---- Canvas ----
  var canvas: any = null;
  var ctx: any = null;
  var W = 390;
  var H = 844;
  var dpr = 1;

  function setupCanvas(): boolean {
    try {
      canvas = wx.createCanvas();
      ctx = canvas.getContext('2d');
      W = canvas.width || 390;
      H = canvas.height || 844;
      var sys = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null;
      if (sys) dpr = sys.pixelRatio || 1;
      log('canvas', W + 'x' + H, 'dpr=' + dpr);
      return true;
    } catch (e: any) { log('canvas fail', e?.message ?? e); return false; }
  }

  // ---- UI state ----
  var countA = 0;
  var countB = 0;
  var toggled = false;
  var sliderVal = 0.4;   // 0..1
  var lastTap = '';
  var pressedId = '';    // which element finger is currently down on
  var slidingActive = false;

  // ---- Layout ----
  // computed after canvas ready
  var PAD = 20;
  var ROW_H = 64;
  var ROW_GAP = 14;

  interface Elem {
    id: string;
    type: 'button' | 'toggle' | 'slider';
    x: number; y: number; w: number; h: number;
    label: string;
  }

  var elems: Elem[] = [];

  function buildLayout(): void {
    PAD = Math.round(W * 0.05);
    ROW_H = Math.round(H * 0.075);
    ROW_GAP = Math.round(H * 0.018);
    var bw = Math.round((W - PAD * 2 - 12) * 0.55);
    var y0 = Math.round(H * 0.14);
    var step = ROW_H + ROW_GAP;

    elems = [
      { id: 'btnA', type: 'button', x: PAD, y: y0, w: bw, h: ROW_H, label: 'BUTTON A' },
      { id: 'btnB', type: 'button', x: PAD, y: y0 + step, w: bw, h: ROW_H, label: 'BUTTON B' },
      { id: 'tog',  type: 'toggle', x: PAD, y: y0 + step * 2, w: W - PAD * 2, h: ROW_H, label: 'Toggle' },
      { id: 'sld',  type: 'slider', x: PAD, y: y0 + step * 3, w: W - PAD * 2, h: ROW_H, label: 'Slider' },
    ];
  }

  // ---- Hit test ----
  function hitElem(tx: number, ty: number): Elem | null {
    for (var i = 0; i < elems.length; i++) {
      var el = elems[i];
      if (tx >= el.x && tx <= el.x + el.w && ty >= el.y && ty <= el.y + el.h) return el;
    }
    return null;
  }

  function touchX(e: any): number {
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return t ? t.clientX : 0;
  }
  function touchY(e: any): number {
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return t ? t.clientY : 0;
  }

  function updateSlider(tx: number, el: Elem): void {
    var rel = tx - el.x;
    sliderVal = Math.max(0, Math.min(1, rel / el.w));
  }

  // ---- Touch ----
  function setupTouch(): void {
    if (typeof wx.onTouchStart !== 'function') return;

    wx.onTouchStart(function(e: any) {
      var tx = touchX(e), ty = touchY(e);
      lastTap = '(' + Math.round(tx) + ', ' + Math.round(ty) + ')';
      var el = hitElem(tx, ty);
      pressedId = el ? el.id : '';
      slidingActive = (el && el.type === 'slider') ? true : false;
      if (slidingActive && el) updateSlider(tx, el);
      log('touchStart pressedId=' + pressedId);
    });

    wx.onTouchMove(function(e: any) {
      if (!slidingActive) return;
      var tx = touchX(e);
      var el = elems.find ? elems.find(function(x: Elem) { return x.id === 'sld'; })
               : (function() { for (var i = 0; i < elems.length; i++) { if (elems[i].id === 'sld') return elems[i]; } return null; })();
      if (el) updateSlider(tx, el);
    });

    wx.onTouchEnd(function(e: any) {
      var tx = touchX(e), ty = touchY(e);
      var el = hitElem(tx, ty);

      // fire action only if finger lifted on same element it started on
      if (el && el.id === pressedId) {
        if (el.id === 'btnA') { countA++; log('btnA -> ' + countA); }
        else if (el.id === 'btnB') { countB++; log('btnB -> ' + countB); }
        else if (el.id === 'tog') { toggled = !toggled; log('toggle -> ' + String(toggled)); }
      }
      pressedId = '';
      slidingActive = false;
    });

    wx.onTouchCancel(function() {
      pressedId = '';
      slidingActive = false;
    });
  }

  // ---- Render helpers ----
  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawButton(el: Elem, pressed: boolean): void {
    var bg = pressed ? '#3b82f6' : '#1e293b';
    var border = pressed ? '#60a5fa' : '#334155';
    ctx.fillStyle = bg;
    roundRect(el.x, el.y, el.w, el.h, 10);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pressed ? '#ffffff' : '#e2e8f0';
    var fs = Math.max(14, Math.round(el.h * 0.36));
    ctx.font = 'bold ' + fs + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h / 2);
  }

  function drawToggle(el: Elem, on: boolean, pressed: boolean): void {
    var labelFs = Math.max(14, Math.round(el.h * 0.34));
    ctx.fillStyle = '#94a3b8';
    ctx.font = labelFs + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.label, el.x, el.y + el.h / 2);

    // pill
    var pw = Math.round(el.w * 0.4);
    var ph = Math.round(el.h * 0.58);
    var px = el.x + el.w - pw;
    var py = el.y + (el.h - ph) / 2;
    var pr = ph / 2;

    ctx.fillStyle = on ? '#16a34a' : '#1e293b';
    roundRect(px, py, pw, ph, pr);
    ctx.fill();
    ctx.strokeStyle = on ? '#22c55e' : '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    // thumb
    var thumbR = Math.round(ph * 0.38);
    var thumbX = on ? px + pw - thumbR - 4 : px + thumbR + 4;
    ctx.beginPath();
    ctx.arc(thumbX, py + ph / 2, thumbR, 0, Math.PI * 2);
    ctx.fillStyle = pressed ? '#bfdbfe' : '#ffffff';
    ctx.fill();

    ctx.fillStyle = on ? '#bbf7d0' : '#94a3b8';
    ctx.font = 'bold ' + Math.round(labelFs * 0.85) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(on ? 'ON' : 'OFF', px + pw / 2, py + ph / 2);
  }

  function drawSlider(el: Elem, val: number, sliding: boolean): void {
    var labelFs = Math.max(13, Math.round(el.h * 0.32));
    ctx.fillStyle = '#94a3b8';
    ctx.font = labelFs + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.label, el.x, el.y + el.h / 2);

    var pct = Math.round(val * 100);
    ctx.fillStyle = '#60a5fa';
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%', el.x + el.w, el.y + el.h / 2);

    // track
    var trackH = Math.round(el.h * 0.22);
    var trackY = el.y + (el.h - trackH) / 2;
    var labelW = Math.round(el.w * 0.22);
    var pctW = Math.round(el.w * 0.14);
    var trackX = el.x + labelW;
    var trackW = el.w - labelW - pctW - 8;
    var trackR = trackH / 2;

    ctx.fillStyle = '#1e293b';
    roundRect(trackX, trackY, trackW, trackH, trackR);
    ctx.fill();

    var fillW = Math.round(trackW * val);
    if (fillW > 0) {
      ctx.fillStyle = sliding ? '#60a5fa' : '#3b82f6';
      roundRect(trackX, trackY, fillW, trackH, trackR);
      ctx.fill();
    }

    // thumb
    var thumbR = Math.round(el.h * 0.28);
    var thumbX = trackX + fillW;
    ctx.beginPath();
    ctx.arc(thumbX, el.y + el.h / 2, thumbR, 0, Math.PI * 2);
    ctx.fillStyle = sliding ? '#bfdbfe' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---- Render loop ----
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

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Title
    var titleFs = Math.max(18, Math.round(W / 20));
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold ' + titleFs + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('UI Smoke', W / 2, Math.round(H * 0.07));

    // FPS
    ctx.fillStyle = fps > 30 ? '#4ade80' : '#facc15';
    ctx.font = Math.max(11, Math.round(W / 34)) + 'px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('fps ' + fps.toFixed(0), W - PAD, Math.round(H * 0.07));

    // Counter labels (to the right of buttons)
    var bw = elems[0] ? elems[0].w : 0;
    var counterX = elems[0] ? elems[0].x + bw + 16 : 0;
    var cFs = Math.max(13, Math.round(ROW_H * 0.32));
    ctx.font = cFs + 'px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (elems[0]) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('count:', counterX, elems[0].y + elems[0].h / 2 - 2);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold ' + Math.round(cFs * 1.3) + 'px monospace';
      ctx.fillText(String(countA), counterX + Math.round(cFs * 4.2), elems[0].y + elems[0].h / 2 - 2);
    }
    if (elems[1]) {
      ctx.font = cFs + 'px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('count:', counterX, elems[1].y + elems[1].h / 2 - 2);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold ' + Math.round(cFs * 1.3) + 'px monospace';
      ctx.fillText(String(countB), counterX + Math.round(cFs * 4.2), elems[1].y + elems[1].h / 2 - 2);
    }

    // Draw elements
    for (var i = 0; i < elems.length; i++) {
      var el = elems[i];
      var pressed = pressedId === el.id;
      if (el.type === 'button') {
        drawButton(el, pressed);
      } else if (el.type === 'toggle') {
        drawToggle(el, toggled, pressed);
      } else if (el.type === 'slider') {
        drawSlider(el, sliderVal, slidingActive);
      }

      // divider below each row
      var divY = el.y + el.h + ROW_GAP / 2;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, divY);
      ctx.lineTo(W - PAD, divY);
      ctx.stroke();
    }

    // Debug line
    var dbY = H - Math.round(H * 0.04);
    ctx.fillStyle = '#475569';
    ctx.font = Math.max(11, Math.round(W / 36)) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('last tap: ' + (lastTap || '—') + '  toggled=' + String(toggled), W / 2, dbY);

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
    buildLayout();
    setupTouch();
    requestFrame(render);
    state.summary = 'running';
    log('ui smoke running, elements=' + elems.length);
  }

  if (typeof globalThis !== 'undefined') globalThis.__MEMBRANE_WX_SMOKE__ = state;
  module.exports = state;
})();
