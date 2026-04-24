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
  require('./dist/index.js');
  console.info('[Membrane][wx-smoke-bootstrap] loaded ./dist/index.js');
} catch (error) {
  console.warn('[Membrane][wx-smoke-bootstrap] ./dist/index.js not found yet');
}
