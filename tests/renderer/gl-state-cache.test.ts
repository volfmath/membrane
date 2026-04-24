import { describe, it, expect, vi } from 'vitest';
import { GLStateCache } from '../../src/renderer/gl-state-cache';

function createMockGL() {
  return {
    TEXTURE0: 0x84C0,
    TEXTURE_2D: 0x0DE1,
    BLEND: 0x0BE2,
    DEPTH_TEST: 0x0B71,
    CULL_FACE: 0x0B44,
    BACK: 0x0405,
    LESS: 0x0201,
    ONE: 1,
    ZERO: 0,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    useProgram: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    depthMask: vi.fn(),
    depthFunc: vi.fn(),
    cullFace: vi.fn(),
    viewport: vi.fn(),
  } as unknown as WebGLRenderingContext;
}

describe('GLStateCache', () => {
  it('useProgram skips redundant calls', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);
    const program = {} as WebGLProgram;

    cache.useProgram(program);
    expect(gl.useProgram).toHaveBeenCalledTimes(1);

    cache.useProgram(program);
    expect(gl.useProgram).toHaveBeenCalledTimes(1);
    expect(cache.skippedCalls).toBe(1);
  });

  it('bindTexture skips redundant calls', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);
    const tex = {} as WebGLTexture;

    cache.bindTexture(0, tex);
    expect(gl.activeTexture).toHaveBeenCalledTimes(1);
    expect(gl.bindTexture).toHaveBeenCalledTimes(1);

    cache.bindTexture(0, tex);
    expect(gl.activeTexture).toHaveBeenCalledTimes(1);
    expect(cache.skippedCalls).toBe(1);
  });

  it('bindTexture allows different slots', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);
    const tex = {} as WebGLTexture;

    cache.bindTexture(0, tex);
    cache.bindTexture(1, tex);
    expect(gl.activeTexture).toHaveBeenCalledTimes(2);
    expect(gl.bindTexture).toHaveBeenCalledTimes(2);
  });

  it('setBlendState enables and disables', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);

    cache.setBlendState(true);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    expect(gl.blendFunc).toHaveBeenCalled();

    cache.setBlendState(true);
    expect(cache.skippedCalls).toBe(1);

    cache.setBlendState(false);
    expect(gl.disable).toHaveBeenCalledWith(gl.BLEND);
  });

  it('setDepthState toggles depth test', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);

    cache.setDepthState(true);
    expect(gl.enable).toHaveBeenCalledWith(gl.DEPTH_TEST);

    cache.setDepthState(true);
    expect(cache.skippedCalls).toBe(1);

    cache.setDepthState(false);
    expect(gl.disable).toHaveBeenCalledWith(gl.DEPTH_TEST);
  });

  it('setCullFace toggles face culling', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);

    cache.setCullFace(true);
    expect(gl.enable).toHaveBeenCalledWith(gl.CULL_FACE);

    cache.setCullFace(true);
    expect(cache.skippedCalls).toBe(1);
  });

  it('setViewport skips redundant calls', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);

    cache.setViewport(0, 0, 800, 600);
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(gl.viewport).toHaveBeenCalledTimes(1);

    cache.setViewport(0, 0, 800, 600);
    expect(gl.viewport).toHaveBeenCalledTimes(1);
    expect(cache.skippedCalls).toBe(1);

    cache.setViewport(0, 0, 1024, 768);
    expect(gl.viewport).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces next calls to go through', () => {
    const gl = createMockGL();
    const cache = new GLStateCache(gl);
    const program = {} as WebGLProgram;

    cache.useProgram(program);
    cache.invalidate();
    cache.useProgram(program);
    expect(gl.useProgram).toHaveBeenCalledTimes(2);
  });
});
