export interface CompiledSpriteFrame {
  image: string;
  rect: { x: number; y: number; width: number; height: number };
  originalSize: { width: number; height: number };
  pivot?: { x: number; y: number };
  rotated?: boolean;
}

export interface CompiledEntity {
  id: string;
  name: string;
  parent: string | null;
  enabled: boolean;
  components: Record<string, Record<string, unknown>>;
}

export interface CompiledSceneData {
  sceneId: string;
  entities: CompiledEntity[];
}

export interface CompiledFixtureData {
  version: number;
  source: string;
  compiledAt: string;
  scenes: CompiledSceneData[];
  spriteFrames?: Record<string, CompiledSpriteFrame>;
}
