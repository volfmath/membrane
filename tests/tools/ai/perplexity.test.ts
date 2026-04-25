import { describe, it, expect, vi, afterEach } from 'vitest';
import { research, generateGDD } from '../../../tools/ai/perplexity.js';
import { PERPLEXITY_RESEARCH_RESPONSE, PERPLEXITY_GDD_RESPONSE } from '../../fixtures/ai/mock-responses.js';
import type { AIConnectorConfig } from '../../../tools/ai/types.js';

const CONFIG: AIConnectorConfig = {
  apiKey: 'pplx-test',
  baseUrl: 'https://api.perplexity.ai',
  model: 'sonar',
};

describe('Perplexity connector', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('performs game design research', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(PERPLEXITY_RESEARCH_RESPONSE), { status: 200 }),
    );

    const result = await research(CONFIG, 'runner game design best practices');

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.summary).toContain('Runner');
    expect(result.data!.keyPoints.length).toBeGreaterThan(0);
    expect(result.data!.references.length).toBeGreaterThan(0);

    const body = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body as string);
    expect(body.model).toBe('sonar');
    expect((fetchSpy.mock.calls[0] as any)[1].headers.Authorization).toBe('Bearer pplx-test');
  });

  it('generates a game design document', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(PERPLEXITY_GDD_RESPONSE), { status: 200 }),
    );

    const result = await generateGDD(CONFIG, 'an endless runner with obstacles');

    expect(result.ok).toBe(true);
    expect(result.data!.title).toBe('Endless Runner');
    expect(result.data!.mechanics.length).toBeGreaterThan(0);
    expect(result.data!.entities.length).toBeGreaterThan(0);
    expect(result.data!.eventRules.length).toBeGreaterThan(0);
  });

  it('handles API error', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const result = await research(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('401');
  });

  it('handles non-JSON response', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        choices: [{ message: { content: 'No structured data available.' } }],
      }), { status: 200 }),
    );

    const result = await research(CONFIG, 'test');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No JSON found');
  });
});
