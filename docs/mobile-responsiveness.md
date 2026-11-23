# Responsividade mobile: diagnóstico e plano de ação

Análise de como o `index.html` se comporta em celulares e do que mudar para o jogo funcionar bem neles, sobretudo deitados (paisagem). Escrita em 2026-11-23, a partir da versão 1.5.0.

## Como foi medido

- **Aparelho de referência:** os prints vieram de um Android em paisagem. Ao tocar em Play, o jogo entra em tela cheia ([web/app.js](../web/app.js), `requestGameFullscreen`), e a área útil fica com **915×412 px** CSS.
- **Reprodução:** Edge headless controlado pelo Chrome DevTools Protocol, com emulação de celular e toque. O script percorre o menu, os 5 passos do lobby, a montagem e a superfície (`#surface-jezero`). Em cada tela, salva a captura e mede:
  - contêineres com `overflow:hidden` cujo conteúdo não cabe;
  - rolagem horizontal;
  - áreas de toque menores que 32 px.
- **Tamanhos testados:**

  | Tamanho | Exemplo |
  |---|---|
  | 915×412 | Android deitado (os prints) |
  | 844×390 | iPhone 14 deitado |
  | 667×375 | iPhone SE deitado |
  | 412×915 | Android em pé |
  | 390×844 | iPhone em pé |
  | 1440×900 | desktop de referência |

- **Limite:** o cockpit não foi capturado. O foguete padrão não pode ser lançado (cabine 0/4), então o lançamento não acontece. A análise dele vem só do CSS.

## Diagnóstico

### Causa principal: os breakpoints só olham a largura

[web/styles.css](../web/styles.css) só tem `max-width` (1200, 900, 640 e 360 px). Não há nenhuma regra por altura (`max-height`) ou por orientação. Por isso o celular deitado cai em layouts feitos para outras telas:

| Tela | Exemplo | Regras que valem | Resultado |
|---|---|---|---|
| 915×412, 932×430 | Android e iPhone Pro Max deitados | desktop (acima de 900) | Lobby travado em `100dvh` com `overflow:hidden` (`#lobby`). O conteúdo é esmagado e cortado |
| 844×390, 667×375 | iPhone deitado | 900 ou menos | Uma coluna só, com páginas de 1.000 a 1.280 px (cerca de 3 telas) e o botão de continuar no fim |
| 390×844, 412×915 | celular em pé | 640 ou menos | Funciona, mas as páginas têm de 1.450 a 2.000 px e o stepper ocupa 245 px |

### Lobby em 915×412 (o tamanho dos prints)

- **Cabeçalho, stepper e rodapé ocupam cerca de 190 dos 412 px (46%).** Sobram uns 220 px, e o título do passo, com a descrição, gasta 90 deles.
- **Passo 1, modo:**
  - o painel do multiplayer (`#mode-mp-visual`) aparece com 20 px de 257 necessários;
  - a linha do servidor fica cortada atrás do campo "JOIN";
  - a prévia da tripulação do singleplayer (`#mode-solo-visual`) aparece com 16 px de 61.
- **Passo 4, local de pouso:**
  - os cards das crateras (`.site-card`) aparecem com 81 px de cerca de 350 necessários, e o nome e a descrição somem;
  - as etiquetas "HIRISE · 1.5 KM" e de coordenadas cobrem a foto e a área de caminhada;
  - no globo, as três etiquetas cobrem o planeta e se sobrepõem ao marcador da Gale.
- **Passo 3, destino:** o mapa e a lista lateral ficam cortados (a linha de status some).
- **Passos 2 e 5, dificuldade e tripulação:** só dá para rolar dentro de uma janela de uns 210 px, com rolagem dentro de rolagem.

### Problemas que aparecem em vários tamanhos

1. **Alturas mínimas maiores que a tela deitada.** Um celular deitado tem de 360 a 430 px de altura, e estas áreas pedem mais:

   | Elemento | Altura mínima |
   |---|---|
   | `.site-card-media` | 190 px (180 e 160 nos breakpoints menores) |
   | `.mars-globe-stage` | 340 px (300 em 640 ou menos) |
   | `.orbit-map` | 420 px |
   | `.blueprint` | 560 px (500 em 640 ou menos) |
   | `.cockpit-viewport` | 540 px (360 em 640 ou menos) |
   | `.assembly-grid` | `clamp(620px, …)` |

2. **O botão de continuar não fica fixo.** Em uma coluna, ele só aparece no fim da página. Na montagem, "Launch Mission" fica a 1.450 px do topo em 915×412.
3. **Stepper em retrato:** vira 5 linhas empilhadas (cerca de 245 px), e o conteúdo começa abaixo de 40% da tela.
4. **Cockpit:** em uma coluna, a área 3D (540 px) fica longe dos controles do minigame. O jogador precisaria rolar a página durante um minigame com tempo.
5. **Superfície deitada:**
   - em 667×375, o painel de experimentos ocupa cerca de 40% da tela e o botão JUMP fica por cima dele;
   - o texto "EMOTES · Q" mostra um atalho de teclado em aparelho de toque.
6. **Menu deitado:** a página tem 517 px numa tela de 412. "Leaderboards" sai cortado, e "Settings" e a versão ficam fora da tela.
7. **Áreas de toque pequenas.** A regra `pointer:coarse` só é usada na superfície.

   | Controle | Tamanho medido |
   |---|---|
   | `.meter-info-btn` | 20×18 px |
   | `.add-stage` | 30×26 px |
   | `.rocket-stage` | 27 px de altura |
   | `.remove-stage` | 28×27 px |
   | abas Engines, Tanks e Fins | 29 px de altura |

8. **`100vh` em `#app`, `.screen`, `.menu-shell` e `.assembly-grid`.** No celular sem tela cheia, isso fica maior que a área visível. No iPhone o Safari não costuma aceitar a tela cheia que o Play pede, então ali a altura útil em paisagem fica ainda menor.
9. **Detalhes:**
   - o stepper corta palavras ("LANDING SI…", "SINGLEPLAYE…");
   - em retrato, o nome "HELENA" não cabe no card da tripulação;
   - a dica do passo 4 fala em "card on the left", mas em uma coluna o card fica acima.

## Plano de ação

### Fase 0: base (pequena, destrava o resto)

- [x] Criar uma faixa "altura curta", com `@media (max-height:500px) and (orientation:landscape)`. Usar `(pointer:coarse)` para os tamanhos de toque.
- [x] Trocar `100vh` por `100dvh` (ou `svh`), com fallback, em `#app`, `.screen`, `.menu-shell` e `.assembly-grid`.
- [x] Guardar as alturas do cabeçalho, do stepper e do rodapé em variáveis CSS (`--header-h`, `--stepper-h`, `--foot-h`), para calcular o espaço que sobra.
- [x] Incluir 915×412, 844×390 e 667×375 no teste do [AGENTS.md](../AGENTS.md) (seções 4 e 11), que hoje só pede 1440 e 390 px.

### Fase 1: lobby deitado (maior impacto; resolve os prints)

- [x] Compactar a moldura de 190 px para 110 px ou menos:
  - cabeçalho com 44 px;
  - esconder o eyebrow e o texto do rodapé;
  - stepper só com os números e o rótulo do passo atual;
  - descrição do passo escondida.
- [x] Liberar a trava de altura: em altura curta, a página rola normalmente e o botão de continuar fica fixo no rodapé. Isso elimina a rolagem aninhada.
- [x] **Modo:**
  - prévia da tripulação baixa ou escondida;
  - o navegador de salas abre num diálogo ou bloco expansível, e o card mostra só "Find" e "Host".
- [x] **Local de pouso:**
  - mídia dos cards com `aspect-ratio` fixo, com o nome sempre visível;
  - nos cards, uma etiqueta só (coordenadas);
  - no globo, uma etiqueta só, sem a instrução em aparelho de toque.
- [x] **Destino:** mapa com altura ajustada ao espaço disponível.
- [x] **Dificuldade:** esconder os detalhes menores ou usar rolagem horizontal com snap.
- [x] **Tripulação:** 4 cards em linha, com o painel de detalhes ao lado.

### Fase 2: lobby em retrato

- [x] Stepper horizontal compacto: os 5 hexágonos em uma linha, cerca de 48 px no lugar de 245 px.
- [x] Barra fixa com o botão de continuar, respeitando a safe-area.
- [x] Corrigir o nome que estoura nos cards da tripulação.
- [x] Reduzir as mídias: fotos com `aspect-ratio` 16:9 e globo com uns 260 px.

### Fase 3: telas de jogo

- [x] **Cockpit:**
  - a área 3D ocupa a altura disponível, sem o mínimo de 540 px;
  - o minigame fica sempre visível junto da cena: ao lado se deitado, abaixo e fixo se em pé.
- [x] **Montagem:**
  - blueprint do tamanho da tela;
  - telemetria resumida numa barra;
  - "Launch Mission" fixo.
- [x] **Superfície:**
  - painel de experimentos recolhível (mostra "0/4" e o alvo mais próximo);
  - reposicionar o JUMP para não cobrir o painel;
  - esconder os atalhos de teclado em aparelho de toque.
- [x] **Menu:** versão para altura curta, com título menor e botões lado a lado.

### Fase 4: toque e acabamento

- [x] Áreas de toque de pelo menos 44 px em `(pointer:coarse)` para os controles da tabela do item 7.
- [x] Rótulos curtos no i18n (`web/locales/`) para o stepper compacto.
- [x] Trocar a dica "card on the left" por um texto neutro.
- [x] Se o jogo passar a usar `viewport-fit=cover`, aplicar `env(safe-area-inset-*)` nas barras fixas.
- [x] Transformar o script de capturas em ferramenta (`tools/web/`) e rodá-lo nos 6 tamanhos a cada mudança de layout.

## Decisões pendentes

1. **Orientação:** manter o jogo completo nas duas orientações ou recomendar paisagem nas telas de jogo (cockpit e superfície), com um aviso de "gire o aparelho"?
   - Recomendação: as duas orientações no lobby e na montagem, e paisagem recomendada nas telas de jogo. Isso reduz bastante a Fase 3.
2. **Lobby em altura curta:** página com rolagem e botão fixo, ou altura travada com rolagem só no conteúdo?
   - Recomendação: página com rolagem e botão fixo, que evita rolagem dentro de rolagem.
