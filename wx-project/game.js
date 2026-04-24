console.info('[Membrane][wx-smoke-bootstrap] start');

if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
  try {
    wx.showToast({
      title: 'Membrane smoke',
      icon: 'none',
      duration: 1200
    });
  } catch (error) {
    console.warn('[Membrane][wx-smoke-bootstrap] toast failed', error);
  }
}

try {
  var smokeState = require('./dist/index.js');
  console.info('[Membrane][wx-smoke-bootstrap] loaded ./dist/index.js');

  if (smokeState && typeof smokeState === 'object') {
    console.info(
      '[Membrane][wx-smoke-bootstrap] case=%s hasWx=%s',
      smokeState.caseId,
      String(smokeState.hasWx)
    );
  }
} catch (error) {
  console.warn(
    '[Membrane][wx-smoke-bootstrap] failed to load ./dist/index.js',
    error && error.message ? error.message : error
  );
}
