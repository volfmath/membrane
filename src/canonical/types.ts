// ── Built-in Component Types ──────────────────────────────────────

export interface TransformComponent {
  x?: number;
  y?: number;
  z?: number;
  rotationX?: number;
  rotationY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  anchorX?: number;
  anchorY?: number;
  width?: number;
  height?: number;
}

export interface SpriteComponent {
  atlas: string;
  frame: string;
  order?: number;
  color?: string;
  flipX?: boolean;
  flipY?: boolean;
  visible?: boolean;
}

export interface CameraComponent {
  mode?: 'orthographic' | 'perspective';
  fov?: number;
  size?: number;
  near?: number;
  far?: number;
  clearColor?: string;
}

export interface LabelComponent {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'center' | 'bottom';
  color?: string;
  wrap?: boolean;
}

export interface LightComponent {
  kind: 'directional' | 'point' | 'spot';
  color?: string;
  intensity?: number;
}

export interface ButtonComponent {
  interactable?: boolean;
}

export interface ProgressBarComponent {
  progress: number;
  totalLength?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
}

export interface TagsComponent {
  values: string[];
}

export interface PrefabRefComponent {
  prefabId: string;
  inheritTransform?: boolean;
  overrides?: Record<string, unknown>;
}

// ── Entity ───────────────────────────────────────────────────────

export type CanonicalComponentValue = Record<string, unknown>;

export type CanonicalComponents = {
  Transform?: TransformComponent;
  Sprite?: SpriteComponent;
  Camera?: CameraComponent;
  Label?: LabelComponent;
  Light?: LightComponent;
  Button?: ButtonComponent;
  ProgressBar?: ProgressBarComponent;
  Tags?: TagsComponent;
  PrefabRef?: PrefabRefComponent;
} & Record<string, CanonicalComponentValue | undefined>;

export interface CanonicalEntity {
  id: string;
  name?: string;
  parent?: string | null;
  enabled?: boolean;
  components: CanonicalComponents;
}

// ── Event ────────────────────────────────────────────────────────

export interface CanonicalEvent {
  id: string;
  on: string;
  do: string | string[];
}

// ── Scene File ───────────────────────────────────────────────────

export interface CanonicalSceneFile {
  format: 'membrane.scene';
  version: 1;
  sceneId: string;
  name?: string;
  metadata?: Record<string, unknown>;
  entities: CanonicalEntity[];
  events?: CanonicalEvent[];
}

// ── Prefab File ──────────────────────────────────────────────────

export interface CanonicalPrefabFile {
  format: 'membrane.prefab';
  version: 1;
  prefabId: string;
  name?: string;
  metadata?: Record<string, unknown>;
  entities: CanonicalEntity[];
  events?: CanonicalEvent[];
}

// ── Assets File ──────────────────────────────────────────────────

export interface AssetPathEntry {
  id: string;
  path: string;
}

export interface AtlasFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX?: number;
  pivotY?: number;
}

export interface AtlasEntry {
  id: string;
  image: string;
  width: number;
  height: number;
  frames: AtlasFrame[];
}

export type AudioKind = 'bgm' | 'sfx' | 'voice' | 'ambient';

export interface AudioEntry {
  id: string;
  path: string;
  kind: AudioKind;
}

export interface CanonicalAssetsFile {
  format: 'membrane.assets';
  version: 1;
  scenes: AssetPathEntry[];
  prefabs?: AssetPathEntry[];
  atlases: AtlasEntry[];
  audio: AudioEntry[];
}

// ── Import Report ────────────────────────────────────────────────

export type IssueSeverity = 'info' | 'warning' | 'error';

export type SourceKind = 'cocos' | 'unity' | 'custom';

export interface ImportIssue {
  severity: IssueSeverity;
  code: string;
  sceneId?: string;
  entityId?: string;
  component?: string;
  message: string;
}

export interface ImportReportFile {
  format: 'membrane.import-report';
  version: 1;
  source: {
    kind: SourceKind;
    root: string;
  };
  summary: {
    sceneCount: number;
    entityCount: number;
    warningCount: number;
    unsupportedCount: number;
  };
  issues: ImportIssue[];
}

// ── Format string literals ───────────────────────────────────────

export const CANONICAL_FORMATS = {
  scene: 'membrane.scene' as const,
  prefab: 'membrane.prefab' as const,
  assets: 'membrane.assets' as const,
  importReport: 'membrane.import-report' as const,
};

export const CANONICAL_VERSION = 1 as const;
