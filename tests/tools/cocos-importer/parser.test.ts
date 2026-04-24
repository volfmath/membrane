import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseSceneFile, getFirstComponent, getComponentsByType, colorToHex } from '../../../tools/cocos-importer/scene-parser';

const FIXTURES = resolve(__dirname, '../../fixtures/cocos');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

describe('parseSceneFile', () => {
  it('parses the minimal scene fixture', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.rootNodeIndices.length).toBeGreaterThan(0);
  });

  it('extracts node names', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const names = result.nodes.map(n => n.name);

    expect(names).toContain('Canvas');
    expect(names).toContain('Player');
    expect(names).toContain('Main Camera');
  });

  it('extracts node positions from _lpos', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const player = result.nodes.find(n => n.name === 'Player')!;

    expect(player.x).toBe(100);
    expect(player.y).toBe(200);
    expect(player.z).toBe(0);
  });

  it('extracts node scale from _lscale', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const player = result.nodes.find(n => n.name === 'Player')!;

    expect(player.scaleX).toBe(1);
    expect(player.scaleY).toBe(1);
  });

  it('resolves parent-child relationships', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const canvas = result.nodes.find(n => n.name === 'Canvas')!;
    const player = result.nodes.find(n => n.name === 'Player')!;

    expect(canvas.childIndices).toContain(player.index);
    expect(player.parentIndex).toBe(canvas.index);
  });

  it('resolves components on nodes', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const player = result.nodes.find(n => n.name === 'Player')!;

    const compTypes = player.components.map(c => c.type);
    expect(compTypes).toContain('cc.UITransform');
    expect(compTypes).toContain('cc.Sprite');
    expect(compTypes).toContain('cc.Label');
  });

  it('resolves camera components', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const camera = result.nodes.find(n => n.name === 'Main Camera')!;

    const cam = getFirstComponent(camera, 'cc.Camera');
    expect(cam).not.toBeNull();
    expect(cam!.type).toBe('cc.Camera');
  });

  it('identifies root nodes from cc.Scene', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);

    expect(result.rootNodeIndices.length).toBe(1);
    const rootNode = result.nodes.find(n => n.index === result.rootNodeIndices[0])!;
    expect(rootNode.name).toBe('Canvas');
  });

  it('throws on non-array input', () => {
    expect(() => parseSceneFile({})).toThrow('must be a JSON array');
    expect(() => parseSceneFile('string')).toThrow('must be a JSON array');
  });

  it('handles empty array', () => {
    const result = parseSceneFile([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.rootNodeIndices).toHaveLength(0);
  });
});

describe('getComponentsByType', () => {
  it('returns all components of a given type', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const player = result.nodes.find(n => n.name === 'Player')!;

    const transforms = getComponentsByType(player, 'cc.UITransform');
    expect(transforms).toHaveLength(1);
  });

  it('returns empty array for missing type', () => {
    const json = loadFixture('min-scene.scene');
    const result = parseSceneFile(json);
    const player = result.nodes.find(n => n.name === 'Player')!;

    expect(getComponentsByType(player, 'cc.RigidBody')).toHaveLength(0);
  });
});

describe('colorToHex', () => {
  it('converts white', () => {
    expect(colorToHex({ __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 })).toBe('#FFFFFFFF');
  });

  it('converts red half-transparent', () => {
    expect(colorToHex({ __type__: 'cc.Color', r: 255, g: 0, b: 0, a: 128 })).toBe('#FF000080');
  });

  it('converts dark blue', () => {
    expect(colorToHex({ __type__: 'cc.Color', r: 26, g: 26, b: 46, a: 255 })).toBe('#1A1A2EFF');
  });

  it('clamps out-of-range values', () => {
    expect(colorToHex({ __type__: 'cc.Color', r: 300, g: -10, b: 0, a: 255 })).toBe('#FF0000FF');
  });
});
