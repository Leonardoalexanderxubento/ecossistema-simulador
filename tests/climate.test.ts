import { describe, expect, it } from 'vitest';
import { YEAR, climateAt, winters } from '../src/sim/climate';

describe('clima', () => {
  it('as estações seguem a ordem primavera → verão → outono → inverno', () => {
    expect([0, 0.25, 0.5, 0.75].map((f) => climateAt(f * YEAR + 1, true).season)).toEqual([0, 1, 2, 3]);
    expect(climateAt(YEAR * 2 + 5, true).year).toBe(3);
  });

  it('plantas crescem mais na primavera do que no outono', () => {
    expect(climateAt(YEAR * 0.2, true).growth).toBeGreaterThan(climateAt(YEAR * 0.7, true).growth);
  });

  it('o verão dá mais sede e o inverno, mais frio', () => {
    const summer = climateAt(YEAR * 0.375, true);
    const winter = climateAt(YEAR * 0.875, true);
    expect(summer.heat).toBeGreaterThan(winter.heat);
    expect(winter.cold).toBeGreaterThan(summer.cold);
  });

  it('com as estações desligadas, o clima é neutro', () => {
    const c = climateAt(YEAR * 0.8, false);
    expect([c.growth, c.cold, c.heat]).toEqual([1, 1, 1]);
  });

  it('encontra os invernos dentro de um intervalo', () => {
    expect(winters(0, YEAR * 2)).toEqual([
      [YEAR * 0.75, YEAR],
      [YEAR * 1.75, YEAR * 2],
    ]);
  });
});
