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

function setupGlobalErrorHooks() {
  if (typeof wx === 'undefined') {
    return;
  }

  if (typeof wx.onError === 'function') {
    wx.onError(function onError(message) {
      console.error('[Membrane][wx-smoke-bootstrap] wx.onError', message);
    });
  }

  if (typeof wx.onUnhandledRejection === 'function') {
    wx.onUnhandledRejection(function onUnhandledRejection(event) {
      console.error(
        '[Membrane][wx-smoke-bootstrap] wx.onUnhandledRejection',
        event && event.reason ? event.reason : event
      );
    });
  }
}

log('start');
setupGlobalErrorHooks();

if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
  try {
    wx.showToast({
      title: 'Membrane smoke',
      icon: 'none',
      duration: 1200
    });
  } catch (error) {
    warn('toast failed', error);
  }
}

try {
  var smokeState = require('./dist/index.js');
  log('loaded ./dist/index.js');

  if (smokeState && typeof smokeState === 'object') {
    log(
      'case=' +
        smokeState.caseId +
        ' hasWx=' +
        String(smokeState.hasWx) +
        ' summary=' +
        smokeState.summary
    );
  }
} catch (error) {
  warn('failed to load ./dist/index.js', error && error.message ? error.message : error);
}
