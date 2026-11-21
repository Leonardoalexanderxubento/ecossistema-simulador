export type Species = 'rabbit' | 'fox';

/** Parâmetros fixos de cada espécie (o que os genes não controlam). */
export interface SpeciesConfig {
  /** Gasto de energia por tick só por estar vivo. */
  baseMetabolism: number;
  /** Gasto extra ao se mover, multiplicado por velocidade² × tamanho. */
  moveCost: number;
  maxEnergy: number;
  /** Energia mínima para se reproduzir. */
  reproduceAt: number;
  /** Energia que o pai/mãe passa para cada filhote. */
  energyPerChild: number;
  litter: [min: number, max: number];
  /** Ticks de espera entre ninhadas. */
  reproduceCooldown: number;
  maturityAge: number;
  maxAge: number;
  /** Abaixo dessa fração da energia máxima o animal procura comida. */
  hungerThreshold: number;
}

export const SPECIES: Record<Species, SpeciesConfig> = {
  rabbit: {
    baseMetabolism: 0.14,
    moveCost: 4,
    maxEnergy: 100,
    reproduceAt: 75,
    energyPerChild: 24,
    litter: [1, 3],
    reproduceCooldown: 420,
    maturityAge: 300,
    maxAge: 2400,
    hungerThreshold: 0.85,
  },
  fox: {
    baseMetabolism: 0.07,
    moveCost: 2.6,
    maxEnergy: 160,
    reproduceAt: 120,
    energyPerChild: 50,
    litter: [1, 2],
    reproduceCooldown: 520,
    maturityAge: 420,
    maxAge: 3600,
    hungerThreshold: 0.75,
  },
};
