import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { importCocosProject } from './cocos-importer/importer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COCOS_PROJECT = 'D:/majonggame';
const OUTPUT = resolve(__dirname, '../wx-project/assets/scene-data.json');

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

const fixtureData = {
  version: 1,
  source: 'mahjong',
  compiledAt: new Date().toISOString(),
  scenes: compiledScenes,
};

mkdirSync(resolve(__dirname, '../wx-project/assets'), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(fixtureData, null, 2), 'utf-8');

const bytes = Buffer.byteLength(JSON.stringify(fixtureData));
console.log('Written', OUTPUT, `(${(bytes / 1024).toFixed(1)}KB)`);
console.log('Done.');
