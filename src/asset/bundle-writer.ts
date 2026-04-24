import {
  BUNDLE_MAGIC,
  BUNDLE_VERSION,
  HEADER_SIZE,
  TOC_ENTRY_SIZE,
  AssetType,
} from './bundle-format';

interface PendingAsset {
  assetId: number;
  type: AssetType;
  data: Uint8Array;
}

export class BundleWriter {
  private assets: PendingAsset[] = [];

  get assetCount(): number {
    return this.assets.length;
  }

  addAsset(assetId: number, type: AssetType, data: ArrayBuffer | Uint8Array): void {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.assets.push({ assetId, type, data: bytes });
  }

  serialize(): ArrayBuffer {
    const tocOffset = HEADER_SIZE;
    const tocSize = this.assets.length * TOC_ENTRY_SIZE;
    const dataOffset = tocOffset + tocSize;

    let totalDataSize = 0;
    for (const a of this.assets) totalDataSize += a.data.byteLength;

    const totalSize = dataOffset + totalDataSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Header (32 bytes, little-endian)
    view.setUint32(0, BUNDLE_MAGIC, true);
    view.setUint16(4, BUNDLE_VERSION, true);
    view.setUint16(6, 0, true); // flags
    view.setUint32(8, this.assets.length, true);
    view.setUint32(12, tocOffset, true);
    view.setUint32(16, dataOffset, true);
    // reserved 12 bytes (20..31) already zero

    // TOC + Data
    let dataPos = 0;
    for (let i = 0; i < this.assets.length; i++) {
      const a = this.assets[i];
      const tocPos = tocOffset + i * TOC_ENTRY_SIZE;
      view.setUint32(tocPos, a.assetId, true);
      view.setUint8(tocPos + 4, a.type);
      view.setUint32(tocPos + 5, dataPos, true);
      view.setUint32(tocPos + 9, a.data.byteLength, true);

      bytes.set(a.data, dataOffset + dataPos);
      dataPos += a.data.byteLength;
    }

    return buffer;
  }
}
