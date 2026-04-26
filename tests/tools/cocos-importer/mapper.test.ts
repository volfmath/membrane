import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSceneFile } from '../../../tools/cocos-importer/scene-parser';
import { mapSceneNodes, mapNode } from '../../../tools/cocos-importer/component-mapper';
import { validateScene, CANONICAL_FORMATS, CANONICAL_VERSION } from '../../../src/canonical';

const FIXTURES = resolve(__dirname, '../../fixtures/cocos');

function loadAndParse(name: string) {
  const json = JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
  return parseSceneFile(json);
}

describe('mapSceneNodes', () => {
  it('maps minimal scene to canonical entities', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities, issues } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'level_01');

    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every(e => typeof e.id === 'string')).toBe(true);
    expect(entities.every(e => e.components.Transform !== undefined)).toBe(true);
  });

  it('produces valid canonical scene output', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test_scene');

    const scene = {
      format: CANONICAL_FORMATS.scene,
      version: CANONICAL_VERSION,
      sceneId: 'test_scene',
      entities,
    };

    const result = validateScene(scene);
    expect(result.valid).toBe(true);
    if (!result.valid) {
      console.log('Validation errors:', result.errors);
    }
  });

  it('maps Player node with Transform from _lpos', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const player = entities.find(e => e.name === 'Player');
    expect(player).toBeDefined();
    expect(player!.components.Transform).toBeDefined();
    expect(player!.components.Transform!.x).toBe(100);
    expect(player!.components.Transform!.y).toBe(200);
  });

  it('maps Player node with Sprite from cc.Sprite', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const player = entities.find(e => e.name === 'Player');
    expect(player).toBeDefined();
    expect(player!.components.Sprite).toBeDefined();
    expect(player!.components.Sprite!.atlas).toBe('a1b2c3d4-e5f6-7890-abcd-ef0123456789');
    expect(player!.components.Sprite!.frame).toBe('f9941');
  });

  it('maps Camera node with Camera component', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const camera = entities.find(e => e.name === 'Main Camera');
    expect(camera).toBeDefined();
    expect(camera!.components.Camera).toBeDefined();
    expect(camera!.components.Camera!.mode).toBe('orthographic');
    expect(camera!.components.Camera!.size).toBe(320);
    expect(camera!.components.Camera!.clearColor).toBe('#1A1A2EFF');
  });

  it('maps Player node with Label from cc.Label', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const player = entities.find(e => e.name === 'Player');
    expect(player).toBeDefined();
    expect(player!.components.Label).toBeDefined();
    expect(player!.components.Label!.text).toBe('Player');
    expect(player!.components.Label!.fontSize).toBe(24);
    expect(player!.components.Label!.align).toBe('center');
  });

  it('does not report cc.Label as unsupported', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { issues } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    expect(issues.some(i => i.component === 'cc.Label')).toBe(false);
  });

  it('reports truly unsupported components as issues', () => {
    const node = {
      index: 0,
      name: 'WithRigidBody',
      active: true,
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotation: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
      parentIndex: null,
      childIndices: [],
      components: [{
        type: 'cc.RigidBody',
        index: 1,
        data: { __type__: 'cc.RigidBody' },
      }],
    };
    const { issues } = mapNode(node, [node], 'test', null);
    const rbIssue = issues.find(i => i.component === 'cc.RigidBody');
    expect(rbIssue).toBeDefined();
    expect(rbIssue!.code).toBe('UNSUPPORTED_COMPONENT');
    expect(rbIssue!.severity).toBe('warning');
  });

  it('preserves parent-child hierarchy', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const canvas = entities.find(e => e.name === 'Canvas');
    const player = entities.find(e => e.name === 'Player');
    const camera = entities.find(e => e.name === 'Main Camera');

    expect(canvas!.parent).toBeNull();
    expect(player!.parent).toBe(canvas!.id);
    expect(camera!.parent).toBe(canvas!.id);
  });

  it('sets enabled from _active', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    expect(entities.every(e => e.enabled === true)).toBe(true);
  });

  it('omits default Transform values (zeros/ones)', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const canvas = entities.find(e => e.name === 'Canvas');
    const t = canvas!.components.Transform!;
    expect(t.x).toBeUndefined();
    expect(t.y).toBeUndefined();
    expect(t.scaleX).toBeUndefined();
    expect(t.scaleY).toBeUndefined();
  });

  it('does not include cc.Canvas or cc.UITransform as unsupported', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { issues } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    expect(issues.some(i => i.component === 'cc.Canvas')).toBe(false);
    expect(issues.some(i => i.component === 'cc.UITransform')).toBe(false);
  });

  it('generates unique entity ids', () => {
    const parsed = loadAndParse('min-scene.scene');
    const { entities } = mapSceneNodes(parsed.nodes, parsed.rootNodeIndices, 'test');

    const ids = entities.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('mapNode edge cases', () => {
  it('handles node with no components', () => {
    const node = {
      index: 0,
      name: 'Empty',
      active: true,
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotation: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
      parentIndex: null,
      childIndices: [],
      components: [],
    };

    const { entity, issues } = mapNode(node, [node], 'test', null);
    expect(entity.id).toBe('Empty');
    expect(entity.components.Transform).toBeDefined();
    expect(issues).toHaveLength(0);
  });

  it('handles Sprite with no spriteFrame', () => {
    const node = {
      index: 0,
      name: 'NoFrame',
      active: true,
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotation: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
      parentIndex: null,
      childIndices: [],
      components: [{
        type: 'cc.Sprite',
        index: 1,
        data: { __type__: 'cc.Sprite', node: { __id__: 0 }, _spriteFrame: null },
      }],
    };

    const { entity, issues } = mapNode(node, [node], 'test', null);
    expect(entity.components.Sprite).toBeDefined();
    expect(issues.some(i => i.code === 'MISSING_SPRITE_FRAME')).toBe(true);
  });
});
