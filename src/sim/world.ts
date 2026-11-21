import { Animal, type Traits } from './animal';
import { updateRabbit } from './behavior';
import { Plants, defaultPlantSettings, type PlantSettings } from './plants';
import { Random } from './random';
import { SpatialHash } from './spatial';
import { SPECIES, type Species } from './species';
import { Terrain, Tile } from './terrain';

export interface WorldOptions {
  cols: number;
  rows: number;
  seed: number;
  rabbits: number;
}

export interface WorldSettings {
  plants: PlantSettings;
}

export function defaultSettings(): WorldSettings {
  return { plants: { ...defaultPlantSettings } };
}

export const BASE_TRAITS: Record<Species, Traits> = {
  rabbit: { speed: 0.12, vision: 8, size: 1 },
  fox: { speed: 0.14, vision: 11, size: 1 },
};

/** Estado completo da simulação: terreno, vegetação e animais. */
export class World {
  readonly rng: Random;
  readonly terrain: Terrain;
  readonly plants: Plants;
  readonly settings: WorldSettings;
  animals: Animal[] = [];
  readonly rabbitIndex: SpatialHash;
  tick = 0;
  private births: Animal[] = [];

  constructor(readonly options: WorldOptions, settings: WorldSettings = defaultSettings()) {
    this.rng = new Random(options.seed);
    this.terrain = new Terrain(options.cols, options.rows, this.rng);
    this.plants = new Plants(this.terrain, this.rng);
    this.settings = settings;
    this.rabbitIndex = new SpatialHash(options.cols, options.rows);

    for (let i = 0; i < options.rabbits; i++) this.spawnRandom('rabbit');
  }

  /** Cria um animal numa célula de grama aleatória. */
  spawnRandom(species: Species): Animal | null {
    for (let tries = 0; tries < 200; tries++) {
      const x = this.rng.int(0, this.terrain.cols - 1);
      const y = this.rng.int(0, this.terrain.rows - 1);
      if (this.terrain.tileAt(x, y) !== Tile.Grass) continue;
      const cfg = SPECIES[species];
      const animal = new Animal(
        species,
        x + 0.5,
        y + 0.5,
        { ...BASE_TRAITS[species] },
        cfg.maxEnergy * this.rng.range(0.5, 0.8),
        1,
        this.rng,
      );
      animal.age = this.rng.int(0, cfg.maturityAge * 2);
      this.animals.push(animal);
      return animal;
    }
    return null;
  }

  step(): void {
    this.plants.step(this.rng, this.settings.plants);
    this.rabbitIndex.rebuild(this.animals.filter((a) => a.species === 'rabbit'));

    for (const a of this.animals) {
      if (!a.alive) continue;
      if (a.species === 'rabbit') updateRabbit(this, a);
      this.age(a);
      if (a.alive) this.tryReproduce(a);
    }

    if (this.births.length > 0) {
      this.animals.push(...this.births);
      this.births = [];
    }
    if (this.tick % 30 === 0) this.animals = this.animals.filter((a) => a.alive);
    this.tick++;
  }

  private age(a: Animal): void {
    a.age++;
    if (a.cooldown > 0) a.cooldown--;
    const cfg = SPECIES[a.species];
    if (a.energy <= 0 || a.age > cfg.maxAge) a.alive = false;
  }

  /** Reprodução assexuada: filhotes herdam as características do pai/mãe. */
  private tryReproduce(parent: Animal): void {
    const cfg = SPECIES[parent.species];
    if (parent.age < cfg.maturityAge || parent.cooldown > 0 || parent.energy < cfg.reproduceAt) return;

    const litter = this.rng.int(cfg.litter[0], cfg.litter[1]);
    for (let i = 0; i < litter; i++) {
      if (parent.energy < cfg.energyPerChild * 1.5) break;
      parent.energy -= cfg.energyPerChild;
      const child = new Animal(
        parent.species,
        parent.x + this.rng.range(-0.4, 0.4),
        parent.y + this.rng.range(-0.4, 0.4),
        { ...parent.traits },
        cfg.energyPerChild * 0.9,
        parent.generation + 1,
        this.rng,
      );
      child.cooldown = cfg.maturityAge;
      if (!this.terrain.walkable(child.cellX, child.cellY)) {
        child.x = parent.x;
        child.y = parent.y;
      }
      this.births.push(child);
      parent.children++;
    }
    parent.cooldown = cfg.reproduceCooldown;
  }

  count(species: Species): number {
    let n = 0;
    for (const a of this.animals) if (a.alive && a.species === species) n++;
    return n;
  }
}
