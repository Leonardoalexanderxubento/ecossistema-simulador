import { Animal, type Traits } from './animal';
import { climateAt, type Climate } from './climate';
import { maxEnergy, releasePartner, updateFox, updateRabbit } from './behavior';
import { GENES, crossover, defaultMutation, founderTraits, type MutationSettings } from './genes';
import { Plants, defaultPlantSettings, type PlantSettings } from './plants';
import { Random } from './random';
import { SpatialHash } from './spatial';
import { SPECIES, SPECIES_LIST, type Species } from './species';
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
  /** Estações do ano: crescimento das plantas, frio e calor variam. */
  seasons: boolean;
}

export function defaultSettings(): WorldSettings {
  return { plants: { ...defaultPlantSettings }, migration: true, mutation: { ...defaultMutation }, seasons: true };
}

/** A cada quantos ticks a migração é verificada, e abaixo de quantos animais. */
const MIGRATION_INTERVAL = 900;
const MIGRATION_THRESHOLD: Record<Species, number> = { rabbit: 6, fox: 3 };
const MIGRANTS: Record<Species, number> = { rabbit: 8, fox: 4 };

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
  /** Índice espacial de cada espécie, reconstruído a cada tick. */
  readonly index: Record<Species, SpatialHash>;
  readonly deaths: Record<Species, Record<DeathCause, number>> = {
    rabbit: { starved: 0, old: 0, eaten: 0 },
    fox: { starved: 0, old: 0, eaten: 0 },
  };
  readonly bornTotal: Record<Species, number> = { rabbit: 0, fox: 0 };
  migrations = 0;
  /** Média dos genes da última população com tamanho razoável (usada por migrantes). */
  private lastKnownTraits: Partial<Record<Species, Traits>> = {};
  tick = 0;
  /** Clima do tick atual. */
  climate: Climate;
  private births: Animal[] = [];

  constructor(readonly options: WorldOptions, settings: WorldSettings = defaultSettings()) {
    this.rng = new Random(options.seed);
    this.terrain = new Terrain(options.cols, options.rows, this.rng);
    this.plants = new Plants(this.terrain, this.rng);
    this.settings = settings;
    this.climate = climateAt(0, settings.seasons);
    this.index = {
      rabbit: new SpatialHash(options.cols, options.rows),
      fox: new SpatialHash(options.cols, options.rows),
    };

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
    this.climate = climateAt(this.tick, this.settings.seasons);
    this.plants.step(this.rng, this.settings.plants, this.climate.growth);
    for (const species of SPECIES_LIST) {
      this.index[species].rebuild(this.animals.filter((a) => a.species === species));
    }

    for (const a of this.animals) {
      if (!a.alive) continue;
      if (a.species === 'rabbit') updateRabbit(this, a);
      else updateFox(this, a);
      this.age(a);
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
    for (const species of SPECIES_LIST) {
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
    for (const species of SPECIES_LIST) {
      // Também chegam migrantes se sobrou só um sexo: a espécie não teria futuro.
      const s = this.sexes(species);
      if (s.male + s.female >= MIGRATION_THRESHOLD[species] && s.male > 0 && s.female > 0) continue;
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
    if (a.energy <= 0) this.kill(a, 'starved');
    else if (a.age > cfg.maxAge) this.kill(a, 'old');
  }

  kill(a: Animal, cause: DeathCause): void {
    a.alive = false;
    releasePartner(a);
    this.deaths[a.species][cause]++;
  }

  /**
   * Reprodução sexuada: a mãe carrega a ninhada e paga a maior parte da
   * energia; o pai contribui com pouco. Cada filhote recebe uma mistura
   * dos genes dos dois, com mutações. Mães maiores têm filhotes maiores,
   * que custam mais energia.
   */
  mate(mother: Animal, father: Animal): void {
    const cfg = SPECIES[mother.species];
    const size = mother.traits.size;
    const cost = cfg.energyPerChild * size;
    const litter = this.rng.int(cfg.litter[0], cfg.litter[1]);
    for (let i = 0; i < litter; i++) {
      if (mother.energy < cost * 1.5) break;
      mother.energy -= cost;
      const child = new Animal(
        mother.species,
        mother.x + this.rng.range(-0.4, 0.4),
        mother.y + this.rng.range(-0.4, 0.4),
        crossover(mother.species, mother.traits, father.traits, this.rng, this.settings.mutation),
        cost * 0.9,
        Math.max(mother.generation, father.generation) + 1,
        this.rng,
      );
      child.cooldown = cfg.maturityAge;
      if (!this.terrain.walkable(child.cellX, child.cellY)) {
        child.x = mother.x;
        child.y = mother.y;
      }
      this.births.push(child);
      this.bornTotal[mother.species]++;
      mother.children++;
      father.children++;
    }
    father.energy -= cfg.energyPerChild * 0.2 * father.traits.size;
    mother.cooldown = cfg.reproduceCooldown;
    father.cooldown = Math.round(cfg.reproduceCooldown * 0.35);
    releasePartner(mother);
  }

  /** Quantos machos e fêmeas vivos a espécie tem. */
  sexes(species: Species): Record<'male' | 'female', number> {
    const n = { male: 0, female: 0 };
    for (const a of this.animals) if (a.alive && a.species === species) n[a.sex]++;
    return n;
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
