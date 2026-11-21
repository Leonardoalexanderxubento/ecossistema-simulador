import { Animal, type Traits } from './animal';
import { updateFox, updateRabbit } from './behavior';
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
  foxes: number;
}

export type DeathCause = 'starved' | 'old' | 'eaten';

export interface WorldSettings {
  plants: PlantSettings;
  /** Se verdadeiro, migrantes chegam quando uma espécie quase desaparece. */
  migration: boolean;
}

export function defaultSettings(): WorldSettings {
  return { plants: { ...defaultPlantSettings }, migration: true };
}

/** A cada quantos ticks a migração é verificada, e abaixo de quantos animais. */
const MIGRATION_INTERVAL = 900;
const MIGRATION_THRESHOLD: Record<Species, number> = { rabbit: 6, fox: 2 };
const MIGRANTS: Record<Species, number> = { rabbit: 8, fox: 3 };

export const BASE_TRAITS: Record<Species, Traits> = {
  rabbit: { speed: 0.12, vision: 8, size: 1 },
  fox: { speed: 0.165, vision: 11, size: 1 },
};

/** Estado completo da simulação: terreno, vegetação e animais. */
export class World {
  readonly rng: Random;
  readonly terrain: Terrain;
  readonly plants: Plants;
  readonly settings: WorldSettings;
  animals: Animal[] = [];
  readonly rabbitIndex: SpatialHash;
  readonly foxIndex: SpatialHash;
  readonly deaths: Record<Species, Record<DeathCause, number>> = {
    rabbit: { starved: 0, old: 0, eaten: 0 },
    fox: { starved: 0, old: 0, eaten: 0 },
  };
  readonly bornTotal: Record<Species, number> = { rabbit: 0, fox: 0 };
  migrations = 0;
  tick = 0;
  private births: Animal[] = [];

  constructor(readonly options: WorldOptions, settings: WorldSettings = defaultSettings()) {
    this.rng = new Random(options.seed);
    this.terrain = new Terrain(options.cols, options.rows, this.rng);
    this.plants = new Plants(this.terrain, this.rng);
    this.settings = settings;
    this.rabbitIndex = new SpatialHash(options.cols, options.rows);
    this.foxIndex = new SpatialHash(options.cols, options.rows);

    for (let i = 0; i < options.rabbits; i++) this.spawnRandom('rabbit');
    for (let i = 0; i < options.foxes; i++) this.spawnRandom('fox');
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
    this.foxIndex.rebuild(this.animals.filter((a) => a.species === 'fox'));

    for (const a of this.animals) {
      if (!a.alive) continue;
      if (a.species === 'rabbit') updateRabbit(this, a);
      else updateFox(this, a);
      this.age(a);
      if (a.alive) this.tryReproduce(a);
    }

    if (this.births.length > 0) {
      this.animals.push(...this.births);
      this.births = [];
    }
    if (this.tick % 30 === 0) this.animals = this.animals.filter((a) => a.alive);
    if (this.settings.migration && this.tick > 0 && this.tick % MIGRATION_INTERVAL === 0) this.migrate();
    this.tick++;
  }

  /** Traz alguns animais de fora do mapa se uma espécie está sumindo. */
  private migrate(): void {
    for (const species of ['rabbit', 'fox'] as const) {
      if (this.count(species) >= MIGRATION_THRESHOLD[species]) continue;
      for (let i = 0; i < MIGRANTS[species]; i++) {
        const a = this.spawnRandom(species);
        if (a) a.age = SPECIES[species].maturityAge;
      }
      this.migrations++;
    }
  }

  private age(a: Animal): void {
    a.age++;
    if (a.cooldown > 0) a.cooldown--;
    const cfg = SPECIES[a.species];
    if (a.energy <= 0) {
      a.alive = false;
      this.recordDeath(a, 'starved');
    } else if (a.age > cfg.maxAge) {
      a.alive = false;
      this.recordDeath(a, 'old');
    }
  }

  recordDeath(a: Animal, cause: DeathCause): void {
    this.deaths[a.species][cause]++;
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
      this.bornTotal[parent.species]++;
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
