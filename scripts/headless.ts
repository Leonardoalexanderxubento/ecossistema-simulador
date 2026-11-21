/**
 * Roda a simulação sem interface e imprime a evolução das populações.
 * Útil para ajustar o equilíbrio do ecossistema.
 *
 *   npm run sim -- [ticks] [seed]
 */
import { SPECIES_LIST } from '../src/sim/species';
import { World } from '../src/sim/world';
import { INITIAL_POPULATION, WORLD_SIZE } from '../src/config';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ticks = Number(args[0] ?? 12000);
const seed = Number(args[1] ?? 42);
const every = Number(args[2] ?? 600);

const world = new World({ ...WORLD_SIZE, seed, ...INITIAL_POPULATION });
const short = { rabbit: 'coelhos', fox: 'raposas', deer: 'cervos' };
const start = performance.now();
for (let t = 0; t <= ticks; t++) {
  if (t % every === 0) {
    const season = ['pri', 'ver', 'out', 'inv'][world.climate.season];
    const parts = SPECIES_LIST.map((sp) => {
      const s = world.stats(sp);
      const g = s.traits;
      return `${short[sp]} ${String(s.count).padStart(4)} [vel ${g.speed.toFixed(3)} vis ${g.vision.toFixed(1)} tam ${g.size.toFixed(2)} ger ${s.maxGeneration}]`;
    });
    console.log(`tick ${String(t).padStart(6)} ${season}  plantas ${world.plants.total().toFixed(0).padStart(5)}  ${parts.join('  ')}`);
  }
  world.step();
}
console.log('mortes', JSON.stringify(world.deaths), 'migrações', world.migrations);
console.log(`${ticks} ticks em ${(performance.now() - start).toFixed(0)} ms`);
