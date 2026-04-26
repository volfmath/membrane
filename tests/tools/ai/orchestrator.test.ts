import { describe, it, expect, vi, afterEach } from 'vitest';
import { runWorkflow, createGameWorkflow } from '../../../tools/ai/orchestrator.js';
import {
  CLAUDE_SCENE_RESPONSE,
  PERPLEXITY_GDD_RESPONSE,
  OPENAI_IMAGE_RESPONSE,
  SUNO_AUDIO_RESPONSE,
} from '../../fixtures/ai/mock-responses.js';
import type { AIConnectorConfig, ConnectorName } from '../../../tools/ai/types.js';

const CONFIGS: Partial<Record<ConnectorName, AIConnectorConfig>> = {
  claude: { apiKey: 'sk-claude', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  perplexity: { apiKey: 'pplx-test', baseUrl: 'https://api.perplexity.ai', model: 'sonar' },
  'openai-image': { apiKey: 'sk-oai', baseUrl: 'https://api.openai.com', model: 'gpt-image-1' },
  audio: { apiKey: 'suno-test', baseUrl: 'https://studio-api.suno.ai', model: 'chirp-v4' },
};

describe('Orchestrator', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('creates a game workflow with correct steps', () => {
    const steps = createGameWorkflow('a platformer game');
    expect(steps).toHaveLength(4);
    expect(steps[0].connector).toBe('perplexity');
    expect(steps[1].connector).toBe('claude');
    expect(steps[1].dependsOn).toContain('research');
    expect(steps[2].connector).toBe('openai-image');
    expect(steps[3].connector).toBe('audio');
  });

  it('runs workflow with all connectors', async () => {
    const audioBytes = new Uint8Array([0xFF, 0xFB]);

    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(PERPLEXITY_GDD_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(CLAUDE_SCENE_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(OPENAI_IMAGE_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(SUNO_AUDIO_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(audioBytes, { status: 200 }));

    const steps = createGameWorkflow('endless runner');
    const result = await runWorkflow(steps, CONFIGS);

    expect(result.steps).toHaveLength(4);
    expect(result.steps[0].status).toBe('ok');
    expect(result.steps[1].status).toBe('ok');
    expect(result.steps[2].status).toBe('ok');
    expect(result.steps[3].status).toBe('ok');
  });

  it('skips steps when API key is missing', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(CLAUDE_SCENE_RESPONSE), { status: 200 }));

    const steps = createGameWorkflow('test');
    const result = await runWorkflow(steps, { claude: CONFIGS.claude! });

    const perplexityStep = result.steps.find(s => s.id === 'research');
    expect(perplexityStep!.status).toBe('skipped');
    expect(perplexityStep!.error).toContain('no API key');

    const claudeStep = result.steps.find(s => s.id === 'scene');
    expect(claudeStep!.status).toBe('skipped');
    expect(claudeStep!.error).toContain('dependency failed');
  });

  it('skips dependent steps when parent fails', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('error', { status: 500 }));

    const steps = createGameWorkflow('test');
    const result = await runWorkflow(steps, CONFIGS);

    expect(result.steps[0].status).toBe('error');
    expect(result.steps[1].status).toBe('skipped');
  });

  it('runs independent workflow steps', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(CLAUDE_SCENE_RESPONSE), { status: 200 }));

    const steps = [
      { id: 'scene', connector: 'claude' as const, action: 'generateScene', input: { prompt: 'test' } },
    ];

    const result = await runWorkflow(steps, { claude: CONFIGS.claude! });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe('ok');
  });

  it('detects cyclic dependencies', async () => {
    const steps = [
      { id: 'a', connector: 'claude' as const, action: 'generateScene', input: { prompt: 'test' }, dependsOn: ['b'] },
      { id: 'b', connector: 'claude' as const, action: 'generateScene', input: { prompt: 'test' }, dependsOn: ['a'] },
    ];

    await expect(runWorkflow(steps, CONFIGS)).rejects.toThrow('Cyclic dependency');
  });

  it('handles topological ordering', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(PERPLEXITY_GDD_RESPONSE), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(CLAUDE_SCENE_RESPONSE), { status: 200 }));

    const steps = [
      { id: 'scene', connector: 'claude' as const, action: 'generateScene', input: { prompt: 'test' }, dependsOn: ['research'] },
      { id: 'research', connector: 'perplexity' as const, action: 'generateGDD', input: { prompt: 'test' } },
    ];

    const result = await runWorkflow(steps, CONFIGS);
    expect(result.steps[0].id).toBe('research');
    expect(result.steps[1].id).toBe('scene');
    expect(result.steps[0].status).toBe('ok');
    expect(result.steps[1].status).toBe('ok');
  });
});
