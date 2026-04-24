import { describe, it, expect } from 'vitest';
import { BundleWriter } from '../../src/asset/bundle-writer';
import { BundleReader } from '../../src/asset/bundle-reader';
import {
  AssetType,
  BUNDLE_MAGIC,
  BUNDLE_VERSION,
  HEADER_SIZE,
  TOC_ENTRY_SIZE,
} from '../../src/asset/bundle-format';

function makeData(length: number, fill = 0xAB): Uint8Array {
  const buf = new Uint8Array(length);
  buf.fill(fill);
  return buf;
}

describe('BundleWriter', () => {
  it('serializes an empty bundle', () => {
    const w = new BundleWriter();
    const buf = w.serialize();
    expect(buf.byteLength).toBe(HEADER_SIZE);

    const view = new DataView(buf);
    expect(view.getUint32(0, true)).toBe(BUNDLE_MAGIC);
    expect(view.getUint16(4, true)).toBe(BUNDLE_VERSION);
    expect(view.getUint32(8, true)).toBe(0);
  });

  it('tracks assetCount', () => {
    const w = new BundleWriter();
    expect(w.assetCount).toBe(0);
    w.addAsset(1, AssetType.Texture, makeData(16));
    expect(w.assetCount).toBe(1);
    w.addAsset(2, AssetType.Audio, makeData(32));
    expect(w.assetCount).toBe(2);
  });

  it('accepts ArrayBuffer input', () => {
    const w = new BundleWriter();
    const ab = new ArrayBuffer(8);
    new Uint8Array(ab).fill(0xCD);
    w.addAsset(1, AssetType.Binary, ab);

    const reader = new BundleReader(w.serialize());
    const data = reader.getAssetData(1);
    expect(data.length).toBe(8);
    expect(data[0]).toBe(0xCD);
  });
});

describe('BundleReader', () => {
  it('rejects buffer too small', () => {
    expect(() => new BundleReader(new ArrayBuffer(4))).toThrow('Bundle too small');
  });

  it('rejects invalid magic', () => {
    const buf = new ArrayBuffer(HEADER_SIZE);
    const view = new DataView(buf);
    view.setUint32(0, 0xDEADBEEF, true);
    expect(() => new BundleReader(buf)).toThrow('Invalid bundle magic');
  });

  it('rejects unsupported version', () => {
    const buf = new ArrayBuffer(HEADER_SIZE);
    const view = new DataView(buf);
    view.setUint32(0, BUNDLE_MAGIC, true);
    view.setUint16(4, 99, true);
    expect(() => new BundleReader(buf)).toThrow('Unsupported bundle version');
  });

  it('reads an empty bundle', () => {
    const w = new BundleWriter();
    const reader = new BundleReader(w.serialize());
    expect(reader.header.assetCount).toBe(0);
    expect(reader.entries.length).toBe(0);
  });

  it('throws on missing asset', () => {
    const w = new BundleWriter();
    const reader = new BundleReader(w.serialize());
    expect(() => reader.getAssetData(999)).toThrow('Asset not found');
  });
});

describe('Round-trip write → read', () => {
  it('preserves single asset', () => {
    const w = new BundleWriter();
    const payload = makeData(64, 0x42);
    w.addAsset(100, AssetType.Texture, payload);

    const reader = new BundleReader(w.serialize());
    expect(reader.header.assetCount).toBe(1);

    const entry = reader.getEntry(100);
    expect(entry).not.toBeNull();
    expect(entry!.assetType).toBe(AssetType.Texture);
    expect(entry!.size).toBe(64);

    const data = reader.getAssetData(100);
    expect(data.length).toBe(64);
    expect(data.every(b => b === 0x42)).toBe(true);
  });

  it('preserves multiple assets', () => {
    const w = new BundleWriter();
    w.addAsset(1, AssetType.Texture, makeData(100, 0x11));
    w.addAsset(2, AssetType.Audio, makeData(200, 0x22));
    w.addAsset(3, AssetType.JSON, makeData(50, 0x33));

    const reader = new BundleReader(w.serialize());
    expect(reader.header.assetCount).toBe(3);
    expect(reader.entries.length).toBe(3);

    expect(reader.getAssetData(1).length).toBe(100);
    expect(reader.getAssetData(1)[0]).toBe(0x11);
    expect(reader.getAssetData(2).length).toBe(200);
    expect(reader.getAssetData(2)[0]).toBe(0x22);
    expect(reader.getAssetData(3).length).toBe(50);
    expect(reader.getAssetData(3)[0]).toBe(0x33);
  });

  it('getAssetIdsByType filters correctly', () => {
    const w = new BundleWriter();
    w.addAsset(10, AssetType.Texture, makeData(8));
    w.addAsset(20, AssetType.Audio, makeData(8));
    w.addAsset(30, AssetType.Texture, makeData(8));

    const reader = new BundleReader(w.serialize());
    const textures = reader.getAssetIdsByType(AssetType.Texture);
    expect(textures).toEqual([10, 30]);

    const audio = reader.getAssetIdsByType(AssetType.Audio);
    expect(audio).toEqual([20]);

    const scenes = reader.getAssetIdsByType(AssetType.Scene);
    expect(scenes).toEqual([]);
  });

  it('hasAsset returns correct results', () => {
    const w = new BundleWriter();
    w.addAsset(5, AssetType.Binary, makeData(4));

    const reader = new BundleReader(w.serialize());
    expect(reader.hasAsset(5)).toBe(true);
    expect(reader.hasAsset(6)).toBe(false);
  });

  it('returns zero-copy subarray view', () => {
    const w = new BundleWriter();
    w.addAsset(1, AssetType.Binary, makeData(16, 0xFF));

    const buf = w.serialize();
    const reader = new BundleReader(buf);
    const data = reader.getAssetData(1);

    expect(data.buffer).toBe(buf);
    expect(data.byteOffset).toBeGreaterThan(0);
  });

  it('header fields are correct', () => {
    const w = new BundleWriter();
    w.addAsset(1, AssetType.Texture, makeData(32));
    w.addAsset(2, AssetType.Audio, makeData(64));

    const reader = new BundleReader(w.serialize());
    expect(reader.header.magic).toBe(BUNDLE_MAGIC);
    expect(reader.header.version).toBe(BUNDLE_VERSION);
    expect(reader.header.assetCount).toBe(2);
    expect(reader.header.tocOffset).toBe(HEADER_SIZE);
    expect(reader.header.dataOffset).toBe(HEADER_SIZE + 2 * TOC_ENTRY_SIZE);
  });
});
