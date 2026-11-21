import type { Animal } from './animal';
import { ROOTS } from './plants';
import { PREDATORS, PREY, SPECIES, canHunt, type Predator } from './species';
import type { World } from './world';

/** Quanto de energia um herbívoro tira de 1.0 de biomassa. */
const PLANT_NUTRITION = 15;
/** Energia de uma presa adulta de tamanho 1 (filhotes rendem 40%). */
const MEAT: Record<string, number> = { rabbit: 85, deer: 250 };
/** Distância (em células) de onde o predador consegue dar o bote. */
const POUNCE_DISTANCE = 1.4;
/** Ticks de descanso depois de um bote que falhou. */
const POUNCE_REST = 18;
/** Multiplicador de velocidade em fuga ou perseguição (custa mais energia). */
const FLEE_EFFORT = 1.25;
/** Predadores espreitam devagar e só disparam quando estão perto da presa. */
const STALK_EFFORT = 0.75;
const SPRINT_EFFORT = 1.6;
const SPRINT_DISTANCE = 4;
/** Água recuperada por tick bebendo na margem. */
const DRINK_RATE = 0.06;
/** Distância em que o casal consegue acasalar. */
const MATE_DISTANCE = 1.2;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Animais maiores armazenam mais energia. */
export function maxEnergy(a: Animal): number {
  return SPECIES[a.species].maxEnergy * a.traits.size;
}

/** Como cada predador caça. */
interface Hunting {
  /** Chance base do bote (ajustada por tamanho, velocidade e bando). */
  chance: number;
  /** Ticks digerindo depois de comer: um predador saciado não caça. */
  digest: number;
  /** Energia por tick de comida miúda quando não há presa à vista. */
  forage: number;
  /** Caça em bando e divide a presa. */
  pack: boolean;
}

const HUNTING: Record<Predator, Hunting> = {
  fox: { chance: 0.2, digest: 90, forage: 0.1, pack: false },
  wolf: { chance: 0.14, digest: 600, forage: 0.02, pack: true },
};

/** Distância em que outros lobos ajudam no bote e dividem a presa. */
const PACK_RADIUS = 6;
/** Quanto cada lobo a mais aumenta a chance do bote. */
const PACK_BONUS = 0.7;
/** Lobos fora da caça procuram ficar a essa distância do bando. */
const PACK_SPACING = 5;

export function updatePredator(world: World, a: Animal): void {
  const species = a.species as Predator;
  const cfg = SPECIES[species];
  const hunting = HUNTING[species];
  let moved = 0;
  const cap = maxEnergy(a);
  const hungry = a.energy < cap * cfg.hungerThreshold;

  let courting = -1;
  let drinking = -1;
  const resting = a.rest > 0;
  if ((drinking = seekWater(world, a)) >= 0) {
    // A sede interrompe até a digestão.
    moved = drinking;
    if (a.rest > 0) a.rest--;
  } else if (resting) {
    // Recuperando o fôlego depois de um bote, ou digerindo.
    a.rest--;
  } else if ((courting = courtship(world, a)) >= 0) {
    moved = courting;
  } else if (hungry) {
    const prey = nearestPrey(world, a);
    if (prey) {
      a.state = 'hunt';
      const dist = Math.hypot(prey.x - a.x, prey.y - a.y);
      if (dist <= POUNCE_DISTANCE) pounce(world, a, prey, hunting);
      else {
        // Espreita devagar até ser visto ou chegar perto; aí dispara.
        const sprint = dist <= SPRINT_DISTANCE || prey.state === 'flee';
        moved = moveToward(world, a, prey.x, prey.y, sprint ? SPRINT_EFFORT : STALK_EFFORT);
      }
    } else {
      // Sem presa à vista: fuça atrás de roedores, insetos e frutos (rende pouco)
      // e, se for um lobo, procura o bando.
      a.state = 'forage';
      moved = followPack(world, a, hunting) ?? wander(world, a, 0.5);
      a.energy = Math.min(cap, a.energy + hunting.forage);
    }
  } else {
    a.state = 'wander';
    // Saciado, o predador fica quase parado poupando energia, perto do bando.
    moved = followPack(world, a, hunting) ?? wander(world, a, 0.15);
  }

  a.energy -= metabolism(a, moved, world.climate.cold, resting);
}

/**
 * O bote pode falhar: predadores maiores e mais rápidos que a presa acertam
 * mais, e cada lobo do bando por perto aumenta a chance. A carne é dividida
 * entre todos que participaram.
 */
function pounce(world: World, a: Animal, prey: Animal, hunting: Hunting): void {
  const bigger = clamp(a.traits.size / prey.traits.size, 0.5, 1.6);
  const faster = clamp(a.traits.speed / prey.traits.speed, 0.6, 1.6);
  const helpers = hunting.pack
    ? world.index[a.species].within(prey.x, prey.y, PACK_RADIUS).filter((w) => w !== a && w.rest === 0)
    : [];
  const chance = Math.min(0.95, hunting.chance * bigger * faster * (1 + PACK_BONUS * helpers.length));
  a.rest = POUNCE_REST;
  if (!world.rng.chance(chance)) return;

  world.kill(prey, 'eaten');
  const eaters = [a, ...helpers];
  const share = meatOf(prey) / eaters.length;
  for (const e of eaters) {
    e.energy = Math.min(maxEnergy(e), e.energy + share);
    // Refeição grande, digestão longa.
    e.rest = Math.round(hunting.digest * Math.min(1, (2 * share) / maxEnergy(e)));
    e.state = 'hunt';
  }
}

/** Energia que a presa rende: cervos adultos alimentam um bando inteiro. */
function meatOf(prey: Animal): number {
  const young = prey.age < SPECIES[prey.species].maturityAge;
  return MEAT[prey.species] * prey.traits.size * (young ? 0.4 : 1);
}

/** Lobos se mantêm perto do bando. Devolve a distância andada, ou null se já está junto. */
function followPack(world: World, a: Animal, hunting: Hunting): number | null {
  if (!hunting.pack) return null;
  const mate = world.index[a.species].nearest(a.x, a.y, a.traits.vision * 2, (w) => w !== a);
  if (!mate || Math.hypot(mate.x - a.x, mate.y - a.y) < PACK_SPACING) return null;
  return moveToward(world, a, mate.x, mate.y, 0.6);
}

/** Arbusto acima disso é uma moita fechada, onde uma presa pequena some de vista. */
const COVER = 0.6;

/** Verdadeiro se o animal está escondido numa moita densa. */
export function inCover(world: World, a: Animal): boolean {
  return world.plants.shrubs[world.terrain.index(a.cellX, a.cellY)] > COVER;
}

/** Presas pequenas (coelhos e filhotes) se escondem em moitas; cervos adultos não cabem. */
function hidden(world: World, a: Animal): boolean {
  const small = a.species === 'rabbit' || a.age < SPECIES[a.species].maturityAge;
  return small && inCover(world, a);
}

/**
 * A presa visível mais próxima, entre as espécies que o predador caça.
 * Como o predador vai atrás do que encontra primeiro, ele caça mais a presa
 * mais abundante e alivia a que está ficando rara (troca de presa).
 */
function nearestPrey(world: World, hunter: Animal): Animal | null {
  const predator = hunter.species as Predator;
  const r = hunter.traits.vision;
  let best: Animal | null = null;
  let bestDist = Infinity;
  for (const species of PREY[predator]) {
    const p = world.index[species].nearest(hunter.x, hunter.y, r, (a) => canHunt(predator, a) && !hidden(world, a));
    if (!p) continue;
    const d = (p.x - hunter.x) ** 2 + (p.y - hunter.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/** Gasto de energia do tick, que depende do corpo e de quanto se moveu. */
export function metabolism(a: Animal, moved: number, cold = 1, resting = false): number {
  const cfg = SPECIES[a.species];
  const { size, vision } = a.traits;
  // No frio, manter o corpo aquecido custa mais.
  // Descansando (dormindo, digerindo) o corpo gasta menos.
  const body = cfg.baseMetabolism * size ** 0.75 * cold * (resting ? 0.6 : 1);
  const senses = vision * 0.0025;
  const motion = cfg.moveCost * moved * moved * size;
  return body + senses + motion;
}

/**
 * Como cada herbívoro pasta. Coelhos roem o capim até a raiz; cervos dão
 * mordidas grandes, mas só onde o capim está alto. Assim, muitos coelhos
 * deixam os cervos sem comida, e cervos abrem espaço para os coelhos.
 */
interface Grazing {
  bite: number;
  /** Abaixo dessa biomassa o capim não vale a pena. */
  minBiomass: number;
  /** Quanto capim fica na célula depois de comido. */
  floor: number;
  /** Se alcança as folhas dos arbustos. */
  browses: boolean;
}

const GRAZING: Record<'rabbit' | 'deer', Grazing> = {
  rabbit: { bite: 0.06, minBiomass: 0.05, floor: ROOTS, browses: false },
  deer: { bite: 0.14, minBiomass: 0.35, floor: 0.2, browses: true },
};

/** Quanta comida útil a célula tem para esse herbívoro. */
function foodAt(world: World, graze: Grazing, i: number): number {
  const grass = world.plants.biomass[i];
  const usable = grass > graze.minBiomass ? grass : 0;
  return graze.browses ? Math.max(usable, world.plants.shrubs[i]) : usable;
}

/** Come o que houver na célula (arbustos primeiro, se alcançar) e devolve a biomassa comida. */
function eatAt(world: World, graze: Grazing, i: number, amount: number): number {
  const { plants } = world;
  let eaten = graze.browses ? plants.browse(i, amount) : 0;
  if (eaten < amount && plants.biomass[i] > graze.minBiomass) eaten += plants.eat(i, amount - eaten, graze.floor);
  return eaten;
}

/** O predador mais próximo, à vista, que consegue caçar esse animal. */
function nearestThreat(world: World, a: Animal): Animal | null {
  const range = a.traits.vision * 0.6;
  let best: Animal | null = null;
  let bestDist = Infinity;
  for (const predator of PREDATORS) {
    if (!canHunt(predator, a)) continue;
    const p = world.index[predator].nearest(a.x, a.y, range);
    if (!p) continue;
    const d = (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

export function updateHerbivore(world: World, a: Animal): void {
  const species = a.species as 'rabbit' | 'deer';
  const cfg = SPECIES[species];
  const graze = GRAZING[species];
  const { terrain } = world;
  let moved = 0;

  const cap = maxEnergy(a);
  const hungry = a.energy < cap * cfg.hungerThreshold;
  const here = terrain.index(a.cellX, a.cellY);

  // Perigo vem antes de tudo: um predador à vista faz a presa correr.
  // Cervos adultos ignoram raposas, mas fogem de lobos.
  let courting = -1;
  let drinking = -1;
  const threat = nearestThreat(world, a);
  if (threat) {
    a.state = 'flee';
    a.targetX = -1;
    a.heading = Math.atan2(a.y - threat.y, a.x - threat.x) + world.rng.range(-0.3, 0.3);
    moved = step(world, a, a.traits.speed * FLEE_EFFORT);
  } else if ((drinking = seekWater(world, a)) >= 0) {
    moved = drinking;
  } else if ((courting = courtship(world, a)) >= 0) {
    moved = courting;
  } else if (hungry && foodAt(world, graze, here) > 0.05) {
    // Parado comendo.
    a.state = 'food';
    const eaten = eatAt(world, graze, here, graze.bite * a.traits.size);
    a.energy = Math.min(cap, a.energy + eaten * PLANT_NUTRITION);
    a.targetX = -1;
  } else if (hungry) {
    const target = a.targetX >= 0 ? foodAt(world, graze, terrain.index(a.targetX, a.targetY)) : 0;
    if (a.retarget <= 0 || target <= 0.05) {
      findPlant(world, a, graze);
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
  a.energy -= metabolism(a, moved, world.climate.cold);
}

/**
 * Sede: com pouca água, o animal vai até a margem mais próxima e bebe
 * até se saciar. Devolve a distância percorrida, ou -1 se não está com sede.
 */
function seekWater(world: World, a: Animal): number {
  if (!world.settings.thirst) return -1;
  const cfg = SPECIES[a.species];
  const already = a.state === 'drink' && a.hydration < 0.98;
  if (!already && a.hydration >= cfg.thirstThreshold) return -1;
  const { terrain } = world;
  const here = terrain.index(a.cellX, a.cellY);
  const target = terrain.nearestShore[here];
  if (target < 0) return -1;
  a.state = 'drink';
  if (target === here) {
    a.hydration = Math.min(1, a.hydration + DRINK_RATE);
    return 0;
  }
  const tx = target % terrain.cols;
  const ty = (target - tx) / terrain.cols;
  return moveToward(world, a, tx + 0.5, ty + 0.5, 1);
}

/** Adulto, descansado e com energia para gastar com filhotes. */
export function readyToBreed(a: Animal): boolean {
  const cfg = SPECIES[a.species];
  // Machos gastam pouco com a ninhada, então precisam de menos reserva.
  let need = cfg.reproduceAt * a.traits.size * (a.sex === 'female' ? 1 : 0.6);
  // Quem já está a caminho do parceiro não desiste por gastar um pouco no trajeto.
  if (a.partner) need *= 0.7;
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
    // Território lotado (predadores) ou área superlotada (cervos): a fêmea não cria filhotes.
    const territory = SPECIES[a.species].territory;
    if (territory && world.index[a.species].within(a.x, a.y, territory.radius).length > territory.max) return -1;
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
function findPlant(world: World, a: Animal, graze: Grazing): void {
  const { terrain } = world;
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
      const b = foodAt(world, graze, terrain.index(x, y));
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
