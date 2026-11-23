# Auditoria técnica: Astro Romana v2

> **Documento vivo.** A cada nova revisão: acrescente uma linha ao histórico abaixo (data e commit-base), atualize a seção "Base desta revisão" e marque os achados resolvidos, sem apagar o histórico.

| Revisão | Data | Commit-base | Observação |
|---|---|---|---|
| 1 | 2026-11-23 | `2282c4baea5f4f0c2b5efc798346c7098efc57e0` | Primeira auditoria completa. Inclui alterações não commitadas em 7 arquivos (WIP dos fantasmas e da cena de partida). |

**Escopo:** todo o código escrito à mão (`index.html`, `web/`, `multiplayer/`, `tools/`), os docs e a estrutura do repositório. Os assets gerados foram conferidos por regeneração, não por leitura.

## Base desta revisão (referência para diffs futuros)

- **Data da revisão:** 2026-11-23.
- **Commit-base:** `2282c4baea5f4f0c2b5efc798346c7098efc57e0` (`main`, 2026-11-23T00:27:06-03:00, "feat: add settings screen with i18n, unit system, and server config").
- **Alterações não commitadas também analisadas.** São o WIP dos fantasmas e da cena de partida e as correções do sombreamento de `t` (renomeado para `tSec`, `terrain` e `task`). Os arquivos estavam sendo editados durante a auditoria. Hash do blob de cada um no fim dela (`git hash-object <arquivo>`):

| Arquivo | Blob na working tree (fim da auditoria) |
|---|---|
| `web/app.js` | `dd3fbdeb879b2fc465c5094aba364399e7dec5c7` |
| `web/flight.js` | `08d93b1b74e28d0ba0724b311e0352a9eb132867` |
| `web/launch.js` | `94aa9301dda6b273b630b85c347bfda3af2aa234` |
| `web/locales/en.js` | `efa11f031889f8228db7697d1269eaf113fcc091` |
| `web/locales/pt.js` | `adbc60514bdfa8dbc44bcdc227145f4462a0c6da` |
| `web/styles.css` | `8b68a40bcd6367da6703e0dcbbf1a50466fbcc67` |
| `web/views.js` | `1db0b6263c9d86d0c17edebeef1d1990f8ffb7e4` |

**Como usar numa próxima revisão:**
- `git diff 2282c4baea5f4f0c2b5efc798346c7098efc57e0..<novo-commit>` mostra tudo o que mudou desde esta auditoria. Como o WIP acima ainda não estava commitado, ele aparece nesse diff assim que for commitado.
- Para saber se um arquivo commitado é idêntico ao que foi auditado, compare `git rev-parse <novo-commit>:<arquivo>` com o blob da tabela. Se for igual, os achados (WIP) daquele arquivo valem como estão. Se não for, revise o diff.
- Achados marcados "na HEAD" referem-se a `2282c4baea5f4f0c2b5efc798346c7098efc57e0` (`git show 2282c4baea5f4f0c2b5efc798346c7098efc57e0:<arquivo>`).

## Como ler

- **IDs por área:**
  - `GAME`: núcleo do jogo
  - `SURF`: superfície e minigames
  - `FLT`: voo, lançamento e órbita
  - `UI`: interface, i18n e CSS
  - `NET`: multiplayer
  - `MOD`: pipeline de modelos
  - `PIPE`: áudio e terreno
  - `REPO`: docs e processo
- **Severidade:**
  - **CRÍTICO:** crash, trava ou servidor derrubado por um cliente;
  - **ALTO:** resultado errado ou recurso quebrado no caminho comum, ou dado "real" errado;
  - **MÉDIO:** caso de borda ou débito com custo claro;
  - **BAIXO:** menor.
- **(WIP):** o problema está no código não commitado e deve ser resolvido antes do commit.
- **Confiança:**
  - *confirmado*: caminho de código rastreado, e muitas vezes reproduzido em script;
  - *suspeita*: depende de rodar no navegador.
- **Linhas:** `web/app.js`, `views.js`, `flight.js` e `launch.js` foram editados durante a auditoria, então algumas linhas citadas podem ter andado alguns números. A referência é a working tree de ~01:40 do dia 23.

## Resumo

**88 entradas:** 5 críticas, 10 altas, 44 médias e 29 baixas. Várias entradas baixas agrupam itens pequenos.

### Corrigir primeiro

1. **A HEAD não completa uma missão.** Três sombreamentos do helper de i18n `t` entraram no commit de i18n `2282c4b`:
   - a plataforma de lançamento trava (FLT-01);
   - todo pouso falha (SURF-01);
   - concluir um experimento lança TypeError (GAME-01).

   A working tree já corrige os três. **Commitar essas correções isoladas do WIP** e ligar um lint (`no-shadow`, `no-use-before-define`) e um smoke test (REPO-01).
2. **Servidor de salas derrubável por um único cliente:**
   - JSON muito aninhado (NET-01);
   - `{"t":"__proto__"}` (NET-02);
   - OOM com cerca de 91 salas (NET-03);
   - lotar `MAX_ROOMS` em menos de 1 s (NET-04).
3. **XSS por link** (`?server=` de atacante) e por host malicioso, sem CSP (NET-05).
4. **Antes de commitar o WIP dos fantasmas:**
   - a IA vira fantasma em 67 a 93% dos timeouts (SURF-02);
   - o texto do debrief diverge da penalidade aplicada (GAME-02);
   - os pontos de spawn ficam fora do raio de embarque (SURF-03);
   - a cena de partida pode deixar convidados num limbo, aceita entradas e ignora movimento reduzido (SURF-04 a 06);
   - cores trocadas no fantasma 3D e cores fora da paleta (FLT-06, UI-03).
5. **Dados apresentados como reais que estão errados:**
   - o MMRTG gera 900 W contínuos, quando o real é 110 W (MOD-02);
   - "53 min após a última leitura normal" contradiz o CSV (PIPE-02);
   - o Geiger documentado não existe no jogo (PIPE-01);
   - a Terra "no jogo" não é usada (MOD-10);
   - massa dos motores contada duas vezes nos tanques (MOD-03).
6. **Acessibilidade e toque:**
   - o acoplamento da etapa 02 é impossível no celular (FLT-02);
   - sem WebGL não há minigames (SURF-08);
   - o card "Fato real" fecha em 3,4 s (SURF-07).
7. **Ferramenta quebrada:** `npm run web:sites` falha no import (MOD-01).

### O que está saudável

- **Validadores:** `models:validate`, `audio:validate` e `terrain:validate` passam.
- **Regeneração:** feita num clone limpo, deu GLBs, WAVs e terrenos byte a byte idênticos aos commitados. A única diferença foi o `generatedAt` (MOD-17).
- **Servidor de salas:** os testes passam (19/19).
- **i18n:** EN e PT têm as mesmas 710 chaves, com placeholders e arrays iguais e nenhuma chave usada faltando.
- **Matemática do foguete:** sem erro de unidade (kN, kg, s, g0), e a tabela de dificuldades bate com o README.
- **Encoders e georreferência:** WAV, GLB, PNG e JPEG corretos; a georreferência e a curvatura do terreno conferem.
- **Determinismo:** nenhum `Math.random` nos geradores.
- **Listeners:** nenhum é duplicado entre renders.

## 1. Núcleo do jogo (`web/app.js`)

#### GAME-01 · [CRÍTICO na HEAD] `completeSurfaceTask` sombreia `t()`
- **Onde:** `HEAD:web/app.js:1497-1507` (corrigido na working tree: `task`) · **Confiança:** confirmado
- **Problema:** `const t = surf.tasks.find(...)` seguido de `t('surface.allDoneToast')`. Na HEAD, todo experimento concluído lança `TypeError: t is not a function` depois do `surf.completed.add`: não sai toast nem `astro:surface`, e a exceção sobe para `views.js`, que deixa o prompt sujo. É o mesmo padrão de SURF-01 e FLT-01.
- **Sugestão:** commitar a correção mesmo que o WIP seja descartado.

#### GAME-02 · [MÉDIO] (WIP) Debrief mostra "−100 pts" por fantasma, mas a perda real é outra, e um fantasma pode ficar em 1º
- **Onde:** `web/app.js` (`showResults`: `teamPenalty`, `memberPenalty`, `returnBonus`, `Math.max(150, …)`) · **Confiança:** confirmado (aritmética)
- **Problema:** com score 100 e 4 tarefas, um fantasma leva 1.258 (S+) para 1.026 (A): a perda real é 232, mas o texto diz −100. O piso de 150 esconde parte da penalidade em missões fracas. O `memberPenalty` é igual para todos, então o ranking não muda e aparece "1st · MAYA (GHOST)".
- **Sugestão:** mostrar a perda efetiva e penalizar ou rebaixar só quem ficou. A IA virar fantasma está em SURF-02.

#### GAME-03 · [MÉDIO] Promises de cutscene sem garantia de término
- **Onde:** `web/app.js` (`playDeparture(...).then(finish)`, splashdown); `web/launch.js` (`new Promise(async resolve => …)`) · **Confiança:** suspeita
- **Problema:** uma exceção em `playDeparture` deixa `surf.departing=true` para sempre: o host não mostra resultados e os convidados não recebem `results`. Num executor `async`, um erro deixa a Promise pendente, e o fallback novo do botão de lançar não cobre esse caso.
- **Sugestão:** `Promise.race` com timeout e `.finally`; executor não-async.

#### GAME-04 · [MÉDIO] Ações (`act`) de convidado sem validação
- **Onde:** `web/app.js` (`breaker`, `togglePart`, `stageType`) · **Confiança:** confirmado (medido em Node)
- **Problema:** `act('cockpit','breaker',2e8)` cria um array esparso de 200 milhões de posições. Com isso:
  - `.some()` leva ~19 s por frame;
  - o `JSON.stringify` do snapshot lança RangeError;
  - o voo congela para a sala.

  Com um índice a partir de ~13 mil, o snapshot passa de 64 KB e o servidor derruba o host. O `togglePart` não confere categoria nem slot: aceita tanque no lugar de motor e fura o limite de 4 cabines, e aceita chaves herdadas (`part('constructor')`). `stageType('__proto__', …)` polui `Array.prototype`.
- **Sugestão:** aceitar só índices inteiros dentro do limite; usar `Object.hasOwn(DATA.parts, id)`; validar categoria contra `partsFor`.

#### GAME-05 · [MÉDIO] Convidados recebem textos no idioma e nas unidades do host
- **Onde:** `crewToast` (`net.emit({k:'toast', text})`), `lift`/`info` do lançamento e do aborto, `log: flightLog`, `'ABORT.'` fixo, `lift.pad === 'SPLASHDOWN'` em `web/app.js` · **Confiança:** confirmado
- **Problema:** idioma e unidades são por usuário. Com host em PT e métrico e convidado em EN e imperial, o convidado vê em PT, com vírgula decimal e m/s:
  - os toasts;
  - o log de voo;
  - o título, o detalhe e o pad do debrief de falha;
  - os erros do planner.

  A comparação com `'SPLASHDOWN'` só funciona em inglês.
- **Sugestão:** trafegar `{key, params}` e números crus, e traduzir e formatar em cada cliente.

#### GAME-06 · [MÉDIO] Estado velho da sala faz o convidado pousar com seed e site errados
- **Onde:** `web/app.js` (`clearMission` só em retry e replay; `showScreen('surface')` antes de `syncSurface(true)`; `applySurface` grava a seed só na 1ª vez) · **Confiança:** confirmado por leitura
- **Problema:** depois de um reload do host no meio da missão, o cache da sala continua com o `flight` e o `surface` antigos. Na missão seguinte, a fase chega antes do snapshot novo, e o convidado trava a seed e o site antigos: fica no terreno errado, com os blocos errados.
- **Sugestão:** limpar o estado ao iniciar a missão; enviar o estado antes da fase, ou um id de missão no snapshot.

#### GAME-07 · [MÉDIO] Tecla do piloto remoto fica presa quando ele cai
- **Onde:** `web/app.js` (`remoteInput`; o único `clear()` está em `startFlight`) · **Confiança:** confirmado por leitura
- **Problema:** um convidado que cai segurando W continua "pilotando" até o fim do voo, mesmo depois de o host assumir a vaga. A perda de mensagens na reconexão está em NET-07.
- **Sugestão:** limpar a entrada do assento em `onPeers` (offline ou saiu) e ao trocar de etapa.

#### GAME-08 · [MÉDIO] Mecânicas mortas: módulos pagos sem efeito, ganchos e eventos sem uso, log de voo invisível
- **Onde:** `web/app.js` (`steer`, `shield_storm`, `edl_arm`, `stormShielded`, `hasHera`, `lowDv`, `refuelTank`, `completedPhases`, `astro:cockpit`, `astro:surface`); `#flight-log` ausente do `index.html` · **Confiança:** confirmado
- **Problema:**
  - Nada dispara `steer`, `shield_storm` ou `edl_arm`.
  - O abrigo de tempestade e o HERA custam orçamento, massa e energia, mas só trocam um rótulo: não existe tempestade na fase "Refuel & Solar Storm".
  - `astro:cockpit` é disparado a cada frame e `astro:surface` uma vez, e nenhum dos dois tem ouvinte. O mesmo vale para `astro:lang` e `astro:units` (UI).
  - O log de voo e as 28 chaves `cockpit.logs.*` são calculados e sincronizados, mas `#flight-log` não existe na página, então os alertas de causa e efeito nunca aparecem.
  - A separação de estágio e os disjuntores sem efeito estão em FLT-03.
- **Sugestão:** implementar ou remover as mecânicas e os eventos; devolver o log ao cockpit.

#### GAME-09 · [MÉDIO] Nomes e descrições das peças só em inglês, contra o §9
- **Onde:** `web/app.js:376` (`${p.name}`, `${p.role}` vindos do manifest), `≠ ${partner}` com 'tank'/'engine', `'HARD-DOCK'`/`ALIGN` · **Confiança:** confirmado
- **Problema:** o catálogo inteiro (46 peças) aparece em inglês no modo PT, e não há seção `parts` nos locales. No modo Difícil em PT aparece "Propelentes diferentes do tank instalado".
- **Sugestão:** chaves `parts.<id>.name/role` geradas a partir de `specs.mjs`.

#### GAME-10 · [MÉDIO] Números de balanceamento soltos e duplicados, contra o §4
- **Onde:** `showResults` (6,5, 140, 5, 6, 0,08, piso 150, cortes 1150/950/740 e 360/310/240, bases por membro); limiares de estrelas duplicados; 10 s e 6,5 m duplicados com `views.js`; "20%" e "10 seconds" escritos dentro dos locales · **Confiança:** confirmado
- **Sugestão:** um objeto `SCORING`/`FLIGHT_BALANCE` marcado `game-balance`, com interpolação nos textos.

#### GAME-11 · [BAIXO] Lote de bugs menores
- **Confiança:** confirmado, exceto o último item
- **Relógio:** `clock(59.98)` mostra "00:60", porque usa `Math.ceil(seconds % 60)`.
- **Reconexão:** o convidado que reconecta depois do lançamento perde o resultado (`results` é evento único).
- **Rótulos do convidado:** trocar a unidade (`astro:settings`) salva "Waiting for host" como rótulo, e ao sair da sala 7 botões ficam com esse texto.
- **`aria-disabled`:** `toggleAttribute('aria-disabled', …)` grava valor vazio, que leitores de tela tratam como false.
- **Estrelas do menu:** o rAF roda para sempre com o menu oculto, e um resize apaga as estrelas.
- **`ascentPlan`:** usa o `m0` velho de um estágio fraco, então o cockpit anima um estágio que nunca acende (confirmado com o `metrics()` real).
- **Aba oculta (suspeita):** as regras rodam no rAF do host, então com a aba do host em segundo plano a sala inteira congela.

## 2. Superfície e minigames (`web/views.js`, `web/scout.js`)

#### SURF-01 · [CRÍTICO] Na HEAD, todo pouso falha: `t.hf.at` usa a função de tradução
- **Onde:** `HEAD:web/views.js:818` (corrigido só na working tree, `terrain.hf.at`) · **Tipo:** bug · **Confiança:** confirmado
- **Problema:** o commit 2282c4b (i18n) renomeou `const [t] = await Promise.all(...)` para `[terrain]` mas esqueceu `a.pos.set(x, t.hf.at(x, z), z)`. Dentro de `land()`, `t` é o helper de i18n, então dá `TypeError` na primeira iteração de `CREW_START`. O `catch` mostra "Could not load the terrain", e a fase de superfície fica injogável: 0 de 4 experimentos, só resta "Embarcar e partir".
- **Sugestão:** commitar essa linha já, separada do WIP. Renomear o helper de i18n (por exemplo `tr`) ou os `t` locais (`setTerrain(t)`, `const t = o.net`, `for (let t…)`): foi esse sombreamento que causou o bug. Ver também FLT-01 e GAME (mesmo padrão).

#### SURF-02 · [ALTO] (WIP) Tripulante IA que obedece ao "rush" continua virando fantasma
- **Onde:** [web/views.js](web/views.js) (`rushing = timeLeft <= 10`, `spd = rushing ? WALK : …`, alvos de passeio a `12 + Math.random()*26` m); [web/app.js](web/app.js) (`boardShipAndFinish`) · **Tipo:** bug (resultado errado) · **Confiança:** confirmado (simulação Monte Carlo)
- **Problema:** em 10 s a 2,2 m/s a IA anda 22 m, então só embarca quem estiver a no máximo ~28 m do módulo em T−10 s. O WIP manda a IA passear até ~83 m; na HEAD eram 6 a 24 m, com corte em 35 m. Em solo, P(≥1 fantasma) fica entre 0,67 e 0,74, conforme a dificuldade. Cada fantasma custa −100 na equipe e −40 em cada membro, e o `returnBonus` vira −108. O jogador perde notas por algo que não controla, e o embarque voluntário de qualquer distância não deixa ninguém para trás.
- **Sugestão:** iniciar o retorno de cada NPC por distância (`dist/vel + margem ≥ timeLeft`, a `RUN`) ou não deixar a IA para trás no timeout.

#### SURF-03 · [MÉDIO] (WIP) Quem nunca carrega a superfície vira fantasma garantido
- **Onde:** `CREW_START` (8,5 / 7,7 / 7,8 / 8,5 m do módulo) vs `BOARD_SAFE_R = 6.5` em [web/views.js](web/views.js) · **Confiança:** confirmado
- **Problema:** um convidado sem WebGL, ou com o terreno falhando, nunca envia pose. No host, o avatar dele fica parado em `CREW_START`, fora do raio. Desde a HEAD isso já bloqueava o embarque voluntário (`playersAway`). Com o WIP, esse jogador vira fantasma no timeout, o que fere a regra de funcionar sem WebGL do §4.
- **Sugestão:** ignorar quem nunca carregou, ou começar dentro do raio.

#### SURF-04 · [MÉDIO] (WIP) O fim da missão depende do rAF da superfície no host
- **Onde:** [web/views.js](web/views.js) (`playDeparture` só resolve dentro de `frame()`, que retorna cedo se a aba está oculta ou a superfície inativa) · **Confiança:** confirmado na leitura (o comportamento de aba oculta precisa de navegador)
- **Problema:** com a aba do host oculta, `'depart'` sai mas `'results'` só sai quando ela volta. Os convidados terminam a cena e voltam a `step()`, e ficam num limbo:
  - módulo ~61 m no ar (a posição não é restaurada no fim da cena);
  - corpos reaparecem;
  - capacete visível em 1ª pessoa;
  - prompt preso;
  - relógio congelado.
- **Sugestão:** dirigir a cena por `performance.now()` com `setTimeout` de segurança; no fim, devolver o módulo ao chão ou cobrir a vista até chegar `'results'`.

#### SURF-05 · [MÉDIO] (WIP) Entradas continuam ativas durante a cena de partida
- **Onde:** `const live = () => isActive('surface') && s.ready && !dlg.open` em [web/views.js](web/views.js) (não olha `s.departing`) · **Confiança:** confirmado
- **Problema:** durante a cena:
  - E/Enter abre um minigame, que fica sobre a tela de resultados (o `showResults` não fecha o `<dialog>`);
  - Q abre a roda de emotes;
  - 1 a 4 e V trocam o capacete do avatar em cena;
  - um clique recaptura o ponteiro.
- **Sugestão:** incluir `!s.departing` em `live()`, `openWheel` e `interact()`; fechar o diálogo em `showResults`.

#### SURF-06 · [MÉDIO] (WIP) A cena de partida ignora movimento reduzido
- **Onde:** [web/views.js](web/views.js) (só o `hop` respeita `reduce`) · **Tipo:** acessibilidade · **Confiança:** confirmado
- **Problema:** com `prefers-reduced-motion`, a câmera ainda voa, há tremor `Math.random()`, pluma e luz piscando e braços balançando a ~2,5 Hz. Pré-existente: a pluma do Saturn V do menu pisca mesmo com `reduce`.
- **Sugestão:** com `reduce`, pular a cena ou mostrar um quadro estático.

#### SURF-07 · [MÉDIO] O cartão "Fato real" fecha sozinho em 3,4 s
- **Onde:** `COMPLETE_DELAY_MS = 3400` em [web/views.js](web/views.js) · **Tipo:** acessibilidade · **Confiança:** confirmado
- **Problema:** os fatos têm de 27 a 39 palavras, de 8 a 12 s de leitura. Em solo o relógio já pausa com o diálogo aberto. Mina o objetivo educativo (`docs/minigames.md`) e fere a WCAG 2.2.1.
- **Sugestão:** um botão "Continuar", ou tempo proporcional ao texto.

#### SURF-08 · [MÉDIO] Sem WebGL, os 4 minigames (que são DOM puro) ficam inacessíveis
- **Onde:** `if (!world) return fail(t('surface.needWebgl'))` em [web/views.js](web/views.js) · **Confiança:** confirmado
- **Problema:** os minigames só abrem perto do bloco 3D. Sem WebGL o jogador termina com 0 de 4 (−560 pontos), contra o §4 do AGENTS.
- **Sugestão:** no `fail(needWebgl)`, listar os experimentos como botões que abrem o mesmo diálogo.

#### SURF-09 · [BAIXO] Lote de problemas menores da superfície
- **Confiança:** confirmado
- **Poses remotas vazam para a missão seguinte:** `land()` não zera `o.net`/`o.wasRemote`, então os colegas saltam para a posição final da missão anterior. No host, essa posição velha decide embarque e fantasmas.
- **`takePose` sem validação:** descarta o `from`, então qualquer participante move o astronauta de outro (ver NET-06). Além disso, `spd: "x"` vira `NaN` e quebra a animação de andar até recarregar.
- **(WIP) Velocidade do rush fora da pose:** a pose envia `WALK*.68`, mas no rush a IA anda a `WALK`, e os pés patinam nos convidados.
- **MOXIE com tecla presa:** perder o foco segurando Espaço deixa o reator aquecendo, porque `keyHeat` só zera no `keyup` ([web/scout.js](web/scout.js)).
- **Recursos sem `dispose()`:**
  - geometrias do planner a cada seleção;
  - blocos de experimento a cada pouso;
  - `PMREMGenerator`.

  Também fica um `PointLight` de intensidade 0 permanente na cena: ainda custa iluminação por fragmento no terreno de 129 mil triângulos.
- **Falha de carga fica em cache:** `cache.set(path, fetch(…))` sem `res.ok`/`cache.delete`. No terreno, `delete entry.glb` acontece antes do parse terminar.
- **(WIP) Números soltos e duplicados:** o limiar de 10 s do rush aparece em `views.js`, em `app.js` e no texto do toast; o `?? 6.5` duplica `BOARD_SAFE_R`.
- **Teclado e leitor de tela:**
  - a câmera só gira com mouse ou toque (←/→ fazem strafe);
  - `#scout-board` tem `role="img"` contendo botões;
  - `#bio-board` tem `role="grid"` sem linhas nem células;
  - `#surface-crew` tem `aria-label` fixo em inglês.
- **Arrastar para fora do diálogo:** começar o arrasto dentro e soltar no fundo fecha o minigame e perde o progresso.

#### SURF-10 · [BAIXO] Specs dos minigames e cards "Fato real" divergem das referências
- **Tipo:** docs / dados × fontes · **Confiança:** confirmado (a ordem dos elementos é suspeita)
- **Divergências entre specs e código:**

  | Minigame | Spec (`references/experiments/minigames/`) | Código |
  |---|---|---|
  | L-S1 | faixa verde 785–815 °C, início 0 °C | 780–820 °C, início 750 °C |
  | O-S1 | janela de 20 s | 40 s |
  | M-S1 | exige acerto do SHERLOC | só conta o PIXL |
  | H-S1 | README ainda descreve voo de helicóptero | rota em grade |

  As "0 a 3 estrelas" e a "falha com consequência" de `docs/minigames.md` não existem: todos os minigames são binários e nenhum pode ser perdido.
- **Docs de multiplayer:** `docs/multiplayer.md` ainda diz "more than 35 m" (o código usa 6,5 m) e não documenta `'depart'`.
- **Cards "Fato real":**
  - A ordem O→Si→Fe→Mg→Ca dos elementos da crosta ([web/scout.js:25-32](web/scout.js#L25-L32)) não tem fonte em `references/`. Por Taylor & McLennan, o Al estaria entre os cinco.
  - Os cards de L-S1 e O-S1 usam como fato valores que as referências marcam ⚠: 300 W; "8 min" e "100–250 Mb" por passagem, que são da era Curiosity.

## 3. Cockpit, lançamento e órbita (`web/flight.js`, `web/launch.js`, `web/orbit.js`)

#### FLT-01 · [CRÍTICO] Na HEAD, a plataforma de lançamento e o splashdown travam para sempre (TDZ de `t`)
- **Onde:** `HEAD:web/launch.js:199` + `:227` (`ASTRO_LAUNCHPAD`) e `:362` + `:390` (`ASTRO_SPLASHDOWN`); corrigido só na working tree (`tSec`) · **Tipo:** bug · **Confiança:** confirmado (reproduzido num sandbox Node e conferido no código)
- **Problema:**
  - `t('common.missionPrefix', …)` é chamado antes do `let t = reduce ? COUNT : 0` declarado na mesma função. Isso dá `ReferenceError: Cannot access 't' before initialization`.
  - O executor async rejeita sem handler, e o botão Skip e o Esc nunca são ligados. Todo lançamento (e todo abort) fica preso na plataforma até recarregar, inclusive para os convidados.
  - O mesmo padrão existe na HEAD em `completeSurfaceTask` (`const t = surf.tasks.find(...)` seguido de `t('surface.allDoneToast')`, que dá TypeError), também já renomeado na working tree.
- **Sugestão:** commitar as renomeações já e adicionar lint (`no-shadow`, `no-use-before-define`). Junto com SURF-01, a HEAD não permite completar uma missão. O `Promise.race` de 2,5 s do WIP trata um sintoma, não a causa.

#### FLT-02 · [ALTO] A etapa 02 (acoplamento da cabine) só funciona com teclado e WebGL
- **Onde:** [web/flight.js:399-414](web/flight.js#L399-L414); [web/app.js](web/app.js) (a etapa 1 lê só `keys`; o card diz "keyboard only") · **Tipo:** bug / acessibilidade · **Confiança:** confirmado no código
- **Problema:**
  - **Toque:** na etapa 1 o d-pad (`flight.hold`) é ignorado e o card não tem botões. No celular (390 px é exigido) a etapa sempre falha por tempo: −5 pts, perde +10 e deixa `stageSeparated=false`, o que torna a etapa 03 1,35× mais difícil.
  - **Sem WebGL:** o único retorno é `OFFSET {{dist}}`, sem direção. A etapa 03 também não tem d-pad.
- **Sugestão:** um d-pad de 6 direções (`data-hold`) lido no `flightTick`, e um alvo 2D com x/y quando não houver WebGL.

#### FLT-03 · [MÉDIO] Controles 3D do cockpit ligados a ações mortas ou enganosas
- **Onde:** [web/flight.js:353-366](web/flight.js#L353-L366); [web/app.js](web/app.js) (`stabilize`, `stage_sep`) · **Confiança:** confirmado
- **Problema:**
  - **`EDL_Arm_Switch`:** dispara `stabilize`, que é sobrescrito no tick seguinte; `edl_arm` (bônus TRN/LOFTID) não é alcançável por nenhuma interface.
  - **`Stage_Sep_Switch`:** exige `!portDock`, mas `setFlightStep(1)` sempre cria `portDock`, então o clique sempre cai num toast enganoso e `separationAdvancing` é código morto.
  - **`Breaker_Bank`:** clicar sem nada desarmado loga "reset #1". Os breakers só se resetam pelo clique 3D, então sem WebGL ou só com teclado o alerta da subida não tem ação.
  - **Trim da etapa 03:** não tem custo nem cooldown; cliques repetidos garantem 3 estrelas.
- **Sugestão:** religar ou remover esses controles; botão DOM para os breakers; cooldown no trim.

#### FLT-04 · [MÉDIO] O pódio 3D mostra sempre os props de `action_loop`
- **Onde:** [web/flight.js:606-645](web/flight.js#L606-L645) (o `views.js` esconde `Prop_*`, o `flight.js` não) · **Tipo:** regra §5.4 · **Confiança:** confirmado (código e GLB)
- **Problema:** chave de fenda, notebook, antena e pá aparecem em idle e wave, e no WIP flutuam junto com os fantasmas. Pré-existente.
- **Sugestão:** esconder os props no load e mostrá-los só com `action`.

#### FLT-05 · [MÉDIO] `is-3d` é ligado antes do GLB carregar: uma falha deixa o cockpit ou o pódio pretos
- **Onde:** [web/flight.js:77](web/flight.js#L77) (`makeViewport`); o CSS esconde o fallback 2D · **Confiança:** confirmado (caminho de código)
- **Problema:** se o parse falha (por exemplo, `file://` sem a chave no bundle), o erro vai só para o console. O fallback já foi escondido, e fica uma caixa preta permanente, que no pódio esconde também os astronautas 2D. Com o pódio preguiçoso do WIP, o mesmo vazio aparece em todo primeiro debrief, durante 4 parses e 199 clones de material.
- **Sugestão:** ligar `is-3d` só depois do primeiro render e reverter no `catch`.

#### FLT-06 · [BAIXO] (WIP) Fantasma com cores de identidade trocadas e visual fora da paleta
- **Onde:** `CREW_COLORS` em [web/flight.js:10-15](web/flight.js#L10-L15) · **Confiança:** confirmado
- **Problema:** `lucas: '#52b7ff', oscar: '#f6c445'` estão invertidos em relação a `app.js` e aos GLBs (`#F2A900` / `#1FA2FF`), e a Helena sai laranja. O 2D usa as cores certas, então 2D e 3D divergem. O ciano dos fantasmas (`0xc8f4ff`, `#b8f0ff`, `#19384a`) está fora da paleta, e `docs/visual-identity.md` não foi atualizado, o que o §4 exige no mesmo commit. Há 199 clones de material nunca descartados.
- **Conferido como certo no WIP:**
  - esconder `UpperLeg_*` esconde também a perna inteira;
  - a troca de material não vaza;
  - `astro:results` sempre traz os 4 tripulantes.
- **Sugestão:** usar `ASTRO.crew[].color`, cachear os clones por material e documentar o fantasma.

#### FLT-07 · [BAIXO] Lote de problemas menores de voo e lançamento
- **Confiança:** confirmado
- **Esc do lançamento:** `addEventListener('keydown', onKey, { once: true })` é consumido por qualquer tecla. Apertar Espaço ou W na contagem desativa o Esc anunciado ([web/launch.js](web/launch.js), plataforma e splashdown).
- **(WIP) Fallback da plataforma:**
  - timeout mágico de 2500 ms sem constante nomeada;
  - canvas velho visível no modo só-texto;
  - Promise que fica pendente quando a tela troca.
- **Movimento reduzido incompleto** (`docs/visual-identity.md` §7 pede tela estática):
  - mixers do pódio sempre rodando;
  - alarmes piscando a 2,2 Hz;
  - faíscas;
  - roll da navball;
  - tremor da câmera no lançamento;
  - zoom do fundo na órbita.
- **Faíscas fora do preset:** ignoram o preset `sparks` e aplicam a gravidade de Marte (3,71, solta no código) na decolagem, na Terra (ver MOD-19).
- **Monitor direito:**
  - `'HARD-DOCK'`/`'DOCKING CAMERA'` fixos em inglês, embora exista `cockpit.extDockCam`;
  - o estado do voo anterior continua visível nas etapas seguintes;
  - a navball congela quando `g` é null.
- **Multiplayer:** os textos da plataforma e do debrief chegam traduzidos no idioma do host, e `app.js` compara `lift.pad === 'SPLASHDOWN'` com o texto já traduzido.
- **Cinturão de asteroides retrógrado:** `belt.rotation.y = -time*…` gira ao contrário dos planetas ([web/orbit.js:142](web/orbit.js#L142)).
- **Desempenho:**
  - CanvasTexture reenviada a cada frame;
  - trajetória de transferência recriada a 60 Hz;
  - `computeVertexNormals` de 9.600 vértices por frame, inútil com `flatShading`;
  - ~470 meshes soltos no parque;
  - contexto `high-performance` criado no load e mantido a sessão toda;
  - `bufCache` inútil;
  - torre e clones sem `dispose()`.
- **Evento sem ouvinte:** `astro:cockpit` é disparado ~60×/s e ninguém escuta.
- **Docs:**
  - o NSSDC fornece os períodos e as inclinações (corretos), mas eles não estão tabulados em `references/`;
  - `docs/minigames.md` fala em "extra breaker trip at separation" e em "centre monitor", que não existem;
  - o comentário do pouso diz "input inverted", mas o código não inverte.
- **Layout em 390 px (suspeita):** o FOV fixo do pódio corta o 2º e o 4º lugar nas bordas.

## 4. Interface, i18n e CSS (`index.html`, `web/styles.css`, `web/i18n.js`, `web/settings.js`, `web/units.js`, locales)

#### UI-01 · [MÉDIO] Toasts ficam escondidos atrás do `<dialog>` modal
- **Onde:** `.toast` (`z-index:40`) em `web/styles.css`; `dlg.showModal()` em `web/views.js` · **Confiança:** confirmado pela semântica do top layer, sem teste em navegador
- **Problema:** o modal fica no top layer, acima de qualquer z-index, com um backdrop 82% opaco. No multiplayer o relógio continua com o minigame aberto, então os avisos "10 seconds left!" (WIP), "window reached" e os de rede ficam praticamente invisíveis, e o leitor de tela não os anuncia, porque o resto da página fica inert.
- **Sugestão:** toast como `popover` (top layer) ou renderizado dentro do diálogo aberto.

#### UI-02 · [MÉDIO] Sem o CDN do three.js (por exemplo, `file://` offline), a superfície fica presa
- **Onde:** import map em `index.html:346`; `web/views.js` inteiro num IIFE que aborta em `await import('three')` · **Confiança:** confirmado no código
- **Problema:** o listener `astro:land` e o botão `surface-board` nunca são registrados. O overlay "Touchdown / Loading terrain…" fica fixo, em inglês, e "Board & depart" não faz nada. A missão só termina pelo timer. A chave `surface.loadingTerrain` existe mas não é usada.
- **Sugestão:** `data-i18n` no overlay e um fallback mínimo (mensagem e embarque) fora do IIFE 3D.

#### UI-03 · [BAIXO] (WIP) Pódio fantasma 2D: CSS anulado, contraste baixo, cores fora da paleta
- **Onde:** `.podium-step.is-ghost`, `.is-ghost-tag` e `filter:hue-rotate(155deg)` em `web/styles.css` · **Confiança:** confirmado
- **Problema:** o `style="background:${r.color}"` inline vence `.podium-step.is-ghost{background:var(--f3)}`. O texto fica creme sobre a cor do tripulante com `opacity:.78`, contraste de ~1,6:1 no Lucas. `#b8f0ff` e `#19384a` estão fora da paleta, e `docs/visual-identity.md` não foi atualizado (§4).
- **Sugestão:** não aplicar o fundo inline quando `stranded`; usar os tokens e documentar o fantasma.

#### UI-04 · [BAIXO] Oito `aria-label` fixos em inglês
- **Onde:** `index.html:119, 134, 135, 162, 179, 198, 227, 257` ("Rocket assembly", "Part categories", "Crew member you control"…) · **Confiança:** confirmado
- **Sugestão:** `data-i18n-aria` com chaves nos locales.

#### UI-05 · [BAIXO] i18n: PT aparece tarde, i18next redundante e sem SRI, fallback sem plurais
- **Onde:** `web/i18n.js:102-106`; `index.html:336, 341, 346` · **Confiança:** confirmado no código
- **Problema:** o `applyDOM` espera o `DOMContentLoaded`, que só dispara depois do `index.models.js` (4,5 MB, síncrono) e do i18next do CDN, que bloqueia o parser. Durante o carregamento a interface aparece em inglês. Os CDNs (i18next e three) não têm `integrity`. O fallback já cobre tudo o que o jogo usa, mas diverge do i18next numa variável ausente (`''` contra `{{x}}`). Sem plurais, aparecem "1 PARTS INSTALLED" e "1 packets selected".
- **Sugestão:** aplicar `applyDOM()` de imediato (os scripts já estão no fim do body); hospedar o i18next localmente ou removê-lo; SRI nos CDNs.

#### UI-06 · [BAIXO] Foco e teclado
- **Confiança:** confirmado
- **Idioma:** `renderLanguageButtons` recria os botões e o foco se perde depois do Enter.
- **Outline cortado:** `.emote-wheel button`, `.surface-prompt` e `.surface-jump` usam `clip-path`, que corta o outline.
- **`#bio-board`:** `role="grid"` sem linhas nem células e com 48 paradas de Tab.
- **Preview do servidor:** o `aria-live` anuncia a cada tecla.

#### UI-07 · [BAIXO] Unidades: zero negativo, unidade fixa no texto e fallbacks duplicados
- **Onde:** `web/units.js:29-43`; fallbacks em `web/app.js:7-22`, `web/scout.js:10-15`, `web/views.js:475` · **Confiança:** confirmado (VM)
- **Problema:**
  - `number(-0.3)` dá "-0", `velocityMs(-0.1)` dá "-0 ft/s" e `money(-0.04)` dá "−$0M".
  - `tempRangeC(null,820)` dá "32–1.508 °F".
  - O fato do MOXIE fixa "12 g/h" ao lado de `{{total}}` em oz.
  - Os três fallbacks reimplementam a API sem locale e sem os mesmos arredondamentos.
- **Sugestão:** normalizar −0 e remover os fallbacks.

#### UI-08 · [BAIXO] Interface vazia e CSS morto
- **Confiança:** confirmado (script e grep)
- **Inventário:** o rótulo "Inventory" aparece sempre com `#surface-inventory` vazio.
- **Elementos sempre ocultos:** `#flight-exterior` e `#docking-monitor` são sempre forçados a `hidden`. As ~30 linhas de CSS deles estão mortas, e são justamente as que usam blur, glow e `border-radius:50%`.
- **Seletores sem uso:** `.icon-button`, `.menu-kicker`, `.menu-desc`, `.telemetry-note`, `.breaker-grid`, `.breaker-btn`, `.tripped`, `.inv-slot`, `.rocket-stage.off`, entre outros.
- **Chaves de locale sem uso:** `common.ai`, `surface.loadingTerrain`, `surface.doneLower`, `minigames.experiment`, `minigames.moxie.badgeInitial`.

#### UI-09 · [BAIXO] Identidade visual violada no CSS vivo, e o doc se contradiz
- **Confiança:** confirmado
- **No CSS:**
  - 76 cores literais fora da paleta, por exemplo `.button.amber` com `#fbbf24` e `#fde68a`;
  - hex da paleta escrito em vez de `var()`;
  - brilho difuso `0 0 24px` em `.launchpad-count` e text-shadow difuso em `.compass-readout`;
  - fonte emoji na roda de emotes;
  - "Earth · unavailable" no seletor, embora a Terra seja a origem.
- **No doc:** proíbe emoji mas descreve 👋🚶🧍; fala em título de 3 linhas, mas o HTML tem 2; diz que `RAMPS` está no `index.html`, mas fica no `app.js`.
- **Pódio 2D a 390 px (suspeita):** SVG de 112 px em colunas de ~70 px, então os astronautas se sobrepõem.

## 5. Multiplayer (`multiplayer/`, `web/net.js`)

Testes: 19/19 passam. Os probes abaixo rodaram contra servidores locais em porta aleatória; a VM real não foi acessada.

#### NET-01 · [CRÍTICO] Uma mensagem com JSON muito aninhado derruba o servidor
- **Onde:** `multiplayer/rooms.mjs:174` (`checkMeta` → `JSON.stringify`); `multiplayer/server.mjs:51` e `:68` (`hub.handle` sem try/catch) · **Confiança:** confirmado (reproduzido no Node 24; o Node 22 da VM tem o mesmo stringify recursivo)
- **Problema:** `{"v":1,"t":"create","meta":{"a":[[[…6000 níveis…]]]}}` tem 11,7 KiB, abaixo do limite de 16 KiB. O `JSON.parse` aceita, mas o `stringify` estoura a pilha (`RangeError`). A exceção vira `uncaughtException`, o processo sai, e todas as salas, que vivem só em memória, somem. O mesmo vale para `pose`, `act`, `event`, `send` e `state` com algum destinatário, e para um `state` guardado, que explode no `welcome` do próximo `join`. Não é preciso estar numa sala nem mandar Origin, e o atacante pode repetir em loop a cada restart do systemd (2 s).
- **Sugestão:** limitar a profundidade (por exemplo, 32) logo após o `JSON.parse` e responder `bad-message`; colocar try/catch em `hub.handle` e em cada `send`, fechando só o socket culpado.

#### NET-02 · [CRÍTICO] `{"t":"__proto__"}` derruba o servidor
- **Onde:** `multiplayer/rooms.mjs:42` (`const handler = IN_ROOM[t]`) e `:201` · **Confiança:** confirmado (reproduzido)
- **Problema:** `IN_ROOM` herda de `Object.prototype`. Depois de um `create`, `__proto__`, `__defineGetter__` ou `__defineSetter__` fazem `handler.call` lançar TypeError, e o processo sai. Já `constructor`, `toString` e `valueOf` são aceitos em silêncio. Duas mensagens (17 bytes) bastam para derrubar todas as salas.
- **Sugestão:** `Object.hasOwn(IN_ROOM, t)` (ou um `Map`) e o try/catch do NET-01.

#### NET-03 · [ALTO] Um cliente esgota a memória: ~5,6 MiB retidos por sala, OOM com ~91 salas
- **Onde:** `multiplayer/rooms.mjs:235-256`; `multiplayer/config.mjs:19-22`; `deploy/astro-rooms.service:33` (`MemoryMax=512M`) · **Confiança:** confirmado por medição
- **Problema:** o hub guarda o objeto já parseado: 16 `state` mais 1 `pose` de `[{},{},…]` ocupam 5,65 MiB, uma expansão de ~20×. Com ~91 conexões, cada uma criando uma sala e mandando 17 mensagens (cabem no burst), o cgroup mata o processo. Agravantes: `sendTo` não olha `bufferedAmount`, e cada relay é re-serializado para cada destinatário.
- **Sugestão:** guardar o texto bruto com orçamento de bytes por sala (por exemplo, 256 KiB); limitar salas e conexões por IP; serializar uma vez por broadcast.

#### NET-04 · [ALTO] Um cliente lota `MAX_ROOMS` em menos de 1 s, sem manter sockets
- **Onde:** `multiplayer/rooms.mjs:80` e `:64` (grace de 30 s); `multiplayer/server.mjs:50-52` · **Confiança:** confirmado (500 salas em 816 ms)
- **Problema:** basta repetir conectar, `create` e `terminate`. A sala do host que caiu vive 30 s, então repetindo a cada ~25 s ninguém mais cria sala (`too-many-rooms`). Não há limite por IP nem limite global de conexões.
- **Sugestão:** limites por IP (X-Forwarded-For do Caddy só quando o peer for 127.0.0.1) e grace curto para sala sem convidados.

#### NET-05 · [ALTO] XSS por link (`?server=`) e por host malicioso; sem CSP
- **Onde:** `web/app.js:176` (`${net.code}` em innerHTML), `:305`/`:107` (ids crus do foguete), `applySetup`, `lift.detail`, `refuelDone`; `web/net.js:21, 57, 144`; `multiplayer/client/room-client.js:255`; `web/i18n.js:41` (`escapeValue:false`) · **Confiança:** fluxo confirmado (VM com WebSocket falso); não executado em navegador
- **Problema:**
  - **Link malicioso:** `https://sabor-pinguim.github.io/astro-romana/?server=wss://atacante/ws&room=ABCD` conecta sozinho no carregamento. O servidor do atacante devolve `code:"<img src=x onerror=…>"`, que executa no `renderRoom()` na origem `*.github.io`. O script pode gravar um `serverUrl` malicioso no localStorage e sequestrar as visitas seguintes.
  - **Host malicioso numa sala legítima:** injeta HTML em todos os convidados via ids em `setup.rocket` (o `applySetup` só confere se os campos são arrays), `lift.detail` ou `refuelDone`.
  - Nem o `index.html` nem o `Caddyfile.site` definem CSP.
- **Sugestão:** helper `esc()` para todo dado de rede; validar `code` (`/^[A-Z0-9]{4}$/`) e os ids de peças; confirmação ou allowlist para `?server=`; CSP no Caddy.

#### NET-06 · [MÉDIO] O cliente ignora o carimbo `from` em `pose` e `msg`
- **Onde:** `web/views.js` (`on('pose', data => takePose(data))`); `web/app.js` (`net.on('msg', …toast…)`) · **Confiança:** confirmado
- **Problema:** um convidado manda `pose {av:{oscar:{x:80,…}}}` e teletransporta o astronauta de outro jogador em todas as telas, inclusive no host, onde essa posição decide embarque e fantasmas. Qualquer peer exibe toasts falsos "do host" para todos, até 60 vezes por segundo (sem XSS, porque usa `textContent`). Também, `spd` inválido vira NaN (SURF-09).
- **Sugestão:** aceitar `av[id]` só de `surf.control[id] === from.id` (ou do host, para a IA), e toast só do host.

#### NET-07 · [MÉDIO] Mensagens enviadas durante a reconexão somem em silêncio
- **Onde:** `multiplayer/client/room-client.js:158-161` (`raw()` devolve false, sem fila); `web/app.js` (`sendInput`, tarefas, `resumed`) · **Confiança:** confirmado por leitura
- **Problema:**
  - O `keyup` perdido deixa uma tecla presa (GAME-07).
  - Um minigame concluído durante a queda volta a "não feito".
  - O host que editou algo durante a queda recebe no `resumed` a cópia antiga do servidor (`applySetup(cached, true)`).
  - Cada `act` com o host fora vira o toast "Room error: host-offline.".
- **Sugestão:** fila para `act` e `setState`, reenviada após o `resumed`; zerar `sentInput` ao reconectar.

#### NET-08 · [MÉDIO] A tela de Configurações vira fase da sala, e Salvar ou Restaurar derruba a sala do host
- **Onde:** `web/app.js:136` e `:466`; `web/net.js:100-111` (`setServerUrl` faz `room.close()` sem comparar a URL); `web/settings.js:117-156` · **Confiança:** confirmado
- **Problema:** abrir Configurações publica a fase `settings`, que não é joinável, e quem tenta entrar recebe "The mission already launched.". Clicar "Save server" (mesmo sem mudar nada), "Reset default" ou "Reset all defaults" fecha a sala de todos (`host-left`), sem aviso. A lista de fases está copiada em três arquivos, e o `joinable` do `welcome` é ignorado.
- **Sugestão:** tratar Configurações como tela local; só fechar a sala se a URL efetiva mudar, com confirmação.

#### NET-09 · [MÉDIO] Endereço do servidor: convite incompleto, `ws://` em página https, `?server=` cru
- **Onde:** `web/app.js:177`; `web/net.js:21-44, 57, 112-120`; `web/settings.js:74-80, 130-138` · **Confiança:** confirmado por probe
- **Problema:**
  - **Convite:** com servidor salvo nas Configurações, o link sai sem `server`, e o amigo cai no servidor padrão e vê "Room not found".
  - **Normalização:** `192.168.1.50:8787` vira `ws://…` (o exemplo do placeholder), e `myhost:80` vira `ws://myhost:8787/ws`, trocando a porta em silêncio.
  - **Mixed content:** no Pages e na VM, que são https, o `ws://` é bloqueado, e o preview mostra o endpoint como válido.
  - **`?server=` sem esquema:** lança SyntaxError.
  - **Toasts:** mostram o código numérico do DOMException ("Room error: 18.").
- **Sugestão:** incluir `server` no convite; forçar `wss://` em página https e manter a porta digitada; normalizar o `?server=` com a mesma função.

#### NET-10 · [MÉDIO] Escolha automática da URL trata qualquer host fora de `github.io` como se fosse a VM
- **Onde:** `web/net.js:16-20` · **Confiança:** confirmado por probe
- **Problema:** `https://astro-romana.web.app/` vira `wss://astro-romana.web.app/ws`, e um servidor estático na LAN vira `ws://192.168.0.10:5500/ws`. A alternativa "Cloud Run + Firebase Hosting" do `multiplayer/README.md` não funciona, e um domínio próprio no Pages (já houve CNAME) quebraria do mesmo jeito.
- **Sugestão:** usar o próprio host só quando a página souber que está na VM (configuração gerada pelo `setup.sh`).

#### NET-11 · [MÉDIO] Host que recarrega no meio da missão manda todos para o menu
- **Onde:** `web/app.js` (`resumed` do host: `net.setPhase(state.screen)`, com `state.screen` inicial igual a `'menu'`) · **Confiança:** confirmado por leitura
- **Problema:** um reload do host no cockpit ou na superfície publica a fase `menu`, e os convidados executam `leaveMission`. O `docs/multiplayer.md` promete que o host volta "with the assembly and the screen". Os estados velhos continuam em cache (GAME-06).
- **Sugestão:** documentar a limitação e limpar os estados, ou guardar um snapshot retomável.

#### NET-12 · [MÉDIO] Códigos de sala enumeráveis e sem limite de tentativas
- **Onde:** `multiplayer/config.mjs:32-33` (31⁴ = 923.521 códigos); `multiplayer/rooms.mjs:99-118` · **Confiança:** confirmado por leitura (varredura não executada)
- **Problema:**
  - **Varredura:** com 50 conexões (~3.000 tentativas/s), o espaço inteiro sai em ~5 min, e um `join` que falha não fecha o socket.
  - **Efeito de um acerto:** o estranho ocupa uma vaga livre, muda o foguete (`act rocket`) e manda toasts.
  - **Vazamentos:** `room-full` e `in-progress` revelam que a sala existe, e o `/health` público publica quantas salas estão abertas.
- **Sugestão:** códigos de 6 ou mais caracteres; limitar falhas de `join` por IP; tirar a contagem do `/health`.

#### NET-13 · [MÉDIO] Request-target malformado derruba o Node exposto diretamente
- **Onde:** `multiplayer/server.mjs:25` e `:41` (`new URL(req.url, …)` sem try/catch) · **Confiança:** confirmado localmente
- **Problema:** `GET http://[ HTTP/1.1` lança `TypeError: Invalid URL` e o processo sai. Atrás do Caddy isso não chega ao Node, mas o `HOST` padrão é `''` (todas as interfaces), justamente o uso na LAN sugerido pelo placeholder.
- **Sugestão:** try/catch e resposta 400.

#### NET-14 · [MÉDIO] `setup.sh` não é idempotente na detecção de mudanças
- **Onde:** `multiplayer/deploy/setup.sh:100-115, 149` (`changed=$(git diff --name-only "$before" HEAD)`) · **Confiança:** confirmado por leitura
- **Problema:** se uma execução faz pull e falha no `npm ci`, a seguinte vê `changed` vazio e não instala nem reinicia: o servidor fica no código velho sem aviso. No sentido contrário, mudar só o README, os testes ou a demo reinicia o serviço e derruba as partidas em andamento.
- **Sugestão:** gravar a última revisão implantada (`/etc/astro-romana/deployed-rev`) e reiniciar só por mudança de runtime.

#### NET-15 · [MÉDIO] Endereço da VM fixo no código e origens permitidas frágeis
- **Onde:** `web/net.js:11` (`NET_SERVER = 'wss://35-193-156-110.sslip.io/ws'`); `docs/multiplayer.md:39`; `multiplayer/deploy/setup.sh:44, 124`; `multiplayer/server.mjs:39-43` · **Confiança:** confirmado (grep e código); região e IP efêmero são suspeita
- **Problema:** uma troca de IP exige mexer junto em:
  1. `net.js` e a doc;
  2. republicar o Pages;
  3. rodar de novo o `setup.sh`;
  4. o `EXTRA_ORIGINS` exato (`https://sabor-pinguim.github.io`, que não está escrito em lugar nenhum).

  Cópias `file://` antigas e `serverUrl` salvos no navegador quebram. A comparação de origem é exata e sensível a maiúsculas: barra final ou `/astro-romana` passam na regex mas nunca casam, e o resultado é 403. O IP já mudou uma vez.
- **Sugestão:** domínio próprio ou um arquivo único de configuração do endereço; normalizar as origens em `loadConfig`.

#### NET-16 · [MÉDIO] Lacunas de teste
- **Onde:** `multiplayer/test/*.mjs` · **Confiança:** confirmado
- **Problema:** os 19 testes cobrem o caminho feliz e limites simples. Falta cobrir:
  - os crashes de NET-01, 02 e 13;
  - limites por IP e orçamento de memória;
  - o heartbeat encerrando socket mudo;
  - a desistência da reconexão (`lost`) e o `resume` depois que a sala fechou;
  - o canal `meta`;
  - conexões sem Origin.

  `rejoin()` nunca roda, porque o Node não tem `sessionStorage`. Nada testa `web/net.js` nem o protocolo do jogo, e o script Playwright do `docs/multiplayer.md` não existe. O teste de path traversal (`/../config.mjs`) não testa nada, porque o `fetch` normaliza a URL.
- **Sugestão:** começar pelos testes de regressão dos crashes, com socket cru.

#### NET-17 · [BAIXO] Lote menor do multiplayer
- **Confiança:** confirmado
- **Origin:** a allowlist aceita requisições sem Origin e, em produção, `null`. Qualquer site pode usar um `<iframe sandbox>` para criar salas ou varrer códigos pelo navegador do visitante.
- **Erros sem tradução:** `lost`, `bad-token`, `host-offline`, `rate-limited` e `bad-version` aparecem crus ("Room error: lost."), e o mapa `ERRORS` em inglês do `net.js` duplica os locales.
- **`leave()` durante a reconexão:** não chega ao servidor (a vaga fica presa 30 s) e depois lança TypeError, porque `this.you` já é null.
- **VM:** é criada com a conta de serviço padrão do Compute; usar `--no-service-account --no-scopes`.
- **`?room=`:** fica na URL depois de "Leave", e um reload entra de novo na sala.
- **`create`/`join` com erro sem `ref`:** deixam o `pending` preso.
- **Checkout publicado:** a VM serve o checkout inteiro (`docs/`, `tools/`, `references/`, código do servidor).
- **Docs:**
  - `docs/multiplayer.md` diz "for now up to the planner", embora os itens 5 e 6 estejam ✅;
  - não documenta a precedência `?server=` > Configurações > padrão;
  - diz que todo erro traz `ref`, o que é falso;
  - o checklist do AGENTS.md não inclui `cd multiplayer && npm test`.

## 6. Pipeline de modelos 3D (`tools/modeling/`, `tools/web/`, `tools/model-viewer/`)

#### MOD-01 · [ALTO] `npm run web:sites` está quebrado: importa uma função que não existe mais
- **Tipo:** bug · **Onde:** [tools/web/site-photos.mjs:9](tools/web/site-photos.mjs#L9) · **Confiança:** confirmado (reproduzido: `does not provide an export named 'readRegion'`)
- **Problema:** o commit 48c4bc9 trocou `readRegion` por `readWindow` + `regionFromWindow` em `tools/terrain/lib/raster.mjs` e só atualizou o `build-terrain.mjs`. O script falha já na carga do módulo, antes de qualquer rede. As fotos em `assets/sites/` (marcadas como GERADAS) não podem mais ser regeneradas, por exemplo para um local de pouso novo. O `node --check` não detecta erro de import.
- **Sugestão:** `regionFromWindow(await readWindow(cog, pickLevel(...), borderPoints(...)))`, como em `build-terrain.mjs:81-83`. Um smoke test que importa cada script de `tools/` evitaria a repetição.

#### MOD-02 · [ALTO] MMRTG: pico de 900 W da bateria somado como geração contínua e rotulado "real"
- **Tipo:** dado × fonte · **Onde:** [tools/modeling/parts/specs.mjs:517](tools/modeling/parts/specs.mjs#L517) (fonte em `:524`); soma em [web/app.js:231](web/app.js#L231) · **Confiança:** confirmado
- **Problema:** `powerW: 900` tem a fonte `'real (… 110 W continuous / 900 W peak buffer)'`, e `references/parts/stage-equipment.md` dá "+110 contínuos / 900 de pico". O planner soma todo `powerW > 0` como geração contínua (`gen += s.powerW`), então o módulo vale cerca de 8 vezes o MMRTG real e aparece como "+900 W" sem ⚠. A massa (71,5 kg) é a do MMRTG com bateria, não a de um Kilopower (150 a 400 kg), que justificaria 1 kW.
- **Sugestão:** usar 110 W como valor real, ou marcar 900 W como `game-balance` (Kilopower) e ajustar a massa.

#### MOD-03 · [MÉDIO] Tanques do Electron e do Falcon 9 usam a massa do estágio inteiro, e o jogo soma os motores outra vez
- **Tipo:** dado × fonte · **Onde:** [specs.mjs:309](tools/modeling/parts/specs.mjs#L309) (Electron, 950 kg) e [specs.mjs:341](tools/modeling/parts/specs.mjs#L341) (F9, 22.200 kg); soma em [web/app.js:233-236](web/app.js#L233-L236) · **Confiança:** confirmado
- **Problema:** os próprios READMEs dizem "Whole stage dry mass… Includes 9 engines… For the game, subtract 9 × Rutherford mass" (Electron) e "Whole stage empty (engines, legs, grid fins, interstage included)" (F9). O planner faz `hw += n*e.massDryKg` e depois `hw += t.massDryKg`, além da `booster-thrust-section`. São cerca de 315 kg a mais no Electron (33% da massa do tanque) e cerca de 4,2 t no F9, o que distorce o Δv e o TWR. O `centaur-iii-tank` fez a subtração (`derived`), então o critério muda de tanque para tanque.
- **Sugestão:** subtrair motores e acessórios e marcar como `derived`/`est.`, como no Centaur.

#### MOD-04 · [MÉDIO] Metas de Δv sem rótulo, e a de transferência diverge das referências
- **Tipo:** inconsistência / regra §4 · **Onde:** [specs.mjs:14-15](tools/modeling/parts/specs.mjs#L14-L15) · **Confiança:** confirmado
- **Problema:** `earthOrbitDeltaVMs: 9400` e `marsTransferDeltaVMs: 4300` aparecem para o jogador e no README, mas a `note` não os classifica nem como reais nem como `game-balance`. `references/parts/parts.md:228-229` dá LEO "9–10 ⚠" e TMI 3,6 km/s (3,9 para C3 = 15). Nenhuma referência tem 4.300.
- **Sugestão:** marcar como `game-balance` ("3,6 km/s Hohmann + margem") ou usar o valor de `parts.md` com a fonte.

#### MOD-05 · [MÉDIO] Quase metade dos números de `specs.mjs` sem rótulo, e o Rutherford tem valores de vácuo implausíveis
- **Tipo:** regra §4/§8 · **Onde:** [specs.mjs:36-48](tools/modeling/parts/specs.mjs#L36-L48); checagem fraca em [validate.mjs:223](tools/modeling/validate.mjs#L223) · **Confiança:** confirmado (script)
- **Problema:** 162 de 358 números não têm rótulo, entre eles `defaultClusterCount` (13 motores), massas de combustível e oxidante (8 tanques) e `dataRateKbps` (21 peças). O validador só exige que `sources` não esteja vazio. No Rutherford, o README diz `thrust_vac`/`isp_vac` = n/f, mas o spec tem `thrustVacKn: 25.8` (copiado do Rutherford Vacuum) e `ispVacS: 311`, igual ao de nível do mar. Esse Isp entra no Δv (`isp = (ispSlS + ispVac)/2`, [app.js:239](web/app.js#L239)). O §8 pede que n/f vire valor de jogo marcado.
- **Sugestão:** rotular cada campo e fazer o validador checar cobertura por campo.

#### MOD-06 · [MÉDIO] `comm-electra-marco`: 24,5 kg sem base nas fontes citadas
- **Tipo:** dado × fonte · **Onde:** [specs.mjs:576](tools/modeling/parts/specs.mjs#L576) (fonte em `:584`) · **Confiança:** confirmado
- **Problema:** a fonte diz "~6.5 kg Electra + 2×9 kg MarCO", mas `mars-experiments.md` dá a massa do Electra como n/f e não informa a do MarCO. `stage-equipment.md:206` diz "13.5 kg each… ~33.5 kg total ⚠", e `experiments.md:711` diz "Mass n/f". As referências divergem entre si, e 9 kg por MarCO não aparece em nenhuma.
- **Sugestão:** alinhar com a fonte (2 × 13,5 + 6,5) e corrigir o E12.

#### MOD-07 · [MÉDIO] O validador deixa passar várias regras do AGENTS.md
- **Tipo:** débito técnico · **Onde:** [tools/modeling/validate.mjs:50-89](tools/modeling/validate.mjs#L50-L89), `:137-154`, `:272` · **Confiança:** confirmado
- **Problema:** a checagem de pivôs, clips e orçamento é circular: lê `conventions.pivots`, `requiredClips` e `budget.triangles` do manifest que o próprio gerador escreve. Se alguém renomear `Torso` no `RIG`, a validação passa e `getObjectByName('Torso')` em [web/views.js](web/views.js) quebra em silêncio. A hierarquia dos pivôs não é checada. Várias regras não têm checagem:
  - materiais só da paleta em avatares e peças (só os corpos são checados);
  - geometria não indexada com normal por face;
  - escala negativa;
  - `pose(0) == pose(1)` nos loops;
  - `extras.fx` das âncoras de avatar;
  - texturas no JSON do glTF;
  - cilindros de 5 a 10 lados.

  Os nós que o jogo usa (`Navball`, `Closed`, `Stowed_*`, `View_Window`) também não são exigidos. E só é validado o que está no manifest: GLBs órfãos, como o Saturn V (MOD-08), nunca passam pela checagem. Hoje todos os GLBs listados passam nessas regras; o risco é latente.
- **Sugestão:** importar `RIG` e o orçamento dos fontes, adicionar as checagens que faltam e varrer todos os `assets/models/**/*.glb`.

#### MOD-08 · [MÉDIO] Saturn V do menu: GLB sem gerador, fora da paleta, nunca validado e sem procedência
- **Tipo:** regra §5.1/§5.3 · **Onde:** `assets/models/rocket/saturn_v_lowpoly.glb`, carregado em [web/views.js:53](web/views.js#L53) · **Confiança:** confirmado
- **Problema:** entrou no commit adfd158 (2026-11-14, só o binário, ainda na pasta do Godot) e foi movido em 81ba706. O `asset.generator` do glTF diz "Astro-Romana Low-Poly Saturn V Generator", mas esse código nunca foi commitado (`git log --all -S`). O modelo tem 7 materiais próprios fora de `palette.mjs` e não está em nenhum manifest, então o `validate.mjs` nunca o vê. Isso contradiz o README ("Every model… generated by code, never edited by hand") e o `references/README.md`, que também não registra a origem, importante para o formulário do Space Apps.
- **Sugestão:** commitar o script gerador, se existir, ou portar para `tools/modeling` com a paleta e entrar no manifest. No mínimo, registrar a origem e corrigir as duas frases.

#### MOD-09 · [MÉDIO] Os bundles podem ficar desatualizados em silêncio, e o jogo sempre os prefere
- **Tipo:** débito técnico / desempenho · **Onde:** [package.json:21](package.json#L21) (`terrain` não chama `web:models`); [tools/web/bundle-models.mjs:22](tools/web/bundle-models.mjs#L22) · **Confiança:** confirmado
- **Problema:** `npm run terrain`, `models:build -- maya` e `models:build:parts` regeneram os assets mas não `index.models.js` nem `index.terrain.*.js`. O jogo (inclusive via HTTP no VM) continua com o modelo antigo, e nada acusa a divergência. GLBs referenciados por template (`characters/${id}.glb`) escapam da regex que monta o bundle. O base64 soma 33%: os terrenos viram 6,3 MB por sítio (acima do limite de 5 MB do §10), e o `index.models.js` de 4,4 MB é carregado de forma síncrona no `<head>`. Hoje os bundles estão em sincronia: a regeneração da auditoria gerou bytes idênticos.
- **Sugestão:** um `web:models --check` que falha se o bundle diverge; encadear `web:models` em `terrain` e nos builds parciais; via HTTP, preferir `fetch` aos bundles.

#### MOD-10 · [MÉDIO] A Terra low poly (1,7 MB) não é usada pelo jogo, mas o README diz que é
- **Tipo:** docs · **Onde:** [README.md:90](README.md#L90); `assets/models/bodies/earth.glb` · **Confiança:** confirmado
- **Problema:** a tabela "In the game" lista "Low-poly Earth | MODIS land cover, ETOPO1 relief, AMSR2 sea ice". Nada em `web/` nem no `index.html` referencia `bodies/`, e a regex do bundle nem inclui essa pasta. O mapa orbital usa um icosaedro com continentes fictícios. Material de submissão atribui ao jogo um uso de dados reais que não existe.
- **Sugestão:** integrar o GLB à cena de órbita ou de lançamento, ou corrigir o README.

#### MOD-11 · [MÉDIO] Visualizador de modelos: manifest errado no Firefox/Safari, TypeError a cada tecla, sem os corpos
- **Tipo:** bug · **Onde:** [tools/model-viewer/index.html:612-617](tools/model-viewer/index.html#L612-L617), `:1075`, `:575` · **Confiança:** confirmado
- **Problema:**
  - Ao escolher a raiz do repositório, opção que a interface oferece, `fileListSource` pega o `manifest.json` de caminho mais curto. Esse arquivo é `assets/audio/manifest.json` ou `assets/sites/manifest.json`, não `assets/models/manifest.json`. As listas ficam vazias, aparece "Invalid Date", e `state.manifest?.models.map` lança TypeError a cada tecla.
  - Com `?manifest=parts/manifest.json`, os GLBs dão 404.
  - `manifest.bodies` é ignorado, então a Terra não pode ser conferida como pedem os §5.7 e §5.8.
  - `MANIFEST_PATHS` tem um item duplicado.
- **Sugestão:** priorizar `assets/models/manifest.json`, usar `(state.manifest?.models ?? [])` e listar os `bodies`.

#### MOD-12 · [BAIXO] O README promete 55 peças no construtor, mas ele oferece 46
- **Tipo:** docs / código morto · **Onde:** [README.md:55](README.md#L55); filtro duplicado em [web/app.js:316](web/app.js#L316) e [tools/web/bundle-models.mjs:17](tools/web/bundle-models.mjs#L17) · **Confiança:** confirmado
- **Problema:** são geradas 55 peças, mas o `partsFor` e o filtro do bundle oferecem 46: 8 dos 13 motores e 5 dos 8 tanques. Os motores MR-107, R-4D, NSTAR, AJ10-190 e NEXT-C e os tanques de hidrazina, Dawn (xenônio) e Orion ESM são gerados, documentados e commitados, mas nunca aparecem no jogo. O filtro está duplicado em dois arquivos ("Same filter as the builder"), o que convida a divergência. Os cabeçalhos estão desatualizados (`build-parts.mjs:1` diz "52 parts", `specs.mjs:1` diz "49"). O `cockpit-pilot.glb` existe em duas cópias idênticas de 373 KB (`parts/cockpit/` e `rocket/`).
- **Sugestão:** corrigir o README ("55 modeladas, 46 no construtor") ou oferecer as peças in-space; centralizar o filtro numa flag do manifest (`offered: true`).

#### MOD-13 · [BAIXO] `dataRateKbps` mistura volume com taxa, com erros de ordens de grandeza
- **Tipo:** unidades · **Onde:** [specs.mjs:626](tools/modeling/parts/specs.mjs#L626), `:641`, `:656` · **Confiança:** confirmado
- **Problema:** o PIXL/SHERLOC/SuperCam tem `111200`, a partir de "Mb por experimento". O SEIS tem `38000`, a partir de "38 Mb/day", que dá cerca de 0,44 kbps, 86.400 vezes menos. O jogo ainda não usa esses valores, mas o visualizador os mostra ("111.2 Mbps"), e o orçamento de dados previsto nos docs herdaria o erro.
- **Sugestão:** converter para kbps reais ou criar um campo de volume por experimento.

#### MOD-14 · [BAIXO] `site-photos.mjs`: manifest reescrito parcialmente, lista de sítios fixa, sem timeout
- **Tipo:** bug / débito · **Onde:** [tools/web/site-photos.mjs:15](tools/web/site-photos.mjs#L15), `:48-60` · **Confiança:** confirmado
- **Problema:** rodar o script só para `gale` apaga a entrada do `jezero` do `assets/sites/manifest.json`. Os sítios (`['jezero','gale']`) e a licença (`'CC0-1.0'`) estão fixos no código, sem crédito NASA/JPL/UArizona. Os `fetch` não têm timeout nem retry.
- **Sugestão:** mesclar com o manifest anterior, derivar os sítios da mesma fonte que o bundle e usar `AbortSignal.timeout`.

#### MOD-15 · [BAIXO] Downloads sem timeout nem escrita atômica; requisito de Node subestimado
- **Tipo:** débito técnico · **Onde:** [tools/modeling/fetch-bodies.mjs:25-36](tools/modeling/fetch-bodies.mjs#L25-L36); `import.meta.dirname` em `bundle-models.mjs:12` e `site-photos.mjs:13`; [package.json:7](package.json#L7) · **Confiança:** confirmado
- **Problema:** se o 3º download falha, os grids ficam com safras misturadas. `import.meta.dirname` exige Node ≥ 20.11, mas `engines` diz `>=20`: no Node 20.0 a 20.10 o último passo do `npm run models` falha. A dica de TLS (`/CERT|SELF_SIGNED/`) não cobre `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- **Sugestão:** baixar tudo antes de escrever, com timeout e retry; subir `engines` para `>=20.11` ou usar `fileURLToPath(import.meta.url)`.

#### MOD-16 · [BAIXO] Builders gravam o GLB antes de checar o orçamento
- **Tipo:** bug · **Onde:** [tools/modeling/build-avatars.mjs:64-72](tools/modeling/build-avatars.mjs#L64-L72), [build-parts.mjs:74-95](tools/modeling/build-parts.mjs#L74-L95) · **Confiança:** confirmado
- **Problema:** `writeFile` acontece antes de `if (stats.triangles > TRIANGLE_BUDGET) throw`. Um modelo estourado sobrescreve o GLB bom e deixa o manifest com estatísticas antigas. O `build-bodies.mjs` faz na ordem certa.
- **Sugestão:** validar antes de gravar.

#### MOD-17 · [BAIXO] `generatedAt` torna os manifests não reprodutíveis
- **Tipo:** débito técnico · **Onde:** [build-avatars.mjs:121](tools/modeling/build-avatars.mjs#L121), [build-parts.mjs:163](tools/modeling/build-parts.mjs#L163), [build-bodies.mjs:118](tools/modeling/build-bodies.mjs#L118) · **Confiança:** confirmado (regeneração da auditoria)
- **Problema:** é a única fonte de não-determinismo dos geradores de modelos. Todo `npm run models` suja dois manifests no git, mesmo sem mudança real.
- **Sugestão:** trocar por um hash do conteúdo, que continua servindo ao auto-reload do visualizador.

#### MOD-18 · [BAIXO] Helpers duplicados e código morto nas ferramentas
- **Tipo:** débito técnico · **Onde:** vários · **Confiança:** confirmado
- **Problema:**
  - Há dois encoders PNG com assinaturas diferentes: `tools/modeling/lib/png.mjs:123` e `tools/terrain/lib/png.mjs:40`.
  - A contagem de triângulos está repetida 7 vezes, entre builders, validador e visualizador.
  - A lista de nós do cockpit está repetida 3 vezes e sem `Navball`.
  - A mescla do manifest existe em 3 variantes.
  - `build-avatars.mjs:131-134` preserva campos que nunca existem no manifest.
  - O preset `thrust` de `fx-presets.mjs` não é usado.
  - O polyfill de `FileReader` pendura a build se o exporter rejeitar.
- **Sugestão:** um módulo comum de estatísticas, nós e manifest, e um único encoder PNG.

#### MOD-19 · [BAIXO] Partículas do jogo não usam os presets do manifest, contra o §5.6
- **Tipo:** regra §5.6 · **Onde:** [tools/web/bundle-models.mjs:36-39](tools/web/bundle-models.mjs#L36-L39); [web/flight.js:372-389](web/flight.js#L372-L389) · **Confiança:** confirmado
- **Problema:** o bundle não exporta `fxPresets`. As faíscas do cockpit usam `PointsMaterial({ color: 0xffb347, size: 0.032 })`, fora do preset `sparks` (cores #FFF3B0→#FF7A00, gravidade de 3,71 m/s²). As âncoras `FX_*` dos avatares não são usadas no jogo.
- **Sugestão:** exportar `fxPresets` em `ASTRO_FILES` e criar as partículas a partir deles.

#### MOD-20 · [BAIXO] Convenções de modelagem com exceções não documentadas
- **Tipo:** inconsistência · **Confiança:** confirmado
- **Problema:**
  - O Lucas segura o notebook na mão esquerda (`characters/lucas.mjs:67`), mas o §5.5 diz que as ferramentas ficam na mão direita.
  - Duas bases de equipamento são "(estilizado)", não reais.
  - O `Prop_Sample` da Maya não está em `equipment`.
  - Algumas origens de peças fogem da convenção sem checagem: `centaur-iii-tank` minY −0,14; `mr-107` maxY +0,06.
  - O `part-builder` ignora a rotação do pivô (`lib/part-builder.mjs:112-116`); o cockpit compensa à mão.
  - Os avatares estão no limite do orçamento: 49 a 50 meshes (limite 50) e 2.892 a 2.972 triângulos (limite 3.000). Qualquer item novo estoura a validação.
- **Sugestão:** ajustar ou registrar as exceções; validar a origem por categoria.

#### MOD-21 · [BAIXO] Docs desatualizados no escopo de modelos
- **Tipo:** docs · **Confiança:** confirmado
- **Problema:**
  - `references/parts/parts.md:90`, `stage-equipment.md:17` e `cabin-equipment.md:17` citam "game-balance in `.tres`" (Godot, removido).
  - O §12 do AGENTS.md diz que `npm run models` "gera os 4 avatares", mas ele também gera as 55 peças e a Terra e faz o bundle.
  - A tabela de âncoras do §5.6 omite as das peças (`FX_Exhaust`, `FX_Sparks_Left/Right`).
  - O §2 não lista `tools/modeling/parts/`.
- **Sugestão:** atualizar junto do próximo commit de pipeline.

## 7. Pipelines de áudio e terreno (`tools/audio/`, `tools/terrain/`)

Conferido sem problema:
- cabeçalhos WAV (RIFF, fmt, data e `smpl`);
- nenhum `Math.random`;
- GLBs sem nenhum aviso da Khronos;
- encoders JPEG e PNG;
- Polar Stereographic e curvatura;
- elevações iguais ao DTM (até 3 cm);
- os números de áudio do README (1,25σ, 92,8 → 7.295,7, ~79×, 115,7, 1 s = 1,5 h, 24 kHz / 44,1 kHz).

#### PIPE-01 · [ALTO] O contador Geiger documentado não existe no jogo
- **Onde:** `web/app.js:720-726`; `README.md:139-144, 162`; `docs/audio.md:39-71`; `AGENTS.md` §7 · **Confiança:** confirmado
- **Problema:** os docs prometem `0.5 × dose / 115.7` cliques/s, teto de 30, intervalos exponenciais e sorteio entre 4 WAVs. O jogo sintetiza uma onda quadrada em tempo real (`setInterval(…, 420)` com `Math.random() < 0.38`), a ~0,9 clique/s fixo, sem relação com a dose. Isso viola "nada de síntese em tempo real" (§7). Nada em `web/` cita `geiger_click_*` ou o `assets/audio/manifest.json`: os 4 WAVs, os parâmetros `geiger` e o envelope da tempestade não são usados.
- **Sugestão:** tocar os WAVs com os números do manifest, ou corrigir README, docs e AGENTS.

#### PIPE-02 · [ALTO] "53 min após a última leitura normal" e "79× em menos de uma hora" contradizem os dados
- **Onde:** `README.md:128`; `docs/audio.md:27, 61, 63` (card "Fato real" pronto); `references/datasets/msl-rad/README.md:47` · **Confiança:** confirmado
- **Problema:** no CSV, a leitura das 05:21:50 (178,6 / 238,9) já está 12σ acima em B e 50σ acima em E: já é tempestade. A última leitura normal é a das 05:04:45, a 70,6 min do pico. O texto vale como fato real e fere o §8 ("nunca invente fatos").
- **Sugestão:** "~70 min desde a última leitura normal (05:05 UTC)" ou "de 179 para 7.296 µGy/dia em 53 min".

#### PIPE-03 · [MÉDIO] O validador de áudio aceita emendas de loop quebradas
- **Onde:** `tools/audio/validate.mjs:26-31` (`seam > Math.max(typical * 4, 1e-3)`) · **Confiança:** confirmado (simulação)
- **Problema:** no bed, o limiar fica acima do maior passo do arquivo inteiro. Em emendas aleatórias simuladas, 1.274 de 2.000 passam com um salto de ~−22 dBFS, que é audível. O arquivo atual está bom.
- **Sugestão:** comparar com a mediana ou o p90 dos passos em volta da emenda; incluir um teste negativo.

#### PIPE-04 · [MÉDIO] O cache offline do terreno não confere a URL nem a configuração do sítio
- **Onde:** `tools/terrain/lib/source-store.mjs:87-131`; `tools/terrain/build-terrain.mjs:187-230, 531` · **Confiança:** confirmado por leitura
- **Problema:** trocar um `ctx` ou o `item` em `sites.mjs` e rodar `npm run terrain` gera o terreno com os dados antigos. O manifest passa a registrar a fonte nova com o dado velho, ou seja, fonte errada para dado "real".
- **Sugestão:** gravar a URL e a configuração em `sources.json` e falhar offline se divergirem.

#### PIPE-05 · [MÉDIO] O `terrain:fetch` não é atômico
- **Onde:** `source-store.mjs:121-153`; `build-terrain.mjs:589-616` · **Confiança:** confirmado por leitura
- **Problema:** os PNGs são gravados na hora, mas o `sources.json` (offset, escala, georreferência) só no fim. Uma falha no meio faz a próxima build decodificar os PNGs novos com os parâmetros velhos: alturas erradas, sem erro, e o validador não percebe.
- **Sugestão:** baixar numa pasta temporária e renomear no fim; guardar o hash de cada PNG.

#### PIPE-06 · [BAIXO] Lote menor dos pipelines
- **Confiança:** confirmado, exceto onde indicado
- **Resolução Y dos overviews:** usa a razão da largura (`raster.mjs:16-17`). Isso dá um deslocamento N–S estimado de dezenas a ~160 m nos CTX do horizonte (magnitude é suspeita); o DTM andável não é afetado.
- **Checagem de alinhamento:** só pega erro grosseiro. Uma textura deslocada 20 m ainda passa.
- **"73 notas, cada uma no momento medido":** 60 caem no loop; 5 vêm de depois do `endUtc` e 8 são atenuadas pelo fade.
- **Loop do ambiente no jogo:** `<audio loop>` ignora o `smpl`, começa num degrau de −17,6 dBFS e para seco, com clique.
- **`fetch-rad.mjs`:** não testa `r.ok` e sobrescreve o CSV mesmo com 0 linhas; a janela `WINDOWS` está duplicada no `generate.mjs`.
- **Antimeridiano:** a guarda (`global-dem.mjs:38`) nunca dispara. Não afeta os sítios atuais.
- **READMEs de referência:**
  - a cadência durante a tempestade é ~9 min, não ~27;
  - a dose acumulada só bate se somada a partir de 05:21;
  - o CTX de Gale está ~120 m *abaixo* do HiRISE, não acima.
- **`north_polar_scarp`:** é construído, validado e commitado (~4,7 MB com as fontes) sem uso no jogo.
- **Validadores circulares:** conferem o manifest contra ele mesmo. Não checam 24 kHz / 44,1 kHz nem o orçamento de textura, e não detectam arquivos órfãos.
- **Detectores diferentes:** o jogo mostra RAD 165 µGy/dia (detector E, `web/app.js:638`), enquanto o Geiger do manifest usa o detector B (115,7).

## 8. Documentação, repositório e processo

#### REPO-01 · [ALTO] Sem CI, sem lint e sem testes do jogo: três regressões críticas passaram num único commit
- **Onde:** não há `.github/workflows`, ESLint nem testes de `web/`; o único teste automatizado é o do `multiplayer/` · **Confiança:** confirmado
- **Problema:**
  - SURF-01, FLT-01 e GAME-01 são erros que um lint (`no-shadow`, `no-use-before-define`) ou um smoke test pegaria. O smoke test carregaria a página headless e faria uma missão pelos hooks `window.ASTRO_SURFACE`/`ASTRO_LAUNCH_JUMP`, que já existem "para Playwright".
  - O `node --check` não pega imports quebrados (MOD-01).
  - Os validadores e os testes do servidor só rodam à mão.
- **Sugestão:** um workflow com:
  - `npm ci`;
  - os três `*:validate`;
  - `cd multiplayer && npm test`;
  - ESLint com essas regras;
  - um teste que importa cada script de `tools/`;
  - um smoke test com Playwright.

#### REPO-02 · [MÉDIO] Docs de `docs/` em inglês, contra o §9 do AGENTS (PT-BR)
- **Onde:** `docs/minigames.md`, `docs/multiplayer.md` (e outros) · **Confiança:** confirmado por dois revisores
- **Sugestão:** traduzir ou mudar a regra do §9.

#### REPO-03 · [BAIXO] Links quebrados e estrutura desatualizada no AGENTS.md
- **Onde:** `AGENTS.md:18`; `characters/maya-mars-missions.md:8, 24, 41, 57` · **Confiança:** confirmado (script de links)
- **AGENTS.md:**
  - linka `docs/characters.md`, mas o arquivo é `characters/characters.md`;
  - a árvore do §2 não lista `web/`, `characters/`, `datasets/` nem `tools/modeling/parts/`.
- **`characters/maya-mars-missions.md`:** tem 4 links relativos quebrados (para `mars-experiments.md` e para a transcrição), restos de uma mudança de pasta.

#### REPO-04 · [BAIXO] Sem `.gitattributes`: diffs fantasmas no Windows
- **Confiança:** confirmado
- **Problema:** com `core.autocrlf=true`, os geradores escrevem LF e o checkout fica em CRLF. Depois de regenerar, 10 arquivos aparecem como modificados sem nenhuma mudança de conteúdo. A working tree atual mistura LF (os dois locales) e CRLF.
- **Sugestão:** `* text=auto eol=lf`, mais `*.glb`, `*.wav`, `*.png`, `*.pdf` marcados como `binary`.

#### REPO-05 · [BAIXO] Lacunas no catálogo de fontes (`references/README.md`, base do formulário do Space Apps)
- **Confiança:** confirmado; licença é suspeita
- **Problema:** faltam:
  - sslip.io (nome TLS da VM);
  - GitHub Pages;
  - as fotos do Parque Tecnológico de Sorocaba ("reconstructed from the supplied photographs", `web/launch.js:25`);
  - a procedência do Saturn V (MOD-08);
  - os períodos e as inclinações do NSSDC tabulados (FLT-07).

  O horizonte deriva do DEM HRSC, que é CC BY-SA 3.0 IGO (ShareAlike), e o repositório não tem arquivo LICENSE.
- **Sugestão:** completar o catálogo e definir a licença do repositório.

#### REPO-06 · [BAIXO] Crescimento do repositório e limite de 5 MB
- **Confiança:** confirmado
- **Problema:** cada terreno é guardado duas vezes (GLB de 4,6 MB e base64 de 6,1 MB), e os modelos também (GLBs e um bundle de 4,4 MB). O `.git` já tem 90 MB, e cada regeneração de terreno soma ~21 MB ao histórico. Os `index.terrain.*.js` passam do limite de 5 MB do §10.
- **Sugestão:** decidir em time (Git LFS, não versionar os GLBs intermediários do terreno, ou registrar a exceção no §10).

#### REPO-07 · [BAIXO] Afirmações desatualizadas em docs gerais
- **Confiança:** confirmado
- **`README.md`:**
  - diz que só o three.js precisa de internet, mas também carregam do CDN o i18next e o Google Fonts;
  - diz que "as builds rodam offline", mas `web:sites` usa rede;
  - diz "55 parts" no construtor (MOD-12) e lista a Terra como "no jogo" (MOD-10).
- **`datasets/nasa-datasets-integration.md`:** é um plano antigo. Lista REMS/MEDA, DONKI e LLIS, que não foram implementados, e fala em RAD em "mSv/dia", contra a nota do README de que os dados são de dose absorvida (Gy).

## Apêndice: verificações executadas

| Verificação | Resultado |
|---|---|
| `node --check` em `web/*.js`, `multiplayer/*.mjs` e no cliente | sem erro de sintaxe |
| `npm run models:validate`, `audio:validate`, `terrain:validate` (clone limpo) | passam |
| `cd multiplayer && npm test` | 19/19 |
| Regeneração completa (models, parts, bodies, audio, terrain, web:models) | só `generatedAt` diverge; GLBs, WAVs e bundles idênticos |
| Import de `tools/web/site-photos.mjs` | falha: `does not provide an export named 'readRegion'` |
| Links relativos em 66 `.md` | 1 no AGENTS.md e 4 em `characters/` quebrados (os templates foram desconsiderados de propósito) |
| Paridade i18n EN/PT | 710/710 chaves; placeholders iguais |
| Probes do servidor (porta local aleatória) | crash por aninhamento, por `__proto__` e por URL malformada; 500 salas em 816 ms; ~5,6 MiB por sala |
| HEAD vs working tree (`git show HEAD:…`) | `t` sombreado em `views.js`, `launch.js` e `app.js` |

Scripts e probes usados ficaram no scratchpad da sessão. Nenhum arquivo do repositório foi alterado pela auditoria, exceto a criação deste documento.
