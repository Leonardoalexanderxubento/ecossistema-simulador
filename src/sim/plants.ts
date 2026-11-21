import { Random } from './random';
import { Terrain, Tile } from './terrain';

export interface PlantSettings {
  /** Velocidade de crescimento da biomassa por tick. */
  growthRate: number;
  /** Chance por tick de uma célula vazia ser colonizada por uma vizinha. */
  spreadChance: number;
  /** Chance por tick de uma semente brotar sozinha numa célula vazia. */
  seedChance: number;
}

/** Biomassa mínima que sobra depois de comida: as raízes rebrotam. */
export const ROOTS = 0.02;

/** Velocidade com que as folhas dos arbustos rebrotam. */
const SHRUB_GROWTH = 0.001;

export const defaultPlantSettings: PlantSettings = {
  growthRate: 0.004,
  spreadChance: 0.02,
  seedChance: 0.00002,
};

/**
 * Vegetação como um campo de biomassa por célula (0 = vazio, 1 = cheio).
 * Plantas crescem de forma logística e se espalham para células vizinhas
 * de grama, com velocidade proporcional à fertilidade do solo.
 */
export class Plants {
  readonly biomass: Float32Array;
  /**
   * Folhas de arbustos (0–1), que só crescem em solo bem fértil. Ficam
   * altas demais para os coelhos: são o alimento exclusivo dos cervos.
   */
  readonly shrubs: Float32Array;
  /** Quanto de arbusto cada célula comporta. */
  readonly shrubCapacity: Float32Array;
  private readonly next: Float32Array;

  constructor(
    private readonly terrain: Terrain,
    rng: Random,
    initialCover = 0.35,
  ) {
    this.biomass = new Float32Array(terrain.cols * terrain.rows);
    this.next = new Float32Array(this.biomass.length);
    this.shrubs = new Float32Array(this.biomass.length);
    this.shrubCapacity = new Float32Array(this.biomass.length);
    for (let i = 0; i < this.biomass.length; i++) {
      if (terrain.tiles[i] !== Tile.Grass) continue;
      if (rng.chance(initialCover * terrain.fertility[i])) this.biomass[i] = rng.range(0.3, 1);
      const cap = Math.min(1, Math.max(0, (terrain.fertility[i] - 0.55) * 2.5));
      this.shrubCapacity[i] = cap;
      this.shrubs[i] = cap * rng.range(0.5, 1);
    }
  }

  /** Avança um tick; `season` multiplica o crescimento (estações do ano). */
  step(rng: Random, settings: PlantSettings, season = 1): void {
    const { cols, rows, tiles, fertility } = this.terrain;
    const b = this.biomass;
    const out = this.next;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (tiles[i] !== Tile.Grass) {
          out[i] = 0;
          continue;
        }
        const current = b[i];
        const f = fertility[i] * season;
        if (current > 0) {
          // Crescimento logístico: rápido no meio, devagar perto do máximo.
          out[i] = Math.min(1, current + settings.growthRate * f * (0.15 + current) * (1 - current));
        } else {
          // Célula vazia: pode ser colonizada por vizinhas bem desenvolvidas.
          const neighbors = neighborBiomass(b, cols, rows, x, y);
          const colonized = neighbors > 0 && rng.chance(settings.spreadChance * neighbors * f);
          out[i] = colonized || rng.chance(settings.seedChance * f) ? 0.05 : 0;
        }
      }
    }
    b.set(out);

    // Arbustos rebrotam devagar até a capacidade da célula.
    const shrubs = this.shrubs;
    const cap = this.shrubCapacity;
    const g = SHRUB_GROWTH * season;
    for (let i = 0; i < shrubs.length; i++) {
      if (cap[i] > 0 && shrubs[i] < cap[i]) shrubs[i] += g * (cap[i] - shrubs[i] + 0.05);
      if (shrubs[i] > cap[i]) shrubs[i] = cap[i];
    }
  }

  /** Come folhas de arbusto; devolve quanto foi comido. */
  browse(index: number, amount: number): number {
    const eaten = Math.min(this.shrubs[index], amount);
    this.shrubs[index] -= eaten;
    return eaten;
  }

  /**
   * Retira até `amount` de biomassa da célula e devolve quanto foi comido.
   * `floor` é o mínimo que fica (bocas grandes não alcançam o capim rente).
   */
  eat(index: number, amount: number, floor = ROOTS): number {
    const available = this.biomass[index] - floor;
    if (available <= 0) return 0;
    const eaten = Math.min(available, amount);
    this.biomass[index] -= eaten;
    return eaten;
  }

  total(): number {
    let sum = 0;
    for (let i = 0; i < this.biomass.length; i++) sum += this.biomass[i];
    return sum;
  }
}

function neighborBiomass(b: Float32Array, cols: number, rows: number, x: number, y: number): number {
  let sum = 0;
  if (x > 0) sum += b[y * cols + x - 1];
  if (x < cols - 1) sum += b[y * cols + x + 1];
  if (y > 0) sum += b[(y - 1) * cols + x];
  if (y < rows - 1) sum += b[(y + 1) * cols + x];
  return sum * 0.25;
}
