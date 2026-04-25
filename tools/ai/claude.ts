import type { AIConnectorConfig, AIResponse, GeneratedScene } from './types.js';
import type { CanonicalEntity, CanonicalEvent } from '../../src/canonical/types.js';
import type { ProjectManifest } from '../mcp/project-data.js';

const SCENE_SYSTEM_PROMPT = `You are a game scene generator for the Membrane engine. You produce JSON output conforming to the canonical format.

Output ONLY a JSON object with this structure:
{
  "sceneId": "string (snake_case identifier)",
  "name": "string (display name)",
  "description": "string (brief scene description)",
  "entities": [
    {
      "id": "string (unique snake_case id)",
      "name": "string (display name)",
      "parent": "string | null (parent entity id)",
      "enabled": true,
      "components": {
        "Transform": { "x": number, "y": number, "rotation"?: number, "scaleX"?: number, "scaleY"?: number },
        "Sprite": { "atlas": "string", "frame": "string", "order"?: number, "visible"?: true },
        "Camera": { "mode"?: "orthographic", "size"?: number, "near"?: number, "far"?: number },
        "Tags": { "values": ["string"] }
      }
    }
  ],
  "events": [
    {
      "id": "string (unique event id)",
      "on": "string (trigger condition, e.g. 'tag:player touch tag:enemy')",
      "do": "string | string[] (action(s) to execute, e.g. 'destroy:self' or ['play:explosion', 'score:+10'])"
    }
  ]
}

Rules:
- Every scene MUST have at least one Camera entity
- Every visible entity needs a Transform component
- Sprites need both Transform and Sprite components
- Use descriptive entity ids (e.g. "player", "enemy_01", "platform_left")
- Coordinate system: origin is top-left, x increases right, y increases down
- Default canvas size: 720x1280 (portrait mobile)
- Place entities within the canvas bounds`;

const EVENTS_SYSTEM_PROMPT = `You are a game event rule generator for the Membrane engine. You produce JSON arrays of event rules.

Output ONLY a JSON array of event objects:
[
  {
    "id": "string (unique event id)",
    "on": "string (trigger condition)",
    "do": "string | string[] (action(s))"
  }
]

Trigger condition formats:
- "tag:X touch tag:Y" — collision between tagged entities
- "entity:ID health:0" — entity property check
- "score:>=N" — score threshold
- "timer:Ns" — timer trigger
- "input:tap" — user input
- "scene:start" — scene lifecycle

Action formats:
- "destroy:ENTITY_ID" or "destroy:self"
- "spawn:ENTITY_ID" — instantiate entity
- "play:SOUND_ID" — play audio
- "score:+N" or "score:-N" — modify score
- "scene:SCENE_ID" — switch scene
- "show:ENTITY_ID" / "hide:ENTITY_ID"
- "emit:EVENT_NAME" — trigger another event`;

const SYSTEM_CODE_PROMPT = `You are a game system code generator for the Membrane engine ECS architecture.

Generate a TypeScript function that acts as an ECS system. The function signature is:
(world: World, dt: number) => void

The World API:
- world.query(withComponents: number[]): { entities: EntityId[] }
- world.storage.getField(componentId: number, fieldName: string): TypedArray
- world.hasComponent(entityId: EntityId, componentId: number): boolean
- world.create(): EntityId
- world.destroy(entityId: EntityId): void

Output ONLY the TypeScript function code, no markdown or explanation.`;

export async function generateScene(
  config: AIConnectorConfig,
  prompt: string,
  context?: { existingScenes?: string[]; projectManifest?: ProjectManifest },
): Promise<AIResponse<GeneratedScene>> {
  let userContent = prompt;
  if (context?.existingScenes?.length) {
    userContent += `\n\nExisting scenes in project: ${context.existingScenes.join(', ')}. Avoid duplicate scene IDs.`;
  }
  if (context?.projectManifest) {
    userContent += `\n\nProject has ${context.projectManifest.scenes.length} scenes.`;
  }

  return callClaude<GeneratedScene>(config, SCENE_SYSTEM_PROMPT, userContent);
}

export async function generateEvents(
  config: AIConnectorConfig,
  sceneId: string,
  prompt: string,
  entities: CanonicalEntity[],
): Promise<AIResponse<CanonicalEvent[]>> {
  const entitySummary = entities
    .map(e => {
      const comps = Object.keys(e.components).join(', ');
      const tags = e.components.Tags?.values?.join(', ') ?? '';
      return `  - ${e.id} (${e.name}): [${comps}]${tags ? ` tags=[${tags}]` : ''}`;
    })
    .join('\n');

  const userContent = `Scene: ${sceneId}\nEntities:\n${entitySummary}\n\nRequest: ${prompt}`;
  return callClaude<CanonicalEvent[]>(config, EVENTS_SYSTEM_PROMPT, userContent);
}

export async function generateSystemCode(
  config: AIConnectorConfig,
  prompt: string,
  componentSchemas?: Record<string, unknown>,
): Promise<AIResponse<string>> {
  let userContent = prompt;
  if (componentSchemas) {
    userContent += `\n\nAvailable components:\n${JSON.stringify(componentSchemas, null, 2)}`;
  }

  const response = await callClaudeRaw(config, SYSTEM_CODE_PROMPT, userContent);
  if (!response.ok) return { ok: false, error: response.error, usage: response.usage };

  return { ok: true, data: response.data, usage: response.usage };
}

async function callClaude<T>(
  config: AIConnectorConfig,
  systemPrompt: string,
  userContent: string,
): Promise<AIResponse<T>> {
  const raw = await callClaudeRaw(config, systemPrompt, userContent);
  if (!raw.ok) return { ok: false, error: raw.error, usage: raw.usage };

  try {
    const text = raw.data!;
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { ok: false, error: 'No JSON found in response', usage: raw.usage };
    }
    const parsed = JSON.parse(jsonMatch[0]) as T;
    return { ok: true, data: parsed, usage: raw.usage };
  } catch (e: any) {
    return { ok: false, error: `JSON parse error: ${e.message}`, usage: raw.usage };
  }
}

async function callClaudeRaw(
  config: AIConnectorConfig,
  systemPrompt: string,
  userContent: string,
): Promise<AIResponse<string>> {
  const url = `${config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`;
  const model = config.model ?? 'claude-sonnet-4-20250514';
  const timeout = config.timeout ?? 60000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `API ${res.status}: ${body}` };
    }

    const json = await res.json() as any;
    const text = json.content?.[0]?.text ?? '';
    const usage = json.usage
      ? { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens }
      : undefined;

    return { ok: true, data: text, usage };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${timeout}ms` };
    }
    return { ok: false, error: e.message };
  }
}

export { callClaudeRaw as _callClaudeRaw };
