/**
 * Resumo do equilíbrio em várias sementes: para cada espécie, a mediana,
 * o mínimo e o máximo da população depois do primeiro ano, quantas vezes
 * ela chegou perto de sumir e quantas migrações foram precisas.
 *
 *   npm run balance -- [ticks] [sementes separadas por vírgula]
 */
import { SPECIES_LIST, type Species } from '../src/sim/species';
import { World } from '../src/sim/world';
import { INITIAL_POPULATION, WORLD_SIZE } from '../src/config';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ticks = Number(args[0] ?? 30000);
const seeds = (args[1] ?? '42,7,123,5,99,2024').split(',').map(Number);

const pad = (v: string | number, n: number) => String(v).padStart(n);

for (const seed of seeds) {
  const world = new World({ ...WORLD_SIZE, seed, ...INITIAL_POPULATION });
  const samples: Record<Species, number[]> = Object.fromEntries(SPECIES_LIST.map((sp) => [sp, [] as number[]])) as Record<Species, number[]>;
  for (let t = 0; t < ticks; t++) {
    world.step();
    if (t > 4800 && t % 300 === 0) for (const sp of SPECIES_LIST) samples[sp].push(world.count(sp));
  }
  const parts = SPECIES_LIST.map((sp) => {
    const v = [...samples[sp]].sort((a, b) => a - b);
    const med = v[Math.floor(v.length / 2)] ?? 0;
    const low = samples[sp].filter((x) => x < 5).length;
    return `${sp} med ${pad(med, 4)} [${pad(v[0] ?? 0, 3)}–${pad(v[v.length - 1] ?? 0, 4)}] baixo ${pad(low, 2)}`;
  });
  console.log(`semente ${pad(seed, 5)} | ${parts.join(' | ')} | migrações ${world.migrations}`);
}
