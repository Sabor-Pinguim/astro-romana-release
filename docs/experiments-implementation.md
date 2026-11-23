# Experimentos sorteados: plano de implementação

Plano para colocar no jogo os **21 experimentos** de [minigames.md](minigames.md), com um **sorteio diferente a cada partida (run)**. Escrito em 2026-11-23, a partir da versão 1.5.1.

## 1. Onde estamos hoje

### O que já existe

- **4 dos 21 experimentos funcionam:** os de superfície H-S1, L-S1, O-S1 e M-S1, um por tripulante.
  - A lista é fixa em `SURFACE_TASKS` ([web/app.js](../web/app.js)).
  - Os minigames ficam em [web/scout.js](../web/scout.js), registrados no mapa `GAMES`.
  - Os painéis estão escritos à mão no `index.html` (`#scout-game`, `#moxie-game`, `#relay-game`, `#bio-game`).
  - [web/views.js](../web/views.js) liga cada experimento ao seu painel (`MINIGAME_PANELS`).
  - O fim de um minigame dispara `astro:minigame-completed`, que chama `completeSurfaceTask`.
- **Layouts fixos:** os 4 minigames repetem o mesmo desafio em toda partida, e nenhum tem níveis de dificuldade. Só o M-S1 sorteia as manchas, e mesmo assim sem semente. Detalhes na seção 5.2.
- **Resultado binário:** o experimento está feito ou não. Não há as estrelas de 0 a 3 previstas em [minigames.md](minigames.md) (regra 3).
- **Pontuação fixa por ID:** `showResults` dá 60 pontos para H-S1, 130 para L-S1, 130 para O-S1 e 145 para M-S1. Um sorteio deixaria o placar injusto entre partidas.
- **Não há fase para os experimentos de órbita.** O cockpit tem 4 etapas de voo: decolagem, acoplamento da cabine, acoplamento orbital e pouso em Marte.

### Peças que dá para reaproveitar

- **Semente por partida:** `surf.seed` já é sorteada a cada pouso e enviada aos convidados. Ela posiciona os blocos dos experimentos (`placeBlocks` em `views.js`, com o gerador `seeded`).
- **`unlocksMinigames`:** cada peça em [tools/modeling/parts/specs.mjs](../tools/modeling/parts/specs.mjs) diz quais experimentos libera, e o campo chega ao `manifest.json` das peças. **Todos os 21 experimentos têm pelo menos uma peça.**
- **`createKeepInRange`:** a mecânica "manter na faixa", já usada na decolagem (`web/app.js`).
- **Tempestade solar no voo:** o estado `stormShielded`, os dados do RAD (`references/datasets/msl-rad/`) e o áudio `rad_storm_2024_05_20.wav` servem para o M-S5.
- **Placar do servidor:** já aceita `tasksTotal` até 16 ([multiplayer/server.mjs](../multiplayer/server.mjs)).

### Problemas encontrados

- **ID inexistente:** a peça `cockpit-pilot` libera `L-S4`, que não existe. Provavelmente deveria ser `L-S1` ou `L-S2`.
- **M-O3 ligado à peça errada:** ele é liberado por `sci-hirise-sharad` (HiRISE e SHARAD), mas a base real dele são os espectrômetros NOMAD e ACS do TGO. Conferir com o time.

## 2. Os 21 experimentos

| ID | Experimento | Dono | Onde | Mecânica | Hoje | Peças que liberam (`unlocksMinigames`) | Ligações |
|---|---|---|---|---|---|---|---|
| H-O1 | Aerofrenagem | Helena | Órbita | Manter na faixa | novo | `edl-trn-medli2`, `cabin-orion-cockpit`, `cabin-idss-docking`, `cockpit-pilot` | economiza massa para Maya |
| H-O2 | Rolagem para o radar | Helena | Órbita | Pilotagem | novo | `attitude-reaction-wheels` | bônus em M-O2 |
| H-S1 | Rota de escolta | Helena | Superfície | Planejar rota | ✅ | `truss-ingenuity`, `cabin-autonav-conjunction`, `cockpit-pilot` | revela alvos para Maya |
| H-S2 | Pouso de precisão | Helena | Descida | Escolha sob limite | novo | `edl-trn-medli2`, `edl-aspire-loftid`, `cabin-orion-cockpit`, `cabin-autonav-conjunction` | roda na etapa de pouso, não num bloco |
| L-O1 | Painel solar enrolável | Lucas | Órbita | Timing | novo | `power-rosa-solar`, `cabin-eva-airlock` | energia para todos |
| L-O2 | Detector frio | Lucas | Órbita | Manter na faixa | novo | `drill-corer-cryo`, `cabin-pcdu-thermal`, `cabin-eva-airlock` | bônus nos M-O |
| L-S1 | Forno de oxigênio | Lucas | Superfície | Manter na faixa | ✅ | `power-mmrtg-kilopower`, `isru-moxie-rodwell`, `cabin-eclss-wrs` | disputa energia com Maya |
| L-S2 | Perfuração | Lucas | Superfície | Timing (ritmo) | novo | `drill-corer-cryo` | gera amostras para M-S4 |
| O-O1 | Laser para a Terra | Oscar | Órbita | Mira | novo | `comm-dsoc-laser`, `cabin-scan-console`, `cockpit-pilot` | transmite os dados de Maya |
| O-O2 | Compressão de imagem | Oscar | Órbita | Escolha sob limite | novo | `data-rad750-ssr`, `cabin-scan-console`, `cabin-autonav-conjunction` | reduz os dados de M-O1 |
| O-S1 | Passagem do orbitador | Oscar | Superfície | Escolha sob limite | ✅ | `comm-electra-marco`, `cabin-scan-console` | |
| O-S2 | Radiogeodésia | Oscar | Superfície | Manter na faixa | novo | `comm-rise-xband` | |
| M-O1 | Foto em alta resolução | Maya | Órbita | Timing | novo | `sci-hirise-sharad` | gera muitos dados para Oscar |
| M-O2 | Radar de gelo | Maya | Órbita | Busca de padrão (gráfico) | novo | `sci-hirise-sharad` | |
| M-O3 | Caçador de metano | Maya | Órbita | Busca de padrão (espectro) | novo | `sci-hirise-sharad` ⚠ | peça a conferir (seção 1) |
| M-S1 | Caçador de bioassinaturas | Maya | Superfície | Busca de padrão (grade) | ✅ | `sci-pixl-sherloc-supercam`, `cabin-msg-minion` | vale mais se guardada em M-S4 |
| M-S2 | Laser nas rochas | Maya | Superfície | Mira | novo | `sci-pixl-sherloc-supercam`, `cabin-msg-minion` | |
| M-S3 | Ouvir martemotos | Maya | Superfície | Busca de padrão (gráfico) | novo | `sci-seis-caching` | |
| M-S4 | Escolher amostras | Maya | Superfície | Escolha sob limite | novo | `sci-seis-caching` | usa amostras de L-S2 e M-S1 |
| M-S5 | Alerta de radiação | Maya | Superfície (tripulada) | Timing | novo | `hab-veggie-rad-astrorad`, `cabin-hera-dosimetry`, `cabin-storm-shelter` | reaproveita os dados e o áudio do RAD |
| M-S6 | Estufa marciana | Maya | Superfície (tripulada) | Manter na faixa | novo | `hab-veggie-rad-astrorad`, `cabin-msg-minion` | |

**Totais:** 9 de órbita e 12 de superfície.

| Tripulante | Órbita | Superfície |
|---|---|---|
| Helena | 2 | 2 |
| Lucas | 2 | 2 |
| Oscar | 2 | 2 |
| Maya | 3 | 6 |

## 3. Regras do sorteio

1. **Quantos por partida** (decidido): 1 experimento de órbita e 1 de superfície por tripulante, 8 no total.
   - Mantém o ritmo atual da superfície (4 experimentos) e dá a cada jogador algo para fazer em cada fase.
2. **Aleatório puro** (decidido): cada partida sorteia de novo entre todas as opções de cada tripulante, sem lembrar as partidas anteriores. Um experimento pode sair em partidas seguidas.
   - Dentro de uma partida não há repetição, porque cada tripulante tira 1 experimento de órbita e 1 de superfície.
3. **Lista explícita, além da semente:** o host decide e guarda `run.experiments` (os 8 IDs) e `run.seed`.
   - Cada minigame cria seu próprio gerador com `seed + id`. Assim a grade, a fila de pacotes e as demais disposições saem iguais em todas as telas e reproduzíveis.
4. **Revelados só na hora** (decidido): o sorteio acontece quando a missão começa, mas o jogador só vê cada experimento quando ele entra em jogo.
   - Os de órbita aparecem ao chegar à etapa "Órbita de Marte", nos cards dos tripulantes.
   - Os de superfície aparecem no pouso, nos blocos e na lista de metas, como hoje.
   - O H-S2, quando sorteado, aparece durante a descida.
5. **Peças não afetam os experimentos, por enquanto** (decidido). Nenhum experimento é travado nem facilitado pelo que foi embarcado. O mapa `unlocksMinigames` fica guardado para quando isso mudar (seção 6, "Depois").
6. **Dependências sem bloqueio:** todo experimento pode ser jogado sozinho, e as cadeias só dão bônus.
   - M-S4 sem L-S2 usa amostras padrão do afloramento.
   - M-S1 sem M-S4 conta normalmente.
7. **M-S5 e M-S6 sempre entram no sorteio**, porque a missão do jogo é tripulada.

## 4. Arquitetura

Arquivos (implementados; scripts clássicos, que funcionam em `file://`):

| Arquivo | O que faz |
|---|---|
| `web/experiments.js` | Registro dos 21 (id, tripulante, local, mecânica, códigos do catálogo), o gerador com semente e o sorteio |
| `web/minigames/core.js` | Núcleo: registro dos minigames, layout com semente e novas tentativas, recomeço, teto de estrelas, bots, ajudantes de interface e solucionadores (mochila, ruído) |
| `web/minigames/<id>.js` | Um minigame: níveis, modificadores, gerador, solucionador e interface |
| `web/minigames/<id>.css`, `web/minigames.css` | Estilos de cada minigame e os componentes compartilhados |
| `web/locales/experiments/<id>.js`, `_common.js` | Textos de cada experimento, em inglês e português no mesmo arquivo |
| `web/experiment-run.js` | Ligação com o jogo: partida (`run`), diálogo, bots e pontos |
| `tools/minigame-lab/index.html` | Laboratório: abre qualquer experimento por nível, semente e idioma |
| `tools/web/check-experiments.mjs` | Validador em Node |

### 4.1 Registro dos experimentos (`web/experiments.js`)

Ele expõe `window.ASTRO_EXPERIMENTS`:

```js
{ id: 'H-S1', crew: 'helena', place: 'surface', mechanic: 'route', basis: ['EN9'], chains: [{ to: 'M-S1', kind: 'targets' }] }
// place: 'orbit' | 'surface' | 'descent' (o H-S2 roda na descida e ocupa a vaga de chão da Helena)
```

- O registro também traz `draw(seed)` (o sorteio da seção 3), `pool(crew, side)`, `levelOf(difficulty)` e o gerador `random.rngFor(seed, chave)`.
- As peças exigidas **não são copiadas** para o registro: saem de `DATA.parts[*].unlocksMinigames` quando as peças passarem a contar (seção 6, "Depois").

### 4.2 Contrato de cada minigame (`web/minigames/<id>.js`)

```js
ASTRO_MINIGAMES.register('H-S1', {
  levels: { easy: {...}, normal: {...}, hard: {...} },  // os números de cada nível ficam no arquivo do minigame
  mods: ['chave', ...],               // modificadores com base real; o nível diz quantos entram
  generate(R, P, { mods, ctx }),      // puro: layout da partida a partir da semente
  validate(layout, P),                // rejeita layouts sem solução
  solve(layout, P),                   // melhor resultado possível do layout (estrelas contra o ótimo)
  botSeconds: { easy, normal, hard },
  factVars: U => ({...}),             // números do "Fato real" que dependem de unidades
  mount(host),                        // monta a interface; termina com host.finish({ stars }) ou host.fail(motivo)
});
```

- O núcleo cuida do que é igual em todos: as etiquetas de nível, teto de estrelas e modificadores, o botão "Recomeçar" (mesmo layout, teto uma estrela menor) e a falha com opção de encerrar com 0 estrela.
- O diálogo monta o minigame num ponto único (`#minigame-stage`). Os 4 painéis fixos saem do `index.html`.
- Todo minigame precisa:
  - funcionar com mouse, teclado e toque;
  - respeitar `prefers-reduced-motion`;
  - caber em 390 px e em 915×412 (veja [mobile-responsiveness.md](mobile-responsiveness.md)).

### 4.3 Mecânicas base

Os 21 experimentos usam só 7 mecânicas. O núcleo oferece as peças comuns (ruído com semente, mochila exata, medidores, botão de segurar, canvas), e cada minigame monta a sua interface sobre elas.

| Mecânica | De onde vem | Experimentos |
|---|---|---|
| Manter na faixa | extrair de `createKeepInRange` (decolagem) e do MOXIE (`scout.js`) | H-O1, L-O2, L-S1, O-S2, M-S6 |
| Timing | nova | L-O1, L-S2, M-O1, M-S5 |
| Mira | nova (pode partir da retícula do acoplamento) | O-O1, M-S2 |
| Escolha sob limite | extrair do relay (O-S1) | H-S2, O-O2, O-S1, M-S4 |
| Busca de padrão | grade do M-S1, mais a variante nova "gráfico/espectro" | M-O2, M-O3, M-S1, M-S3 |
| Planejar rota | H-S1 atual | H-S1 |
| Pilotagem | nova | H-O2 |

### 4.4 Estado da partida (`web/app.js`)

- `state.run = { seed, experiments, results }`, em que `results` guarda, por experimento, `{ stars, by }`. `by` é o jogador que jogou, ou `'bot'` (seção 4.12). Nasce no início da missão e é limpo em `clearMission`.
- `surf.tasks` passa a sair de `run.experiments` (os de superfície). Como `views.js` já lê `sim().surf.tasks`, os blocos no terreno acompanham sem mudança.
- `surf.seed` continua só para posicionar os blocos.

### 4.5 Fase "Órbita de Marte" (cockpit)

- **Os experimentos de órbita acontecem antes do pouso** (decidido), numa nova etapa entre o acoplamento orbital (03) e o pouso, que passa a ser a 05.
- Cada tripulante tem um card com o seu experimento de órbita, que abre o mesmo `#minigame-dialog`.
- O tempo é medido em "passagens" (`game-balance`). No solo, o relógio pausa durante o minigame, como na superfície.
- A H-O1 (aerofrenagem) pode ser a própria inserção em órbita.
- **Arquivos afetados:**
  - `STEP_CREW` e `setFlightStep` (`app.js`);
  - o stepper de voo, que passa de 4 para 5 colunas (`index.html` e `styles.css`);
  - os locales;
  - a vista de Marte em órbita (`flight.js`);
  - as fases do multiplayer.
- **H-S2:** quando sorteado, roda dentro da etapa de pouso (escolher um ponto seguro em 10 s, como o TRN real), antes do toque no solo.

### 4.6 Pontuação

- **Estrelas:** cada experimento devolve de 0 a 3 estrelas.
- **Fórmula por tripulante:** base + estrelas × `STAR_POINTS` + bônus de cadeia, com teto.
  - `STAR_POINTS` é uma constante única (`game-balance`), então o máximo é o mesmo em qualquer sorteio e o placar continua justo.
- **Multiplicador por dificuldade:** o total da missão é multiplicado conforme a dificuldade escolhida no lobby. Valores `game-balance` decididos pelo time em 2026-11-23:

  | Fácil | Normal | Difícil |
  |---|---|---|
  | ×0,75 | ×1,0 | ×1,5 |

  - Fica como `scoreMultiplier` na tabela `difficulty` de `web/app.js`. Não confundir com o `factor` que já existe lá, que multiplica o orçamento.
  - Vale para o total e para os pontos de cada astronauta no pódio, para a soma bater.
  - A nota (S+, A, B, C) é calculada antes do multiplicador (decidido) e mede quão bem o time jogou naquela dificuldade. O multiplicador só pesa nos pontos e no placar.
  - Aparece em três lugares: no card de dificuldade do lobby, no selo do cabeçalho (ex.: "NORMAL · $250M · 3:00 ON MARS · ×1.0 PTS") e na tela de resultados, como "pontos × multiplicador".
- **Em `showResults`:** trocar os pontos fixos por ID (`rawScores`) pela fórmula acima e recalibrar as notas S+, A, B e C.
- **Tela de resultados:** lista os 8 experimentos com estrelas e o fato real de cada um.

### 4.7 Multiplayer

- **Sorteio:** o host sorteia, e `run` vai no `state setup`. Assim os convidados veem os mesmos experimentos.
- **Superfície:**
  - `act('task', id)` passa a levar as estrelas: `act('task', id, stars)`;
  - o host confere o dono pelo `from.seat`, como já pede [multiplayer.md](multiplayer.md);
  - `surfaceSnapshot` inclui `results`.
- **Órbita:** o mesmo esquema, dentro do estado de voo.
- **Vagas da IA:** os bots fazem os próprios experimentos (seção 4.12). O host calcula o resultado deles e o envia no estado, como faz com as outras regras.

### 4.8 Placar

- O registro da missão ganha `experiments: [{ id, stars, bot? }]`, `runSeed` e `scoreMultiplier` (implementado no servidor, com teste e migração de bancos antigos).
  - Guardar o multiplicador mantém os pontos antigos explicáveis se os valores mudarem depois.
  - Com o multiplicador, o filtro "todas as dificuldades" do placar passa a comparar partidas de forma justa.
  - O teto do servidor (`MAX_SCORE` = 100.000) comporta os pontos multiplicados.
- **Servidor:**
  - `multiplayer/server.mjs` (validação) e `db.mjs` (tabela) aceitam o campo como opcional;
  - os registros antigos continuam válidos;
  - exige novo deploy na VM.
- **Placar local do solo:** o mesmo campo.

### 4.9 Textos (i18n)

- Cada experimento tem o seu arquivo `web/locales/experiments/<id>.js`, com inglês e português lado a lado. Ele entra em `translation.experiments.<id>` e carrega depois de `en.js`/`pt.js` e antes de `i18n.js`. Assim os dois idiomas ficam juntos e vários experimentos podem ser feitos ao mesmo tempo sem conflito.
- Textos comuns (níveis, recomeçar, etapa de órbita, resultados): `web/locales/experiments/_common.js`.
- As chaves antigas `surface.tasks.<id>` e `minigames.scout|moxie|relay|bio` saem de `en.js`/`pt.js` na integração.

### 4.10 Teste e validação

- **Laboratório:** `tools/minigame-lab/index.html#<id>/<nível>/<semente>/<idioma>` abre qualquer experimento com os mesmos arquivos do jogo. É ferramenta de validação, sem lógica de jogo, como o visualizador de modelos.
- **Validador:** `node tools/web/check-experiments.mjs [--seeds 300] [--only H-S1,L-S1]`. Só confere, sem lógica de jogo:
  - existem 21 entradas, e nenhuma combinação de tripulante e local está vazia;
  - as chaves de texto estão em `en` e `pt`, com o mesmo conjunto nos dois idiomas, incluindo os nomes dos modificadores;
  - para cada experimento e nível, as sementes geram layouts que têm solução, são dados simples, são diferentes entre si e saem em menos de 50 ms;
  - os bots tiram 1 ou 2 estrelas;
  - em 10.000 sementes, o sorteio dá 1 de órbita e 1 de chão por tripulante e cobre os 21.

### 4.11 Dados, fontes e arte

- **Especificação:** cada experimento novo precisa de `references/experiments/minigames/<id>/README.md`, no formato do [_template.md](../references/experiments/minigames/_template.md). São 17 novos.
  - Inclui dados reais, parâmetros (real ou `game-balance`), modelos e o card de fato com fonte.
- **Conferir antes de usar como fato** (AGENTS.md §8):

  | Experimento | O que conferir |
  |---|---|
  | M-S3 | massa do SEIS "~29,5 kg (to be confirmed)" (o jogo não mostra) |
  | M-O2 | gelo de Utopia com água de um Lago Superior (~14.300 km³): marcado ⚠ no catálogo (PH7) |
  | H-O1 | "~600 kg economizados pelo MRO": marcado ⚠ no catálogo (EN10) |
  | L-O1 | "ROSA foi descartado em 2017": marcado ⚠ no catálogo (E5) |
  | L-S2 | "3–5 m", "~37 cm" e "empurrar com o braço" só estão em minigames.md; o catálogo (G9) diz "≥3 m" e "2–3 cm" |
  | H-S2 | "sinal leva ~11 min": o catálogo dá a faixa de 3–22 min |
  | M-S1, M-S4 | "Mars Sample Return cancelado em jan/2026": marcado ⚠ no catálogo |

  Também são interpretação de jogo, e o código diz isso nos comentários: o efeito das nuvens sobre a estação laser (O-O1), o pavio entupido da estufa (M-S6), a areia mais drenante do simulante (M-S6), o efeito da tempestade de poeira sobre o ar alto (H-O1) e sobre o contraste das fotos (O-O2), e a "segunda onda" da tempestade do RAD (M-S5). As linhas dos espectros do M-O3 são padrões de jogo, não comprimentos de onda reais.
  | O-O1 | [minigames.md](minigames.md) diz que os números do terminal laser não foram publicados; `specs.mjs` usa <29 kg e ~76 W com ⚠ |
  | M-O3 | "In Nov 2026 TGO detected gas…" (fato deste mês: confirmar a fonte) |
  | O-S1 | "In 2025 NASA lost MAVEN" |
  | M-S1, M-S4 | situação da missão de retorno de amostras (cancelada?) |

- **Arte:**
  - **Primeiro:** reaproveitar o bloco procedural de `views.js` (`makeBlock`), na cor do tripulante e com um ícone por mecânica.
  - **Depois:** modelos low poly por experimento, gerados em `tools/modeling` com o orçamento da AGENTS.md §5.

### 4.12 Bots (vagas da IA)

Decidido: os bots fazem os experimentos com um resultado médio, nunca excelente.

- **Resultado:** 1 ou 2 estrelas, sorteadas com a semente da partida. Nunca 0 nem 3. A proporção é `game-balance`, a calibrar.
- **Tempo:**
  - na superfície, o bot anda até o bloco e trabalha pelo tempo típico do minigame naquele nível antes de o resultado aparecer;
  - na órbita, o card mostra o bot trabalhando, com uma barra de progresso.
- **Assumir o lugar do bot:** como hoje, um jogador pode assumir o astronauta do bot antes de ele terminar e jogar o minigame. Aí vale o resultado do jogador.
  - No solo, é a troca de tripulante que já existe.
  - No multiplayer, é o `requestCrew`.
  - Depois que o bot termina, o resultado dele é definitivo.
- **Quem calcula:** no solo, o próprio navegador; no multiplayer, o host, que sincroniza o resultado com os convidados.
- **Pontuação:** as estrelas do bot contam no total do time como as de qualquer tripulante, e o pódio mostra os pontos dele.

## 5. Variação e níveis de dificuldade

Nenhum minigame pode ter um caminho predeterminado. Cada partida monta o minigame a partir de três camadas:

| Camada | O que muda | De onde vem |
|---|---|---|
| Layout | posições, itens e curvas (a grade, os pacotes, o ruído) | gerador com semente: `rngFor(run.seed, id)` |
| Nível | tamanho e aperto: grade maior, faixa mais estreita, menos tempo | dificuldade da missão (fácil, normal, difícil) |
| Modificadores | eventos com base em casos reais (rajada fria, orbitador perdido, areia lisa) | sorteados com a mesma semente; o nível decide quantos entram |

### 5.1 Regras para os 21 experimentos

1. **Sempre com semente.** Nada de `Math.random` dentro dos minigames (o M-S1 usa hoje). A mesma semente gera o mesmo layout em qualquer tela.
2. **"Recomeçar" mantém o layout.** Se gerasse outro, o jogador recomeçaria até cair num layout fácil. O layout só muda na partida seguinte.
3. **Sempre há solução.** Cada gerador vem com um solucionador. Um layout sem solução é descartado e gerado de novo, com limite de tentativas e um layout reserva já testado.
4. **Estrelas contra o ótimo do próprio layout.** Como os layouts variam, a nota compara o jogador com a melhor solução daquele layout (a rota mais curta, a melhor seleção de pacotes), e não com um número fixo.
5. **O nível do minigame é o nível da partida** (decidido): Fácil, Normal ou Difícil, conforme o passo 02 do lobby.
6. **Números reais continuam reais.** A variação só sorteia dentro de faixas reais (por exemplo, 100–250 Mb por passagem) ou em valores marcados como `game-balance`.
7. **Modificadores têm base real** ([minigames.md](minigames.md), regra 4), e o card de fato explica o caso.
8. **Cabe no celular.** Uma grade maior não pode deixar a célula com menos de ~36 px em tela de toque. Em retrato, a grade gira (12×8 vira 8×12) ou ganha zoom.

### 5.2 Os 4 experimentos atuais

Os valores das tabelas são propostas `game-balance`, a calibrar em teste, exceto onde está escrito "real".

#### H-S1 · Rota de escolta

- **Hoje:** grade 5×5 fixa, 5 pontos de passagem (O → Si → Fe → Mg → Ca) e 4 áreas de areia sempre no mesmo lugar. Não há limite de passos, e a solução é sempre a mesma.
- **Gerador:**
  1. Sortear um caminho que não se cruza, com o tamanho pedido pelo nível (passeio aleatório com retrocesso).
  2. Colocar os pontos de passagem em ordem ao longo dele, com uma distância mínima entre eles.
  3. Pôr areia fora do caminho, de preferência nos atalhos óbvios.
  4. Resolver por busca em largura para achar a rota mais curta. Sem solução, gerar de novo.
- **Níveis:**

  | | Fácil | Normal | Difícil |
  |---|---|---|---|
  | Grade | 5×5 | 6×6 | 7×7 |
  | Pontos de passagem | 4 | 5 | 5 (6 se houver fonte para o 6º elemento) |
  | Areia visível | 3–4 | 6–8 | 9–12 |
  | Areia lisa (só aparece quando o jogador está ao lado) | 0 | 1–2 | 3–4 |
  | Limite de passos | sem limite | ótimo + 6 | ótimo + 3 |

- **Base real do modificador:** a areia lisa vem do fim do Ingenuity, que perdeu a referência visual sobre areia sem textura no voo 72. É o fato do próprio H-S1.
- **Estrelas:**
  - 3: rota até o ótimo + 1, sem recomeçar;
  - 2: dentro do limite de passos;
  - 1: completou fora do limite ou depois de recomeçar;
  - 0: não completou.
- **A conferir:** um 6º ponto exige o 6º elemento mais abundante da crosta de Marte, com fonte em `references/`. Sem fonte, o difícil fica com 5 pontos e mais areia.

#### L-S1 · Forno de oxigênio

- **Hoje:** a temperatura oscila pela soma de duas senoides fixas. Parte sempre de 750 °C, com faixa verde de 780–820 °C e meta de 6 g, e o padrão se repete igual em toda partida.
- **Gerador:** ruído com semente (frequências, fases e amplitude sorteadas), temperatura inicial sorteada e momento dos eventos sorteado.
- **Níveis:**

  | | Fácil | Normal | Difícil |
  |---|---|---|---|
  | Faixa verde (alvo real: 800 °C) | 770–830 °C | 780–820 °C | 790–810 °C |
  | Oscilação | fraca | média | forte e mais rápida |
  | Meta de O₂ (corridas reais: 5,4–9,8 g) | 5,5 g | 6 g | 8 g |
  | Modificadores | 0 | 1 | 2 |
  | Bateria | sem limite | sem limite | limitada pelo consumo real de 300 W |

- **Modificadores:**
  - rajada fria: a noite e o vento esfriam o forno;
  - queda de energia: a bateria é disputada com outros instrumentos;
  - célula desgastada: o forno aquece mais devagar.
- **Estrelas:** pela fração do tempo dentro da faixa verde e pelo dano na célula.

#### O-S1 · Passagem do orbitador

- **Hoje:** os mesmos 7 pacotes, capacidade de 250 Mb, janela de 40 s e meta de 200 pts. A melhor escolha nunca muda.
- **Gerador:**
  - Sortear os pacotes de um catálogo de instrumentos com tamanhos reais. Hoje o catálogo tem Mastcam-Z, SHERLOC, RIMFAX, SEIS, PIXL, SuperCam e a telemetria; instrumentos novos só entram com fonte em `references/`.
  - Sortear a capacidade da passagem dentro da faixa real de 100–250 Mb.
  - Sortear a curva de taxa (a altura do orbitador no céu) e o valor de cada pacote, a "prioridade do dia". Por exemplo, SHERLOC vale mais se o M-S1 foi feito.
  - Calcular a melhor seleção (programação dinâmica da mochila, que é rápida com poucos pacotes) e definir a meta como uma fração dela.
- **Níveis:**

  | | Fácil | Normal | Difícil |
  |---|---|---|---|
  | Pacotes | 6 | 8 | 10 |
  | Capacidade (faixa real: 100–250 Mb) | 220–250 Mb | 150–220 Mb | 100–150 Mb |
  | Janela | 45 s | 40 s | 30 s |
  | Meta | 70% do ótimo | 85% do ótimo | 95% do ótimo |
  | Chegada dos pacotes | todos no início | alguns durante a passagem | a maioria durante a passagem |

- **Modificadores:**
  - orbitador perdido: menos capacidade (conferir o fato sobre o MAVEN);
  - pacote urgente: chega no meio da passagem;
  - janela curta.
- **Estrelas:**
  - 1: atingiu a meta;
  - 2: passou da metade do caminho entre a meta e o ótimo;
  - 3: atingiu o ótimo.

#### M-S1 · Caçador de bioassinaturas

- **Hoje:** já sorteia as manchas a cada tentativa, mas sem semente. A grade (8×6), as quantidades (5 manchas, 3 iscas, achar 3) e o orçamento (300 min e 120 Wh) são fixos.
- **Gerador:**
  - manchas em aglomerados, como as "manchas de leopardo" reais de Cheyava Falls, e não em células soltas;
  - iscas de tipos diferentes;
  - orçamento calculado a partir do layout: o custo de uma estratégia de referência mais a folga do nível.
- **Níveis:**

  | | Fácil | Normal | Difícil |
  |---|---|---|---|
  | Grade | 8×6 | 10×7 | 12×8 |
  | Manchas / a confirmar | 5 / 3 | 5 / 3 | 6 / 4 |
  | Iscas | 2 | 3 | 5 |
  | Folga do orçamento | +40% | +20% | +5% |
  | Pista de halo (↗) | sim | sim | não |

- **Modificadores:**
  - poeira na rocha: o UV do SHERLOC revela menos;
  - mineral fluorescente: iscas que brilham como mancha.
- **Estrelas:** pelas manchas confirmadas, pelo orçamento que sobrou e pelas iscas confirmadas por engano.
- **Custos que não mudam:** os do SHERLOC e do PIXL, que são reais ou derivados (10 min e 8,1 Wh; 12,5 min e 5,2 Wh).

### 5.3 Os 17 experimentos novos

Já nascem com as três camadas. O `_template.md` ganha uma seção "Variation and difficulty", e cada especificação nova a preenche com:
- o gerador;
- a tabela dos 3 níveis;
- os modificadores com base real;
- o solucionador;
- a regra de estrelas.

Os geradores ficam nas mecânicas (seção 4.3), então a mesma lógica serve a vários experimentos:

| Mecânica | Gerador e solucionador | Experimentos |
|---|---|---|
| Planejar rota | caminho que não se cruza + busca da rota mais curta | H-S1 |
| Manter na faixa | ruído com semente + eventos | H-O1, L-O2, L-S1, O-S2, M-S6 |
| Escolha sob limite | catálogo real + mochila (ótimo exato) | H-S2, O-O2, O-S1, M-S4 |
| Busca de padrão | aglomerados na grade, ou sinais no ruído de um gráfico ou espectro | M-O2, M-O3, M-S1, M-S3 |
| Timing | velocidade e janela do cursor e alvos sorteados | L-O1, L-S2, M-O1, M-S5 |
| Mira | trajetória e vibração do alvo sorteadas | O-O1, M-S2 |
| Pilotagem | ângulo pedido e perturbações sorteados | H-O2 |

## 6. Fases

Cada fase é um commit com bump de versão. As fases 0 a 3 são features grandes, então levam bump minor.

### Fase 0: fundação (nenhum experimento novo)

- [ ] Criar o registro `web/experiments.js` com os 21 experimentos (dados e textos).
- [ ] Implementar `draw` (aleatório puro, com semente), `rngFor` e `state.run`.
- [ ] Criar o contrato `register`/`finish`, o ponto único `#minigame-stage` e a rota `#exp-<id>`.
- [ ] Passar aos minigames o nível (vindo da dificuldade da missão) e a semente. "Recomeçar" passa a manter o layout.
- [ ] Acrescentar a seção "Variation and difficulty" ao `_template.md`.
- [ ] Migrar H-S1, L-S1, O-S1 e M-S1 de `scout.js` para `web/minigames/<id>.js`, já devolvendo estrelas.
- [ ] Trocar a pontuação fixa por ID pela fórmula da seção 4.6, com o multiplicador por dificuldade, e mostrar as estrelas e o multiplicador nos resultados.
- [ ] Fazer os bots completarem os experimentos de superfície com resultado médio (seção 4.12).
- [ ] Criar o validador `tools/web/check-experiments.mjs`.
- [ ] Corrigir `L-S4` em `specs.mjs` e rodar `npm run models`.
- **Pronto quando:** o jogo funciona como hoje, mas a partir do registro, com estrelas, e o validador passa.

### Fase 1: mecânicas base, variação e níveis

- [ ] Criar `web/minigames/core.js` com as 7 mecânicas, cada uma com seu gerador e seu solucionador (seção 5.3).
- [ ] Extrair "manter na faixa", "escolha sob limite" e "busca de padrão" do código atual.
- [ ] Criar timing, mira, pilotagem e a variante de busca em gráfico/espectro.
- [ ] Dar aos 4 experimentos atuais layout gerado, 3 níveis, modificadores e estrelas contra o ótimo (seção 5.2).
- **Pronto quando:**
  - duas sementes diferentes geram desafios diferentes;
  - os 3 níveis funcionam;
  - o validador gera 1.000 layouts por nível, e todos têm solução;
  - tudo funciona com mouse, teclado e toque, em 1440 px, 390 px e 915×412.

### Fase 2: os 8 novos de superfície (o sorteio da superfície passa a valer)

Cada experimento novo já nasce com gerador, 3 níveis e modificadores (seção 5.3). Ordem, pela reutilização das mecânicas:

- [ ] O-S2 e M-S6 (manter na faixa)
- [ ] L-S2 e M-S5 (timing)
- [ ] M-S2 (mira)
- [ ] M-S3 (busca em gráfico)
- [ ] M-S4 (escolha sob limite)
- [ ] H-S2 (escolha sob limite, dentro da etapa de pouso)
- [ ] Revelar cada experimento só na hora: os de superfície no pouso e o H-S2 na descida (seção 3, regra 4).
- **Pronto quando:** cada partida sorteia 4 dos 12 experimentos de superfície, e o multiplayer sincroniza a lista e as estrelas.
- **Corte possível para a entrega do hackathon:** fases 0 a 2.

### Fase 3: órbita de Marte (os 9 de órbita)

- [ ] Criar a etapa "Órbita de Marte" no cockpit, antes do pouso, com o stepper de 5 etapas, os cards por tripulante, os bots e o multiplayer.
- [ ] Implementar os experimentos, já com gerador, 3 níveis e modificadores, nesta ordem:
  - H-O1 e L-O2 (manter na faixa)
  - L-O1 e M-O1 (timing)
  - O-O1 (mira)
  - O-O2 (escolha sob limite)
  - M-O2 e M-O3 (busca em gráfico/espectro)
  - H-O2 (pilotagem)
- **Pronto quando:** cada partida tem 8 experimentos sorteados (4 de órbita e 4 de superfície).

### Fase 4: cadeias e efeitos

- [ ] Bônus de cadeia: H-O2 → M-O2, L-O2 → M-O1/M-O2/M-O3, O-O2 → M-O1, L-S2 e M-S1 → M-S4, H-S1 → alvos de Maya.
- [ ] Efeitos nos recursos: por exemplo, L-O1 bem-sucedido dá mais energia na superfície.
- [ ] Gravar `experiments` e `seed` no placar e fazer o deploy do servidor.

### Fase 5: arte, fatos e acabamento

- [ ] Escrever as 17 especificações em `references/experiments/minigames/` e conferir os itens da tabela da seção 4.11.
- [ ] Criar os modelos low poly por experimento.
- [ ] Revisar o mobile e a acessibilidade em todos os minigames.
- [ ] Atualizar [minigames.md](minigames.md) (regras do sorteio) e a estrutura no [AGENTS.md](../AGENTS.md) §2 (pasta `web/minigames/`).

### Depois (fora do escopo atual)

- [ ] Fazer as peças embarcadas afetarem os experimentos: travar o experimento sem a peça, ou facilitar com uma peça melhor. O mapa `unlocksMinigames` de `specs.mjs` já está pronto para isso.

## 7. Decisões

Nenhuma decisão pendente. Todas foram tomadas pelo time em 2026-11-23:

- **Quantos experimentos por partida:** 8, sendo 1 de órbita e 1 de superfície por tripulante (seção 3, regra 1).
- **Sorteio:** aleatório puro, sem memória entre partidas (seção 3, regra 2).
- **Quando o jogador vê os experimentos:** só na hora, na órbita, na descida e no pouso (seção 3, regra 4).
- **Multiplicador de pontos por dificuldade:** ×0,75 no Fácil, ×1,0 no Normal e ×1,5 no Difícil, aplicado ao total. A nota é calculada antes do multiplicador (seção 4.6).
- **Peças:** por enquanto não afetam os experimentos (seção 3, regra 5).
- **Experimentos de órbita:** acontecem antes do pouso, numa nova etapa do cockpit (seção 4.5).
- **Bots:** fazem os próprios experimentos com resultado médio, de 1 ou 2 estrelas (seção 4.12).
- **Nível dos minigames:** é o nível da partida (seção 5.1, regra 5).

## 8. Riscos

- **Volume:** são 17 minigames novos e uma fase nova de voo. As fases 0 a 2 já entregam um sorteio real e podem ser a meta mínima.
- **Placar justo:** a escala única de estrelas, medida contra o ótimo de cada layout, é o que mantém comparáveis partidas com sorteios e layouts diferentes.
- **Geradores:** podem criar um layout sem solução, ou fácil demais. Cada gerador tem um solucionador, e o validador testa 1.000 sementes por nível.
- **Grades maiores no celular:** a célula não pode ficar pequena demais para o toque (seção 5.1, regra 8).
- **Servidor:** o campo novo no placar exige deploy. Clientes antigos continuam funcionando, porque o campo é opcional.
- **Trabalho em paralelo:** `web/app.js`, `index.html` e `web/styles.css` também mudam na frente de responsividade. É preciso combinar pelo `SHARED_CONTEXT.md`.
