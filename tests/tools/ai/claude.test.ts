import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateScene, generateEvents, generateSystemCode } from '../../../tools/ai/claude.js';
import { CLAUDE_SCENE_RESPONSE, CLAUDE_EVENTS_RESPONSE, CLAUDE_CODE_RESPONSE } from '../../fixtures/ai/mock-responses.js';
import type { AIConnectorConfig } from '../../../tools/ai/types.js';

const CONFIG: AIConnectorConfig = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
};

describe('Claude connector', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('generates a scene from prompt', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_SCENE_RESPONSE), { status: 200 }),
    );

    const result = await generateScene(CONFIG, 'Create a simple runner game level');

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.sceneId).toBe('runner_level_01');
    expect(result.data!.entities).toHaveLength(4);
    expect(result.data!.events).toHaveLength(2);
    expect(result.usage).toBeDefined();
    expect(result.usage!.inputTokens).toBe(500);

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/messages');
    const body = JSON.parse(options.body as string);
    expect(body.model).toContain('claude');
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('sk-test');
  });

  it('includes context in scene generation', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_SCENE_RESPONSE), { status: 200 }),
    );

    await generateScene(CONFIG, 'Create level 2', {
      existingScenes: ['level_01'],
      projectManifest: { projectRoot: '/test', scenes: [{ sceneId: 'level_01', entityCount: 5, path: '' }], hasAssets: false, hasImportReport: false },
    });

    const body = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body as string);
    expect(body.messages[0].content).toContain('level_01');
  });

  it('generates events for a scene', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_EVENTS_RESPONSE), { status: 200 }),
    );

    const result = await generateEvents(CONFIG, 'level_01', 'Add jump and land events', [
      { id: 'player', name: 'Player', components: { Transform: { x: 0, y: 0 }, Tags: { values: ['player'] } } },
    ]);

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].id).toBe('jump');
  });

  it('generates system code', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_CODE_RESPONSE), { status: 200 }),
    );

    const result = await generateSystemCode(CONFIG, 'Create a gravity system');

    expect(result.ok).toBe(true);
    expect(result.data).toContain('gravitySystem');
  });

  it('handles API error response', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"error":{"message":"Invalid API key"}}', { status: 401 }),
    );

    const result = await generateScene(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('401');
  });

  it('handles network error', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

    const result = await generateScene(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('handles invalid JSON in response', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        content: [{ type: 'text', text: 'Sorry, I cannot generate that.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }), { status: 200 }),
    );

    const result = await generateScene(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No JSON found');
  });
});
