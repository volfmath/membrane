export interface CocosRef {
  __id__: number;
}

export interface CocosUuid {
  __uuid__: string;
  __expectedType__?: string;
}

export interface CocosVec3 {
  __type__: 'cc.Vec3';
  x: number;
  y: number;
  z: number;
}

export interface CocosVec2 {
  __type__: 'cc.Vec2';
  x: number;
  y: number;
}

export interface CocosQuat {
  __type__: 'cc.Quat';
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface CocosSize {
  __type__: 'cc.Size';
  width: number;
  height: number;
}

export interface CocosColor {
  __type__: 'cc.Color';
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface CocosSerializedObject {
  __type__: string;
  _name?: string;
  _objFlags?: number;
  [key: string]: unknown;
}

export interface CocosNodeData extends CocosSerializedObject {
  __type__: 'cc.Node';
  _name: string;
  _parent: CocosRef | null;
  _children: CocosRef[];
  _active: boolean;
  _components: CocosRef[];
  _lpos: CocosVec3;
  _lrot: CocosQuat;
  _lscale: CocosVec3;
}

export interface CocosSceneData extends CocosSerializedObject {
  __type__: 'cc.Scene';
  _name: string;
  _children: CocosRef[];
}

export interface CocosSceneAssetData extends CocosSerializedObject {
  __type__: 'cc.SceneAsset';
  scene: CocosRef;
}

export interface CocosUITransformData extends CocosSerializedObject {
  __type__: 'cc.UITransform';
  node: CocosRef;
  _contentSize: CocosSize;
  _anchorPoint: CocosVec2;
}

export interface CocosSpriteData extends CocosSerializedObject {
  __type__: 'cc.Sprite';
  node: CocosRef;
  _spriteFrame?: CocosUuid | null;
  _type?: number;
  _sizeMode?: number;
  _color?: CocosColor;
}

export interface CocosCameraData extends CocosSerializedObject {
  __type__: 'cc.Camera';
  node: CocosRef;
  _projection: number;  // 0=orthographic, 1=perspective
  _fov?: number;
  _orthoHeight?: number;
  _near?: number;
  _far?: number;
  _color?: CocosColor;
}

export interface CocosLabelData extends CocosSerializedObject {
  __type__: 'cc.Label';
  node: CocosRef;
  _string?: string;
  _fontSize?: number;
  _lineHeight?: number;
  _horizontalAlign?: number;
  _verticalAlign?: number;
  _color?: CocosColor;
  _enableWrapText?: boolean;
}

export interface CocosDirectionalLightData extends CocosSerializedObject {
  __type__: 'cc.DirectionalLight';
  node: CocosRef;
  _color?: CocosColor;
  _illuminance?: number;
}

export interface CocosButtonData extends CocosSerializedObject {
  __type__: 'cc.Button';
  node: CocosRef;
  interactable?: boolean;
}

export interface CocosProgressBarData extends CocosSerializedObject {
  __type__: 'cc.ProgressBar';
  node: CocosRef;
  totalLength?: number;
  progress?: number;
  mode?: number;
  reverse?: boolean;
}

export function isCocosRef(v: unknown): v is CocosRef {
  return typeof v === 'object' && v !== null && '__id__' in v;
}

export function isCocosUuid(v: unknown): v is CocosUuid {
  return typeof v === 'object' && v !== null && '__uuid__' in v;
}

export function isNodeData(obj: CocosSerializedObject): obj is CocosNodeData {
  return obj.__type__ === 'cc.Node';
}

export function isSceneData(obj: CocosSerializedObject): obj is CocosSceneData {
  return obj.__type__ === 'cc.Scene';
}
