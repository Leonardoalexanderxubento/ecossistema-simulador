export type Species = 'rabbit' | 'fox' | 'deer';

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
  /** Alcance da procura por parceiro, em múltiplos da visão (cheiro e chamados). */
  mateRange: number;
  /** Água perdida por tick (multiplicada pelo calor da estação). */
  thirstRate: number;
  /** Abaixo dessa hidratação o animal vai beber. */
  thirstThreshold: number;
  /** Territorialidade: acima de `max` vizinhos da espécie no raio, a fêmea não se reproduz. */
  territory?: { radius: number; max: number };
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
    mateRange: 2,
    thirstRate: 1 / 1800,
    thirstThreshold: 0.4,
  },
  fox: {
    baseMetabolism: 0.055,
    moveCost: 1.8,
    maxEnergy: 160,
    reproduceAt: 110,
    energyPerChild: 40,
    litter: [2, 3],
    reproduceCooldown: 600,
    maturityAge: 420,
    maxAge: 3600,
    hungerThreshold: 0.75,
    mateRange: 12,
    thirstRate: 1 / 2000,
    thirstThreshold: 0.35,
    territory: { radius: 14, max: 3 },
  },
  deer: {
    baseMetabolism: 0.26,
    moveCost: 3,
    maxEnergy: 260,
    reproduceAt: 180,
    energyPerChild: 70,
    litter: [1, 2],
    reproduceCooldown: 1500,
    maturityAge: 900,
    maxAge: 7200,
    hungerThreshold: 0.8,
    mateRange: 3,
    thirstRate: 1 / 1500,
    thirstThreshold: 0.4,
  },
};

export const SPECIES_NAMES: Record<Species, { one: string; many: string }> = {
  rabbit: { one: 'Coelho', many: 'Coelhos' },
  fox: { one: 'Raposa', many: 'Raposas' },
  deer: { one: 'Cervo', many: 'Cervos' },
};

/** Filhotes de cervo ainda são pequenos o bastante para as raposas. */
export function isPrey(a: { species: Species; age: number }): boolean {
  return a.species === 'rabbit' || (a.species === 'deer' && a.age < SPECIES.deer.maturityAge);
}

export const SPECIES_LIST = Object.keys(SPECIES) as Species[];
