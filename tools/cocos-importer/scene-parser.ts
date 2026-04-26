import {
  type CocosSerializedObject,
  type CocosNodeData,
  type CocosSceneData,
  type CocosRef,
  type CocosColor,
  type CocosQuat,
  isCocosRef,
  isNodeData,
  isSceneData,
} from './cocos-types.js';

export interface ParsedNode {
  index: number;
  name: string;
  active: boolean;
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotation: number;  // Z-axis rotation (Euler degrees)
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  parentIndex: number | null;
  childIndices: number[];
  components: ParsedComponent[];
}

export interface ParsedComponent {
  type: string;
  index: number;
  data: CocosSerializedObject;
}

export interface ParsedScene {
  nodes: ParsedNode[];
  rootNodeIndices: number[];
  objects: CocosSerializedObject[];
}

function quatToEulerXYZ(q: CocosQuat): { rotationX: number; rotationY: number; rotation: number } {
  const RAD = 180 / Math.PI;
  const sinX = 2 * (q.w * q.x + q.y * q.z);
  const cosX = 1 - 2 * (q.x * q.x + q.y * q.y);
  const sinP = Math.max(-1, Math.min(1, 2 * (q.w * q.y - q.z * q.x)));
  const sinZ = 2 * (q.w * q.z + q.x * q.y);
  const cosZ = 1 - 2 * (q.y * q.y + q.z * q.z);
  return {
    rotationX: Math.atan2(sinX, cosX) * RAD,
    rotationY: Math.asin(sinP) * RAD,
    rotation: Math.atan2(sinZ, cosZ) * RAD,
  };
}

export function colorToHex(c: CocosColor): string {
  const r = Math.max(0, Math.min(255, c.r));
  const g = Math.max(0, Math.min(255, c.g));
  const b = Math.max(0, Math.min(255, c.b));
  const a = Math.max(0, Math.min(255, c.a));
  return '#' + [r, g, b, a].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function resolveRef(objects: CocosSerializedObject[], ref: CocosRef): CocosSerializedObject | null {
  const idx = ref.__id__;
  return (idx >= 0 && idx < objects.length) ? objects[idx] : null;
}

export function parseSceneFile(json: unknown): ParsedScene {
  if (!Array.isArray(json)) {
    throw new Error('Cocos scene file must be a JSON array');
  }

  const objects = json as CocosSerializedObject[];

  let sceneRootIndices: number[] = [];
  for (const obj of objects) {
    if (isSceneData(obj)) {
      sceneRootIndices = (obj._children || [])
        .filter(isCocosRef)
        .map(ref => ref.__id__);
      break;
    }
  }

  const nodes: ParsedNode[] = [];
  const indexToNodeMap = new Map<number, ParsedNode>();

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!isNodeData(obj)) continue;

    const euler = obj._lrot ? quatToEulerXYZ(obj._lrot) : { rotationX: 0, rotationY: 0, rotation: 0 };
    const node: ParsedNode = {
      index: i,
      name: obj._name || `node_${i}`,
      active: obj._active !== false,
      x: obj._lpos?.x ?? 0,
      y: obj._lpos?.y ?? 0,
      z: obj._lpos?.z ?? 0,
      rotationX: euler.rotationX,
      rotationY: euler.rotationY,
      rotation: euler.rotation,
      scaleX: obj._lscale?.x ?? 1,
      scaleY: obj._lscale?.y ?? 1,
      scaleZ: obj._lscale?.z ?? 1,
      parentIndex: (obj._parent && isCocosRef(obj._parent)) ? obj._parent.__id__ : null,
      childIndices: (obj._children || []).filter(isCocosRef).map(ref => ref.__id__),
      components: [],
    };

    const componentRefs = (obj._components || []).filter(isCocosRef);
    for (const ref of componentRefs) {
      const compObj = resolveRef(objects, ref);
      if (compObj) {
        node.components.push({
          type: compObj.__type__,
          index: ref.__id__,
          data: compObj,
        });
      }
    }

    nodes.push(node);
    indexToNodeMap.set(i, node);
  }

  const rootNodeIndices = sceneRootIndices.filter(idx => indexToNodeMap.has(idx));

  return { nodes, rootNodeIndices, objects };
}

export function getComponentsByType(node: ParsedNode, type: string): ParsedComponent[] {
  return node.components.filter(c => c.type === type);
}

export function getFirstComponent(node: ParsedNode, type: string): ParsedComponent | null {
  return node.components.find(c => c.type === type) ?? null;
}
