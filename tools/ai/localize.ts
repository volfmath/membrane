import type { AIConnectorConfig, AIResponse, LocalizedContent } from './types.js';
import type { CanonicalSceneFile } from '../../src/canonical/types.js';
import { _callClaudeRaw } from './claude.js';

const TRANSLATE_SYSTEM = `You are a game content translator. Translate game text accurately while preserving game-specific terminology.

Output ONLY a JSON array of translation objects:
[
  { "original": "original text", "language": "target language code", "translated": "translated text" }
]

Rules:
- Preserve entity IDs, event IDs, and technical identifiers (don't translate them)
- Translate display names, descriptions, and user-facing text
- Keep game terms consistent (use glossary if provided)
- Maintain the tone and style appropriate for games`;

export async function translateContent(
  config: AIConnectorConfig,
  content: string | string[],
  targetLanguage: string,
  options?: { context?: string; glossary?: Record<string, string> },
): Promise<AIResponse<LocalizedContent[]>> {
  const items = Array.isArray(content) ? content : [content];

  let userContent = `Translate to ${targetLanguage}:\n`;
  userContent += items.map((t, i) => `${i + 1}. "${t}"`).join('\n');

  if (options?.glossary && Object.keys(options.glossary).length > 0) {
    userContent += `\n\nGlossary:\n`;
    for (const [term, translation] of Object.entries(options.glossary)) {
      userContent += `  "${term}" → "${translation}"\n`;
    }
  }

  if (options?.context) {
    userContent += `\n\nContext: ${options.context}`;
  }

  const raw = await _callClaudeRaw(config, TRANSLATE_SYSTEM, userContent);
  if (!raw.ok) return { ok: false, error: raw.error, usage: raw.usage };

  try {
    const text = raw.data!;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { ok: false, error: 'No JSON array found in response', usage: raw.usage };
    }
    const parsed = JSON.parse(jsonMatch[0]) as LocalizedContent[];
    return { ok: true, data: parsed, usage: raw.usage };
  } catch (e: any) {
    return { ok: false, error: `JSON parse error: ${e.message}`, usage: raw.usage };
  }
}

export async function translateScene(
  config: AIConnectorConfig,
  scene: CanonicalSceneFile,
  targetLanguage: string,
  glossary?: Record<string, string>,
): Promise<AIResponse<CanonicalSceneFile>> {
  const names = scene.entities
    .map(e => e.name)
    .filter((n): n is string => !!n && n !== '');

  if (names.length === 0) {
    return { ok: true, data: { ...scene } };
  }

  const result = await translateContent(config, names, targetLanguage, {
    context: `Game scene: ${scene.name ?? scene.sceneId}`,
    glossary,
  });

  if (!result.ok || !result.data) {
    return { ok: false, error: result.error, usage: result.usage };
  }

  const translationMap = new Map<string, string>();
  for (const item of result.data) {
    translationMap.set(item.original, item.translated);
  }

  const translatedScene: CanonicalSceneFile = {
    ...scene,
    entities: scene.entities.map(e => ({
      ...e,
      name: e.name && translationMap.has(e.name) ? translationMap.get(e.name)! : e.name,
    })),
  };

  return { ok: true, data: translatedScene, usage: result.usage };
}
