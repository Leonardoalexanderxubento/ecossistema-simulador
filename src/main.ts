import './style.css';
import { Renderer } from './render/renderer';
import { randomSeed } from './sim/random';
import { World } from './sim/world';

const COLS = 160;
const ROWS = 100;
const CELL = 6;
const TICKS_PER_SECOND = 30;

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const world = new World({ cols: COLS, rows: ROWS, seed: randomSeed(), rabbits: 120, foxes: 14 });
const renderer = new Renderer(canvas, world, CELL);

// Passo fixo: a simulação avança no mesmo ritmo em qualquer monitor.
let accumulator = 0;
let last = performance.now();
const stepMs = 1000 / TICKS_PER_SECOND;

function frame(now: number): void {
  accumulator += Math.min(now - last, 250);
  last = now;
  while (accumulator >= stepMs) {
    world.step();
    accumulator -= stepMs;
  }
  renderer.draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
