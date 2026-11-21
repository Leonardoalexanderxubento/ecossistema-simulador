/**
 * Gerador de números pseudoaleatórios com semente (mulberry32).
 * Com a mesma semente, a simulação se repete exatamente — útil para testes
 * e para compartilhar mundos interessantes.
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número em [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Número em [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Inteiro em [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Amostra de uma normal padrão (Box–Muller). */
  gaussian(): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
