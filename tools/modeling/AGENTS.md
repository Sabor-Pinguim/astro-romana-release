# AGENTS.md: modelos 3D (`tools/modeling/` e `tools/model-viewer/`)

Regras só desta parte. Elas **somam** às do [AGENTS.md da raiz](../../AGENTS.md), que continua valendo (ficaram aqui porque o da raiz chegou ao limite de tamanho). A numeração (5.1 a 5.8 e 6) é a mesma de quando estavam na raiz, então citações como "AGENTS.md §5.5" continuam valendo.

```text
tools/modeling/
  characters/<id>.mjs   um arquivo por personagem: equipamento + animação de ação
  bodies/<id>.mjs       um arquivo por planeta/lua: dados reais → classe de cada face
  parts/                peças de foguete (specs.mjs: números de jogo e de simulação, com fonte)
  portraits/            facetas e recortes da arte aprovada de Nancy para os cards de dificuldade
  lib/                  rig, formas, paleta, animações, presets de partículas
tools/model-viewer/     visualizador HTML para validar modelos (seção 6)
```

## 5.1 O código é a fonte da verdade
- Os GLBs em `assets/models/` são **gerados** por `tools/modeling/`.
- **Nunca edite um GLB à mão**, nem no Blender: a próxima geração sobrescreve.
- **Para mudar um personagem**, edite `tools/modeling/characters/<id>.mjs`.
- **Personagem sem traje** (NPC, como a `nancy`): `astronaut: false` no arquivo dele. O rig vem vazio e o arquivo monta o corpo inteiro; `rig` ajusta posição e repouso dos pivôs para outras proporções (nomes e hierarquia não mudam). Em `characters/index.mjs`, entra depois dos jogáveis.
- **Para mudar o que é comum a todos**, edite `tools/modeling/lib/`.
- **Retratos de dificuldade:** a arte aprovada em `references/art/nancy-difficulty-concept.png` é a fonte visual. `tools/modeling/portraits/render-reference.mjs` gera recortes PNG recoloridos; `tools/modeling/build-portraits.mjs` gera os GLBs e SVGs a partir de `tools/modeling/portraits/nancy-facets.json`. `npm run models` gera e valida todos eles. Os cards exibem os PNGs apenas em telas largas.
- O gerador usa three.js (formas, hierarquia, `AnimationClip`) e exporta com `GLTFExporter`.

## 5.2 Convenções geométricas
- **Unidades:** metros; **+Y** é para cima.
- **Frente:** o personagem olha para **+Z**.
- **Lados:** o lado esquerdo do personagem é **+X**.
- **Origem:** entre os pés, no chão (y = 0).
- **Altura:** topo do capacete (ou da cabeça, sem capacete) entre 1,75 e 1,95 m; com acessórios, no máximo 2,4 m.

## 5.3 Estilo e orçamento

| Regra | Limite |
|---|---|
| Triângulos por avatar | **≤ 3.000** |
| Meshes (≈ draw calls) por avatar | **≤ 50** |
| Tamanho do GLB | ≤ 400 KB |
| Texturas | **nenhuma**: só cores da paleta |

- **Low poly facetado:** a geometria não é indexada e tem normal por face, o que garante o sombreamento chapado em qualquer renderizador.
- **Segmentos baixos:** cilindros de 5 a 10 lados.
- **Materiais:** só os da paleta compartilhada (`lib/palette.mjs`). A cor de identidade do personagem vai em `Accent` (e `Screen` para telas e LEDs).
- **Equipamento:** todo item visível precisa de uma **base real** registrada em `equipment` (item + base). As fotos de referência (NASA Image and Video Library) ficam em `references` no `manifest.json`.
- **Símbolos:**
  - Sem logos ou insígnias reais (como as da NASA).
  - Sem cruz vermelha, que é emblema protegido. Para primeiros socorros, use cruz branca em fundo verde (ISO 7010).

## 5.4 Rig compartilhado
Todos os avatares têm **os mesmos 15 pivôs, com os mesmos nomes**. Assim as animações e o código do jogo valem para qualquer personagem:

```text
Hips > Torso > Head
             > UpperArm_L > LowerArm_L > Hand_L
             > UpperArm_R > LowerArm_R > Hand_R
     > UpperLeg_L > LowerLeg_L > Foot_L
     > UpperLeg_R > LowerLeg_R > Foot_R
```

- Pivôs são nós vazios na articulação. As meshes ficam como filhas e se chamam `<Pivô>_<Material>`. Itens temporários de `action_loop` usam nós `Prop_<Nome>` (via `avatar.prop()`), exibidos apenas enquanto `action_loop` toca.
- **Não renomeie pivôs.** Para adicionar um, atualize juntos:
  - `RIG` em `lib/avatar.mjs`;
  - `validate.mjs`;
  - este arquivo.
- Não use escala negativa (inverte as faces): espelhe pela posição.

## 5.5 Animações
- **Obrigatórias:** `idle_loop`, `walk_loop`, `wave`, `salute`, `action_loop` (a ação própria de cada personagem).
- **Sufixo `_loop`:** o jogo toca em loop as animações terminadas em `_loop` (`idle_loop`, `walk_loop`, `action_loop`); `wave` e `salute` tocam uma vez.
- **Definição:** cada animação é uma função `pose(u)` com `u ∈ [0, 1]`, com rotações em graus e posições em metros relativas ao repouso. Em loops, `pose(0)` precisa ser igual a `pose(1)`.
- **Sinais de rotação:**

  | Movimento | Rotação |
  |---|---|
  | Membro para a frente | X negativo |
  | Dobrar joelho ou tronco para a frente | X positivo |
  | Braço esquerdo para fora | Z positivo |
  | Braço direito para fora | Z negativo |

- **Mão direita:** segura as ferramentas. Gestos genéricos (como o aceno) usam a mão **esquerda**.

## 5.6 Partículas
O glTF não transporta partículas, então o projeto usa âncoras:
- **Âncoras:** nós vazios chamados `FX_<Nome>`. Emitem ao longo do seu **+Y local** e guardam `userData.fx = "<preset>"`, que vira `extras` no glTF.
- **Registro:** cada âncora é registrada com `clips`, a lista de animações em que fica ativa. Exemplo: as faíscas (`FX_Sparks`) da Helena só ligam em `action_loop`.
- **Presets:** ficam em `lib/fx-presets.mjs`, em unidades SI, com a gravidade de Marte de 3,71 m/s². O gerador os copia para o `manifest.json`.
- **No jogo:** as partículas devem ser criadas a partir desses mesmos números.
- **Âncoras atuais:**

  | Âncora | Personagem | Preset |
  |---|---|---|
  | `FX_Sparks` | Helena | sparks |
  | `FX_Antenna` | Oscar | signal |
  | `FX_Scoop` | Maya | dust |
  | `FX_Foot_L/R` | todos | footdust |

## 5.7 Fluxo obrigatório ao mudar um modelo
1. `npm run models`: gera e valida. Precisa passar sem ✘; o validador oficial da Khronos não pode reportar erros.
2. Abra o visualizador (seção 6) e confira visualmente cada animação, as partículas e os pivôs (opção "Pivôs do rig e âncoras FX").
3. Faça commit **junto** do código-fonte, dos GLBs e do `manifest.json`.

## 5.8 Planetas e luas (`bodies/`)
- **Gerados de dados reais:** `build-bodies.mjs` lê só as grades já baixadas em `references/datasets/<corpo>/` (sem rede). Para baixar de novo: `npm run models:fetch:bodies`.
- **Convenções:** raio médio = 1 (o jogo escala; o raio real vai no `manifest.json`); +Y = polo norte; +Z = lat. 0°/long. 0°; +X = 90° L.
- **Relevo exagerado** (`game-balance`, valor no manifesto). Âncoras `Site_*` na superfície: +Y para cima, +X leste, −Z norte.
- **Cores:** só as da paleta `BODY` em `lib/palette.mjs`. O orçamento fica no arquivo de cada corpo, e as mesmas regras de commit da seção 5.7 valem aqui.

## 6. Visualizador de modelos (`tools/model-viewer/`)
- **É um HTML puro:** abra `tools/model-viewer/index.html` (duplo clique) e escolha `assets/models` (ou a raiz do repositório, ou arraste a pasta). Precisa de internet para o three.js do CDN.
- **Chrome/Edge:** lembra a pasta e **recarrega sozinho** quando o `manifest.json` muda (depois de `npm run models:build`). No Firefox, use "Trocar pasta…" para recarregar.
- **Página hospedada:** num servidor (GitHub Pages, por exemplo) carrega `assets/models/manifest.json` sozinha; para outro arquivo, use `?manifest=<url relativa>`.
- **Recursos:** animações, partículas por âncora, cenário de Marte ou estúdio, wireframe, pivôs/âncoras e validação por modelo. Dá para arrastar um `.glb` avulso para a tela.
- **Escopo:** é ferramenta de **validação**. Não coloque lógica de jogo nele.

## Comandos

```bash
npm run models                 # gera tudo (avatares, retratos, peças, planetas), valida e empacota em index.models.js
npm run models:build -- maya   # gera só um personagem
npm run models:build:portraits # gera os retratos de dificuldade (PNG, SVG e GLB)
npm run models:build:parts     # gera só as peças de foguete
npm run models:build:bodies    # gera os planetas (ex.: -- earth)
npm run models:validate        # só valida
npm run web:models             # só empacota os GLBs e specs usados pelo index.html em index.models.js
```
