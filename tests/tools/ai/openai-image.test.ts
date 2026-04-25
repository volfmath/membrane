import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateSprite, generateBackground } from '../../../tools/ai/openai-image.js';
import { OPENAI_IMAGE_RESPONSE } from '../../fixtures/ai/mock-responses.js';
import type { AIConnectorConfig } from '../../../tools/ai/types.js';

const CONFIG: AIConnectorConfig = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-image-1',
};

describe('OpenAI Image connector', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('generates a sprite from b64_json', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(OPENAI_IMAGE_RESPONSE), { status: 200 }),
    );

    const result = await generateSprite(CONFIG, 'a pixel art warrior');

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.buffer).toBeInstanceOf(Buffer);
    expect(result.data!.buffer.length).toBeGreaterThan(0);
    expect(result.data!.mimeType).toBe('image/png');
    expect(result.data!.width).toBe(256);
    expect(result.data!.height).toBe(256);

    const body = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body as string);
    expect(body.prompt).toContain('warrior');
    expect(body.size).toBe('256x256');
    expect((fetchSpy.mock.calls[0] as any)[1].headers.Authorization).toBe('Bearer sk-test');
  });

  it('generates a background with custom size', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(OPENAI_IMAGE_RESPONSE), { status: 200 }),
    );

    const result = await generateBackground(CONFIG, 'forest scene', { size: '1792x1024' });

    expect(result.ok).toBe(true);
    expect(result.data!.width).toBe(1792);
    expect(result.data!.height).toBe(1024);
  });

  it('handles image download from URL', async () => {
    const urlResponse = { data: [{ url: 'https://example.com/image.png' }] };
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(urlResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(pngBytes, { status: 200 }));

    const result = await generateSprite(CONFIG, 'a coin');

    expect(result.ok).toBe(true);
    expect(result.data!.buffer).toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('handles API error', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"error":"rate limit"}', { status: 429 }),
    );

    const result = await generateSprite(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('429');
  });

  it('handles empty response data', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    const result = await generateSprite(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No image data');
  });
});
