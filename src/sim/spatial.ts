import type { Animal } from './animal';

/**
 * Índice espacial em baldes: divide o mapa em blocos para encontrar
 * vizinhos próximos sem comparar cada animal com todos os outros.
 */
export class SpatialHash {
  private readonly buckets: Animal[][];
  private readonly bcols: number;
  private readonly brows: number;

  constructor(cols: number, rows: number, private readonly bucketSize = 8) {
    this.bcols = Math.ceil(cols / bucketSize);
    this.brows = Math.ceil(rows / bucketSize);
    this.buckets = Array.from({ length: this.bcols * this.brows }, () => []);
  }

  rebuild(animals: readonly Animal[]): void {
    for (const b of this.buckets) b.length = 0;
    for (const a of animals) {
      if (!a.alive) continue;
      const bx = Math.min(this.bcols - 1, Math.floor(a.x / this.bucketSize));
      const by = Math.min(this.brows - 1, Math.floor(a.y / this.bucketSize));
      this.buckets[by * this.bcols + bx].push(a);
    }
  }

  /** Animal vivo mais próximo dentro do raio que satisfaz o filtro. */
  nearest(x: number, y: number, radius: number, filter?: (a: Animal) => boolean): Animal | null {
    let best: Animal | null = null;
    let bestDist = radius * radius;
    const s = this.bucketSize;
    const x0 = Math.max(0, Math.floor((x - radius) / s));
    const x1 = Math.min(this.bcols - 1, Math.floor((x + radius) / s));
    const y0 = Math.max(0, Math.floor((y - radius) / s));
    const y1 = Math.min(this.brows - 1, Math.floor((y + radius) / s));
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        for (const a of this.buckets[by * this.bcols + bx]) {
          if (!a.alive || (filter && !filter(a))) continue;
          const dx = a.x - x;
          const dy = a.y - y;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            best = a;
          }
        }
      }
    }
    return best;
  }

  /** Todos os animais vivos dentro do raio. */
  within(x: number, y: number, radius: number): Animal[] {
    const found: Animal[] = [];
    const r2 = radius * radius;
    const s = this.bucketSize;
    const x0 = Math.max(0, Math.floor((x - radius) / s));
    const x1 = Math.min(this.bcols - 1, Math.floor((x + radius) / s));
    const y0 = Math.max(0, Math.floor((y - radius) / s));
    const y1 = Math.min(this.brows - 1, Math.floor((y + radius) / s));
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        for (const a of this.buckets[by * this.bcols + bx]) {
          if (!a.alive) continue;
          const dx = a.x - x;
          const dy = a.y - y;
          if (dx * dx + dy * dy <= r2) found.push(a);
        }
      }
    }
    return found;
  }
}
