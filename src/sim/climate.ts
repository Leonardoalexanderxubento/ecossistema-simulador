/** Duração de um ano, em ticks (2 min 40 s em velocidade 1×). */
export const YEAR = 4800;

export const SEASON_NAMES = ['Primavera', 'Verão', 'Outono', 'Inverno'] as const;
export type Season = 0 | 1 | 2 | 3;

/** Como o clima do momento afeta plantas e animais. */
export interface Climate {
  /** Posição no ano, de 0 (início da primavera) a 1. */
  phase: number;
  season: Season;
  /** Ano atual, começando em 1. */
  year: number;
  /** Multiplicador do crescimento das plantas. */
  growth: number;
  /** Multiplicador do gasto para manter o corpo aquecido. */
  cold: number;
  /** Multiplicador da perda de água (calor). */
  heat: number;
}

const NEUTRAL = { growth: 1, cold: 1, heat: 1 };

/**
 * Clima de um instante. As curvas são suaves (cossenos), então as
 * estações se misturam em vez de mudar de repente:
 * - plantas crescem mais no fim da primavera e quase param no fim do outono;
 * - o calor (e a sede) é máximo no meio do verão;
 * - o frio aumenta o gasto de energia no inverno.
 */
export function climateAt(tick: number, seasons: boolean): Climate {
  const phase = (tick % YEAR) / YEAR;
  const season = Math.floor(phase * 4) as Season;
  const year = Math.floor(tick / YEAR) + 1;
  if (!seasons) return { phase, season, year, ...NEUTRAL };
  const summer = Math.cos(2 * Math.PI * (phase - 0.375));
  return {
    phase,
    season,
    year,
    growth: 1 + 0.45 * Math.cos(2 * Math.PI * (phase - 0.25)),
    heat: 1 + 0.4 * summer,
    cold: 1 + 0.15 * Math.max(0, -summer),
  };
}

/** Intervalos de inverno (em ticks) entre `from` e `to`, para destacar em gráficos. */
export function winters(from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = Math.floor(from / YEAR); y * YEAR <= to; y++) {
    const start = y * YEAR + YEAR * 0.75;
    const end = (y + 1) * YEAR;
    if (end > from && start < to) out.push([Math.max(start, from), Math.min(end, to)]);
  }
  return out;
}
