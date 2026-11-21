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
  /** 1 nas células de terra vizinhas à água (onde os animais bebem). */
  readonly shore: Uint8Array;
  /** Para cada célula, o índice da margem mais próxima andando por terra (-1 se não há). */
  readonly nearestShore: Int32Array;

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

    this.shore = new Uint8Array(n);
    this.nearestShore = new Int32Array(n).fill(-1);
    this.mapShores();
  }

  /**
   * Marca as margens e, com uma busca em largura que parte de todas elas
   * ao mesmo tempo, descobre a margem mais próxima de cada célula.
   * É calculado uma vez; depois cada animal sabe para onde ir beber.
   */
  private mapShores(): void {
    const { cols, rows, tiles } = this;
    const queue = new Int32Array(cols * rows);
    let head = 0;
    let tail = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (tiles[i] === Tile.Water) continue;
        const nearWater =
          (x > 0 && tiles[i - 1] === Tile.Water) ||
          (x < cols - 1 && tiles[i + 1] === Tile.Water) ||
          (y > 0 && tiles[i - cols] === Tile.Water) ||
          (y < rows - 1 && tiles[i + cols] === Tile.Water);
        if (nearWater) {
          this.shore[i] = 1;
          this.nearestShore[i] = i;
          queue[tail++] = i;
        }
      }
    }
    while (head < tail) {
      const i = queue[head++];
      const x = i % cols;
      const y = (i - x) / cols;
      const visit = (j: number) => {
        if (tiles[j] === Tile.Water || this.nearestShore[j] !== -1) return;
        this.nearestShore[j] = this.nearestShore[i];
        queue[tail++] = j;
      };
      if (x > 0) visit(i - 1);
      if (x < cols - 1) visit(i + 1);
      if (y > 0) visit(i - cols);
      if (y < rows - 1) visit(i + cols);
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
