import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConnectorConfig, loadAllConfigs, listAvailableConnectors } from '../../../tools/ai/config.js';

describe('AI config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.SUNO_API_KEY;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('returns null when API key is missing', () => {
    expect(getConnectorConfig('claude')).toBeNull();
    expect(getConnectorConfig('openai-image')).toBeNull();
    expect(getConnectorConfig('perplexity')).toBeNull();
    expect(getConnectorConfig('audio')).toBeNull();
  });

  it('returns config when API key is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-123';
    const config = getConnectorConfig('claude');
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBe('sk-test-123');
    expect(config!.baseUrl).toBe('https://api.anthropic.com');
    expect(config!.model).toContain('claude');
  });

  it('localize reuses ANTHROPIC_API_KEY', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-123';
    const config = getConnectorConfig('localize');
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBe('sk-test-123');
  });

  it('loadAllConfigs returns only available connectors', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    process.env.OPENAI_API_KEY = 'sk-oai';
    const configs = loadAllConfigs();
    expect(configs.claude).toBeDefined();
    expect(configs['openai-image']).toBeDefined();
    expect(configs.localize).toBeDefined();
    expect(configs.perplexity).toBeUndefined();
    expect(configs.audio).toBeUndefined();
  });

  it('listAvailableConnectors returns names with keys set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    const available = listAvailableConnectors();
    expect(available).toContain('claude');
    expect(available).toContain('localize');
    expect(available).not.toContain('openai-image');
  });
});
