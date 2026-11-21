/**
 * Roda a simulação sem interface e imprime a evolução das populações.
 * Útil para ajustar o equilíbrio do ecossistema.
 *
 *   npx vite-node scripts/headless.ts -- [ticks] [seed]
 */
import { World } from '../src/sim/world';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ticks = Number(args[0] ?? 12000);
const seed = Number(args[1] ?? 42);

const world = new World({ cols: 160, rows: 100, seed, rabbits: 120 });
const start = performance.now();
for (let t = 0; t <= ticks; t++) {
  if (t % 600 === 0) {
    const plants = world.plants.total().toFixed(0);
    console.log(`tick ${String(t).padStart(6)}  coelhos ${String(world.count('rabbit')).padStart(4)}  plantas ${plants}`);
  }
  world.step();
}
console.log(`${ticks} ticks em ${(performance.now() - start).toFixed(0)} ms`);
