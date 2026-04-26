import type {
  CocosSerializedObject,
  CocosUITransformData,
  CocosSpriteData,
  CocosCameraData,
  CocosLabelData,
  CocosDirectionalLightData,
  CocosButtonData,
  CocosProgressBarData,
  CocosColor,
  CocosVec2,
  CocosSize,
} from './cocos-types.js';
import type { ParsedNode, ParsedComponent } from './scene-parser.js';
import { colorToHex, getFirstComponent } from './scene-parser.js';
import type {
  CanonicalEntity,
  CanonicalComponents,
  TransformComponent,
  SpriteComponent,
  CameraComponent,
  LabelComponent,
  LightComponent,
  ButtonComponent,
  ProgressBarComponent,
  ImportIssue,
} from '../../src/canonical/types.js';

export interface MappedEntity {
  entity: CanonicalEntity;
  issues: ImportIssue[];
}

const SUPPORTED_COMPONENTS = new Set([
  'cc.UITransform',
  'cc.Sprite',
  'cc.Camera',
  'cc.Canvas',
  'cc.Label',
  'cc.DirectionalLight',
  'cc.Button',
  'cc.ProgressBar',
]);

const SILENTLY_SKIPPED = new Set([
  'cc.Canvas',
]);

function makeEntityId(node: ParsedNode, allNodes: ParsedNode[]): string {
  const parts: string[] = [];
  let current: ParsedNode | undefined = node;
  while (current) {
    parts.unshift(current.name.replace(/[^A-Za-z0-9_./:@-]/g, '_'));
    if (current.parentIndex === null) break;
    current = allNodes.find(n => n.index === current!.parentIndex);
  }
  return parts.join('/');
}

function mapTransform(
  node: ParsedNode,
  uiTransform: ParsedComponent | null
): TransformComponent {
  const t: TransformComponent = {};

  if (node.x !== 0) t.x = node.x;
  if (node.y !== 0) t.y = node.y;
  if (node.z !== 0) t.z = node.z;
  if (Math.abs(node.rotationX) > 0.001) t.rotationX = Math.round(node.rotationX * 1000) / 1000;
  if (Math.abs(node.rotationY) > 0.001) t.rotationY = Math.round(node.rotationY * 1000) / 1000;
  if (Math.abs(node.rotation) > 0.001) t.rotation = Math.round(node.rotation * 1000) / 1000;
  if (node.scaleX !== 1) t.scaleX = node.scaleX;
  if (node.scaleY !== 1) t.scaleY = node.scaleY;
  if (node.scaleZ !== 1) t.scaleZ = node.scaleZ;

  if (uiTransform) {
    const data = uiTransform.data as CocosUITransformData;
    const anchor = data._anchorPoint as CocosVec2 | undefined;
    if (anchor) {
      if (anchor.x !== 0.5) t.anchorX = anchor.x;
      if (anchor.y !== 0.5) t.anchorY = anchor.y;
    }
  }

  return t;
}

function mapSprite(
  comp: ParsedComponent,
  sceneId: string,
  entityId: string
): { sprite: SpriteComponent; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const data = comp.data as CocosSpriteData;

  let atlas = 'unknown';
  let frame = 'unknown';

  if (data._spriteFrame && '__uuid__' in data._spriteFrame) {
    const uuid = data._spriteFrame.__uuid__;
    const atMatch = uuid.match(/^([^@]+)@(.+)$/);
    if (atMatch) {
      atlas = atMatch[1];
      frame = atMatch[2];
    } else {
      atlas = uuid;
      frame = uuid;
    }
  } else {
    issues.push({
      severity: 'warning',
      code: 'MISSING_SPRITE_FRAME',
      sceneId,
      entityId,
      component: 'cc.Sprite',
      message: 'Sprite has no spriteFrame reference.',
    });
  }

  const sprite: SpriteComponent = { atlas, frame };

  const color = data._color as CocosColor | undefined;
  if (color && !(color.r === 255 && color.g === 255 && color.b === 255 && color.a === 255)) {
    sprite.color = colorToHex(color);
  }

  return { sprite, issues };
}

function mapCamera(comp: ParsedComponent): CameraComponent {
  const data = comp.data as CocosCameraData;
  const cam: CameraComponent = {};

  // Cocos: _projection 0=orthographic, 1=perspective
  if (data._projection === 0) {
    cam.mode = 'orthographic';
    if (data._orthoHeight != null) cam.size = data._orthoHeight;
  } else {
    cam.mode = 'perspective';
    if (data._fov != null) cam.fov = data._fov;
  }
  if (data._near != null) cam.near = data._near;
  if (data._far != null) cam.far = data._far;

  const color = data._color as CocosColor | undefined;
  if (color) cam.clearColor = colorToHex(color);

  return cam;
}

function mapLabel(comp: ParsedComponent): LabelComponent {
  const data = comp.data as CocosLabelData;
  const HALIGN = ['left', 'center', 'right'] as const;
  const VALIGN = ['top', 'center', 'bottom'] as const;
  const label: LabelComponent = { text: data._string ?? '' };
  if (data._fontSize != null) label.fontSize = data._fontSize;
  if (data._lineHeight != null) label.lineHeight = data._lineHeight;
  if (data._horizontalAlign != null) label.align = HALIGN[data._horizontalAlign] ?? 'left';
  if (data._verticalAlign != null) label.vAlign = VALIGN[data._verticalAlign] ?? 'top';
  if (data._enableWrapText != null) label.wrap = data._enableWrapText;
  const color = data._color as CocosColor | undefined;
  if (color && !(color.r === 255 && color.g === 255 && color.b === 255 && color.a === 255)) {
    label.color = colorToHex(color);
  }
  return label;
}

function mapDirectionalLight(comp: ParsedComponent): LightComponent {
  const data = comp.data as CocosDirectionalLightData;
  const light: LightComponent = { kind: 'directional' };
  const color = data._color as CocosColor | undefined;
  if (color && !(color.r === 255 && color.g === 255 && color.b === 255 && color.a === 255)) {
    light.color = colorToHex(color);
  }
  if (data._illuminance != null) light.intensity = data._illuminance;
  return light;
}

function mapButton(comp: ParsedComponent): ButtonComponent {
  const data = comp.data as CocosButtonData;
  const btn: ButtonComponent = {};
  if (data.interactable != null) btn.interactable = data.interactable;
  return btn;
}

function mapProgressBar(comp: ParsedComponent): ProgressBarComponent {
  const data = comp.data as CocosProgressBarData;
  const DIR = ['horizontal', 'vertical'] as const;
  const bar: ProgressBarComponent = { progress: data.progress ?? 0 };
  if (data.totalLength != null) bar.totalLength = data.totalLength;
  if (data.mode != null) bar.direction = DIR[data.mode] ?? 'horizontal';
  if (data.reverse != null) bar.reverse = data.reverse;
  return bar;
}

export function mapNode(
  node: ParsedNode,
  allNodes: ParsedNode[],
  sceneId: string,
  parentEntityId: string | null
): MappedEntity {
  const issues: ImportIssue[] = [];
  const entityId = makeEntityId(node, allNodes);

  const components: CanonicalComponents = {};

  const uiTransform = getFirstComponent(node, 'cc.UITransform');
  components.Transform = mapTransform(node, uiTransform);

  const spriteComp = getFirstComponent(node, 'cc.Sprite');
  if (spriteComp) {
    const { sprite, issues: spriteIssues } = mapSprite(spriteComp, sceneId, entityId);
    components.Sprite = sprite;
    issues.push(...spriteIssues);
  }

  const cameraComp = getFirstComponent(node, 'cc.Camera');
  if (cameraComp) {
    components.Camera = mapCamera(cameraComp);
  }

  const labelComp = getFirstComponent(node, 'cc.Label');
  if (labelComp) {
    components.Label = mapLabel(labelComp);
  }

  const lightComp = getFirstComponent(node, 'cc.DirectionalLight');
  if (lightComp) {
    components.Light = mapDirectionalLight(lightComp);
  }

  const buttonComp = getFirstComponent(node, 'cc.Button');
  if (buttonComp) {
    components.Button = mapButton(buttonComp);
  }

  const progressComp = getFirstComponent(node, 'cc.ProgressBar');
  if (progressComp) {
    components.ProgressBar = mapProgressBar(progressComp);
  }

  for (const comp of node.components) {
    if (SUPPORTED_COMPONENTS.has(comp.type) || SILENTLY_SKIPPED.has(comp.type)) continue;
    if (comp.type === 'cc.UITransform') continue;
    issues.push({
      severity: 'warning',
      code: 'UNSUPPORTED_COMPONENT',
      sceneId,
      entityId,
      component: comp.type,
      message: `Component ${comp.type} is not supported in Phase 1; entity kept without this component.`,
    });
  }

  const entity: CanonicalEntity = {
    id: entityId,
    name: node.name,
    parent: parentEntityId,
    enabled: node.active,
    components,
  };

  return { entity, issues };
}

export function mapSceneNodes(
  nodes: ParsedNode[],
  rootNodeIndices: number[],
  sceneId: string
): { entities: CanonicalEntity[]; issues: ImportIssue[] } {
  const entities: CanonicalEntity[] = [];
  const allIssues: ImportIssue[] = [];
  const usedIds = new Map<string, number>();

  const indexToNode = new Map<number, ParsedNode>();
  for (const node of nodes) {
    indexToNode.set(node.index, node);
  }

  function deduplicateId(id: string): string {
    const count = usedIds.get(id) ?? 0;
    usedIds.set(id, count + 1);
    return count === 0 ? id : `${id}:${count}`;
  }

  function walkNode(nodeIndex: number, parentEntityId: string | null): void {
    const node = indexToNode.get(nodeIndex);
    if (!node) return;

    const { entity, issues } = mapNode(node, nodes, sceneId, parentEntityId);
    entity.id = deduplicateId(entity.id);
    entities.push(entity);
    allIssues.push(...issues);

    for (const childIndex of node.childIndices) {
      walkNode(childIndex, entity.id);
    }
  }

  for (const rootIndex of rootNodeIndices) {
    walkNode(rootIndex, null);
  }

  return { entities, issues: allIssues };
}
