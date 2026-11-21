import type { Animal } from './animal';
import { SPECIES } from './species';
import type { World } from './world';

/** Quanto de energia um coelho tira de 1.0 de biomassa. */
const PLANT_NUTRITION = 15;
/** Biomassa que um coelho consegue comer por tick. */
const BITE = 0.06;
/** Energia que uma raposa ganha ao comer um coelho de tamanho 1. */
const RABBIT_MEAT = 55;
/** Distância (em células) de onde a raposa consegue dar o bote. */
const POUNCE_DISTANCE = 1.4;
/** Chance base de o bote dar certo (ajustada por tamanho e velocidade). */
const POUNCE_CHANCE = 0.3;
/** Ticks que a raposa precisa descansar depois de um bote. */
const POUNCE_REST = 18;
/** Multiplicador de velocidade em fuga ou perseguição (custa mais energia). */
const FLEE_EFFORT = 1.25;
const CHASE_EFFORT = 1.25;
/** Distância em que o casal consegue acasalar. */
const MATE_DISTANCE = 1.2;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Animais maiores armazenam mais energia. */
export function maxEnergy(a: Animal): number {
  return SPECIES[a.species].maxEnergy * a.traits.size;
}

export function updateFox(world: World, a: Animal): void {
  const cfg = SPECIES.fox;
  let moved = 0;
  const cap = maxEnergy(a);
  const hungry = a.energy < cap * cfg.hungerThreshold;

  let courting = -1;
  if (a.rest > 0) {
    // Recuperando o fôlego depois de um bote.
    a.rest--;
  } else if ((courting = courtship(world, a)) >= 0) {
    moved = courting;
  } else if (hungry) {
    const prey = world.index.rabbit.nearest(a.x, a.y, a.traits.vision);
    if (prey) {
      a.state = 'hunt';
      const dist = Math.hypot(prey.x - a.x, prey.y - a.y);
      if (dist <= POUNCE_DISTANCE) {
        // O bote pode falhar: raposas maiores e mais rápidas que a presa acertam mais.
        const bigger = clamp(a.traits.size / prey.traits.size, 0.5, 1.6);
        const faster = clamp(a.traits.speed / prey.traits.speed, 0.6, 1.6);
        a.rest = POUNCE_REST;
        if (world.rng.chance(POUNCE_CHANCE * bigger * faster)) {
          world.kill(prey, 'eaten');
          a.energy = Math.min(cap, a.energy + RABBIT_MEAT * prey.traits.size);
        }
      } else {
        moved = moveToward(world, a, prey.x, prey.y, CHASE_EFFORT);
      }
    } else {
      a.state = 'wander';
      moved = wander(world, a, 0.9);
    }
  } else {
    a.state = 'wander';
    moved = wander(world, a, 0.4);
  }

  a.energy -= metabolism(a, moved);
}

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

  const cap = maxEnergy(a);
  const hungry = a.energy < cap * cfg.hungerThreshold;
  const here = terrain.index(a.cellX, a.cellY);

  // Perigo vem antes da fome: uma raposa à vista faz o coelho correr.
  let courting = -1;
  const threat = world.index.fox.nearest(a.x, a.y, a.traits.vision * 0.6);
  if (threat) {
    a.state = 'flee';
    a.targetX = -1;
    a.heading = Math.atan2(a.y - threat.y, a.x - threat.x) + world.rng.range(-0.3, 0.3);
    moved = step(world, a, a.traits.speed * FLEE_EFFORT);
  } else if ((courting = courtship(world, a)) >= 0) {
    moved = courting;
  } else if (hungry && plants.biomass[here] > 0.05) {
    // Parado comendo.
    a.state = 'food';
    const eaten = plants.eat(here, BITE * a.traits.size);
    a.energy = Math.min(cap, a.energy + eaten * PLANT_NUTRITION);
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

/** Adulto, descansado e com energia para gastar com filhotes. */
export function readyToBreed(a: Animal): boolean {
  const cfg = SPECIES[a.species];
  // Machos gastam pouco com a ninhada, então precisam de menos reserva.
  let need = cfg.reproduceAt * a.traits.size * (a.sex === 'female' ? 1 : 0.6);
  // Quem já está a caminho do parceiro não desiste por gastar um pouco no trajeto.
  if (a.partner) need *= 0.85;
  return a.alive && a.age >= cfg.maturityAge && a.cooldown <= 0 && a.energy >= need;
}

/** Desfaz o casal (dos dois lados). */
export function releasePartner(a: Animal): void {
  if (a.partner && a.partner.partner === a) a.partner.partner = null;
  a.partner = null;
}

/**
 * Corte e acasalamento. A fêmea pronta procura machos por perto e escolhe
 * o de maior tamanho e mais bem alimentado (seleção sexual); os dois
 * caminham um em direção ao outro e, quando se encontram, nasce a ninhada.
 * Devolve a distância percorrida, ou -1 se o animal não está cortejando.
 */
function courtship(world: World, a: Animal): number {
  if (!readyToBreed(a)) {
    releasePartner(a);
    return -1;
  }
  let p = a.partner;
  if (p) {
    const far = Math.hypot(p.x - a.x, p.y - a.y) > a.traits.vision * SPECIES[a.species].mateRange * 1.5;
    if (p.partner !== a || !readyToBreed(p) || far) {
      releasePartner(a);
      p = null;
    }
  }
  if (!p) {
    // Os machos esperam ser escolhidos; só as fêmeas procuram.
    if (a.sex === 'male' || a.mateSearch-- > 0) return -1;
    a.mateSearch = 15;
    p = chooseMate(world, a);
    if (!p) return -1;
    a.partner = p;
    p.partner = a;
  }
  a.state = 'mate';
  const dist = Math.hypot(p.x - a.x, p.y - a.y);
  if (dist <= MATE_DISTANCE) {
    if (a.sex === 'female') world.mate(a, p);
    return 0;
  }
  return moveToward(world, a, p.x, p.y, 1);
}

function chooseMate(world: World, female: Animal): Animal | null {
  const candidates = world.index[female.species].within(female.x, female.y, female.traits.vision * SPECIES[female.species].mateRange);
  let best: Animal | null = null;
  let bestScore = 0;
  for (const m of candidates) {
    if (m.sex !== 'male' || m.partner || !readyToBreed(m)) continue;
    const d = Math.hypot(m.x - female.x, m.y - female.y);
    const condition = m.energy / maxEnergy(m);
    const score = (m.traits.size * condition) / (1 + d * 0.15);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
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
export function step(world: World, a: Animal, distance: number): number {
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
