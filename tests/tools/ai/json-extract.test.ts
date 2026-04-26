import { describe, it, expect } from 'vitest';
import { extractJson } from '../../../tools/ai/json-extract.js';

describe('extractJson', () => {
  it('extracts a simple object', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it('extracts a simple array', () => {
    expect(extractJson('[1,2,3]')).toBe('[1,2,3]');
  });

  it('extracts JSON from surrounding text', () => {
    const text = 'Here is the result:\n{"name":"test","value":42}\nDone.';
    expect(extractJson(text)).toBe('{"name":"test","value":42}');
  });

  it('handles nested braces', () => {
    const json = '{"a":{"b":{"c":1}},"d":[1,{"e":2}]}';
    expect(extractJson(`prefix ${json} suffix`)).toBe(json);
  });

  it('handles braces inside strings', () => {
    const json = '{"msg":"use {braces} here","arr":"[not an array]"}';
    expect(extractJson(json)).toBe(json);
  });

  it('handles escaped quotes in strings', () => {
    const json = '{"msg":"say \\"hello\\""}';
    expect(extractJson(json)).toBe(json);
  });

  it('returns null for no JSON', () => {
    expect(extractJson('no json here')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractJson('')).toBeNull();
  });

  it('does not match greedily past the closing brace', () => {
    const text = '{"a":1} some text with } more braces';
    expect(extractJson(text)).toBe('{"a":1}');
  });

  it('extracts from markdown code blocks', () => {
    const text = '```json\n{"scene":"test","entities":[]}\n```';
    expect(JSON.parse(extractJson(text)!)).toEqual({ scene: 'test', entities: [] });
  });
});
