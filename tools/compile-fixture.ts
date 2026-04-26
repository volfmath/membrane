import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { importCocosProject } from './cocos-importer/importer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COCOS_PROJECT = 'D:/majonggame';
const OUTPUT = resolve(__dirname, '../wx-project/assets/scene-data.js');

if (!existsSync(resolve(COCOS_PROJECT, 'assets'))) {
  console.error('Cocos project not found at', COCOS_PROJECT);
  process.exit(1);
}

console.log('Importing Cocos project from', COCOS_PROJECT);
const imported = importCocosProject(COCOS_PROJECT);

console.log('Scenes:', imported.scenes.length);
for (const scene of imported.scenes) {
  console.log(`  ${scene.sceneId}: ${scene.entities.length} entities`);
}

interface CompiledEntity {
  id: string;
  name: string;
  parent: string | null;
  enabled: boolean;
  components: Record<string, Record<string, unknown>>;
}

interface CompiledSceneData {
  sceneId: string;
  entities: CompiledEntity[];
}

interface CompiledSpriteFrame {
  image: string;
  rect: { x: number; y: number; width: number; height: number };
  originalSize: { width: number; height: number };
  pivot?: { x: number; y: number };
  rotated?: boolean;
}

const compiledScenes: CompiledSceneData[] = imported.scenes.map(scene => ({
  sceneId: scene.sceneId,
  entities: scene.entities.map(e => ({
    id: e.id,
    name: e.name ?? e.id,
    parent: e.parent ?? null,
    enabled: e.enabled !== false,
    components: { ...e.components } as Record<string, Record<string, unknown>>,
  })),
}));

const spriteFrames = buildSpriteFrameIndex(compiledScenes);

const fixtureData = {
  version: 1,
  source: 'mahjong',
  compiledAt: new Date().toISOString(),
  scenes: compiledScenes,
  spriteFrames,
};

mkdirSync(resolve(__dirname, '../wx-project/assets'), { recursive: true });
writeFileSync(OUTPUT, 'module.exports = ' + JSON.stringify(fixtureData) + ';\n', 'utf-8');

const bytes = Buffer.byteLength(JSON.stringify(fixtureData));
console.log('Written', OUTPUT, `(${(bytes / 1024).toFixed(1)}KB)`);
console.log('Done.');

function buildSpriteFrameIndex(scenes: CompiledSceneData[]): Record<string, CompiledSpriteFrame> {
  const uuids = new Set<string>();
  for (const scene of scenes) {
    for (const entity of scene.entities) {
      const sprite = entity.components.Sprite;
      if (!sprite) continue;
      const atlas = sprite.atlas;
      const frame = sprite.frame;
      if (typeof atlas === 'string' && atlas !== 'unknown' && typeof frame === 'string' && frame !== 'unknown') {
        uuids.add(`${atlas}@${frame}`);
      }
    }
  }

  const out: Record<string, CompiledSpriteFrame> = {};
  for (const key of uuids) {
    const info = loadSpriteFrame(key);
    if (info) out[key] = info;
  }
  console.log('SpriteFrames:', Object.keys(out).length);
  return out;
}

function loadSpriteFrame(key: string): CompiledSpriteFrame | null {
  const [uuid, frame] = key.split('@');
  if (!uuid || !frame) return null;
  const prefix = uuid.slice(0, 2);
  const frameJson = resolve(COCOS_PROJECT, `library/${prefix}/${uuid}@${frame}.json`);
  const imageJson = resolve(COCOS_PROJECT, `library/${prefix}/${uuid}.json`);
  const pngPath = resolve(COCOS_PROJECT, `library/${prefix}/${uuid}.png`);
  const jpgPath = resolve(COCOS_PROJECT, `library/${prefix}/${uuid}.jpg`);
  if (!existsSync(frameJson) || !existsSync(imageJson)) return null;

  const frameData = JSON.parse(readFileSync(frameJson, 'utf-8'))?.content;
  if (!frameData?.rect || !frameData?.originalSize) return null;

  const ext = existsSync(pngPath) ? '.png' : existsSync(jpgPath) ? '.jpg' : '';
  if (!ext) return null;

  const outDir = resolve(__dirname, '../wx-project/assets/cocos');
  mkdirSync(outDir, { recursive: true });
  const outName = `${uuid}${ext}`;
  copyFileSync(ext === '.png' ? pngPath : jpgPath, resolve(outDir, outName));

  return {
    image: `assets/cocos/${outName}`,
    rect: {
      x: frameData.rect.x,
      y: frameData.rect.y,
      width: frameData.rect.width,
      height: frameData.rect.height,
    },
    originalSize: {
      width: frameData.originalSize.width,
      height: frameData.originalSize.height,
    },
    pivot: frameData.pivot ? { x: frameData.pivot.x, y: frameData.pivot.y } : undefined,
    rotated: !!frameData.rotated,
  };
}
