export interface CompiledSceneData {
  sceneId: string;
  entities: CompiledEntity[];
}

export interface CompiledEntity {
  id: string;
  name: string;
  parent: string | null;
  enabled: boolean;
  components: Record<string, Record<string, unknown>>;
}
