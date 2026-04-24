import type { System } from './system';
import { PHASE_COUNT } from './system';
import type { World } from './world';

export class Scheduler {
  private phases: System[][] = [];
  private lastRunTicks = new Map<System, number>();
  private matchBuffer: Uint32Array;

  constructor(capacity: number) {
    for (let i = 0; i < PHASE_COUNT; i++) this.phases.push([]);
    this.matchBuffer = new Uint32Array(capacity);
  }

  addSystem(system: System): void {
    const list = this.phases[system.phase];
    if (list.indexOf(system) !== -1) {
      throw new Error(`System "${system.name}" already registered`);
    }
    list.push(system);
    this.lastRunTicks.set(system, 0);
  }

  removeSystem(system: System): void {
    const list = this.phases[system.phase];
    const idx = list.indexOf(system);
    if (idx !== -1) {
      list.splice(idx, 1);
      this.lastRunTicks.delete(system);
    }
  }

  getSystems(phase: number): ReadonlyArray<System> {
    return this.phases[phase];
  }

  getAllSystems(): ReadonlyArray<System> {
    const result: System[] = [];
    for (const list of this.phases) result.push(...list);
    return result;
  }

  getLastRunTick(system: System): number {
    return this.lastRunTicks.get(system) ?? 0;
  }

  update(world: World, dt: number): void {
    for (let phase = 0; phase < PHASE_COUNT; phase++) {
      const systems = this.phases[phase];
      for (let s = 0; s < systems.length; s++) {
        const system = systems[s];
        if (!system.enabled) continue;

        const query = system.query;
        let matchCount = 0;

        if (query !== null) {
          const lastTick = this.lastRunTicks.get(system) ?? 0;
          const hasTickFilters = query.hasTickFilters;
          const capacity = world.storage.capacity;

          for (let e = 0; e < capacity; e++) {
            const arch = world.storage.getArchetype(e);
            if (arch === 0n) continue;
            if (!query.matchesArchetype(arch)) continue;
            if (hasTickFilters && !query.matchesEntity(e, world.storage, lastTick)) continue;
            this.matchBuffer[matchCount++] = e;
          }
        }

        system.update(world, dt, this.matchBuffer, matchCount);
        this.lastRunTicks.set(system, world.storage.currentTick);
      }
    }
  }
}
