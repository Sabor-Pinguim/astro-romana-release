# AGENTS.md: regras de desenvolvimento do Astro Romana

Regras para **qualquer pessoa ou agente de IA** (Claude Code, OpenAI Codex, Google Antigravity, Cursor etc.) que mexer neste repositório.

- Este é o arquivo principal de instruções para agentes: as ferramentas acima o leem sozinhas. Algumas pastas têm um `AGENTS.md` próprio, que soma a este (veja a seção 14). Não crie cópias por ferramenta.
- Se uma regra daqui conflitar com o pedido de alguém do time, pergunte antes de seguir.
- Se o time mudar uma regra, atualize este arquivo no mesmo commit.

---

## 1. O projeto

Jogo cooperativo (1 a 4 jogadores) para o **NASA Space Apps Challenge 2026**, desafio "Space Mission Design Game". Os jogadores projetam e operam uma missão científica a Marte, equilibrando massa, energia, orçamento, dados, comunicação e tempo de vida.

| Documento | Conteúdo |
|---|---|
| [docs/description.md](docs/description.md) | Enunciado oficial do desafio (em inglês) |
| [characters/characters.md](characters/characters.md) | Os 4 personagens jogáveis e os recursos de cada um |
| [docs/minigames.md](docs/minigames.md) | Experimentos e minigames por personagem |
| [references/README.md](references/README.md) | Catálogo de tudo o que o projeto usa (dados, imagens, código, fontes, serviços), com link, uso e licença; base do formulário do Space Apps. Fonte nova entra aqui também |
| [references/experiments/](references/experiments/) | Dados reais de missões, com fontes |
| [references/parts/parts.md](references/parts/parts.md) | Peças reais de foguete (motores, tanques): tiers, dados, fotos e instruções low poly |
| [references/datasets/msl-rad/](references/datasets/msl-rad/) | Radiação medida pelo detector RAD do Curiosity, com fonte |
| [references/datasets/earth/](references/datasets/earth/) | Grades globais da Terra (cobertura do solo, relevo, gelo marinho) que geram o planeta low poly |
| [references/datasets/mars-terrain/](references/datasets/mars-terrain/) | Fontes dos terrenos reais de Marte (HiRISE, CTX, HRSC–MOLA): recortes usados pelo build, imagens, versões, licenças e créditos |
| [docs/visual-identity.md](docs/visual-identity.md) | Identidade visual (low poly facetado): paleta, fontes, formas, arte gerada |
| [docs/audio.md](docs/audio.md) | Paisagem sonora gerada a partir desses dados de radiação |
| [docs/multiplayer.md](docs/multiplayer.md) | Multiplayer: servidor de salas (`multiplayer/`) e o plano de integração do cliente |

---

## 2. Estrutura do repositório

```text
docs/                   design do jogo (PT-BR) e material do desafio
references/             dados reais com fontes (EN): experimentos, peças, datasets
index.html              o jogo (MVP web, three.js); index.models.js e index.terrain.*.js são GERADOS
web/                    estilos e scripts da página, por responsabilidade; textos em web/locales/
assets/
  models/               GERADO: GLBs + manifest.json (não editar à mão)
  audio/                GERADO: WAVs + manifest.json (não editar à mão)
  terrain/              GERADO: terrenos reais de Marte (GLB com textura e horizonte + manifest.json)
  sites/                GERADO: foto real (HiRISE) de cada local de pouso para o lobby (tools/web/site-photos.mjs)
tools/
  modeling/             gerador procedural dos modelos 3D (Node + three.js); regras em tools/modeling/AGENTS.md
  model-viewer/         visualizador HTML para validar modelos (seção 6)
  audio/                gerador da paisagem sonora a partir de dados reais; regras em tools/audio/AGENTS.md
  terrain/              terrenos a partir de DTMs do HiRISE; regras em tools/terrain/AGENTS.md
  web/                  empacota modelos e specs da página (index.models.js) e audita a página e as traduções
  version.mjs           sobe e confere a versão em todos os lugares; o gancho .githooks/pre-commit o usa (seção 10)
package.json            versão do projeto, dependências e scripts (seção 12)
CHANGELOG.md            histórico de versões (atualizado obrigatoriamente a cada commit)
multiplayer/            servidor de salas (Node + ws), cliente RoomClient, página de teste e deploy (VM no GCP com Caddy); pacote próprio
```

---

## 3. Stack e decisões técnicas

| Tema | Decisão | Por quê |
|---|---|---|
| Jogo (MVP Hackathon) | **HTML / CSS / JS sem etapa de build** (`index.html` + `web/`), com Three.js `0.186.1` e `i18next` 23.16.8 do CDN (fallback offline em `web/i18n.js`) | Roda direto no navegador (`file://` ou hospedado) e reaproveita os GLBs e WAVs gerados |
| Assets | `assets/` (models, audio, terrain), saída dos geradores offline | Um só lugar para o jogo, o visualizador e os pacotes da página |
| Multiplayer | Servidor de salas em `multiplayer/` (WebSocket; VM no GCP com Caddy, que também serve o jogo) que só repassa mensagens; o host (Helena) roda as regras. No jogo, `web/net.js` (`window.ASTRO_NET`); plano e estado da integração: [docs/multiplayer.md](docs/multiplayer.md) | O fluxo e o game loop atuais seguem no navegador; vaga sem jogador fica com a IA |
| Ferramentas | Node ≥ 20; `three` fixado em **0.186.1** (mesma versão nos import maps do visualizador e do `index.html`) | Builds reprodutíveis |

---

## 4. Regras de código

### HTML e three.js (o jogo, `index.html`)
- **Identidade visual:** siga [docs/visual-identity.md](docs/visual-identity.md) (low poly facetado, paleta, fontes, formas, arte gerada). Se mudar o visual, atualize esse arquivo no mesmo commit.
- **Arquivos separados, sem build:** `index.html` contém a estrutura e `web/` reúne estilos e scripts por responsabilidade. Os scripts locais devem funcionar também em `file://`; o three.js vem do CDN, na mesma versão fixada do visualizador. A tela tem que funcionar sem WebGL (o mapa 2D e a planta 2D são o fallback).
- **3D e dados na página:** vêm de `index.models.js` e de `index.terrain.<sítio>.js` (terreno de cada local de pouso, carregado no pouso), gerados por `npm run web:models` (o `file://` bloqueia `fetch`); `npm run models` já o roda.
- **Números de balanceamento** (massa, potência, custo, velocidades) ficam em dados ou constantes nomeadas, nunca soltos no código. Cada valor diz se é real (com a fonte em `references/`) ou de jogo (`game-balance`).
- **Superfície:** `index.html#surface-<sítio>` abre direto o pouso; `window.ASTRO_SURFACE` expõe estado e `goTo(id)` para testes.
- **Teste** em 1440×900, 390×844 (retrato), 915×412, 844×390 e 667×375 (paisagem mobile) e com movimento reduzido (`npm run web:audit:mobile`).

### JavaScript (ferramentas)
- Módulos ES puros (`.mjs`), sem etapa de build.
- Dependências novas só se necessárias, sempre com **versão exata**.
- Ferramentas não contêm lógica de jogo.

---

## 5. Pipeline de modelos 3D

**Antes de mexer em `tools/modeling/`, `tools/model-viewer/` ou `assets/models/`, leia [tools/modeling/AGENTS.md](tools/modeling/AGENTS.md)**: convenções geométricas, orçamento, rig, animações, partículas, planetas e retratos (seções 5.1 a 5.8). O essencial:
- O código em `tools/modeling/` é a fonte da verdade: os GLBs são gerados. **Nunca edite um GLB à mão**, nem no Blender.
- Low poly facetado, sem texturas, só cores da paleta (`lib/palette.mjs`); sem logos reais e sem cruz vermelha (primeiros socorros: cruz branca em fundo verde).
- Todos os avatares têm os mesmos 15 pivôs, com nomes fixos: não renomeie.
- Ao mudar um modelo: `npm run models` sem ✘, conferir no visualizador e fazer commit **junto** do código, dos GLBs e do `manifest.json`.

---

## 6. Visualizador de modelos (`tools/model-viewer/`)

- Abra `tools/model-viewer/index.html` no navegador e escolha `assets/models`; o uso completo está em [tools/modeling/AGENTS.md](tools/modeling/AGENTS.md) (seção 6).
- É ferramenta de **validação**: não coloque lógica de jogo nele.

---

## 7. Pipeline de áudio (paisagem sonora da radiação)

**Antes de mexer em `tools/audio/` ou `assets/audio/`, leia [tools/audio/AGENTS.md](tools/audio/AGENTS.md).** O essencial:
- `tools/audio/` gera offline os WAVs de `assets/audio/` a partir dos dados reais do RAD: edite o código e rode `npm run audio` (sem ✘); nunca edite um WAV.
- Nada de síntese em tempo real: o jogo só toca arquivos prontos e ajusta o volume.
- Ouça o resultado e faça commit **junto** do código, dos WAVs e do `manifest.json`.

---

## 8. Dados científicos e textos do jogo

- **Números "reais":** tudo que for apresentado ao jogador como real vem de `references/`, com a fonte.
- **Marcas nas referências:**
  - **⚠** = fontes divergem: confira antes de usar como fato.
  - **n/f** = não encontrado: use um valor de jogo e marque como fictício.
- **Marcas extras:** `derived` = calculado a partir de outros valores (com a fórmula); `est.` = estimado por nós (diz como).
- **Peças de foguete:** pasta `references/parts/<engines|tanks|structures|cockpit|fins>/<id>/` com `README.md` no formato de `_template.md` (mesmas seções e chaves) e fotos. Os números de jogo e de simulação de cada peça (com a fonte de cada um) ficam em `tools/modeling/parts/specs.mjs` e saem no `manifest.json` das peças.
- **Fotos de referência:** só com licença livre (domínio público, CC0, CC BY, CC BY-SA), com fonte, autor e licença na tabela do README. As demais entram só como link.
- **Cards "Fato real":** nunca invente fatos.
- **Datas:** o "hoje" do projeto segue a data real. Status de missões (operando, perdida, cancelada) devem ser conferidos quando forem usados.

---

## 9. Idioma

| O quê | Idioma |
|---|---|
| Docs de design do time (`docs/`) | PT-BR |
| Textos vistos pelo jogador (telas, nomes e descrições das peças) | Inglês (padrão), Português-BR e Espanhol (`web/locales/{en,pt,es}.js`, via `i18next`) |
| Enunciado do desafio e `references/` | Inglês |
| Código, identificadores, nomes de nós, arquivos e commits | Inglês |

- **Validar a tradução:** `npm run i18n:check` (chaves e placeholders iguais nos 3 idiomas, chaves usadas no código) e `npm run i18n:audit` (telas em en/pt/es e em pseudo-localização, `index.html?pseudo`). Texto que o código preenche leva `data-i18n-dynamic` no HTML; nome próprio, `translate="no"`; exceção proposital no código, `// i18n-ok`.

---

## 10. Git, versionamento e changelog

- **Repositório exclusivo (`astro-romana-release`):** Nunca, jamais toque em outro repositório que não seja o `Sabor-Pinguim/astro-romana-release` (pasta local `astro-romana-v2`). O repositório antigo (`astro-romana`) **não pode ser tocado em hipótese alguma** (nem `push`, nem `pull`, nem `fetch`, nem leitura/edição local).
- **Coordenação entre agentes (`SHARED_CONTEXT.md`, no `.gitignore`):**
  - Antes de editar ou commitar, leia `SHARED_CONTEXT.md` (se existir) para ver o que outro agente está alterando.
  - Registre sua frente, horário e lista de arquivos em uso; nunca toque em arquivos listados por outro agente nem use `git add .` (faça `git add` explícito dos seus arquivos).
  - Ao concluir ou commitar, remova sua linha do arquivo. Entradas antigas já commitadas podem ser limpas.
- **Versão (`MAJOR.MINOR.PATCH`) a cada commit:** todo commit, de qualquer pessoa ou agente, sobe a versão com `npm run version:bump`:
  - `-- patch` (padrão): correções, ajustes, refatorações, docs e manutenção (`fix:`, `docs:`, `chore:`). Ex.: `1.3.1` → `1.3.2`.
  - `-- minor`: **features grandes** / entregas significativas; zera o patch. Ex.: `1.3.2` → `1.4.0`.
  - `-- major`: só quando o time pedir explicitamente.

  O script grava a versão em `package.json`, `package-lock.json` e `web/version.js` (o menu lê dali); `npm run version:check` confere se todos batem. Não ponha a versão em outro arquivo.
- **Versão do servidor de salas:** própria, em `multiplayer/package.json` (aparece no `/health`). Mudou um `.mjs` de `multiplayer/` ou as dependências dele: `npm run version:bump:server -- patch`. A VM puxa o `main` a cada minuto e reinicia o servidor quando essa versão muda, assim que não houver sala aberta (no máximo 60 min); o jogo atualiza na hora. Mudança em `multiplayer/deploy/` ainda pede `setup-v2.sh` à mão ([multiplayer/README.md](multiplayer/README.md#the-v2-vm-automatic-updates)).
- **Gancho de pré-commit (`.githooks/pre-commit`, ligado pelo `npm install`):** barra o commit cujos arquivos mantêm a versão do último commit, discordam entre si, não têm a seção da nova versão preenchida no CHANGELOG ou mudam o servidor de salas sem subir a versão dele. Não confere merge, rebase nem cherry-pick. `--no-verify` só para o `--amend` do commit que já subiu a versão.
- **Changelog obrigatório:** o `version:bump` abre no topo do [CHANGELOG.md](CHANGELOG.md) a seção `## [X.Y.Z] - YYYY-MM-DD`; liste nela, de forma clara, o que foi adicionado, alterado ou corrigido.
- **Commits:** no padrão já usado pelo time (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`), em inglês.
- **Fazer commit de:** assets gerados e pacotes da página (`index.models.js`, `index.terrain.*.js`), assim quem não tem Node consegue abrir o jogo.
- **Nunca fazer commit de:** `node_modules/`, builds exportadas, áudios de rascunho.
- **Binários grandes:** acima de 5 MB, só depois de combinar com o time.

---

## 11. Checklist antes de concluir uma tarefa

- [ ] O gerador que você tocou passa sem ✘: `npm run models` (e o visualizador abre sem erros), `npm run audio`, `npm run terrain`.
- [ ] `npm run check` passa (lint só de bugs, imports das ferramentas, versão e traduções). O CI (`.github/workflows/ci.yml`) roda o mesmo a cada push, mais os testes do servidor e o `npm run web:smoke`.
- [ ] Se tocou na página: `npm run web:smoke` (uma missão de ponta a ponta, sem erros) e `npm run web:audit:mobile` (os tamanhos da seção 4).
- [ ] Nunca chame um local de `t` num script da página: ele esconde o helper de tradução (a regra `astro/no-shadow-t` do lint barra).
- [ ] `npm run i18n:check` passa, se você tocou em textos vistos pelo jogador.
- [ ] Nenhum número apresentado como real ficou sem fonte.
- [ ] Versão e changelog (seção 10): `npm run version:check` passa e a seção da nova versão está preenchida.
- [ ] Docs e este arquivo (ou o `AGENTS.md` da pasta) atualizados, se alguma convenção mudou.

---

## 12. Comandos

```bash
npm install                    # uma vez: three + validador glTF
npm run models                 # modelos 3D: gera tudo, valida e empacota (os demais em tools/modeling/AGENTS.md)
npm run audio                  # paisagem sonora: gera e valida (tools/audio/AGENTS.md)
npm run terrain                # terrenos reais de Marte (tools/terrain/AGENTS.md)
npm run web:sites              # fotos HiRISE dos locais de pouso (assets/sites; rede: NODE_OPTIONS=--use-system-ca)
npm run check                  # lint + imports + versão + traduções (o mesmo que o CI roda)
npm run web:smoke              # uma missão de ponta a ponta no Chrome/Edge headless; falha com qualquer erro
npm run web:audit:mobile       # a página nos tamanhos da seção 4 (--lang pt|es, --pseudo)
npm run i18n:check             # valida as traduções (i18n:audit: nas telas, com pseudo-localização)
npm run version:bump -- patch  # sobe a versão em todos os lugares (version:check só confere)
npm run version:bump:server -- patch   # mudou o servidor de salas: a VM o reinicia sozinha
npm run server:status          # versões e salas na VM; server:restart reinicia já (token no .env, nunca no git)
cd multiplayer && npm install && npm start   # servidor de salas + página de teste (localhost:8787); npm test valida
```

---

## 13. Referências para quem for mexer no pipeline

- **Skills de three.js:** [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills) (MIT). Ler `threejs-geometry`, `threejs-animation` e `threejs-asset-pipeline` antes de alterar o gerador ou o visualizador.

---

## 14. Ferramentas de IA que leem este arquivo

| Ferramenta | Como encontra este arquivo | Limite |
|---|---|---|
| OpenAI Codex (CLI, IDE, nuvem) | Lê o `AGENTS.md` de cada pasta, da raiz do Git até a pasta onde foi aberto | 32 KiB somados (`project_doc_max_bytes`) |
| Google Antigravity (App, IDE, CLI `agy`) | Lê o `AGENTS.md` da pasta aberta e das pastas acima até a raiz do repositório; sempre ativo | 24 KB por arquivo; 20 mil tokens somando todas as regras |
| Claude Code | O `CLAUDE.md` da raiz importa este arquivo (`@AGENTS.md`); o de uma pasta entra quando ele lê arquivos dela | — |

- **Tamanho:** mantenha este arquivo abaixo de ~20 KB para caber com folga nos limites acima.
- **Sem cópias:** não crie `GEMINI.md`, `.agents/rules/` nem `AGENTS.override.md` com cópias destas regras. O Antigravity soma todos os arquivos de regras que encontra, e as cópias divergem com o tempo.
- **Regras de uma parte só do projeto:** ficam num `AGENTS.md` da pasta, com um `CLAUDE.md` ao lado que o importa (`@AGENTS.md`). A seção correspondente daqui guarda o essencial e o aviso "leia antes de mexer", porque o Codex e o Antigravity, abertos na raiz, não leem os arquivos das pastas. Já divididas: `tools/terrain/`, `tools/modeling/` (com o visualizador) e `tools/audio/`.
