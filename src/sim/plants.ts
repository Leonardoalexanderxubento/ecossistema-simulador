import { Random } from './random';
import { Terrain, Tile } from './terrain';

export interface PlantSettings {
  /** Velocidade de crescimento da biomassa por tick. */
  growthRate: number;
  /** Chance por tick de uma célula vazia ser colonizada por uma vizinha. */
  spreadChance: number;
}

export const defaultPlantSettings: PlantSettings = {
  growthRate: 0.012,
  spreadChance: 0.02,
};

/**
 * Vegetação como um campo de biomassa por célula (0 = vazio, 1 = cheio).
 * Plantas crescem de forma logística e se espalham para células vizinhas
 * de grama, com velocidade proporcional à fertilidade do solo.
 */
export class Plants {
  readonly biomass: Float32Array;
  private readonly next: Float32Array;

  constructor(
    private readonly terrain: Terrain,
    rng: Random,
    initialCover = 0.35,
  ) {
    this.biomass = new Float32Array(terrain.cols * terrain.rows);
    this.next = new Float32Array(this.biomass.length);
    for (let i = 0; i < this.biomass.length; i++) {
      if (terrain.tiles[i] === Tile.Grass && rng.chance(initialCover * terrain.fertility[i])) {
        this.biomass[i] = rng.range(0.3, 1);
      }
    }
  }

  step(rng: Random, settings: PlantSettings): void {
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
        const f = fertility[i];
        if (current > 0) {
          // Crescimento logístico: rápido no meio, devagar perto do máximo.
          out[i] = Math.min(1, current + settings.growthRate * f * (0.15 + current) * (1 - current));
        } else {
          // Célula vazia: pode ser colonizada por vizinhas bem desenvolvidas.
          const neighbors = neighborBiomass(b, cols, rows, x, y);
          out[i] = neighbors > 0 && rng.chance(settings.spreadChance * neighbors * f) ? 0.05 : 0;
        }
      }
    }
    b.set(out);
  }

  /** Retira até `amount` de biomassa da célula e devolve quanto foi comido. */
  eat(index: number, amount: number): number {
    const available = this.biomass[index];
    const eaten = Math.min(available, amount);
    const left = available - eaten;
    this.biomass[index] = left < 0.02 ? 0 : left;
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
