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

export type AnimalState = 'wander' | 'food' | 'flee' | 'hunt' | 'mate' | 'drink';
export type Sex = 'male' | 'female';

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
  /** Ticks de descanso (ex.: depois de um bote). */
  rest = 0;
  readonly sex: Sex;
  /** Água no corpo, de 0 (morre de sede) a 1. */
  hydration = 1;
  /** Parceiro escolhido para acasalar, enquanto os dois se aproximam. */
  partner: Animal | null = null;
  /** Ticks até a fêmea procurar parceiro de novo. */
  mateSearch = 0;

  constructor(
    readonly species: Species,
    public x: number,
    public y: number,
    readonly traits: Traits,
    public energy: number,
    readonly generation: number,
    rng: Random,
  ) {
    this.sex = rng.chance(0.5) ? 'female' : 'male';
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
