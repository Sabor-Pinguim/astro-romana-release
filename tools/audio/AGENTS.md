# AGENTS.md: paisagem sonora da radiação (`tools/audio/`)

Regras só desta pasta. Elas **somam** às do [AGENTS.md da raiz](../../AGENTS.md), que continua valendo (ficaram aqui porque o da raiz chegou ao limite de tamanho). É a antiga seção 7 da raiz, com a mesma numeração para as citações continuarem valendo. O mapeamento dos dados para o som está em [docs/audio.md](../../docs/audio.md).

## 7. Pipeline de áudio

- **O código é a fonte da verdade:** `tools/audio/` gera o som offline dos dados reais do RAD ([references/datasets/msl-rad/](../../references/datasets/msl-rad/)). Os WAVs em `assets/audio/` são **gerados**: edite o código e rode `npm run audio`.
- **Nada de síntese em tempo real:** o jogo só toca arquivos prontos e ajusta o volume.
- **Sem dependências:** JavaScript puro. O gerador é determinístico: os mesmos dados e o mesmo código geram os mesmos bytes.
- **Arquivos gerados:**

  | Arquivo | Tipo | Uso no jogo |
  |---|---|---|
  | `rad_surface_bed.wav` | loop, 40 s | Fundo na superfície de Marte |
  | `rad_storm_2024_05_20.wav` | único, 32 s | Tempestade solar real, por cima do fundo |
  | `geiger_click_<n>.wav` | únicos, 50 ms | Contador Geiger; a taxa segue a dose (parâmetros no `manifest.json`) |

- **Loops:** gere com `closeLoop()` (`lib/wav.mjs`): o WAV leva um chunk `smpl` e um quadro extra, para a emenda ficar exata. No `index.html` o loop é do elemento de áudio.
- **Formato:** PCM 16 bits. Ambientes em 24 kHz estéreo (cada arquivo abaixo de 5 MB); efeitos em 44,1 kHz mono.
- **Escolhas musicais** (tom de Ré, escala pentatônica menor, volumes, compressão de tempo) são `game-balance`. Os eventos e as curvas que as controlam vêm dos dados. O mapeamento está em [docs/audio.md](../../docs/audio.md) e no `manifest.json`.
- **Fluxo ao mudar o áudio:**
  1. `npm run audio`: gera e valida. Precisa passar sem ✘.
  2. Ouça os arquivos: a validação não julga se o som ficou bom.
  3. Faça commit **junto** do código, dos WAVs e do `manifest.json`.

## Comandos

```bash
npm run audio          # gera a paisagem sonora e valida
npm run audio:fetch    # baixa de novo os dados do RAD (só para mudar as janelas de dados)
```
