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
  rotation: number;
  scaleX: number;
  scaleY: number;
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

function quatToDegreesZ(q: CocosQuat): number {
  const sinZ = 2 * (q.w * q.z + q.x * q.y);
  const cosZ = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(sinZ, cosZ) * (180 / Math.PI);
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

    const node: ParsedNode = {
      index: i,
      name: obj._name || `node_${i}`,
      active: obj._active !== false,
      x: obj._lpos?.x ?? 0,
      y: obj._lpos?.y ?? 0,
      z: obj._lpos?.z ?? 0,
      rotation: obj._lrot ? quatToDegreesZ(obj._lrot) : 0,
      scaleX: obj._lscale?.x ?? 1,
      scaleY: obj._lscale?.y ?? 1,
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
