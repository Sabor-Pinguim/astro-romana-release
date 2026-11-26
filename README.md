# Astro Romana

https://sabor-pinguim.github.io/astro-romana-release/

A cooperative browser game about designing and flying a science mission to Mars, made for the
**NASA Space Apps Challenge 2026**, challenge ["Space Mission Design Game"](docs/description.md).

A crew of up to four designs the rocket and its payload, launches, flies, lands on real Martian terrain, runs
experiments based on real missions and tries to bring everyone home. Each crew member is responsible for part of the
mission's resources (mass, budget, power, data, communications, science), so every decision is a trade-off the team
has to argue about. Roles without a player are taken by AI crewmates.

Everything that the game presents as real comes from a mission or a dataset, with its source: the landing-site
terrain from orbital elevation data, the rocket parts from published user guides, the landing profile from
Perseverance, and even the soundtrack, which is generated from radiation that Curiosity measured on Mars.

## Contents

- [Play](#play)
- [The crew](#the-crew)
- [The mission](#the-mission)
- [Built on real data](#built-on-real-data)
- [A soundtrack made from real Mars data](#a-soundtrack-made-from-real-mars-data)
- [How it is built](#how-it-is-built)
- [Development](#development)
- [Repository layout](#repository-layout)
- [Credits](#credits)

## Play

Open `index.html` in a modern browser. No install, build or account is needed: the game runs straight from the
files on disk or from any static web server.

- **Internet:** three.js and i18next load from a CDN (the texts have an offline fallback) and the fonts from Google
  Fonts (without them, system fonts). Team play and the online leaderboard need the room server.
- **Languages:** English, Portuguese and Spanish. Settings also hold metric or imperial units, the interface scale
  and fullscreen. Served over HTTPS, the game can be installed on a phone's home screen and opens fullscreen.
- **Screens:** works on desktop and phone widths, and respects the system's reduced-motion setting. Without WebGL,
  the 2D map and the 2D rocket plan stay available.
- **Controls:** mouse, touch and keyboard. The cockpit shows the keys of each stage on screen, and a **?** button
  explains how to solve each experiment and flight stage.
- **Shortcut:** `index.html#surface-jezero` or `index.html#surface-gale` opens the landing site directly.

## The crew

| Crew member | Role | Resources | In the cockpit |
|---|---|---|---|
| **Helena** | Commander and pilot | Mass, launch vehicle, budget | Flies the liftoff, the cabin docking and the landing |
| **Lucas** | Systems engineer | Power, mission lifetime | Resets breakers and separates stages |
| **Oscar** | Data and telecom specialist | Data, communications | Flies the approach to the tank in orbit |
| **Maya** | Mission scientist and medical officer | Science value, crew health | Runs the propellant transfer once docked; shields the crew in a solar storm |

Each crew member owns experiments based on real missions, 21 in all. Every mission draws 8: one in Mars orbit and
one on the ground for each crew member.

| Crew member | In Mars orbit | On the ground |
|---|---|---|
| **Helena** | Aerobraking (MRO, TGO) · Roll for the radar (SHARAD) | Surface escort (Ingenuity scouting) · Precision landing (Terrain Relative Navigation, played during the descent) |
| **Lucas** | Roll-out solar array (ROSA) · Keep the detector cold (CRISM) | Oxygen oven (MOXIE) · Drilling (Curiosity, InSight) |
| **Oscar** | Laser to Earth (DSOC on Psyche) · Image compression (Kepler, Galileo) | Orbiter pass (Electra UHF relay) · Radio geodesy (RISE on InSight) |
| **Maya** | High-resolution photo (HiRISE) · Ice radar (SHARAD) · Methane hunter (TGO) | Biosignature hunter (PIXL + SHERLOC) · Laser on rocks (SuperCam, ChemCam) · Listening for marsquakes (SEIS) · Choosing samples (Perseverance) · Radiation alert (RAD) · Martian greenhouse (Veggie) |

Character sheets: [characters/characters.md](characters/characters.md). Experiments and their sources:
[docs/minigames.md](docs/minigames.md) and [references/experiments/](references/experiments/).

## The mission

1. **Choose.** A 3D solar system (real orbital periods and axial tilts) opens on Mars. In the lobby the crew picks
   solo or a team room, a difficulty level, the destination, a landing site, **Jezero** (Perseverance) or **Gale**
   (Curiosity), each shown with a real HiRISE photo, and the crew.
2. **Design.** 55 rocket parts are modelled on real hardware, and the builder offers the 46 that fit a Mars launch:
   8 launch and upper-stage engines (Rutherford, Merlin 1D, RL10, RS-25 and Raptor, with vacuum versions), 5 stage
   tanks, 3 structures, 2 fin sets and 28 equipment and cabin modules, such as PIXL/SHERLOC/SuperCam, HiRISE/SHARAD,
   Electra UHF relay, the DSOC laser, ROSA solar arrays, LOFTID, Terrain Relative Navigation, life support and a
   storm shelter. Each part card shows whether it helps the experiments, the score or the flight. Live telemetry
   shows liftoff mass, thrust-to-weight, Δv stage by stage (rocket equation), power generated against power drawn,
   and cost against budget. Orbit takes 9,400 m/s and the Mars transfer 4,300 m/s (game values, near the real
   9–10 km/s and 3.6 km/s), so the design has to plan an orbital refuelling.
3. **Launch.** The rocket stands on the pad, in a low-poly version of the Sorocaba Technology Park, while the
   countdown runs. The climb follows its thrust-to-weight. A rocket without a working engine never lights, one that
   is too heavy strains and shuts down, and one without enough Δv aborts and splashes down in the ocean.
4. **Fly.** From an Orion-style cockpit the crew flies four timed stages: liftoff and Max-Q (keep the navball target
   centred), crew-cabin docking, docking with a tank in orbit to refuel, and the landing, which follows
   Perseverance's real entry, descent and landing profile. After the refuelling, a timed window in Mars orbit gives
   each crew member their orbit experiment. Design choices show up in flight: a heavy rocket wallows in the wind,
   fins damp the gusts, a power deficit throws sparks, and without a storm shelter a solar storm on the way leaves
   one crew member slower on the surface.
5. **Explore.** The crew walks on real terrain around the actual landing points, with a compass and an emote wheel,
   and each member runs their ground experiment. Each experiment ends with a **Real fact** card about the real
   mission. When the surface timer runs out, anyone not back at the lander is left behind.
6. **Debrief.** Each experiment earns up to 3 stars (25 points each); the game also scores the flight, the
   instruments carried and the landing, multiplies the total by the difficulty, ranks the crew on a podium and
   explains each result. A failed launch shows its cause, and the crew can redesign and fly again. Team missions go
   to the online leaderboard and solo ones to a local one (top missions and top astronauts, by difficulty and site).

Seats without a player are AI crewmates, who do their experiments with an average result (1–2 stars).

| Difficulty | Budget | Surface time | Score | Rules |
|---|---|---|---|---|
| Easy | +20% | 210 s | ×0.75 | Rules only warn |
| Normal | Base | 180 s | ×1 | Rules apply, with some tolerance on Δv |
| Hard | −20% | 140 s | ×1.5 | Every rule, including matching each engine with a tank of the right propellant |

Game design: the 21 experiment minigames on 7 reusable mechanics are in [docs/minigames.md](docs/minigames.md).

## Built on real data

| In the game | Data | Source |
|---|---|---|
| Landing-site terrain: 512 × 512 m to walk on, horizon out to 100 km | HiRISE stereo elevation models and orthoimages; CTX elevation models; MOLA–HRSC blended global elevation | NASA MRO (via the USGS Astrogeology STAC catalog); NASA MGS and ESA Mars Express |
| Landing-site photos in the lobby | HiRISE images | NASA/JPL-Caltech/University of Arizona |
| Soundtrack and the radiation reading near Mars | Curiosity RAD dose rate | NASA SPDF CDAWeb and PDS PPI |
| Low-poly Earth model (generated; not shown in this version) | MODIS land cover, ETOPO1 relief, AMSR2 sea ice | NASA GIBS, NOAA, NSIDC/JAXA |
| Solar system and Δv budget | Orbital periods, axial tilts, gravitational parameters, radii | NASA NSSDC Planetary Fact Sheets, JPL Solar System Dynamics |
| Engines and tanks | Thrust, specific impulse, mass, propellant | User guides and fact sheets from NASA, ESA, SpaceX, ULA, Rocket Lab and Northrop Grumman |
| Landing | Perseverance entry, descent and landing timeline | NASA/JPL |
| Experiments and Real fact cards | Mission results | NASA/JPL, ESA, CNES, DLR, JAXA, ISRO |

- **Real or game value:** every number shown as real has a source in [references/](references/). Every value tuned
  for gameplay is marked `game-balance` in the code.
- **Full list:** links, licenses and credits for each source are in [references/README.md](references/README.md).

## A soundtrack made from real Mars data

The game's background sound is generated from the radiation that the Curiosity rover measured on the surface of Mars
(RAD instrument, NASA dataset `MSL_RAD_OBS-L2`). The **data** sets when each sound happens and how strong it is. The
**code** sets how it sounds: key, scale and timbres.

The audio is generated ahead of time, outside the game, in plain JavaScript with no libraries and no recorded sounds
(`npm run audio`). The same data always produces the same file. Details in [docs/audio.md](docs/audio.md).

### Surface ambience: `rad_surface_bed.wav` (40 s loop)

Four quiet Martian days (1–5 May 2024) compressed into 40 seconds, one sol every 10 seconds (about 8,900 times faster
than real time). RAD's dose rate has a daily cycle that follows surface pressure: through each sol, the atmosphere
above Gale crater thickens and thins, and so does the shielding. You can hear that cycle as the chord opens and
closes.

| Data | Sound |
|---|---|
| Dose rate from detector B, smoothed (the slow trend) | Brightness of the drone and how many notes of the chord sound: more dose, a more open chord |
| The same curve | Cutoff and level of the background hiss |
| Each reading well above the trend (more than 1.25 standard deviations) | A bell note, higher for a bigger deviation. Detector B (silicon) plays high, on the left; detector E (tissue-equivalent plastic) plays lower, on the right |

The quiet window holds 73 such readings, so the loop has 73 bell notes, each at the moment it was measured.

### Solar storm: `rad_storm_2024_05_20.wav` (32 s, plays once)

Forty-eight real hours, 20–21 May 2024, compressed into 32 seconds (1 second of audio = 1.5 hours). This is the
largest radiation surge RAD had measured since Curiosity landed in 2012: detector B went from 92.8 µGy/day before the
storm to 7,295.7 µGy/day at 06:15 UTC on 20 May, about 79 times higher, about 70 minutes after the last normal
reading (05:05 UTC). The next reading, at 05:22 UTC, was already well above normal: the storm had begun.

| Data | Sound |
|---|---|
| Measured dose rate | Rate of Geiger clicks: 0.4 per second before the event, proportional to the dose after it (about 31 per second at the peak) |
| Dose rate on a log scale | Level and brightness of the noise, dissonance and flutter of the drone |
| The largest jump between two consecutive readings | A deep impact, about 3.7 s into the file |

It plays over the ambience, in the same key. The manifest stores the storm's dose curve every 0.25 s of audio, so a
dose meter on screen can follow the sound exactly.

### Geiger counter: `geiger_click_1…4.wav`

Four short clicks the game fires at a rate that follows the dose:
`clicks per second = 0.5 × dose / 115.7`, capped at 30. The 115.7 µGy/day is the real median of the quiet window; the
0.5 clicks per second and the cap are game choices. Intervals are random (exponential), as in a real counter, and each
click picks one of the four files. On the surface the dose is the quiet one, so the counter ticks about once every 2 s.

### What comes from the data and what is a choice

| From the data | Musical choices (`game-balance`) |
|---|---|
| When each event happens, how strong it is, the daily cycle, the storm's onset and peak | Key of D, minor pentatonic scale, timbres, volumes, how much time is compressed |

### How it is made

- **Code:** [tools/audio/](tools/audio/) reads the stored measurements in
  [references/datasets/msl-rad/](references/datasets/msl-rad/README.md), synthesizes every sound (drone, hiss,
  bells, clicks, impact) and writes the WAV files and a `manifest.json` with the data windows, the mappings and the
  storm's dose curve.
- **Deterministic:** the random parts use a fixed seed, so the same data and code always produce the same bytes.
- **Seamless loop:** the ambience carries a WAV `smpl` loop chunk and one extra frame, so the seam is exact.
- **Formats:** 16-bit PCM; ambience at 24 kHz stereo (each file under 5 MB), clicks at 44.1 kHz mono.
- **Validation:** `npm run audio` checks format, levels and the loop seam. Whether it sounds good is up to our ears.
- **In the game:** on the Martian surface the game loops the ambience under the Geiger clicks; the storm track plays
  once at the solar storm event on the way to Mars. The game plays these files as they are and only sets their
  volume. The short interface and cockpit beeps are the exception: they are still synthesized live.

### Dataset

| | |
|---|---|
| Dataset | **`MSL_RAD_OBS-L2`**, "MSL/RAD Level 2 observational radiation data" |
| Variable | `DOSIMETRY_TOTAL_f` (quality-filtered dose rate, µGy/day): detector B (silicon, rover power source contribution removed) and detector E (tissue-equivalent plastic) |
| Instrument | Radiation Assessment Detector (RAD), Curiosity rover, Gale crater |
| Provider | NASA Space Physics Data Facility (SPDF), [CDAWeb](https://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/MSL_RAD_OBS-L2/variables); also archived at the [PDS PPI node](https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/AAREADME.TXT) (`MSL-M-RAD-3-RDR-V1.0`) |
| Instrument team | D. Hassler (PI), Southwest Research Institute ([Hassler et al. 2012](https://link.springer.com/article/10.1007/s11214-012-9913-1)) |
| Daily cycle | [Rafkin et al. 2014](https://doi.org/10.1002/2013JE004525), JGR Planets 119, 1345–1358 |
| Windows used | 1–5 May 2024 (surface ambience) and 20–21 May 2024 (solar storm), UTC |

- **Absorbed dose:** the files hold absorbed dose (gray), not dose equivalent (sievert), so they cannot be compared
  directly with figures such as "0.67 mSv/day".
- **Press figures:** the "8,100 micrograys" quoted in NASA's article about this storm does not match the dataset.
  The game uses the measured values.

The downloaded measurements, the derived values and the caveats are in
[references/datasets/msl-rad/](references/datasets/msl-rad/README.md).

## How it is built

### The game

Plain HTML, CSS and JavaScript with no build step: the page loads classic scripts in order, and the 3D scripts
import [three.js](https://threejs.org) 0.186.1 from the CDN through an import map. The 3D models and terrains come
bundled in `index.models.js` and `index.terrain.<site>.js`, so the game also works from `file://`, where the
browser blocks `fetch`.

| File | Screen or job |
|---|---|
| [index.html](index.html) | Structure of every screen |
| [web/app.js](web/app.js) | Game flow: lobby, rocket builder, telemetry, cockpit rules, surface timer, scoring, leaderboards |
| [web/orbit.js](web/orbit.js) | 3D solar system |
| [web/launch.js](web/launch.js) | Launch pad, countdown, liftoff, splashdown |
| [web/flight.js](web/flight.js) | 3D cockpit and the debrief podium |
| [web/views.js](web/views.js) | 3D views from the generated models: menu, lobby, rocket builder, Mars surface |
| [web/experiments.js](web/experiments.js) | The 21 experiments and the draw of each run (8: one orbit and one ground experiment per crew member) |
| [web/minigames/](web/minigames/) | The experiment minigames: a shared core plus one file per experiment (seeded layouts, 3 levels, stars) |
| [web/experiment-run.js](web/experiment-run.js) | Links the minigames to the game: the run, the experiment dialog, bots and points |
| [web/minigame-guide.js](web/minigame-guide.js) | The "How to solve" guide of each experiment and flight stage |
| [web/i18n.js](web/i18n.js), [web/locales/](web/locales/) | Texts in English, Portuguese and Spanish (i18next) |
| [web/settings.js](web/settings.js), [web/units.js](web/units.js) | Settings screen; metric and imperial units |
| [web/net.js](web/net.js), [web/chat.js](web/chat.js) | Link to the room server for team play; the room's text chat |
| [web/dev.js](web/dev.js) | Hidden Dev Mode: jump to any stage or experiment |
| [web/version.js](web/version.js) | The game version shown on the menu |
| [web/styles.css](web/styles.css), [web/minigames.css](web/minigames.css) | Styles |

The look is faceted low poly: flat colours, 45° chamfers, no blur or rounded corners, in the interface as in the
3D models. Palette, fonts (Barlow and Chakra Petch) and rules: [docs/visual-identity.md](docs/visual-identity.md).

### Generated assets

The crew, the rocket parts, the portraits, the terrains, the soundtrack and the minigame clips are generated by code,
never edited by hand. The exceptions are the Saturn V model flying on the menu and the Dev Mode easter-egg sound. The
generators run in Node.js and are deterministic (the clips, recorded in real time, are the exception), and their
outputs are committed, so anyone can open the game without running them.

| Pipeline | Command | What it does | Output |
|---|---|---|---|
| Crew, rocket parts, portraits, Earth | `npm run models` | Builds every model with three.js and exports GLB: 4 avatars (at most 3,000 triangles, no textures) on a shared 15-joint rig with idle, walk, wave and action animations and particle anchors with presets under Mars gravity; 55 rocket parts; Nancy Grace Roman portraits for the difficulty screen; a low-poly Earth coloured from real land cover, relief and sea ice. Checked by our validator and the Khronos glTF Validator | [assets/models/](assets/models/), `index.models.js` |
| Mars terrain | `npm run terrain` | Reads HiRISE elevation models and orthoimages (geotiff.js), removes the shadows baked into the photo so the game light does not shade twice, and adds a 100 km horizon from CTX and the MOLA–HRSC global model, with Mars curvature. Each GLB stays under 5 MB | [assets/terrain/](assets/terrain/), `index.terrain.<site>.js` |
| Soundscape | `npm run audio` | See [the soundtrack](#a-soundtrack-made-from-real-mars-data) | [assets/audio/](assets/audio/) |
| Landing-site photos | `npm run web:sites` | Real HiRISE photo of each site for the lobby | [assets/sites/](assets/sites/) |
| "How to solve" clips | `npm run web:clips` | Plays each minigame and cockpit stage the right way in a headless browser (an autopilot per clip reads the seeded layout) and records it as a looping GIF, in English, Portuguese and Spanish | [assets/minigames/](assets/minigames/) |

The builds read only the data stored in [references/datasets/](references/datasets/), so they work offline and give
the same result on any machine. A model viewer for checking animations, particles and rig: open
[tools/model-viewer/index.html](tools/model-viewer/index.html) and pick `assets/models`.

### Team play

[multiplayer/](multiplayer/README.md) holds a WebSocket room server (Node.js and `ws`) with room codes and invite
links, a browser of public rooms (rooms can also be private or have a password), text chat, and a host who can
remove a player. It only relays messages: the host's browser runs the game rules, a player who drops can return to
the same seat, and every seat without a player stays with the AI. The same server keeps the online leaderboard
(SQLite). It runs on a small cloud VM behind Caddy, which also serves the game, and updates itself from `main`.
Plan and status: [docs/multiplayer.md](docs/multiplayer.md).

## Development

Requires Node.js 20.19 or newer (22.13 or newer for the room server).

```bash
npm install                    # once: three, geotiff, the glTF validator and ESLint
npm run models                 # crew, rocket parts, portraits and Earth; validates and bundles index.models.js
npm run terrain                # Mars terrains; then npm run web:models to bundle them
npm run audio                  # soundscape from the RAD data; validates
npm run web:sites              # HiRISE photos of the landing sites
npm run check                  # lint, imports, versions and translations
npm run web:smoke              # one mission end to end in headless Chrome or Edge, failing on any error
npm run web:clips              # records the "How to solve" clips by playing each minigame (assets/minigames)
npm run web:audit:mobile       # every screen at desktop and phone sizes
node tools/web/check-experiments.mjs  # experiment minigames: texts (en/pt/es), solvable layouts, the draw
cd multiplayer && npm install && npm start   # room server and test page on localhost:8787 (npm test checks it)
```

- **Downloading data again:** `npm run models:fetch:bodies`, `npm run terrain:fetch` and `npm run audio:fetch`
  download the source data again. Normal builds do not need the network.
- **Continuous integration:** every push and pull request runs `npm run check`, the room server tests and the smoke
  test ([.github/workflows/ci.yml](.github/workflows/ci.yml)).
- **Contributing:** the rules for people and AI agents are in [AGENTS.md](AGENTS.md). Every commit raises the
  version with `npm run version:bump` and adds a [CHANGELOG.md](CHANGELOG.md) entry; a pre-commit hook checks it.

## Repository layout

```text
index.html               the game; index.models.js and index.terrain.*.js are generated bundles
web/                     game scripts and styles
assets/                  GENERATED: models, terrain, audio, landing-site photos
tools/
  modeling/              avatars, rocket parts and planets, generated by code
  terrain/               real Mars terrain from HiRISE, CTX and MOLA–HRSC
  audio/                 soundscape from the RAD data
  web/                   bundles for the page, landing-site photos, page audits and the smoke test
  model-viewer/          HTML viewer for checking the models
  minigame-lab/          HTML lab for playing any experiment minigame by level, seed and language
  version.mjs            keeps the version the same everywhere (npm run version:bump / version:check)
  check-imports.mjs      checks the imports of the Node tools
  server-admin.mjs       room server status and restart from your machine (npm run server:status / server:restart)
multiplayer/             room server, client, test page and VM deploy (own package)
references/              data and sources: datasets, rocket parts, experiments, prototypes
docs/                    challenge description and game design
characters/              crew character sheets
.github/workflows/       continuous integration
AGENTS.md                rules for anyone, person or AI agent, who changes the repository
CHANGELOG.md             every version and what changed
AUDITORIA.md             technical audit and its status (Portuguese)
```

| Document | Content |
|---|---|
| [docs/description.md](docs/description.md) | The official challenge statement |
| [characters/characters.md](characters/characters.md) | The four crew members and their resources |
| [docs/minigames.md](docs/minigames.md) | Experiments and minigames per crew member, and the flight stages |
| [docs/experiments-implementation.md](docs/experiments-implementation.md) | How the experiments, the draw, the bots and the star scoring work |
| [docs/rocket-consequences.md](docs/rocket-consequences.md) | What a badly built rocket changes in the mission |
| [docs/audio.md](docs/audio.md) | The radiation soundscape |
| [docs/visual-identity.md](docs/visual-identity.md) | Visual identity |
| [docs/multiplayer.md](docs/multiplayer.md) | Room server and client integration |
| [references/parts/parts.md](references/parts/parts.md) | Real rocket parts: data, photos and modelling notes |
| [references/experiments/](references/experiments/) | Real Mars experiments with sources |

## Credits

- **Mars imagery and terrain:** NASA/JPL-Caltech/University of Arizona (HiRISE); NASA/JPL-Caltech/Malin Space
  Science Systems (CTX); USGS Astrogeology (DTMs and STAC catalog); MOLA: NASA/GSFC; HRSC: ESA/DLR/FU Berlin
  (CC BY-SA 3.0 IGO), in Fergason, Hare and Laura (2018), *HRSC and MOLA Blended Digital Elevation Model at 200m v2*.
- **Radiation:** MSL RAD, D. Hassler (PI), Southwest Research Institute; NASA SPDF and PDS PPI.
- **Earth:** NASA LP DAAC and GIBS (MODIS), NSIDC and JAXA (AMSR2), NOAA NCEI (ETOPO1).
- **Libraries and fonts:** three.js (MIT), i18next (MIT), geotiff.js (MIT), Khronos glTF Validator (Apache-2.0), ws
  (MIT), ESLint (MIT, development only), Barlow and Chakra Petch (SIL Open Font License, served by Google Fonts).
- **AI:** Claude Code (Anthropic), OpenAI Codex and Google Antigravity as coding assistants for the game, the
  generators and the data pipelines, all following the same rules in [AGENTS.md](AGENTS.md). The team checks every
  result and every number against the sources.

The game uses no real agency logos or insignia. Full source list, with links and licenses:
[references/README.md](references/README.md).
