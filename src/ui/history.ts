import type { Traits } from '../sim/animal';
import type { World } from '../sim/world';

export interface Sample {
  tick: number;
  rabbits: number;
  foxes: number;
  /** Fração das células de grama cobertas de vegetação (0–1). */
  plants: number;
  rabbitTraits: Traits | null;
  foxTraits: Traits | null;
}

/**
 * Guarda a história inteira da simulação com memória limitada:
 * quando enche, descarta uma amostra a cada duas e passa a amostrar
 * com metade da frequência. Assim o gráfico sempre mostra do início até agora.
 */
export class History {
  samples: Sample[] = [];
  private interval: number;

  constructor(
    private readonly maxSamples = 360,
    initialInterval = 30,
  ) {
    this.interval = initialInterval;
  }

  record(world: World, grassCells: number): void {
    if (world.tick % this.interval !== 0) return;
    const r = world.stats('rabbit');
    const f = world.stats('fox');
    this.samples.push({
      tick: world.tick,
      rabbits: r.count,
      foxes: f.count,
      plants: grassCells > 0 ? world.plants.total() / grassCells : 0,
      rabbitTraits: r.count > 0 ? r.traits : null,
      foxTraits: f.count > 0 ? f.traits : null,
    });
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.filter((_, i) => i % 2 === 0);
      this.interval *= 2;
    }
  }
}
