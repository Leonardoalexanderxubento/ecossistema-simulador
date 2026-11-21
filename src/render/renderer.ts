import type { Animal } from '../sim/animal';
import { geneFraction, type Gene } from '../sim/genes';
import { SPECIES, type Species } from '../sim/species';
import { Tile } from '../sim/terrain';

const BASE_COLORS: Record<Species, string> = { rabbit: '#f1e4c8', fox: '#e98a4a', deer: '#c39bff' };
const SHADOW = 'rgba(0,0,0,0.35)';

function drawRabbit(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(x + 0.8, y + 1.2, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Raposa: triângulo apontando para onde ela vai. */
function drawFox(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, heading: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  const shape = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(r + dx, dy);
    ctx.lineTo(-r * 0.7 + dx, r * 0.75 + dy);
    ctx.lineTo(-r * 0.7 + dx, -r * 0.75 + dy);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = SHADOW;
  shape(1, 1.5);
  ctx.fillStyle = color;
  shape(0, 0);
  ctx.restore();
}

/** Cervo: corpo alongado com cabeça; machos adultos têm galhada. */
function drawDeer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  heading: number,
  color: string,
  antlers: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(1, 1.5, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.95, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  if (antlers) {
    ctx.strokeStyle = '#efe2c6';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(r * 1.05, side * r * 0.25);
      ctx.lineTo(r * 1.45, side * r * 0.75);
      ctx.moveTo(r * 1.25, side * r * 0.5);
      ctx.lineTo(r * 1.6, side * r * 0.4);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Cor da vegetação no meio de cada estação (primavera, verão, outono, inverno). */
const SEASON_COLORS: [number, number, number][] = [
  [66, 160, 62],
  [58, 140, 48],
  [148, 130, 50],
  [104, 126, 100],
];

/** Cor da vegetação e intensidade da geada num ponto do ano (0–1). */
export function seasonTint(phase: number, seasons: boolean): { r: number; g: number; b: number; frost: number } {
  if (!seasons) {
    const [r, g, b] = SEASON_COLORS[1];
    return { r, g, b, frost: 0 };
  }
  // As cores de referência ficam no meio de cada estação; entre elas, mistura suave.
  const x = phase * 4 - 0.5;
  const k = ((Math.floor(x) % 4) + 4) % 4;
  const t = x - Math.floor(x);
  const s = t * t * (3 - 2 * t);
  const a = SEASON_COLORS[k];
  const b = SEASON_COLORS[(k + 1) % 4];
  const frost = Math.max(0, -Math.cos(2 * Math.PI * (phase - 0.375)));
  return { r: a[0] + (b[0] - a[0]) * s, g: a[1] + (b[1] - a[1]) * s, b: a[2] + (b[2] - a[2]) * s, frost };
}
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
  /** Animal destacado (inspetor). */
  selected: Animal | null = null;

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
    this.drawCouples();
    this.drawAnimals();
    this.drawSelection();
  }

  /** Anel em volta do animal selecionado e um círculo mostrando o alcance da visão. */
  private drawSelection(): void {
    const a = this.selected;
    if (!a || !a.alive) return;
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(a.x * s, a.y * s, a.traits.vision * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.x * s, a.y * s, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Linha discreta ligando cada casal enquanto eles se aproximam. */
  private drawCouples(): void {
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,150,200,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    for (const a of this.world.animals) {
      const p = a.partner;
      if (!a.alive || a.sex !== 'female' || !p || !p.alive) continue;
      ctx.moveTo(a.x * s, a.y * s);
      ctx.lineTo(p.x * s, p.y * s);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawAnimals(): void {
    const ctx = this.ctx;
    const s = this.cellSize;
    for (const a of this.world.animals) {
      if (!a.alive) continue;
      const px = a.x * s;
      const py = a.y * s;
      const young = a.age < SPECIES[a.species].maturityAge * 0.8 ? 0.7 : 1;
      const color = this.animalColor(a);
      if (a.species === 'rabbit') drawRabbit(ctx, px, py, 3 * a.traits.size * young, color);
      else if (a.species === 'fox') drawFox(ctx, px, py, 5.2 * a.traits.size * young, a.heading, color);
      else drawDeer(ctx, px, py, 4.2 * a.traits.size * young, a.heading, color, young === 1 && a.sex === 'male');
    }
  }

  /**
   * Cor do animal. Colorindo por gene, valores baixos ficam na cor da
   * espécie e valores altos vão para uma cor contrastante — assim dá para
   * ver a população mudando ao longo das gerações.
   */
  private animalColor(a: Animal): string {
    if (this.colorBy === null) return BASE_COLORS[a.species];
    const t = Math.max(0, Math.min(1, geneFraction(a.species, this.colorBy, a.traits[this.colorBy])));
    switch (a.species) {
      case 'rabbit':
        // Creme (baixo) → ciano (alto).
        return `hsl(${45 + t * 145} ${35 + t * 50}% ${88 - t * 18}%)`;
      case 'fox':
        // Laranja-claro (baixo) → vermelho-escuro (alto).
        return `hsl(${38 - t * 38} ${80 + t * 15}% ${62 - t * 22}%)`;
      case 'deer':
        // Lilás (baixo) → magenta (alto).
        return `hsl(${265 + t * 55} ${55 + t * 30}% ${78 - t * 18}%)`;
    }
  }

  private paintGround(): void {
    const data = this.image.data;
    const base = this.baseColors;
    const { biomass, shrubs } = this.world.plants;
    const { tiles } = this.world.terrain;
    const tint = seasonTint(this.world.climate.phase, this.world.settings.seasons);
    // No inverno a terra fica coberta de geada.
    const frost = tint.frost * 0.3;
    for (let i = 0; i < biomass.length; i++) {
      const p = biomass[i];
      let r = base[i * 3];
      let g = base[i * 3 + 1];
      let b = base[i * 3 + 2];
      if (frost > 0 && tiles[i] !== Tile.Water) {
        r += (215 - r) * frost;
        g += (222 - g) * frost;
        b += (228 - b) * frost;
      }
      if (p > 0) {
        // Mistura o solo com a cor da vegetação conforme a biomassa.
        const t = 0.35 + p * 0.65;
        r = r + (tint.r - p * 18 - r) * t;
        g = g + (tint.g + p * 30 - 15 - g) * t;
        b = b + (tint.b - b) * t;
      }
      const sh = shrubs[i];
      if (sh > 0.02) {
        // Arbustos: verde-escuro, que perde as folhas no inverno.
        const k = sh * 0.6;
        r += (28 + 70 * tint.frost - r) * k;
        g += (78 - g) * k;
        b += (46 + 6 * tint.frost - b) * k;
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
