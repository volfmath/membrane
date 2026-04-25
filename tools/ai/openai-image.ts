import type { AIConnectorConfig, AIResponse, GeneratedImage } from './types.js';

export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

export interface ImageOptions {
  size?: ImageSize;
  style?: string;
  quality?: 'low' | 'medium' | 'high';
}

const SPRITE_STYLE = 'pixel art game sprite, transparent background, centered, clean edges';
const BG_STYLE = 'game background, seamless, vibrant colors, high quality';

export async function generateSprite(
  config: AIConnectorConfig,
  prompt: string,
  options?: ImageOptions,
): Promise<AIResponse<GeneratedImage>> {
  const fullPrompt = `${prompt}, ${options?.style ?? SPRITE_STYLE}`;
  return callImageAPI(config, fullPrompt, {
    size: options?.size ?? '256x256',
    quality: options?.quality ?? 'low',
  });
}

export async function generateBackground(
  config: AIConnectorConfig,
  prompt: string,
  options?: ImageOptions,
): Promise<AIResponse<GeneratedImage>> {
  const fullPrompt = `${prompt}, ${options?.style ?? BG_STYLE}`;
  return callImageAPI(config, fullPrompt, {
    size: options?.size ?? '1024x1024',
    quality: options?.quality ?? 'medium',
  });
}

async function callImageAPI(
  config: AIConnectorConfig,
  prompt: string,
  options: { size: ImageSize; quality: string },
): Promise<AIResponse<GeneratedImage>> {
  const url = `${config.baseUrl ?? 'https://api.openai.com'}/v1/images/generations`;
  const model = config.model ?? 'gpt-image-1';
  const timeout = config.timeout ?? 120000;

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
        prompt,
        n: 1,
        size: options.size,
        quality: options.quality,
        output_format: 'png',
        output_compression: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `API ${res.status}: ${body}` };
    }

    const json = await res.json() as any;
    const imageData = json.data?.[0];

    if (!imageData) {
      return { ok: false, error: 'No image data in response' };
    }

    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, 'base64');
    } else if (imageData.url) {
      const imgRes = await fetch(imageData.url);
      if (!imgRes.ok) {
        return { ok: false, error: `Failed to download image: ${imgRes.status}` };
      }
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      return { ok: false, error: 'No b64_json or url in response' };
    }

    const [w, h] = options.size.split('x').map(Number);
    return {
      ok: true,
      data: { buffer, mimeType: 'image/png', width: w, height: h, prompt },
    };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${timeout}ms` };
    }
    return { ok: false, error: e.message };
  }
}
