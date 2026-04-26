import type { AIConnectorConfig, AIResponse, ResearchResult } from './types.js';
import { extractJson } from './json-extract.js';

export interface GDDResult {
  title: string;
  overview: string;
  mechanics: string[];
  entities: string[];
  eventRules: string[];
}

const RESEARCH_SYSTEM = `You are a game design researcher. Search the web for relevant information and return structured results.

Output ONLY a JSON object:
{
  "summary": "Brief summary of findings",
  "keyPoints": ["Point 1", "Point 2", ...],
  "references": ["URL or source 1", ...]
}`;

const GDD_SYSTEM = `You are a game design document generator. Based on a game concept, produce a structured game design outline.

Output ONLY a JSON object:
{
  "title": "Game title",
  "overview": "2-3 sentence game overview",
  "mechanics": ["Core mechanic 1", "Core mechanic 2", ...],
  "entities": ["Entity/object needed: player, enemy_goblin, platform, coin, etc."],
  "eventRules": ["Rule: when X happens, do Y"]
}

Focus on mechanics that map to a 2D mobile game with touch controls.`;

export async function research(
  config: AIConnectorConfig,
  query: string,
): Promise<AIResponse<ResearchResult>> {
  return callPerplexity<ResearchResult>(config, RESEARCH_SYSTEM, query);
}

export async function generateGDD(
  config: AIConnectorConfig,
  gameDescription: string,
): Promise<AIResponse<GDDResult>> {
  return callPerplexity<GDDResult>(config, GDD_SYSTEM, gameDescription);
}

async function callPerplexity<T>(
  config: AIConnectorConfig,
  systemPrompt: string,
  userContent: string,
): Promise<AIResponse<T>> {
  const url = `${config.baseUrl ?? 'https://api.perplexity.ai'}/chat/completions`;
  const model = config.model ?? 'sonar';
  const timeout = config.timeout ?? 30000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `API ${res.status}: ${body}` };
    }

    const json = await res.json() as any;
    const text = json.choices?.[0]?.message?.content ?? '';
    const usage = json.usage
      ? { inputTokens: json.usage.prompt_tokens ?? 0, outputTokens: json.usage.completion_tokens ?? 0 }
      : undefined;

    try {
      const jsonStr = extractJson(text);
      if (!jsonStr) {
        return { ok: false, error: 'No JSON found in response', usage };
      }
      const parsed = JSON.parse(jsonStr) as T;
      return { ok: true, data: parsed, usage };
    } catch (e: any) {
      return { ok: false, error: `JSON parse error: ${e.message}`, usage };
    }
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${timeout}ms` };
    }
    return { ok: false, error: e.message };
  }
}
