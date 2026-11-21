import { describe, expect, it } from 'vitest';
import { Random } from '../src/sim/random';
import { World } from '../src/sim/world';

const options = { cols: 80, rows: 50, rabbits: 60, foxes: 6 };

function run(seed: number, ticks: number): World {
  const world = new World({ ...options, seed });
  for (let i = 0; i < ticks; i++) world.step();
  return world;
}

describe('Random', () => {
  it('é determinístico para a mesma semente', () => {
    const a = new Random(99);
    const b = new Random(99);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('World', () => {
  it('a mesma semente produz exatamente a mesma história', () => {
    const a = run(7, 1500);
    const b = run(7, 1500);
    expect(a.count('rabbit')).toBe(b.count('rabbit'));
    expect(a.count('fox')).toBe(b.count('fox'));
    expect(a.plants.total()).toBe(b.plants.total());
  });

  it('nenhum animal fica em cima da água', () => {
    const world = run(3, 1500);
    for (const a of world.animals) {
      if (!a.alive) continue;
      expect(world.terrain.walkable(a.cellX, a.cellY)).toBe(true);
    }
  });

  it('a vida continua: nascem filhotes e novas gerações aparecem', () => {
    const world = run(11, 3000);
    expect(world.bornTotal.rabbit).toBeGreaterThan(0);
    expect(world.stats('rabbit').maxGeneration).toBeGreaterThan(1);
  });

  it('plantas nunca saem da faixa [0, 1]', () => {
    const world = run(5, 1000);
    for (const b of world.plants.biomass) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});
