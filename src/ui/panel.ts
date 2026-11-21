import type { Animal } from '../sim/animal';
import { GENES, GENE_LABELS, type Gene } from '../sim/genes';
import type { Species } from '../sim/species';
import type { WorldSettings } from '../sim/world';
import { LineChart, timeLabel } from './chart';
import type { History } from './history';

/** O que o painel precisa saber/controlar da aplicação. */
export interface AppControls {
  readonly settings: WorldSettings;
  readonly seed: number;
  paused: boolean;
  speed: number;
  focusGene: Gene;
  colorAnimals: boolean;
  selected: Animal | null;
  newWorld(seed?: number): void;
  addAnimals(species: Species, n: number): void;
  readonly tick: number;
  readonly history: History;
  stats(): PanelStats;
}

export interface PanelStats {
  rabbits: number;
  foxes: number;
  plantCover: number;
  rabbitGeneration: number;
  foxGeneration: number;
  migrations: number;
  eaten: number;
}

const SPEEDS = [1, 2, 5, 10, 25];

const COLORS = {
  rabbit: 'var(--rabbit)',
  fox: 'var(--fox)',
  plants: 'var(--accent)',
};

/** Converte o valor bruto de um gene numa unidade legível. */
export function formatGene(gene: Gene, value: number): string {
  switch (gene) {
    case 'speed':
      return `${(value * 30).toFixed(2)} cél/s`;
    case 'vision':
      return `${value.toFixed(1)} cél`;
    case 'size':
      return `${value.toFixed(2)}×`;
  }
}

export class Panel {
  private readonly el: HTMLElement;
  private readonly popChart: LineChart;
  private readonly geneChart: LineChart;
  private readonly cssColors: Record<keyof typeof COLORS, string>;

  constructor(
    root: HTMLElement,
    private readonly app: AppControls,
  ) {
    this.el = root;
    root.innerHTML = template(app);
    const css = getComputedStyle(document.documentElement);
    this.cssColors = {
      rabbit: css.getPropertyValue('--rabbit').trim(),
      fox: css.getPropertyValue('--fox').trim(),
      plants: css.getPropertyValue('--accent').trim(),
    };
    this.popChart = new LineChart(this.$('#chart-pop') as HTMLCanvasElement);
    this.geneChart = new LineChart(this.$('#chart-gene') as HTMLCanvasElement);
    this.bind();
  }

  private $(sel: string): HTMLElement {
    return this.el.querySelector(sel)!;
  }

  private bind(): void {
    const app = this.app;
    const pause = this.$('#btn-pause') as HTMLButtonElement;
    pause.addEventListener('click', () => {
      app.paused = !app.paused;
      this.syncPause();
    });

    this.el.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.speed = Number(btn.dataset.speed);
        this.syncSpeed();
      });
    });

    this.$('#btn-new').addEventListener('click', () => {
      app.newWorld();
      this.syncSeed();
    });
    this.$('#seed-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const value = Number((this.$('#seed') as HTMLInputElement).value);
      if (Number.isFinite(value)) app.newWorld(Math.abs(Math.floor(value)) >>> 0);
      this.syncSeed();
    });

    const gene = this.$('#focus-gene') as HTMLSelectElement;
    gene.addEventListener('change', () => {
      app.focusGene = gene.value as Gene;
      this.drawCharts();
    });
    const colorize = this.$('#colorize') as HTMLInputElement;
    colorize.addEventListener('change', () => (app.colorAnimals = colorize.checked));

    this.bindRange('#p-growth', (v) => (app.settings.plants.growthRate = v));
    this.bindRange('#p-rate', (v) => (app.settings.mutation.rate = v));
    this.bindRange('#p-strength', (v) => (app.settings.mutation.strength = v));
    const migration = this.$('#p-migration') as HTMLInputElement;
    migration.addEventListener('change', () => (app.settings.migration = migration.checked));

    this.$('#add-rabbits').addEventListener('click', () => app.addAnimals('rabbit', 10));
    this.$('#add-foxes').addEventListener('click', () => app.addAnimals('fox', 3));

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        app.paused = !app.paused;
        this.syncPause();
      }
    });

    this.syncPause();
    this.syncSpeed();
  }

  private bindRange(sel: string, apply: (v: number) => void): void {
    const input = this.$(sel) as HTMLInputElement;
    const out = this.el.querySelector<HTMLOutputElement>(`output[for="${input.id}"]`);
    const update = () => {
      const v = Number(input.value);
      apply(v);
      if (out) out.value = input.dataset.percent ? `${Math.round(v * 100)}%` : v.toFixed(3);
    };
    input.addEventListener('input', update);
    update();
  }

  private syncPause(): void {
    const btn = this.$('#btn-pause');
    btn.textContent = this.app.paused ? '▶ Continuar' : '⏸ Pausar';
    btn.setAttribute('aria-pressed', String(this.app.paused));
  }

  private syncSpeed(): void {
    this.el.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === this.app.speed));
    });
  }

  syncSeed(): void {
    (this.$('#seed') as HTMLInputElement).value = String(this.app.seed);
  }

  /** Atualiza números e o inspetor (barato; chamado com frequência). */
  updateStats(): void {
    const s = this.app.stats();
    this.$('#s-rabbits').textContent = String(s.rabbits);
    this.$('#s-foxes').textContent = String(s.foxes);
    this.$('#s-plants').textContent = `${Math.round(s.plantCover * 100)}%`;
    this.$('#s-time').textContent = timeLabel(this.app.tick);
    this.$('#s-gen').textContent = `${s.rabbitGeneration} / ${s.foxGeneration}`;
    this.$('#s-eaten').textContent = String(s.eaten);
    this.updateInspector();
  }

  private updateInspector(): void {
    const a = this.app.selected;
    const box = this.$('#inspector');
    if (!a) {
      box.innerHTML = '<p class="hint">Clique num animal no mapa para ver os genes dele.</p>';
      return;
    }
    const name = a.species === 'rabbit' ? 'Coelho' : 'Raposa';
    const status = a.alive ? stateLabel(a) : '<span class="dead">morreu</span>';
    box.innerHTML = `
      <div class="insp-head"><strong>${name} #${a.id}</strong><span>${status}</span></div>
      <dl class="insp-grid">
        ${GENES.map((g) => `<dt>${GENE_LABELS[g]}</dt><dd>${formatGene(g, a.traits[g])}</dd>`).join('')}
        <dt>Energia</dt><dd>${Math.max(0, a.energy).toFixed(0)}</dd>
        <dt>Idade</dt><dd>${timeLabel(a.age)}</dd>
        <dt>Geração</dt><dd>${a.generation}</dd>
        <dt>Filhotes</dt><dd>${a.children}</dd>
      </dl>`;
  }

  /** Redesenha os gráficos (mais caro; chamado algumas vezes por segundo). */
  drawCharts(): void {
    const samples = this.app.history.samples;
    const x = samples.map((s) => s.tick);
    const c = this.cssColors;
    this.popChart.draw({
      x,
      series: [
        { label: 'Coelhos', color: c.rabbit, values: samples.map((s) => s.rabbits) },
        { label: 'Raposas', color: c.fox, values: samples.map((s) => s.foxes) },
        {
          label: 'Vegetação',
          color: c.plants,
          values: samples.map((s) => s.plants),
          rightAxis: true,
          dashed: true,
        },
      ],
      rightMax: 1,
      formatRightY: (v) => `${Math.round(v * 100)}%`,
    });

    const g = this.app.focusGene;
    const scale = g === 'speed' ? 30 : 1;
    this.geneChart.draw({
      x,
      series: [
        { label: 'Coelhos', color: c.rabbit, values: samples.map((s) => (s.rabbitTraits ? s.rabbitTraits[g] * scale : null)) },
        { label: 'Raposas', color: c.fox, values: samples.map((s) => (s.foxTraits ? s.foxTraits[g] * scale : null)) },
      ],
    });
    this.$('#gene-unit').textContent = g === 'speed' ? 'células/s' : g === 'vision' ? 'células' : '× tamanho base';
  }
}

function stateLabel(a: Animal): string {
  switch (a.state) {
    case 'food':
      return 'procurando comida';
    case 'flee':
      return 'fugindo!';
    case 'hunt':
      return 'caçando';
    default:
      return a.rest > 0 ? 'descansando' : 'passeando';
  }
}

function template(app: AppControls): string {
  const { settings } = app;
  return `
  <section class="card">
    <div class="row">
      <button id="btn-pause" class="btn primary"></button>
      <button id="btn-new" class="btn">Novo mundo</button>
    </div>
    <div class="row speeds" role="group" aria-label="Velocidade da simulação">
      ${SPEEDS.map((s) => `<button class="seg" data-speed="${s}">${s}×</button>`).join('')}
    </div>
    <form id="seed-form" class="row seed">
      <label for="seed">Semente</label>
      <input id="seed" type="number" min="0" value="${app.seed}" />
      <button class="btn small" type="submit">Gerar</button>
    </form>
  </section>

  <section class="card stats">
    <div class="stat"><span class="dot rabbit"></span><span class="label">Coelhos</span><strong id="s-rabbits">0</strong></div>
    <div class="stat"><span class="dot fox"></span><span class="label">Raposas</span><strong id="s-foxes">0</strong></div>
    <div class="stat"><span class="dot plants"></span><span class="label">Vegetação</span><strong id="s-plants">0%</strong></div>
    <div class="stat"><span class="label">Tempo</span><strong id="s-time">0s</strong></div>
    <div class="stat"><span class="label">Geração coelho / raposa</span><strong id="s-gen">1 / 1</strong></div>
    <div class="stat"><span class="label">Coelhos caçados</span><strong id="s-eaten">0</strong></div>
  </section>

  <section class="card">
    <h2>Populações</h2>
    <canvas id="chart-pop" class="chart"></canvas>
    <div class="legend">
      <span><i style="background:${COLORS.rabbit}"></i>Coelhos</span>
      <span><i style="background:${COLORS.fox}"></i>Raposas</span>
      <span><i class="dashed" style="border-color:${COLORS.plants}"></i>Vegetação (eixo direito)</span>
    </div>
  </section>

  <section class="card">
    <div class="row between">
      <h2>Evolução do gene</h2>
      <select id="focus-gene" aria-label="Gene em foco">
        ${GENES.map((g) => `<option value="${g}" ${g === app.focusGene ? 'selected' : ''}>${GENE_LABELS[g]}</option>`).join('')}
      </select>
    </div>
    <canvas id="chart-gene" class="chart"></canvas>
    <div class="legend">
      <span><i style="background:${COLORS.rabbit}"></i>Média dos coelhos</span>
      <span><i style="background:${COLORS.fox}"></i>Média das raposas</span>
      <span class="unit" id="gene-unit"></span>
    </div>
    <label class="check"><input id="colorize" type="checkbox" ${app.colorAnimals ? 'checked' : ''} /> Colorir animais por esse gene</label>
  </section>

  <section class="card">
    <h2>Inspetor</h2>
    <div id="inspector"></div>
  </section>

  <details class="card">
    <summary><h2>Parâmetros</h2></summary>
    <div class="param">
      <label for="p-growth">Crescimento das plantas</label>
      <input id="p-growth" type="range" min="0.001" max="0.012" step="0.0005" value="${settings.plants.growthRate}" />
      <output for="p-growth"></output>
    </div>
    <div class="param">
      <label for="p-rate">Chance de mutação por gene</label>
      <input id="p-rate" type="range" min="0" max="1" step="0.05" value="${settings.mutation.rate}" data-percent="1" />
      <output for="p-rate"></output>
    </div>
    <div class="param">
      <label for="p-strength">Intensidade da mutação</label>
      <input id="p-strength" type="range" min="0" max="0.3" step="0.01" value="${settings.mutation.strength}" data-percent="1" />
      <output for="p-strength"></output>
    </div>
    <label class="check"><input id="p-migration" type="checkbox" ${settings.migration ? 'checked' : ''} /> Migração quando uma espécie some</label>
    <div class="row">
      <button id="add-rabbits" class="btn small">+10 coelhos</button>
      <button id="add-foxes" class="btn small">+3 raposas</button>
    </div>
  </details>`;
}
