import type { CanonicalEntity, CanonicalEvent } from '../../src/canonical/types.js';

export interface AIConnectorConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cost?: number;
}

export interface AIResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  usage?: AIUsage;
}

export interface GeneratedScene {
  sceneId: string;
  name: string;
  description: string;
  entities: CanonicalEntity[];
  events: CanonicalEvent[];
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  prompt: string;
}

export interface GeneratedAudio {
  buffer: Buffer;
  mimeType: 'audio/mpeg' | 'audio/wav';
  duration: number;
  prompt: string;
}

export interface ResearchResult {
  summary: string;
  keyPoints: string[];
  references: string[];
}

export interface LocalizedContent {
  original: string;
  language: string;
  translated: string;
}

export type ConnectorName = 'claude' | 'openai-image' | 'perplexity' | 'audio' | 'localize';
