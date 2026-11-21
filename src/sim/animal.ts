import type { Random } from './random';
import type { Species } from './species';

/** Características físicas que definem como o animal age e quanto gasta. */
export interface Traits {
  /** Distância percorrida por tick, em células. */
  speed: number;
  /** Raio de visão, em células. */
  vision: number;
  /** Tamanho relativo: animais maiores gastam mais energia. */
  size: number;
}

export type AnimalState = 'wander' | 'food' | 'flee' | 'hunt';

let nextId = 1;

export class Animal {
  readonly id = nextId++;
  heading: number;
  age = 0;
  cooldown = 0;
  alive = true;
  state: AnimalState = 'wander';
  /** Alvo atual (célula de comida ou presa); -1 se não houver. */
  targetX = -1;
  targetY = -1;
  /** Ticks até reavaliar o alvo. */
  retarget = 0;
  children = 0;

  constructor(
    readonly species: Species,
    public x: number,
    public y: number,
    readonly traits: Traits,
    public energy: number,
    readonly generation: number,
    rng: Random,
  ) {
    this.heading = rng.range(0, Math.PI * 2);
    this.cooldown = rng.int(0, 120);
  }

  get cellX(): number {
    return Math.floor(this.x);
  }

  get cellY(): number {
    return Math.floor(this.y);
  }
}
