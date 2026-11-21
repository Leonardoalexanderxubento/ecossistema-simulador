export interface Series {
  label: string;
  color: string;
  /** Valores na mesma ordem de `x`; `null` interrompe a linha. */
  values: (number | null)[];
  /** Eixo da direita (escala própria). */
  rightAxis?: boolean;
  dashed?: boolean;
}

export interface ChartOptions {
  x: number[];
  series: Series[];
  formatY?: (v: number) => string;
  formatRightY?: (v: number) => string;
  rightMax?: number;
}

/** Gráfico de linhas simples em canvas, nítido em telas de alta densidade. */
export class LineChart {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(opts: ChartOptions): void {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const style = getComputedStyle(canvas);
    const grid = style.getPropertyValue('--chart-grid').trim() || '#2c352a';
    const muted = style.getPropertyValue('--muted').trim() || '#95a28e';

    const pad = { left: 34, right: opts.series.some((s) => s.rightAxis) ? 34 : 8, top: 8, bottom: 16 };
    const w = cssW - pad.left - pad.right;
    const h = cssH - pad.top - pad.bottom;
    const { x } = opts;
    if (x.length < 2 || w <= 0 || h <= 0) return;

    const leftMax = niceMax(maxOf(opts.series.filter((s) => !s.rightAxis)));
    const rightMax = opts.rightMax ?? niceMax(maxOf(opts.series.filter((s) => s.rightAxis)));
    const x0 = x[0];
    const x1 = x[x.length - 1];
    const px = (v: number) => pad.left + ((v - x0) / (x1 - x0 || 1)) * w;

    ctx.font = '10px system-ui, sans-serif';
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.fillStyle = muted;
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + h - (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText((opts.formatY ?? fmt)((leftMax * i) / 4), pad.left - 4, y);
      if (pad.right > 8) {
        ctx.textAlign = 'left';
        ctx.fillText((opts.formatRightY ?? fmt)((rightMax * i) / 4), pad.left + w + 4, y);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(timeLabel(x0), pad.left, cssH - 3);
    ctx.textAlign = 'right';
    ctx.fillText(timeLabel(x1), pad.left + w, cssH - 3);

    for (const s of opts.series) {
      const max = s.rightAxis ? rightMax : leftMax;
      const py = (v: number) => pad.top + h - (v / (max || 1)) * h;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash(s.dashed ? [4, 3] : []);
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i < x.length; i++) {
        const v = s.values[i];
        if (v === null || v === undefined) {
          drawing = false;
          continue;
        }
        if (drawing) ctx.lineTo(px(x[i]), py(v));
        else ctx.moveTo(px(x[i]), py(v));
        drawing = true;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

function maxOf(series: Series[]): number {
  let m = 0;
  for (const s of series) for (const v of s.values) if (v !== null && v > m) m = v;
  return m;
}

/** Arredonda o topo do eixo para um número "bonito". */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

function fmt(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  if (v >= 10 || v === 0) return v.toFixed(0);
  if (v >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

/** Ticks → tempo simulado legível (30 ticks = 1 s em velocidade 1×). */
export function timeLabel(tick: number): string {
  const s = Math.floor(tick / 30);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
