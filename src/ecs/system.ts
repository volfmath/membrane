import type { ArchetypeQuery } from './query';
import type { World } from './world';

export enum SystemPhase {
  PreUpdate = 0,
  Update = 1,
  PostUpdate = 2,
  PreRender = 3,
  Render = 4,
  PostRender = 5,
}

export const PHASE_COUNT = 6;

export interface System {
  readonly name: string;
  readonly phase: SystemPhase;
  readonly query: ArchetypeQuery | null;
  update(world: World, dt: number, matchedEntities: Uint32Array, matchedCount: number): void;
  enabled: boolean;
}
