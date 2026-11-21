import './style.css';
import { INITIAL_POPULATION, WORLD_SIZE } from './config';
import { Renderer } from './render/renderer';
import type { Animal } from './sim/animal';
import type { Gene } from './sim/genes';
import { randomSeed } from './sim/random';
import { SPECIES_LIST, type Species } from './sim/species';
import { Tile } from './sim/terrain';
import { World, defaultSettings, type WorldSettings } from './sim/world';
import { History } from './ui/history';
import { Panel, type AppControls, type PanelStats } from './ui/panel';

const { cols: COLS, rows: ROWS } = WORLD_SIZE;
const CELL = 6;
const TICKS_PER_SECOND = 30;
/** Tempo máximo de simulação por quadro, para a tela nunca travar. */
const FRAME_BUDGET_MS = 28;

class App implements AppControls {
  readonly settings: WorldSettings = defaultSettings();
  world!: World;
  renderer!: Renderer;
  history!: History;
  seed = 0;
  paused = false;
  speed = 1;
  focusGene: Gene = 'speed';
  colorAnimals = true;
  selected: Animal | null = null;
  private grassCells = 0;
  private panel?: Panel;

  constructor(private readonly canvas: HTMLCanvasElement, panelRoot: HTMLElement) {
    this.newWorld(seedFromUrl());
    this.panel = new Panel(panelRoot, this);
    this.refreshPanel();
    canvas.addEventListener('click', (e) => this.select(e));
  }

  get tick(): number {
    return this.world.tick;
  }

  get climate() {
    return this.world.climate;
  }

  newWorld(seed: number = randomSeed()): void {
    this.seed = seed;
    this.world = new World({ cols: COLS, rows: ROWS, seed, ...INITIAL_POPULATION }, this.settings);
    this.renderer = new Renderer(this.canvas, this.world, CELL);
    this.history = new History();
    this.selected = null;
    this.grassCells = this.world.terrain.tiles.reduce((n, t) => n + (t === Tile.Grass ? 1 : 0), 0);
    this.history.record(this.world, this.grassCells);
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
    this.refreshPanel();
  }

  private refreshPanel(): void {
    this.panel?.updateStats();
    this.panel?.drawCharts();
  }

  addAnimals(species: Species, n: number): void {
    for (let i = 0; i < n; i++) this.world.spawnRandom(species);
  }

  stats(): PanelStats {
    const w = this.world;
    const counts = {} as Record<Species, number>;
    const generations = {} as Record<Species, number>;
    for (const species of SPECIES_LIST) {
      const s = w.stats(species);
      counts[species] = s.count;
      generations[species] = s.maxGeneration;
    }
    return {
      counts,
      generations,
      plantCover: this.grassCells > 0 ? w.plants.total() / this.grassCells : 0,
      migrations: w.migrations,
      eaten: w.deaths.rabbit.eaten + w.deaths.deer.eaten,
      thirst: SPECIES_LIST.reduce((n, sp) => n + w.deaths[sp].thirst, 0),
    };
  }

  /** Seleciona o animal mais próximo do clique. */
  private select(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * COLS;
    const y = ((e.clientY - rect.top) / rect.height) * ROWS;
    let best: Animal | null = null;
    let bestDist = 3 * 3;
    for (const a of this.world.animals) {
      if (!a.alive) continue;
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    this.selected = best;
    this.panel?.updateStats();
  }

  // Passo fixo: a simulação avança no mesmo ritmo em qualquer monitor.
  private accumulator = 0;
  private last = performance.now();
  private frameCount = 0;

  frame = (now: number): void => {
    const stepMs = 1000 / (TICKS_PER_SECOND * this.speed);
    if (!this.paused) {
      this.accumulator += Math.min(now - this.last, 250);
      const start = performance.now();
      while (this.accumulator >= stepMs) {
        this.world.step();
        this.history.record(this.world, this.grassCells);
        this.accumulator -= stepMs;
        if (performance.now() - start > FRAME_BUDGET_MS) {
          this.accumulator = 0;
          break;
        }
      }
    }
    this.last = now;

    this.renderer.colorBy = this.colorAnimals ? this.focusGene : null;
    this.renderer.selected = this.selected;
    this.renderer.draw();

    this.frameCount++;
    if (this.frameCount % 6 === 0) this.panel?.updateStats();
    if (this.frameCount % 20 === 0) this.panel?.drawCharts();
    requestAnimationFrame(this.frame);
  };
}

function seedFromUrl(): number | undefined {
  const raw = new URLSearchParams(location.search).get('seed');
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.abs(Math.floor(n)) >>> 0 : undefined;
}

const app = new App(document.querySelector<HTMLCanvasElement>('#world')!, document.querySelector<HTMLElement>('#panel')!);
requestAnimationFrame(app.frame);

// Em desenvolvimento, expõe a aplicação no console para depurar (`app.world`).
if (import.meta.env.DEV) Object.assign(window, { app });
