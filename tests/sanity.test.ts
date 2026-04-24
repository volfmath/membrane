import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index';

describe('sanity', () => {
  it('should export a version string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toBe('0.1.0');
  });
});
