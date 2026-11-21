import type { Traits } from '../sim/animal';
import { SPECIES_LIST, type Species } from '../sim/species';
import type { World } from '../sim/world';

export interface Sample {
  tick: number;
  /** Tamanho de cada população. */
  counts: Record<Species, number>;
  /** Fração das células de grama cobertas de vegetação (0–1). */
  plants: number;
  /** Média dos genes de cada espécie (`null` se ela estava extinta). */
  traits: Record<Species, Traits | null>;
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
    const counts = {} as Record<Species, number>;
    const traits = {} as Record<Species, Traits | null>;
    for (const species of SPECIES_LIST) {
      const s = world.stats(species);
      counts[species] = s.count;
      traits[species] = s.count > 0 ? s.traits : null;
    }
    this.samples.push({
      tick: world.tick,
      counts,
      plants: grassCells > 0 ? world.plants.total() / grassCells : 0,
      traits,
    });
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.filter((_, i) => i % 2 === 0);
      this.interval *= 2;
    }
  }
}
