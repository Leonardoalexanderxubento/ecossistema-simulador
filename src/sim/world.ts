import { Plants, defaultPlantSettings, type PlantSettings } from './plants';
import { Random } from './random';
import { Terrain } from './terrain';

export interface WorldOptions {
  cols: number;
  rows: number;
  seed: number;
}

export interface WorldSettings {
  plants: PlantSettings;
}

export function defaultSettings(): WorldSettings {
  return { plants: { ...defaultPlantSettings } };
}

/** Estado completo da simulação: terreno, vegetação e (em breve) animais. */
export class World {
  readonly rng: Random;
  readonly terrain: Terrain;
  readonly plants: Plants;
  readonly settings: WorldSettings;
  tick = 0;

  constructor(readonly options: WorldOptions, settings: WorldSettings = defaultSettings()) {
    this.rng = new Random(options.seed);
    this.terrain = new Terrain(options.cols, options.rows, this.rng);
    this.plants = new Plants(this.terrain, this.rng);
    this.settings = settings;
  }

  step(): void {
    this.plants.step(this.rng, this.settings.plants);
    this.tick++;
  }
}
