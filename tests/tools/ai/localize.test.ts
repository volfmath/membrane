import { describe, it, expect, vi, afterEach } from 'vitest';
import { translateContent, translateScene } from '../../../tools/ai/localize.js';
import { CLAUDE_TRANSLATE_RESPONSE } from '../../fixtures/ai/mock-responses.js';
import type { AIConnectorConfig } from '../../../tools/ai/types.js';
import type { CanonicalSceneFile } from '../../../src/canonical/types.js';

const CONFIG: AIConnectorConfig = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
};

describe('Localize connector', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('translates content strings', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_TRANSLATE_RESPONSE), { status: 200 }),
    );

    const result = await translateContent(CONFIG, ['Player', 'Enemy Spike', 'Ground'], 'zh-CN');

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(result.data![0].translated).toBe('玩家');
    expect(result.data![1].language).toBe('zh-CN');
  });

  it('translates a single string', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_TRANSLATE_RESPONSE), { status: 200 }),
    );

    const result = await translateContent(CONFIG, 'Player', 'zh-CN');
    expect(result.ok).toBe(true);
  });

  it('includes glossary in prompt', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_TRANSLATE_RESPONSE), { status: 200 }),
    );

    await translateContent(CONFIG, ['Player'], 'zh-CN', {
      glossary: { 'Player': '玩家', 'HP': '生命值' },
    });

    const body = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body as string);
    expect(body.messages[0].content).toContain('玩家');
    expect(body.messages[0].content).toContain('HP');
  });

  it('translates scene entity names', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(CLAUDE_TRANSLATE_RESPONSE), { status: 200 }),
    );

    const scene: CanonicalSceneFile = {
      format: 'membrane.scene' as any,
      version: 1,
      sceneId: 'test',
      name: 'Test Scene',
      entities: [
        { id: 'player', name: 'Player', components: { Transform: { x: 0, y: 0 } } },
        { id: 'enemy', name: 'Enemy Spike', components: { Transform: { x: 100, y: 0 } } },
        { id: 'ground', name: 'Ground', components: { Transform: { x: 0, y: 100 } } },
      ],
    };

    const result = await translateScene(CONFIG, scene, 'zh-CN');

    expect(result.ok).toBe(true);
    expect(result.data!.entities[0].name).toBe('玩家');
    expect(result.data!.entities[1].name).toBe('尖刺敌人');
    expect(result.data!.entities[0].id).toBe('player');
  });

  it('returns scene unchanged when no names', async () => {
    const scene: CanonicalSceneFile = {
      format: 'membrane.scene' as any,
      version: 1,
      sceneId: 'test',
      entities: [
        { id: 'e1', components: {} },
      ],
    };

    const result = await translateScene(CONFIG, scene, 'ja');
    expect(result.ok).toBe(true);
    expect(result.data!.entities[0].id).toBe('e1');
  });
});
