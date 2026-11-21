import { ValueNoise } from './noise';
import { Random } from './random';

export const enum Tile {
  Water = 0,
  Sand = 1,
  Grass = 2,
}

/**
 * Grade de terreno. Cada célula tem um tipo (água, areia, grama),
 * uma altura e uma fertilidade, que define o quão rápido as plantas crescem.
 */
export class Terrain {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly fertility: Float32Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
    rng: Random,
    waterLevel = 0.38,
  ) {
    const n = cols * rows;
    this.tiles = new Uint8Array(n);
    this.height = new Float32Array(n);
    this.fertility = new Float32Array(n);

    const relief = new ValueNoise(rng);
    const moisture = new ValueNoise(rng);
    const scale = 0.045;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        // Bordas um pouco mais baixas tendem a formar lagos e costas.
        const edge = Math.min(x, y, cols - 1 - x, rows - 1 - y) / Math.min(cols, rows);
        const h = relief.fractal(x * scale, y * scale, 5) * 0.9 + Math.min(edge, 0.12);
        this.height[i] = h;

        if (h < waterLevel) {
          this.tiles[i] = Tile.Water;
        } else if (h < waterLevel + 0.035) {
          this.tiles[i] = Tile.Sand;
        } else {
          this.tiles[i] = Tile.Grass;
          const m = moisture.fractal(x * scale * 1.7 + 100, y * scale * 1.7 + 100, 3);
          this.fertility[i] = clamp01(0.35 + m * 0.9 - (h - waterLevel) * 0.6);
        }
      }
    }
  }

  index(x: number, y: number): number {
    return y * this.cols + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  tileAt(x: number, y: number): Tile {
    return this.tiles[this.index(x, y)] as Tile;
  }

  /** Verdadeiro se um animal pode andar sobre essa célula. */
  walkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.tiles[this.index(x, y)] !== Tile.Water;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
