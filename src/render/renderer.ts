import type { Animal } from '../sim/animal';
import { geneFraction, type Gene } from '../sim/genes';
import { Tile } from '../sim/terrain';
import type { World } from '../sim/world';

/**
 * Desenha o mundo num canvas. O terreno e as plantas são pintados numa
 * imagem do tamanho da grade (1 pixel por célula) e ampliados sem
 * suavização — rápido mesmo com dezenas de milhares de células.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly grid: HTMLCanvasElement;
  private readonly gridCtx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly baseColors: Uint8ClampedArray;
  /** Gene usado para colorir os animais; `null` usa a cor da espécie. */
  colorBy: Gene | null = 'speed';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly world: World,
    readonly cellSize: number,
  ) {
    const { cols, rows } = world.terrain;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    this.ctx = canvas.getContext('2d')!;

    this.grid = document.createElement('canvas');
    this.grid.width = cols;
    this.grid.height = rows;
    this.gridCtx = this.grid.getContext('2d')!;
    this.image = this.gridCtx.createImageData(cols, rows);
    this.baseColors = this.computeBaseColors();
  }

  /** Cor de cada célula sem plantas — calculada uma vez só. */
  private computeBaseColors(): Uint8ClampedArray {
    const { tiles, height, fertility } = this.world.terrain;
    const colors = new Uint8ClampedArray(tiles.length * 3);
    for (let i = 0; i < tiles.length; i++) {
      let r: number, g: number, b: number;
      const h = height[i];
      if (tiles[i] === Tile.Water) {
        const depth = Math.min(1, (0.38 - h) * 5);
        r = 38 - depth * 18;
        g = 92 - depth * 40;
        b = 140 - depth * 40;
      } else if (tiles[i] === Tile.Sand) {
        r = 196;
        g = 182;
        b = 128;
      } else {
        // Solo: mais escuro e úmido onde é fértil.
        const f = fertility[i];
        r = 112 - f * 40;
        g = 96 - f * 20;
        b = 62 - f * 22;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    return colors;
  }

  draw(): void {
    this.paintGround();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.grid, 0, 0, this.canvas.width, this.canvas.height);
    this.drawAnimals();
  }

  private drawAnimals(): void {
    const ctx = this.ctx;
    const s = this.cellSize;
    for (const a of this.world.animals) {
      if (!a.alive) continue;
      const px = a.x * s;
      const py = a.y * s;
      const young = a.age < 240 ? 0.7 : 1;
      if (a.species === 'rabbit') {
        const r = 3 * a.traits.size * young;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(px + 0.8, py + 1.2, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.animalColor(a);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Raposa: triângulo apontando para onde ela vai.
        const r = 5.2 * a.traits.size * young;
        const h = a.heading;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(r + 1, 1.5);
        ctx.lineTo(-r * 0.7 + 1, r * 0.75 + 1.5);
        ctx.lineTo(-r * 0.7 + 1, -r * 0.75 + 1.5);
        ctx.fill();
        ctx.fillStyle = this.animalColor(a);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.7, r * 0.75);
        ctx.lineTo(-r * 0.7, -r * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /**
   * Cor do animal. Colorindo por gene, valores baixos ficam na cor da
   * espécie e valores altos vão para uma cor contrastante — assim dá para
   * ver a população mudando ao longo das gerações.
   */
  private animalColor(a: Animal): string {
    if (this.colorBy === null) return a.species === 'rabbit' ? '#f1e4c8' : '#e98a4a';
    const t = Math.max(0, Math.min(1, geneFraction(a.species, this.colorBy, a.traits[this.colorBy])));
    if (a.species === 'rabbit') {
      // Creme (baixo) → ciano (alto).
      return `hsl(${45 + t * 145} ${35 + t * 50}% ${88 - t * 18}%)`;
    }
    // Laranja-claro (baixo) → vermelho-escuro (alto).
    return `hsl(${38 - t * 38} ${80 + t * 15}% ${62 - t * 22}%)`;
  }

  private paintGround(): void {
    const data = this.image.data;
    const base = this.baseColors;
    const biomass = this.world.plants.biomass;
    for (let i = 0; i < biomass.length; i++) {
      const p = biomass[i];
      let r = base[i * 3];
      let g = base[i * 3 + 1];
      let b = base[i * 3 + 2];
      if (p > 0) {
        // Mistura o solo com verde conforme a biomassa.
        const t = 0.35 + p * 0.65;
        r = r + (58 - p * 20 - r) * t;
        g = g + (128 + p * 40 - g) * t;
        b = b + (48 - b) * t;
      }
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    this.gridCtx.putImageData(this.image, 0, 0);
  }
}
