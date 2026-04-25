import type { AIConnectorConfig, ConnectorName } from './types.js';

const CONNECTOR_ENV_MAP: Record<ConnectorName, { key: string; baseUrl: string; model: string }> = {
  claude: {
    key: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  },
  'openai-image': {
    key: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-image-1',
  },
  perplexity: {
    key: 'PERPLEXITY_API_KEY',
    baseUrl: 'https://api.perplexity.ai',
    model: 'sonar',
  },
  audio: {
    key: 'SUNO_API_KEY',
    baseUrl: 'https://studio-api.suno.ai',
    model: 'chirp-v4',
  },
  localize: {
    key: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  },
};

export function getConnectorConfig(name: ConnectorName): AIConnectorConfig | null {
  const mapping = CONNECTOR_ENV_MAP[name];
  const apiKey = process.env[mapping.key];
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: mapping.baseUrl,
    model: mapping.model,
  };
}

export function loadAllConfigs(): Partial<Record<ConnectorName, AIConnectorConfig>> {
  const configs: Partial<Record<ConnectorName, AIConnectorConfig>> = {};
  for (const name of Object.keys(CONNECTOR_ENV_MAP) as ConnectorName[]) {
    const config = getConnectorConfig(name);
    if (config) configs[name] = config;
  }
  return configs;
}

export function listAvailableConnectors(): ConnectorName[] {
  return (Object.keys(CONNECTOR_ENV_MAP) as ConnectorName[]).filter(
    name => !!process.env[CONNECTOR_ENV_MAP[name].key]
  );
}
