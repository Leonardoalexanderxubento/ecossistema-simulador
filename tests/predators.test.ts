import { describe, expect, it } from 'vitest';
import { FAWN_AGE, canHunt } from '../src/sim/species';
import { World, defaultSettings } from '../src/sim/world';

const options = { cols: 80, rows: 50, rabbits: 0, foxes: 0 };

describe('predadores', () => {
  it('raposas pegam coelhos e só cervos recém-nascidos', () => {
    expect(canHunt('fox', { species: 'rabbit', age: 5000 })).toBe(true);
    expect(canHunt('fox', { species: 'deer', age: FAWN_AGE - 1 })).toBe(true);
    expect(canHunt('fox', { species: 'deer', age: FAWN_AGE + 1 })).toBe(false);
    expect(canHunt('fox', { species: 'wolf', age: 0 })).toBe(false);
  });

  it('lobos caçam cervos de qualquer idade e coelhos, mas não raposas', () => {
    expect(canHunt('wolf', { species: 'deer', age: 99999 })).toBe(true);
    expect(canHunt('wolf', { species: 'rabbit', age: 10 })).toBe(true);
    expect(canHunt('wolf', { species: 'fox', age: 10 })).toBe(false);
  });

  it('um bando de lobos com fome abate cervos adultos', () => {
    const world = new World({ ...options, seed: 17, deer: 25, wolves: 6 }, { ...defaultSettings(), migration: false });
    for (const a of world.animals) {
      if (a.species === 'deer') a.age = 3000;
      if (a.species === 'wolf') a.energy = 80;
    }
    for (let i = 0; i < 3000; i++) world.step();
    expect(world.deaths.deer.eaten).toBeGreaterThan(0);
  });

  it('lobos andam em bando: ficam mais perto uns dos outros do que ao acaso', () => {
    const world = new World({ ...options, seed: 23, deer: 0, wolves: 6 }, { ...defaultSettings(), migration: false, thirst: false });
    // Saciados, para não saírem caçando.
    const meanSpacing = () => {
      const w = world.animals.filter((a) => a.alive && a.species === 'wolf');
      let sum = 0;
      let n = 0;
      for (const a of w) for (const b of w) if (a !== b) (sum += Math.hypot(a.x - b.x, a.y - b.y)), n++;
      return sum / n;
    };
    for (const a of world.animals) a.energy = 290;
    const before = meanSpacing();
    for (let i = 0; i < 600; i++) {
      for (const a of world.animals) a.energy = 290;
      world.step();
    }
    expect(meanSpacing()).toBeLessThan(before);
  });
});
