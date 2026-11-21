import type { Traits } from './animal';
import type { Random } from './random';
import type { Species } from './species';

export type Gene = keyof Traits;
export const GENES: readonly Gene[] = ['speed', 'vision', 'size'];

export const GENE_LABELS: Record<Gene, string> = {
  speed: 'Velocidade',
  vision: 'Visão',
  size: 'Tamanho',
};

/** Limites físicos de cada gene, por espécie. */
export const GENE_RANGES: Record<Species, Record<Gene, [min: number, max: number]>> = {
  rabbit: { speed: [0.04, 0.3], vision: [2, 20], size: [0.6, 1.8] },
  fox: { speed: [0.05, 0.36], vision: [3, 24], size: [0.6, 2] },
  deer: { speed: [0.04, 0.3], vision: [3, 22], size: [0.7, 2] },
  wolf: { speed: [0.05, 0.34], vision: [4, 26], size: [0.7, 2] },
};

/** Valores de partida de cada espécie, antes de qualquer evolução. */
export const BASE_TRAITS: Record<Species, Traits> = {
  rabbit: { speed: 0.12, vision: 8, size: 1 },
  fox: { speed: 0.165, vision: 11, size: 1 },
  deer: { speed: 0.12, vision: 10, size: 1 },
  wolf: { speed: 0.15, vision: 13, size: 1 },
};

export interface MutationSettings {
  /** Probabilidade de cada gene sofrer mutação num filhote. */
  rate: number;
  /** Tamanho típico da mutação, como fração do valor (desvio padrão). */
  strength: number;
}

export const defaultMutation: MutationSettings = { rate: 0.35, strength: 0.08 };

export function clampGene(species: Species, gene: Gene, value: number): number {
  const [min, max] = GENE_RANGES[species][gene];
  return value < min ? min : value > max ? max : value;
}

/**
 * Copia os genes do pai/mãe com mutações aleatórias. A mutação é
 * multiplicativa (± alguns %), então genes grandes e pequenos variam
 * na mesma proporção.
 */
export function inherit(species: Species, parent: Traits, rng: Random, settings: MutationSettings): Traits {
  const child = { ...parent };
  for (const gene of GENES) {
    if (rng.chance(settings.rate)) {
      child[gene] = clampGene(species, gene, parent[gene] * (1 + rng.gaussian() * settings.strength));
    }
  }
  return child;
}

/**
 * Reprodução sexuada: cada gene vem inteiro da mãe ou do pai, sorteado
 * de forma independente (como cromossomos diferentes), e depois pode
 * sofrer mutação. Misturar os pais cria combinações novas a cada ninhada.
 */
export function crossover(
  species: Species,
  mother: Traits,
  father: Traits,
  rng: Random,
  settings: MutationSettings,
): Traits {
  const mix = { ...mother };
  for (const gene of GENES) if (rng.chance(0.5)) mix[gene] = father[gene];
  return inherit(species, mix, rng, settings);
}

/**
 * Genes de um animal que chega sem pais no mapa: os valores de referência
 * (por padrão, os da espécie original) com variação natural, para a
 * seleção ter com o que trabalhar.
 */
export function founderTraits(
  species: Species,
  rng: Random,
  base: Traits = BASE_TRAITS[species],
  variation = 0.15,
): Traits {
  const traits = { ...base };
  for (const gene of GENES) {
    traits[gene] = clampGene(species, gene, base[gene] * (1 + rng.gaussian() * variation));
  }
  return traits;
}

/** Posição de um valor dentro da faixa do gene, de 0 a 1 (útil para cores). */
export function geneFraction(species: Species, gene: Gene, value: number): number {
  const [min, max] = GENE_RANGES[species][gene];
  return (value - min) / (max - min);
}
