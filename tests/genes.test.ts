import { describe, expect, it } from 'vitest';
import { BASE_TRAITS, GENES, GENE_RANGES, clampGene, crossover, founderTraits, inherit } from '../src/sim/genes';
import { Random } from '../src/sim/random';

describe('genes', () => {
  it('sem mutação, o filhote é idêntico ao pai/mãe', () => {
    const rng = new Random(1);
    const parent = { speed: 0.15, vision: 9, size: 1.1 };
    const child = inherit('rabbit', parent, rng, { rate: 0, strength: 0.5 });
    expect(child).toEqual(parent);
    expect(child).not.toBe(parent);
  });

  it('mutações sempre respeitam os limites da espécie', () => {
    const rng = new Random(2);
    let traits = { ...BASE_TRAITS.fox };
    for (let i = 0; i < 2000; i++) {
      traits = inherit('fox', traits, rng, { rate: 1, strength: 0.5 });
      for (const g of GENES) {
        const [min, max] = GENE_RANGES.fox[g];
        expect(traits[g]).toBeGreaterThanOrEqual(min);
        expect(traits[g]).toBeLessThanOrEqual(max);
      }
    }
  });

  it('mutações pequenas mantêm o filhote parecido com o pai/mãe', () => {
    const rng = new Random(3);
    const parent = BASE_TRAITS.rabbit;
    for (let i = 0; i < 500; i++) {
      const child = inherit('rabbit', parent, rng, { rate: 1, strength: 0.05 });
      for (const g of GENES) {
        expect(Math.abs(child[g] / parent[g] - 1)).toBeLessThan(0.3);
      }
    }
  });

  it('fundadores variam em torno dos valores de referência', () => {
    const rng = new Random(4);
    const n = 3000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += founderTraits('rabbit', rng).speed;
    expect(sum / n).toBeCloseTo(BASE_TRAITS.rabbit.speed, 2);
  });

  it('clampGene corta valores fora da faixa', () => {
    expect(clampGene('rabbit', 'size', 99)).toBe(GENE_RANGES.rabbit.size[1]);
    expect(clampGene('rabbit', 'size', -1)).toBe(GENE_RANGES.rabbit.size[0]);
  });

  it('no cruzamento, cada gene vem inteiro da mãe ou do pai', () => {
    const rng = new Random(5);
    const mother = { speed: 0.1, vision: 6, size: 0.8 };
    const father = { speed: 0.2, vision: 12, size: 1.4 };
    const fromFather = { speed: 0, vision: 0, size: 0 };
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const child = crossover('rabbit', mother, father, rng, { rate: 0, strength: 0 });
      for (const g of GENES) {
        expect([mother[g], father[g]]).toContain(child[g]);
        if (child[g] === father[g]) fromFather[g]++;
      }
    }
    // Cerca de metade dos genes vem de cada lado.
    for (const g of GENES) expect(fromFather[g] / n).toBeCloseTo(0.5, 1);
  });
});
