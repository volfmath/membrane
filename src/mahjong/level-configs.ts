// Ported from LevelConfs.ts — Cocos imports removed

export interface ILevelConfig {
  Level: number;
  CombieCount: number;
  RandomCount: number;
  Time: number;       // seconds
  CreateTime: number; // spawn delay (unused in 2D version)
  Scale: number;
  MJList: number[];
}

export const LevelLoopMin = 116;

const manualLevels: ILevelConfig[] = [
  { Level: 1,  CombieCount: 3,  RandomCount: 3,  Time: 100, CreateTime: 2,   Scale: 1.2, MJList: [11,15,19,1,5,9,21,25,29] },
  { Level: 2,  CombieCount: 20, RandomCount: 20, Time: 270, CreateTime: 2.5, Scale: 1,   MJList: [14,15,16,17,18,19,1,2,3,41,42,43,44,45,46,47,48,49,50,4,5,6] },
  { Level: 3,  CombieCount: 25, RandomCount: 25, Time: 300, CreateTime: 2.5, Scale: 1,   MJList: [11,12,13,14,15,16,17,41,42,43,44,45,46,47,2,3,4,5,6,7,8,35,31,34] },
  { Level: 4,  CombieCount: 30, RandomCount: 30, Time: 330, CreateTime: 2.5, Scale: 1,   MJList: [17,18,19,1,2,3,4,5,6,7,8,41,42,43,44,45,46,47,48,49,50,25,26,27,28,31] },
  { Level: 5,  CombieCount: 35, RandomCount: 32, Time: 360, CreateTime: 2.5, Scale: 1,   MJList: [11,12,21,22,23,24,25,26,27,28,29,50,32,33,35,41,42,43,44,45,46,47,48,49,15,16,17] },
  { Level: 6,  CombieCount: 36, RandomCount: 32, Time: 370, CreateTime: 2.5, Scale: 1,   MJList: [12,15,21,22,23,24,25,27,37,41,42,43,44,35,19,45,11,31,32,34,46,47,48,49,50,51,52,53,54,55] },
];

const randomCountFor7to30 = [32,32,33,34,34,34,34,35,36,36,37,38,39,40,40,41,42,43,44,44,45,46,47,48];

const cyclePattern: [number, number, number][] = [
  [61, 48, 620],
  [62, 49, 630],
  [63, 50, 630],
  [64, 51, 630],
  [70, 56, 630],
];

function generateLevels(): ILevelConfig[] {
  const levels: ILevelConfig[] = [...manualLevels];
  for (let lv = 7; lv <= 30; lv++) {
    levels.push({ Level: lv, CombieCount: 30 + lv, RandomCount: randomCountFor7to30[lv - 7], Time: 310 + lv * 10, CreateTime: 2.5, Scale: 1, MJList: [] });
  }
  for (let lv = 31; lv <= 120; lv++) {
    const [cc, rc, time] = cyclePattern[(lv - 31) % 5];
    levels.push({ Level: lv, CombieCount: cc, RandomCount: rc, Time: time, CreateTime: 2.5, Scale: 1, MJList: [] });
  }
  return levels;
}

export const LevelConfs: ILevelConfig[] = generateLevels();

export const randomMjListA = [1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,21,22,23,24,25,26,27,28,29,31,32,33,34,35,36,37];
export const randomMjListB = [41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84];

export function shuffle<T>(arr: T[]): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function buildTilePool(cfg: ILevelConfig): number[] {
  let types: number[];
  if (cfg.MJList.length > 0) {
    types = shuffle([...cfg.MJList]).slice(0, cfg.RandomCount);
  } else {
    const combined = shuffle([...randomMjListA, ...randomMjListB]);
    types = combined.slice(0, cfg.RandomCount);
  }

  // Distribute extra groups (CombieCount may exceed RandomCount)
  const pool: number[] = [];
  let extra = cfg.CombieCount - types.length;
  for (let i = 0; i < types.length; i++) {
    pool.push(types[i], types[i], types[i]);
    if (extra > 0) { pool.push(types[i], types[i], types[i]); extra--; }
  }
  return shuffle(pool);
}
