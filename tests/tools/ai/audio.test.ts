import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateMusic, generateSFX } from '../../../tools/ai/audio.js';
import type { AIConnectorConfig } from '../../../tools/ai/types.js';

const CONFIG: AIConnectorConfig = {
  apiKey: 'suno-test',
  baseUrl: 'https://studio-api.suno.ai',
  model: 'chirp-v4',
};

describe('Audio connector', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('generates background music', async () => {
    const audioBytes = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);

    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ audio_url: 'https://example.com/music.mp3' }),
        { status: 200 },
      ))
      .mockResolvedValueOnce(new Response(audioBytes, { status: 200 }));

    const result = await generateMusic(CONFIG, 'upbeat chiptune', { duration: 30, genre: '8-bit' });

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.buffer).toBeInstanceOf(Buffer);
    expect(result.data!.mimeType).toBe('audio/mpeg');
    expect(result.data!.duration).toBe(30);

    const body = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body as string);
    expect(body.prompt).toContain('8-bit');
    expect(body.duration).toBe(30);
    expect(body.make_instrumental).toBe(true);
  });

  it('generates sound effects', async () => {
    const audioBytes = new Uint8Array([0xFF, 0xFB]);

    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ audio_url: 'https://example.com/sfx.mp3' }),
        { status: 200 },
      ))
      .mockResolvedValueOnce(new Response(audioBytes, { status: 200 }));

    const result = await generateSFX(CONFIG, 'coin pickup chime');

    expect(result.ok).toBe(true);
    expect(result.data!.duration).toBe(3);
    expect(result.data!.prompt).toContain('coin pickup');
  });

  it('handles API error', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const result = await generateMusic(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('403');
  });

  it('handles missing audio_url in response', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'processing' }), { status: 200 }),
    );

    const result = await generateMusic(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No audio URL');
  });
});
