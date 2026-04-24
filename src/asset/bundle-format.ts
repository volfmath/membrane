export const BUNDLE_MAGIC = 0x57584745; // "WXGE"
export const BUNDLE_VERSION = 1;
export const HEADER_SIZE = 32;
export const TOC_ENTRY_SIZE = 13;

export enum AssetType {
  Texture = 1,
  Audio = 2,
  Scene = 3,
  Animation = 4,
  Shader = 5,
  Binary = 6,
  JSON = 7,
}

export interface BundleHeader {
  magic: number;
  version: number;
  flags: number;
  assetCount: number;
  tocOffset: number;
  dataOffset: number;
}

export interface TocEntry {
  assetId: number;
  assetType: AssetType;
  offset: number;
  size: number;
}
