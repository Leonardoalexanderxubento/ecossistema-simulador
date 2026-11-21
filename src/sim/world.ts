import { Animal, type Traits } from './animal';
import { maxEnergy, updateFox, updateRabbit } from './behavior';
import { GENES, defaultMutation, founderTraits, inherit, type MutationSettings } from './genes';
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
  mutation: MutationSettings;
}

export function defaultSettings(): WorldSettings {
  return { plants: { ...defaultPlantSettings }, migration: true, mutation: { ...defaultMutation } };
}

/** A cada quantos ticks a migração é verificada, e abaixo de quantos animais. */
const MIGRATION_INTERVAL = 900;
const MIGRATION_THRESHOLD: Record<Species, number> = { rabbit: 6, fox: 2 };
const MIGRANTS: Record<Species, number> = { rabbit: 8, fox: 3 };

export interface PopulationStats {
  count: number;
  /** Média de cada gene na população viva. */
  traits: Traits;
  maxGeneration: number;
}

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
  /** Média dos genes da última população com tamanho razoável (usada por migrantes). */
  private lastKnownTraits: Partial<Record<Species, Traits>> = {};
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
  spawnRandom(species: Species, base?: Traits): Animal | null {
    for (let tries = 0; tries < 200; tries++) {
      const x = this.rng.int(0, this.terrain.cols - 1);
      const y = this.rng.int(0, this.terrain.rows - 1);
      if (this.terrain.tileAt(x, y) !== Tile.Grass) continue;
      const cfg = SPECIES[species];
      const traits = founderTraits(species, this.rng, base);
      const animal = new Animal(species, x + 0.5, y + 0.5, traits, 0, 1, this.rng);
      animal.energy = maxEnergy(animal) * this.rng.range(0.5, 0.8);
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
    if (this.tick % 300 === 0) this.rememberTraits();
    if (this.settings.migration && this.tick > 0 && this.tick % MIGRATION_INTERVAL === 0) this.migrate();
    this.tick++;
  }

  private rememberTraits(): void {
    for (const species of ['rabbit', 'fox'] as const) {
      const s = this.stats(species);
      if (s.count >= 8) this.lastKnownTraits[species] = s.traits;
    }
  }

  /**
   * Traz alguns animais de fora do mapa se uma espécie está sumindo.
   * Eles se parecem com a última população conhecida, como se tivessem
   * evoluído em paralelo numa região vizinha.
   */
  private migrate(): void {
    for (const species of ['rabbit', 'fox'] as const) {
      if (this.count(species) >= MIGRATION_THRESHOLD[species]) continue;
      for (let i = 0; i < MIGRANTS[species]; i++) {
        const a = this.spawnRandom(species, this.lastKnownTraits[species]);
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

  /**
   * Reprodução assexuada: filhotes herdam os genes do pai/mãe, com mutações.
   * Animais maiores precisam de mais energia para ter filhotes, que já
   * nascem proporcionalmente maiores.
   */
  private tryReproduce(parent: Animal): void {
    const cfg = SPECIES[parent.species];
    const size = parent.traits.size;
    if (parent.age < cfg.maturityAge || parent.cooldown > 0 || parent.energy < cfg.reproduceAt * size) return;

    const cost = cfg.energyPerChild * size;
    const litter = this.rng.int(cfg.litter[0], cfg.litter[1]);
    for (let i = 0; i < litter; i++) {
      if (parent.energy < cost * 1.5) break;
      parent.energy -= cost;
      const child = new Animal(
        parent.species,
        parent.x + this.rng.range(-0.4, 0.4),
        parent.y + this.rng.range(-0.4, 0.4),
        inherit(parent.species, parent.traits, this.rng, this.settings.mutation),
        cost * 0.9,
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

  stats(species: Species): PopulationStats {
    const sums: Traits = { speed: 0, vision: 0, size: 0 };
    let count = 0;
    let maxGeneration = 0;
    for (const a of this.animals) {
      if (!a.alive || a.species !== species) continue;
      count++;
      for (const g of GENES) sums[g] += a.traits[g];
      if (a.generation > maxGeneration) maxGeneration = a.generation;
    }
    if (count > 0) for (const g of GENES) sums[g] /= count;
    return { count, traits: sums, maxGeneration };
  }

  count(species: Species): number {
    let n = 0;
    for (const a of this.animals) if (a.alive && a.species === species) n++;
    return n;
  }
}
