import type { Animal } from '../sim/animal';
import { SEASON_NAMES, winters, type Climate } from '../sim/climate';
import { GENES, GENE_LABELS, type Gene } from '../sim/genes';
import { SPECIES_LIST, SPECIES_NAMES, type Species } from '../sim/species';
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
  readonly climate: Climate;
  stats(): PanelStats;
}

export interface PanelStats {
  counts: Record<Species, number>;
  /** Geração mais avançada viva de cada espécie. */
  generations: Record<Species, number>;
  plantCover: number;
  migrations: number;
  eaten: number;
  thirst: number;
}

const SPEEDS = [1, 2, 5, 10, 25];

const COLORS = {
  rabbit: 'var(--rabbit)',
  fox: 'var(--fox)',
  deer: 'var(--deer)',
  plants: 'var(--accent)',
};

/** Quantos animais cada botão "+" solta no mapa. */
const ADD_AMOUNT: Record<Species, number> = { rabbit: 10, fox: 3, deer: 4 };

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
      deer: css.getPropertyValue('--deer').trim(),
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
    const seasons = this.$('#p-seasons') as HTMLInputElement;
    seasons.addEventListener('change', () => (app.settings.seasons = seasons.checked));
    const thirst = this.$('#p-thirst') as HTMLInputElement;
    thirst.addEventListener('change', () => (app.settings.thirst = thirst.checked));
    const migration = this.$('#p-migration') as HTMLInputElement;
    migration.addEventListener('change', () => (app.settings.migration = migration.checked));

    for (const species of SPECIES_LIST) {
      this.$(`#add-${species}`).addEventListener('click', () => app.addAnimals(species, ADD_AMOUNT[species]));
    }

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
    for (const species of SPECIES_LIST) this.$(`#s-${species}`).textContent = String(s.counts[species]);
    this.$('#s-plants').textContent = `${Math.round(s.plantCover * 100)}%`;
    this.$('#s-time').textContent = timeLabel(this.app.tick);
    const c = this.app.climate;
    this.$('#s-season').textContent = this.app.settings.seasons ? `${SEASON_NAMES[c.season]} · ano ${c.year}` : 'desligadas';
    this.$('#s-gen').textContent = SPECIES_LIST.map((sp) => s.generations[sp]).join(' / ');
    this.$('#s-eaten').textContent = String(s.eaten);
    this.$('#s-thirst').textContent = String(s.thirst);
    this.updateInspector();
  }

  private updateInspector(): void {
    const a = this.app.selected;
    const box = this.$('#inspector');
    if (!a) {
      box.innerHTML = '<p class="hint">Clique num animal no mapa para ver os genes dele.</p>';
      return;
    }
    const name = SPECIES_NAMES[a.species].one;
    const status = a.alive ? stateLabel(a) : '<span class="dead">morreu</span>';
    box.innerHTML = `
      <div class="insp-head"><strong>${name} #${a.id}</strong><span>${status}</span></div>
      <dl class="insp-grid">
        ${GENES.map((g) => `<dt>${GENE_LABELS[g]}</dt><dd>${formatGene(g, a.traits[g])}</dd>`).join('')}
        <dt>Sexo</dt><dd>${a.sex === 'female' ? 'fêmea' : 'macho'}</dd>
        <dt>Energia</dt><dd>${Math.max(0, a.energy).toFixed(0)}</dd>
        <dt>Água</dt><dd>${Math.round(Math.max(0, a.hydration) * 100)}%</dd>
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
        ...SPECIES_LIST.map((sp) => ({
          label: SPECIES_NAMES[sp].many,
          color: c[sp],
          values: samples.map((s) => s.counts[sp]),
        })),
        {
          label: 'Vegetação',
          color: c.plants,
          values: samples.map((s) => s.plants),
          rightAxis: true,
          dashed: true,
        },
      ],
      rightMax: 1,
      bands: this.app.settings.seasons && x.length > 1 ? winters(x[0], x[x.length - 1]) : undefined,
      formatRightY: (v) => `${Math.round(v * 100)}%`,
    });

    const g = this.app.focusGene;
    const scale = g === 'speed' ? 30 : 1;
    this.geneChart.draw({
      x,
      series: SPECIES_LIST.map((sp) => ({
        label: SPECIES_NAMES[sp].many,
        color: c[sp],
        values: samples.map((s) => {
          const t = s.traits[sp];
          return t ? t[g] * scale : null;
        }),
      })),
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
    case 'forage':
      return 'fuçando atrás de comida miúda';
    case 'drink':
      return 'com sede (indo beber)';
    case 'mate':
      return a.partner ? `cortejando #${a.partner.id}` : 'procurando parceiro';
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
    ${SPECIES_LIST.map(
      (sp) => `<div class="stat"><span class="dot ${sp}"></span><span class="label">${SPECIES_NAMES[sp].many}</span><strong id="s-${sp}">0</strong></div>`,
    ).join('')}
    <div class="stat"><span class="dot plants"></span><span class="label">Vegetação</span><strong id="s-plants">0%</strong></div>
    <div class="stat"><span class="label">Tempo</span><strong id="s-time">0s</strong></div>
    <div class="stat"><span class="label">Estação</span><strong id="s-season">Primavera</strong></div>
    <div class="stat"><span class="label">Geração coelho / raposa / cervo</span><strong id="s-gen">1 / 1 / 1</strong></div>
    <div class="stat"><span class="label">Presas caçadas</span><strong id="s-eaten">0</strong></div>
    <div class="stat"><span class="label">Mortes de sede</span><strong id="s-thirst">0</strong></div>
  </section>

  <section class="card">
    <h2>Populações</h2>
    <canvas id="chart-pop" class="chart"></canvas>
    <div class="legend">
      ${SPECIES_LIST.map((sp) => `<span><i style="background:${COLORS[sp]}"></i>${SPECIES_NAMES[sp].many}</span>`).join('')}
      <span><i class="dashed" style="border-color:${COLORS.plants}"></i>Vegetação (eixo direito)</span>
      <span><i class="band"></i>Inverno</span>
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
      ${SPECIES_LIST.map((sp) => `<span><i style="background:${COLORS[sp]}"></i>${SPECIES_NAMES[sp].many}</span>`).join('')}
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
    <label class="check"><input id="p-seasons" type="checkbox" ${settings.seasons ? 'checked' : ''} /> Estações do ano</label>
    <label class="check"><input id="p-thirst" type="checkbox" ${settings.thirst ? 'checked' : ''} /> Sede (animais bebem nos lagos)</label>
    <label class="check"><input id="p-migration" type="checkbox" ${settings.migration ? 'checked' : ''} /> Migração quando uma espécie some</label>
    <div class="row">
      ${SPECIES_LIST.map(
        (sp) => `<button id="add-${sp}" class="btn small">+${ADD_AMOUNT[sp]} ${SPECIES_NAMES[sp].many.toLowerCase()}</button>`,
      ).join('')}
    </div>
  </details>`;
}
