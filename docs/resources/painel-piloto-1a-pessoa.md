# Painel de Controle do Piloto em 1ª Pessoa (`painel-piloto-1a-pessoa.md`)

Pesquisa de referências reais da NASA, análise das 3 referências visuais enviadas e especificação do modelo 3D low-poly do **Painel de Controle do Piloto em 1ª Pessoa** (`cockpit_pilot.glb`) para a **Fase 5 (Lançamento e Entrada em Órbita)** e a **Fase 6 (Reabastecimento Orbital, Eventos de Travessia e Pouso em Marte)** — conforme [space-mission-game-transcricao-organizada.md](space-mission-game-transcricao-organizada.md) §7 e §8.

- **Especificação técnica e árvore de nós 3D (EN):** [references/parts/pilot-cockpit.md](../../references/parts/pilot-cockpit.md).

> **Atualizado em 2026-11-24:** o modelo virou a cabine inteira no layout da Orion: 4 assentos reclinados, dois sobre dois (Helena e Lucas em cima, sob o painel; Oscar e Maya embaixo, com uma tela no encosto do assento de cima) e uma câmera por assento (`Camera_Seat_1..4`); numa sala, cada jogador vê a cabine do próprio assento; no solo, a câmera segue quem está agindo (Helena pilotando, Lucas num disjuntor desarmado, Oscar na aproximação da acoplagem orbital, Maya na transferência de propelente, cada um no seu experimento de órbita). De qualquer assento dá para olhar em volta arrastando na vista fora dos controles (ou com o botão direito em qualquer lugar): a cabeça vira para o lado do movimento, na velocidade da superfície, e o cursor continua livre para os controles e os minigames; duplo clique, toque duplo ou C centraliza. Render em corte com a tripulação: [docs/images/cockpit-crew-cutaway.png](../images/cockpit-crew-cutaway.png). A especificação atual está em [references/parts/cockpit/cockpit-pilot/README.md](../../references/parts/cockpit/cockpit-pilot/README.md); o resto deste documento é a pesquisa inicial.

---

## 1. Análise das 3 Referências Visuais + Cockpits Reais da NASA

As três imagens enviadas combinam exatamente os elementos que tornam a visão em 1ª pessoa legível, imersiva e reativa durante os minigames de lançamento:

### 1.1. Imagem 2 — *Space Shuttle Aft Flight Deck* (Foto Real da NASA)
A foto mostra o **Convés de Voo Traseiro (*Aft Flight Deck* — painéis A6, A7 e A8)** do Ônibus Espacial da NASA (estação de controle de carga útil, acoplamento e braço robótico *Canadarm*, identificada pelo selo `Canada` à direita).
- **Elementos reais que trazemos para o modelo 3D:**
  - **Bancada tripartida inclinada em alumínio/cinza técnico** repleta de chaves físicas, guardas metálicas e disjuntores;
  - **Manche Rotacional (`RHC` — *Rotational Hand Controller*)** vertical preto no centro e **Controlador Translacional (`THC`)** quadrado ao lado;
  - **Matriz Central *Caution & Warning* (C&W):** o bloco retangular de luzes de falha retroiluminadas bem no meio da bancada, logo acima da placa azul `"Warning"`;
  - **Monitor CCTV superior esquerdo:** tela dedicada inclinada para o piloto — ideal no jogo para mostrar a **câmera externa do foguete** (separação dos estágios e queima dos motores montados na Fase 3);
  - **2 janelas frontais + 2 janelas superiores de teto** enquadradas pelas nervuras brancas da cabine.

### 1.2. Imagem 3 — Console *Wrap-Around* em 3 Alas (Simulador / Ponte Sci-Fi)
- **Elementos que trazemos para o modelo 3D:**
  - **Geometria envolvente em "U" (3 alas):** ala esquerda angulada a `+25°`, console central elevado com tela tática de alinhamento/radar e ala direita angulada a `−25°`, preenchendo a visão periférica da câmera em 1ª pessoa;
  - **Nichos de iluminação de emergência vermelha/âmbar** que acendem sobre o painel quando algo quebra ou entra em sobrecarga;
  - **Grelhas superiores de ventilação** acima do visor (de onde podem sair faíscas/fumaça na falha de bomba térmica `P8`).

### 1.3. Imagem 1 — Visão 1ª Pessoa Estilizada com 3 Zonas de Telemetria
- **Elementos que trazemos para o modelo 3D:**
  - **Enquadramento pelos 2 assentos laterais** na borda inferior/lateral da câmera + **ampla janela espacial** ao fundo;
  - **Painel de 3 Telas súper legível para os minigames:**
    1. **Tela Esquerda (Atitude / Mira Circular):** horizonte artificial *FDAI 8-Ball* (Apollo/Shuttle) e mira de alinhamento orbital/acoplamento;
    2. **Tela Central (Barras de Métricas e Motores):** indicadores verticais de **Combustível**, **TWR / Força-G**, **Bateria/Potência (`W`)**, **$\Delta v$** e o anel de motores acesos (estilo *Crew Dragon*);
    3. **Tela Direita (Gráfico de Subida Orbital):** curva de **Altitude vs. Velocidade Orbital** em tempo real (mostrando se o foguete está subindo para a órbita ou caindo por excesso de peso);
  - **Pedestal de controle à frente** com alavancas duplas de empuxo/estágio e botões vermelhos de ação rápida.

### 1.4. Complemento Histórico NASA (Apollo `MDC`, Orion `3 DUs` e `Crew Dragon`)
- **Apollo Command Module (`MDC`):** chaves com trava de segurança (*guarded switches*) para separação de estágios e teclado/display **DSKY** (`Verb / Noun`).
- **Orion MPCV (Artemis):** `3` grandes telas *Glass Cockpit* (`DUs`) com botões físicos na moldura (*bezel keys*) para operar sob forte vibração na decolagem, reduzindo milhares de chaves para `< 60` controles críticos de sobrevivência.
- **SpaceX Crew Dragon:** visualização limpa da curva de subida e do anel de motores do booster (apagando setores individuais se um motor falhar).

---

## 2. Como as Escolhas da Construção (Fase 3–4) Disparam Eventos no Painel (Fase 5–6)

| Situação na Montagem / Voo | O que o Piloto vê e ouve no Painel 3D | Ação / Minigame no Painel |
|---|---|---|
| **Foguete pesado demais (`1.0 ≤ TWR < 1.2`)** | A curva na **Tela Direita** fica abaixo da linha ideal; o bloco `OVERWEIGHT / LOW TWR` acende na **Matriz C&W**; um disjuntor na **Ala Esquerda** salta com faíscas (**`FX_Sparks_Left`**) e o alarme **Master Warning (`Alarm_Master_Red`)** pisca. | Segurar o vetor de subida com o **`Joystick_RHC`** na **Tela Esquerda**, rearmar o disjuntor na **Ala Esquerda** e acionar a **Separação de Estágio (`Stage_Sep_Switch`)** no segundo exato. |
| **Falta de Energia (`powerW < 0` ou bombas elétricas `rutherford`)** | Barra de energia na **Tela Central** cai para o vermelho; bloco `MAIN BUS UNDERVOLT` pisca em âmbar. | Desligar cargas secundárias nas chaves da **Ala Esquerda** antes que o painel apague. |
| **Falha ou Corte de Motor no Cluster (`9× Merlin`, `3× Raptor`, `4× RS-25`)** | Um círculo no anel de motores da **Tela Central** fica vermelho; a nave puxa para o lado no horizonte artificial. | Compensar guinada/rolagem com o **`Joystick_RHC`** e ajustar o **`Throttle_Lever`**. |
| **Reabastecimento Orbital Obrigatório (Fase 6 — `cabin-idss-docking`)** | A nave-tanque aparece na **Janela Frontal**; o **`Monitor_CCTV`** mostra o anel de acoplamento; a **Tela Esquerda** vira mira de aproximação. | Alinhar translação (`Controller_THC`) e rotação (`Joystick_RHC`) até travar os umbilicais criogênicos (**`H-O1`**). |
| **Pane Térmica (`P8`) ou Tempestade Solar (`P10`) na Viagem (Fase 6)** | Faíscas saem da **Ala Direita (`FX_Sparks_Right`)**; luzes `COOLANT PUMP` ou `SOLAR STORM SPE` acendem na **Matriz C&W**. | Coordenar reparo com Lucas (**`L-O2`**) ou acionar o protocolo de abrigo solar com Maya (**`M-S5`**). |
| **Entrada, Descida e Pouso em Marte (`H-S2`)** | Marte cresce na **Janela Frontal**; **Tela Direita** exibe temperatura do escudo (`MEDLI2`) e mapa de crateras (`TRN`). | Armar paraquedas/escudo no **`EDL_Arm_Switch`** (Ala Direita) e desviar de rochas com o **`Joystick_RHC`**. |

---

## 3. Estrutura Planejada para o Modelo 3D (`cockpit_pilot.glb`)

Para que o jogo consiga animar ponteiros, trocar cores de alerta (`LedGreen` → `Lamp` → `LedRed`), clicar em disjuntores/alavancas via *raycast* em 1ª pessoa e soltar partículas, o modelo terá pivôs separados:

1. **`Camera_Pilot` `(0, 1.18, 0.38)`:** posição exata da câmera em 1ª pessoa olhando para `−Z` (enquadrando o painel de 3 alas, as 3 telas, o monitor CCTV superior esquerdo, as janelas frontais/superiores e o topo dos 2 assentos laterais).
2. **`Monitor_CCTV`:** monitor inclinado no canto superior esquerdo (como na foto real do *Space Shuttle*).
3. **3 Telas Principais (`Screen_Left_Attitude`, `Screen_Center_Telemetry`, `Screen_Right_Trajectory`):** molduras chanfradas com elementos 3D low-poly de telemetria (mira circular, barras de nível, curva de subida e anel de motores) que também aceitam uma UI 2D (HTML) por cima.
4. **Matriz `CW_Matrix` + `Alarm_Master_Red` / `Alarm_Caution_Amber`:** grade central de 12 blocos de alerta + botões mestre de alarme no topo do *glareshield*.
5. **Controles Móveis com Pivô Próprio:**
   - `Joystick_RHC` (inclina em X/Z);
   - `Controller_THC` (módulo translacional quadrado);
   - `Throttle_Lever` (alavanca de potência que desliza/gira em X);
   - `Breaker_Bank` (disjuntores na ala esquerda);
   - `Stage_Sep_Switch`, `EDL_Arm_Switch` e `Abort_Button` (chaves com guarda vermelha/laranja);
   - `FX_Sparks_Left` e `FX_Sparks_Right` (âncoras de faíscas `preset: 'sparks'` para quando equipamentos quebram na decolagem).
