import type { PlatformAdapter } from './types';
import { BrowserAdapter } from './browser-adapter';
import { WxAdapter } from './wx-adapter';

declare const wx: { createCanvas?: () => unknown } | undefined;

export function createPlatformAdapter(): PlatformAdapter {
  if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
    return new WxAdapter();
  }
  return new BrowserAdapter();
}
