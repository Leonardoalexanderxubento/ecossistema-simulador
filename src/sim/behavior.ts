import type { Animal } from './animal';
import { SPECIES } from './species';
import type { World } from './world';

/** Quanto de energia um coelho tira de 1.0 de biomassa. */
const PLANT_NUTRITION = 15;
/** Biomassa que um coelho consegue comer por tick. */
const BITE = 0.06;

/** Gasto de energia do tick, que depende do corpo e de quanto se moveu. */
export function metabolism(a: Animal, moved: number): number {
  const cfg = SPECIES[a.species];
  const { size, vision } = a.traits;
  const body = cfg.baseMetabolism * size ** 0.75;
  const senses = vision * 0.0025;
  const motion = cfg.moveCost * moved * moved * size;
  return body + senses + motion;
}

export function updateRabbit(world: World, a: Animal): void {
  const cfg = SPECIES.rabbit;
  const { terrain, plants } = world;
  let moved = 0;

  const hungry = a.energy < cfg.maxEnergy * cfg.hungerThreshold;
  const here = terrain.index(a.cellX, a.cellY);

  if (hungry && plants.biomass[here] > 0.05) {
    // Parado comendo.
    a.state = 'food';
    const eaten = plants.eat(here, BITE * a.traits.size);
    a.energy = Math.min(cfg.maxEnergy, a.energy + eaten * PLANT_NUTRITION);
    a.targetX = -1;
  } else if (hungry) {
    if (a.retarget <= 0 || a.targetX < 0 || plants.biomass[terrain.index(a.targetX, a.targetY)] <= 0.05) {
      findPlant(world, a);
      a.retarget = 20 + world.rng.int(0, 10);
    }
    if (a.targetX >= 0) {
      a.state = 'food';
      moved = moveToward(world, a, a.targetX + 0.5, a.targetY + 0.5, 1);
    } else {
      a.state = 'wander';
      moved = wander(world, a, 0.8);
    }
  } else {
    a.state = 'wander';
    moved = wander(world, a, 0.5);
  }

  a.retarget--;
  a.energy -= metabolism(a, moved);
}

/** Procura, dentro da visão, a célula com mais comida (pesada pela distância). */
function findPlant(world: World, a: Animal): void {
  const { terrain, plants } = world;
  const r = Math.ceil(a.traits.vision);
  const r2 = a.traits.vision * a.traits.vision;
  const cx = a.cellX;
  const cy = a.cellY;
  let bestScore = 0;
  a.targetX = -1;
  a.targetY = -1;
  // Varre em passo 2 para economizar; a precisão é suficiente para mirar.
  for (let dy = -r; dy <= r; dy += 2) {
    for (let dx = -r; dx <= r; dx += 2) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (!terrain.inBounds(x, y)) continue;
      const b = plants.biomass[terrain.index(x, y)];
      if (b <= 0.1) continue;
      const score = b / (1 + Math.sqrt(d2) * 0.25);
      if (score > bestScore) {
        bestScore = score;
        a.targetX = x;
        a.targetY = y;
      }
    }
  }
}

/** Anda em direção a um ponto; devolve a distância percorrida. */
export function moveToward(world: World, a: Animal, tx: number, ty: number, effort: number): number {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) return 0;
  a.heading = Math.atan2(dy, dx);
  return step(world, a, Math.min(dist, a.traits.speed * effort));
}

/** Passeio aleatório suave. */
export function wander(world: World, a: Animal, effort: number): number {
  a.heading += world.rng.range(-0.35, 0.35);
  return step(world, a, a.traits.speed * effort);
}

/**
 * Dá um passo na direção atual. Se o caminho estiver bloqueado (água ou
 * borda), tenta desviar para os lados antes de desistir.
 */
function step(world: World, a: Animal, distance: number): number {
  const { terrain } = world;
  const turns = [0, 0.6, -0.6, 1.2, -1.2, 2.2, -2.2];
  for (const t of turns) {
    const h = a.heading + t;
    const nx = a.x + Math.cos(h) * distance;
    const ny = a.y + Math.sin(h) * distance;
    if (terrain.walkable(Math.floor(nx), Math.floor(ny))) {
      a.x = nx;
      a.y = ny;
      if (t !== 0) a.heading = h;
      return distance;
    }
  }
  a.heading += Math.PI;
  return 0;
}
