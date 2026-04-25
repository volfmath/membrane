import type { AIConnectorConfig, AIResponse, GeneratedAudio } from './types.js';

export interface MusicOptions {
  duration?: number;
  genre?: string;
  instrumental?: boolean;
}

export interface SFXOptions {
  duration?: number;
}

export async function generateMusic(
  config: AIConnectorConfig,
  prompt: string,
  options?: MusicOptions,
): Promise<AIResponse<GeneratedAudio>> {
  const fullPrompt = options?.genre
    ? `${options.genre} style: ${prompt}`
    : prompt;

  return callSunoAPI(config, fullPrompt, {
    duration: options?.duration ?? 30,
    instrumental: options?.instrumental ?? true,
    kind: 'bgm',
  });
}

export async function generateSFX(
  config: AIConnectorConfig,
  prompt: string,
  options?: SFXOptions,
): Promise<AIResponse<GeneratedAudio>> {
  return callSunoAPI(config, `sound effect: ${prompt}`, {
    duration: options?.duration ?? 3,
    instrumental: true,
    kind: 'sfx',
  });
}

async function callSunoAPI(
  config: AIConnectorConfig,
  prompt: string,
  options: { duration: number; instrumental: boolean; kind: string },
): Promise<AIResponse<GeneratedAudio>> {
  const url = `${config.baseUrl ?? 'https://studio-api.suno.ai'}/api/generate/v2/`;
  const timeout = config.timeout ?? 180000;

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
        prompt,
        duration: options.duration,
        make_instrumental: options.instrumental,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `API ${res.status}: ${body}` };
    }

    const json = await res.json() as any;
    const audioUrl = json.audio_url ?? json.data?.[0]?.audio_url;

    if (!audioUrl) {
      return { ok: false, error: 'No audio URL in response' };
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return { ok: false, error: `Failed to download audio: ${audioRes.status}` };
    }

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    return {
      ok: true,
      data: {
        buffer,
        mimeType: 'audio/mpeg',
        duration: options.duration,
        prompt,
      },
    };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${timeout}ms` };
    }
    return { ok: false, error: e.message };
  }
}
