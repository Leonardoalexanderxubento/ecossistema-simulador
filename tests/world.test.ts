import { describe, expect, it } from 'vitest';
import { Random } from '../src/sim/random';
import { Tile } from '../src/sim/terrain';
import { World, defaultSettings } from '../src/sim/world';

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
    // Sem predadores, para o teste não depender dos ciclos de caça.
    const world = new World({ ...options, seed: 11, foxes: 0 });
    for (let i = 0; i < 3000; i++) world.step();
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

  it('há machos e fêmeas, e os casais se desfazem quando um morre', () => {
    const world = run(13, 2000);
    const sexes = world.sexes('rabbit');
    expect(sexes.male).toBeGreaterThan(0);
    expect(sexes.female).toBeGreaterThan(0);
    for (const a of world.animals) {
      if (!a.partner) continue;
      expect(a.alive).toBe(true);
      expect(a.partner.alive).toBe(true);
      expect(a.partner.species).toBe(a.species);
      expect(a.partner.sex).not.toBe(a.sex);
    }
  });

  it('toda célula de terra aponta para uma margem de verdade', () => {
    const { terrain } = new World({ ...options, seed: 21 });
    const { cols } = terrain;
    let checked = 0;
    for (let i = 0; i < terrain.tiles.length; i++) {
      const target = terrain.nearestShore[i];
      if (terrain.tiles[i] === Tile.Water || target < 0) continue;
      checked++;
      expect(terrain.shore[target]).toBe(1);
      const x = target % cols;
      const y = (target - x) / cols;
      const nextToWater = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => terrain.inBounds(x + dx, y + dy) && terrain.tileAt(x + dx, y + dy) === Tile.Water);
      expect(nextToWater).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('animais com sede vão até a água e bebem', () => {
    const world = new World({ ...options, seed: 8, rabbits: 30, foxes: 0 }, { ...defaultSettings(), seasons: false });
    for (const a of world.animals) a.hydration = 0.3;
    for (let i = 0; i < 400; i++) world.step();
    const alive = world.animals.filter((a) => a.alive);
    expect(alive.length).toBeGreaterThan(0);
    expect(world.deaths.rabbit.thirst).toBe(0);
    expect(alive.some((a) => a.hydration > 0.9)).toBe(true);
  });

  it('cervos comem arbustos que coelhos não alcançam', () => {
    const shrubsAfter = (rabbits: number, deer: number) => {
      const world = new World({ ...options, seed: 4, rabbits, foxes: 0, deer });
      for (let i = 0; i < 600; i++) world.step();
      return world.plants.shrubs.reduce((n, v) => n + v, 0);
    };
    const untouched = shrubsAfter(0, 0);
    expect(shrubsAfter(0, 20)).toBeLessThan(untouched);
    expect(shrubsAfter(40, 0)).toBeCloseTo(untouched, 6);
  });

  it('raposas só caçam filhotes de cervo, não adultos', () => {
    const world = new World({ ...options, seed: 6, rabbits: 0, foxes: 10, deer: 20 }, { ...defaultSettings(), migration: false });
    for (const a of world.animals) if (a.species === 'deer') a.age = 2000;
    for (let i = 0; i < 1500; i++) world.step();
    // Todo cervo caçado nasceu durante o teste (filhote).
    const adultsLeft = world.animals.filter((a) => a.species === 'deer' && a.alive && a.generation === 1).length;
    const adultsDead = 20 - adultsLeft;
    expect(world.deaths.deer.eaten).toBeLessThanOrEqual(world.bornTotal.deer);
    expect(adultsDead).toBeLessThanOrEqual(world.deaths.deer.starved + world.deaths.deer.thirst + world.deaths.deer.old);
  });
});
