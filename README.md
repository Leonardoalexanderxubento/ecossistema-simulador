# 🌿 Simulador de Ecossistema

**Plantas, coelhos e raposas evoluindo por seleção natural, em tempo real, no navegador.**

Cada animal nasce com genes de **velocidade**, **visão** e **tamanho**, herdados dos pais com pequenas mutações. Ninguém programou qual é o "melhor" animal: quem come, foge e se reproduz melhor deixa mais filhotes, e a população muda sozinha ao longo das gerações.

▶️ **[Abrir o simulador](https://leonardoalexanderxubento.github.io/ecossistema-simulador/)**

![Simulador em execução: mapa com lagos, vegetação, coelhos e raposas, e gráficos de população e evolução da velocidade](docs/screenshot.jpg)

## O que observar

- **Ciclos predador–presa.** Coelhos se multiplicam → raposas têm comida e se multiplicam → coelhos despencam → raposas passam fome → a vegetação volta → tudo recomeça. São as oscilações descritas pelas equações de [Lotka–Volterra](https://pt.wikipedia.org/wiki/Equa%C3%A7%C3%B5es_de_Lotka%E2%80%93Volterra), surgindo só a partir de regras individuais.
- **Corrida armamentista evolutiva.** Com raposas por perto, coelhos mais rápidos sobrevivem; com coelhos mais rápidos, só as raposas mais rápidas comem. No gráfico _Evolução do gene_, as duas curvas sobem juntas.
- **Genes que deixam de compensar.** Sem predadores, enxergar longe só gasta energia, e a visão média dos coelhos encolhe com as gerações.

Dica: use a velocidade **10×** ou **25×**, escolha _Velocidade_ no gráfico de genes e deixe rodar alguns minutos.

## Como funciona

| Elemento | Regras |
| --- | --- |
| **Terreno** | Gerado com ruído de valor fractal: lagos, praias e campos. A umidade define a fertilidade do solo. |
| **Plantas** | Cada célula tem uma biomassa (0–1) que cresce de forma logística e coloniza vizinhas. As raízes rebrotam depois de comidas. |
| **Coelhos** | Procuram a célula com mais comida dentro da visão, pastam e fogem quando avistam uma raposa. |
| **Raposas** | Perseguem o coelho mais próximo quando têm fome e dão um bote que pode falhar, seguido de um descanso. |
| **Energia** | Tudo custa energia: existir (∝ tamanho^0,75), enxergar (∝ visão) e se mover (∝ velocidade² × tamanho). Energia zerada é morte por fome. |
| **Reprodução** | Com energia suficiente e idade adulta, o animal tem uma ninhada. Os filhotes herdam os genes com mutações e custam energia proporcional ao tamanho. |
| **Migração** | Se uma espécie quase desaparece, alguns migrantes chegam parecidos com a última população conhecida. Dá para desligar. |

### Compromissos evolutivos

Nenhum gene é bom de graça, e é isso que torna a evolução interessante:

- **Velocidade**: ajuda a achar comida, fugir e caçar, mas o gasto cresce com o quadrado da velocidade.
- **Visão**: avisa do perigo mais cedo e encontra comida mais longe, mas custa energia o tempo todo.
- **Tamanho**: guarda mais energia, acerta mais botes e é mais difícil de pegar, mas gasta mais para viver e para ter filhotes.

## Controles

- **Pausar/Continuar** (ou barra de espaço) e velocidades de **1× a 25×**
- **Novo mundo** ou **semente**: o mesmo número gera exatamente o mesmo mundo, e a semente fica na URL para compartilhar
- **Clique num animal** para inspecionar genes, energia, idade, geração e filhotes; o círculo tracejado mostra o alcance da visão
- **Parâmetros**: crescimento das plantas, chance e intensidade de mutação, migração, e botões para soltar mais animais

## Rodando localmente

Requer [Node.js](https://nodejs.org/) 20 ou superior.

```bash
git clone https://github.com/Leonardoalexanderxubento/ecossistema-simulador.git
cd ecossistema-simulador
npm install
npm run dev
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm test` | Testes automatizados (Vitest) |
| `npm run sim -- 20000 42` | Roda 20.000 ticks sem interface com a semente 42 e imprime populações e genes médios; útil para ajustar o equilíbrio |

## Estrutura

```
src/
├── sim/            # Simulação pura, sem DOM (roda no navegador e no Node)
│   ├── random.ts   #   gerador pseudoaleatório com semente
│   ├── noise.ts    #   ruído de valor para o relevo
│   ├── terrain.ts  #   água, areia, grama e fertilidade
│   ├── plants.ts   #   campo de biomassa
│   ├── animal.ts   #   estado de cada animal
│   ├── genes.ts    #   herança, mutação e limites dos genes
│   ├── species.ts  #   parâmetros de cada espécie
│   ├── behavior.ts #   comportamento: pastar, fugir, caçar, metabolismo
│   ├── spatial.ts  #   índice espacial para buscar vizinhos rápido
│   └── world.ts    #   laço da simulação, reprodução, mortes, migração
├── render/         # Desenho no canvas
├── ui/             # Painel, gráficos e histórico
└── main.ts         # Liga tudo: laço com passo fixo, cliques, URL
tests/              # Testes de genética e do mundo
scripts/headless.ts # Simulação sem interface
```

A simulação não depende do navegador, então pode ser testada e rodada no terminal. A aleatoriedade vem de um gerador com semente, o que torna cada execução reproduzível.

## Tecnologias

TypeScript (modo estrito) · Vite · Canvas 2D · Vitest · GitHub Actions + GitHub Pages. Nenhuma dependência em tempo de execução.

## Ideias para o futuro

- Reprodução sexuada com cruzamento de genes
- Mais espécies (aves, cervos, lobos) e estações do ano
- Água como recurso: sede e animais que precisam beber
- Exportar o histórico em CSV
- Árvore genealógica do animal selecionado

## Licença

[MIT](LICENSE)
