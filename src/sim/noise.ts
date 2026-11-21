import { Random } from './random';

/**
 * Ruído de valor 2D (value noise) com várias oitavas.
 * Gera relevo suave para decidir onde há água, areia e grama.
 */
export class ValueNoise {
  private readonly size = 256;
  private readonly values: Float32Array;
  private readonly perm: Uint8Array;

  constructor(rng: Random) {
    this.values = new Float32Array(this.size);
    this.perm = new Uint8Array(this.size * 2);
    for (let i = 0; i < this.size; i++) this.values[i] = rng.next();
    const p = Array.from({ length: this.size }, (_, i) => i);
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < this.size * 2; i++) this.perm[i] = p[i % this.size];
  }

  private lattice(ix: number, iy: number): number {
    const x = ix & (this.size - 1);
    const y = iy & (this.size - 1);
    return this.values[this.perm[this.perm[x] + y]];
  }

  /** Ruído em [0, 1] numa coordenada contínua. */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = this.lattice(x0, y0);
    const b = this.lattice(x0 + 1, y0);
    const c = this.lattice(x0, y0 + 1);
    const d = this.lattice(x0 + 1, y0 + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  /** Soma de oitavas (fractal), normalizada para [0, 1]. */
  fractal(x: number, y: number, octaves = 4, persistence = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    let max = 0;
    for (let o = 0; o < octaves; o++) {
      total += this.sample(x * frequency, y * frequency) * amplitude;
      max += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / max;
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
