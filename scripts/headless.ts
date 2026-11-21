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

const world = new World({ cols: 160, rows: 100, seed, rabbits: 120, foxes: 14 });
const start = performance.now();
for (let t = 0; t <= ticks; t++) {
  if (t % 600 === 0) {
    const plants = world.plants.total().toFixed(0);
    const r = world.stats('rabbit');
    const f = world.stats('fox');
    const genes = (s: typeof r) =>
      `vel ${s.traits.speed.toFixed(3)} vis ${s.traits.vision.toFixed(1)} tam ${s.traits.size.toFixed(2)} ger ${s.maxGeneration}`;
    console.log(
      `tick ${String(t).padStart(6)}  plantas ${plants.padStart(5)}  ` +
        `coelhos ${String(r.count).padStart(4)} [${genes(r)}]  raposas ${String(f.count).padStart(3)} [${genes(f)}]`,
    );
  }
  world.step();
}
console.log('mortes', JSON.stringify(world.deaths), 'migrações', world.migrations);
console.log(`${ticks} ticks em ${(performance.now() - start).toFixed(0)} ms`);
