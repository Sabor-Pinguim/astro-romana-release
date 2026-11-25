# Consequências de montar o foguete errado

Plano e estado das consequências de um foguete mal montado, além das falhas que já encerram a missão. A ideia: a missão continua, mas fica mais difícil de um jeito que o jogador vê e consegue contornar, e cada problema tem um tripulante que lida com ele.

- **Código:** `web/app.js` (constante `CONSEQUENCE`, `captureDesign`, `brownoutTick`, `solarStorm`, revisão de lançamento e relatório final), `web/experiment-run.js` (limite de estrelas e corte do orçamento, guardados em `run.consequences`), `web/flight.js` (telas na queda de tensão, pogo na câmera), `web/views.js` (velocidade de quem tomou radiação).
- **Números:** todos são `game-balance`, em constantes nomeadas (`CONSEQUENCE` em `web/app.js`, `DOSE_SPEED` em `web/views.js`, `BROWNOUT_LEVEL` em `web/flight.js`).
- **Dificuldade:** no fácil (sem penalidades) nada disso acontece; a revisão de lançamento só avisa. No normal e no difícil a consequência acontece; no difícil as quedas de tensão vêm mais seguidas.

---

## 1. O que já existia

| Erro de montagem | Consequência |
|---|---|
| Sem motor, sem tanque, combustível trocado (difícil), empuxo-peso abaixo de 1 | Não decola |
| Δv insuficiente para a órbita, ou para Marte mesmo reabastecido | Aborta e cai no mar (normal e difícil) |
| Estágio de cima que não acende (incompleto, combustível trocado, fraco demais) | Vira peso morto |
| Empuxo-peso abaixo do mínimo seguro | −10 pontos, disjuntores desarmados, faíscas, rajadas maiores na subida |
| Falta de energia | Disjuntores desarmados e faíscas |
| Estouro de orçamento | −12 pontos |
| Faltar módulo (antena, abrigo, auxílio de pouso) | Só perde bônus |

## 2. Implementado (2026-11-25)

| Erro | Consequência no jogo | Quem lida | Valores (`game-balance`) |
|---|---|---|---|
| **Falta de energia** (geração < consumo) | Queda de tensão de tempos em tempos: um disjuntor desarma, as telas do cockpit escurecem e piscam, o estágio não separa até religar. A câmera vai para o Lucas (ver `SIM.cockpitCrew`) | Lucas religa | intervalo 30–48 s (normal), 20–32 s (difícil); telas a 50% com piscadas a 8% (35% fixo com movimento reduzido) |
| **Empuxo-peso baixo** | Pogo na segunda metade da subida (oscilação no minigame e na câmera, com aviso) e mais propelente para reabastecer na órbita (perdas por gravidade da subida lenta) | Helena (subida), Maya (transferência) | pogo 1,6° a 5,2 rad/s a partir de 50% da subida; +15% do tanque no reabastecimento |
| **Sem antena** (nenhum de `comm-dsoc-laser`, `comm-electra-marco`, `comm-rise-xband`, `cabin-scan-console`) | Os dados chegam pela metade: cada experimento vale no máximo 2 estrelas; o cartão de resultado mostra o corte | Oscar | máximo de 2 estrelas |
| **Sem abrigo de tempestade** (nenhum de `cabin-storm-shelter`, `hab-veggie-rad-astrorad`) | Tempestade solar a caminho de Marte (evento novo, com o som real da tempestade de 20/05/2024 medida pelo RAD do Curiosity): um tripulante, sorteado pela semente do run, toma uma dose e anda mais devagar na superfície | Maya (oficial médica) | 70% da velocidade de andar e correr |
| **Orçamento estourado** | A revisão do programa cancela um experimento de solo, sorteado pela semente do run (8 viram 7), além dos −12 pontos | — | 1 experimento |

**Onde o jogador vê:** os riscos aparecem na revisão de lançamento (antes de lançar); os eventos do voo (queda de tensão, pogo, tempestade) aparecem como aviso para a tripulação; quem tomou a dose recebe aviso ao pousar; o relatório final tem a linha "Consequências da montagem".

**Multiplayer:** o anfitrião decide tudo. O limite de estrelas, o experimento cortado e quem tomou a dose ficam em `run.consequences`, que já vai para os convidados no estado do voo; a contagem de quedas de tensão vai em `brownouts`.

## 3. Ideias para depois

| Erro | Consequência possível | Quem lida |
|---|---|---|
| Aletas fracas para o tamanho do foguete | O foguete gira na subida: navball rodando e dano no casco em Max-Q se sair da faixa (o dano de casco já existe) | Helena |
| Sem auxílio de pouso (TRN, LOFTID) | Elipse de pouso maior: pousa longe do local escolhido (menos tempo útil) ou pouso duro com dano | Helena |
| Δv no limite (passa só pela tolerância do normal) | Chega a Marte com pouco combustível: menos tempo na órbita (menos experimentos de órbita) e menos margem para pairar no pouso | Tripulação |
| Sem suporte de vida ou controle térmico | CO₂ e calor sobem: depois de um tempo os minigames ficam mais curtos | Lucas troca o filtro |
| Peça montada invertida (difícil) | Inspeção do Lucas antes do lançamento; se falhar, um sensor invertido troca os comandos do navball por alguns segundos | Lucas |
| Falta de energia na superfície | Só alguns experimentos rodam ao mesmo tempo | Lucas |
| Sem antena, com mais jogo | Oscar reaponta a antena num minigame para recuperar os dados | Oscar |

## 4. Casos reais (inspiração, fontes pendentes)

Citados de memória para orientar o design. Antes de qualquer um aparecer para o jogador (por exemplo num card "Fato real"), precisa entrar em `references/` com a fonte, como manda o AGENTS.md.

- Apollo 12 (1969): um raio derrubou a energia logo após o lançamento ("SCE to AUX").
- Apollo 13 (1970): pogo desligou cedo o motor central do 2º estágio; depois, a tripulação improvisou um adaptador para os filtros de CO₂.
- Galileo (1991): a antena de alto ganho não abriu e a missão mandou os dados pela antena de baixo ganho.
- Genesis (2004): acelerômetros montados invertidos; o paraquedas não abriu.
- Proton-M (2013): sensores de velocidade angular montados de cabeça para baixo; caiu logo após decolar.
- InSight (2022): poeira nos painéis solares acabou com a energia da missão.
- A tempestade solar de 20/05/2024 medida pelo RAD do Curiosity já tem fonte: [references/datasets/msl-rad/](../references/datasets/msl-rad/README.md) e [audio.md](audio.md).
