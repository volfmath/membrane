import {
  BUNDLE_MAGIC,
  HEADER_SIZE,
  TOC_ENTRY_SIZE,
  AssetType,
  type BundleHeader,
  type TocEntry,
} from './bundle-format';

export class BundleReader {
  readonly header: BundleHeader;
  readonly entries: ReadonlyArray<TocEntry>;
  private readonly data: Uint8Array;
  private readonly dataOffset: number;
  private readonly entryMap: Map<number, TocEntry>;

  constructor(buffer: ArrayBuffer) {
    if (buffer.byteLength < HEADER_SIZE) {
      throw new Error('Bundle too small');
    }

    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    if (magic !== BUNDLE_MAGIC) {
      throw new Error(`Invalid bundle magic: 0x${magic.toString(16)}`);
    }

    const version = view.getUint16(4, true);
    if (version > 1) {
      throw new Error(`Unsupported bundle version: ${version}`);
    }

    this.header = {
      magic,
      version,
      flags: view.getUint16(6, true),
      assetCount: view.getUint32(8, true),
      tocOffset: view.getUint32(12, true),
      dataOffset: view.getUint32(16, true),
    };

    this.dataOffset = this.header.dataOffset;
    this.data = new Uint8Array(buffer);

    const entries: TocEntry[] = [];
    this.entryMap = new Map();
    for (let i = 0; i < this.header.assetCount; i++) {
      const pos = this.header.tocOffset + i * TOC_ENTRY_SIZE;
      const entry: TocEntry = {
        assetId: view.getUint32(pos, true),
        assetType: view.getUint8(pos + 4) as AssetType,
        offset: view.getUint32(pos + 5, true),
        size: view.getUint32(pos + 9, true),
      };
      entries.push(entry);
      this.entryMap.set(entry.assetId, entry);
    }
    this.entries = entries;
  }

  getAssetData(assetId: number): Uint8Array {
    const entry = this.entryMap.get(assetId);
    if (!entry) throw new Error(`Asset not found: ${assetId}`);
    const start = this.dataOffset + entry.offset;
    return this.data.subarray(start, start + entry.size);
  }

  getEntry(assetId: number): TocEntry | null {
    return this.entryMap.get(assetId) ?? null;
  }

  getAssetIdsByType(type: AssetType): number[] {
    const ids: number[] = [];
    for (const entry of this.entries) {
      if (entry.assetType === type) ids.push(entry.assetId);
    }
    return ids;
  }

  hasAsset(assetId: number): boolean {
    return this.entryMap.has(assetId);
  }
}
