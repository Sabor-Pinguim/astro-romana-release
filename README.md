# Astro Romana

https://sabor-pinguim.github.io/astro-romana/

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
files on disk or from any static web server. It needs an internet connection only to load three.js from the CDN.

- **Screens:** works on desktop and phone widths, and respects the system's reduced-motion setting. Without WebGL,
  the 2D map and the 2D rocket plan stay available.
- **Controls:** mouse, touch and keyboard. The cockpit shows the keys of each stage on screen.
- **Shortcut:** `index.html#surface-jezero` or `index.html#surface-gale` opens the landing site directly.

## The crew

| Crew member | Role | Resources | In the cockpit | Surface experiment |
|---|---|---|---|---|
| **Helena** | Commander and pilot | Mass, launch vehicle, budget | Flies the liftoff, the cabin docking and the landing | **Escort route:** plan a safe route on a 5 × 5 grid around soft sand (Ingenuity scouting) |
| **Lucas** | Systems engineer | Power, mission lifetime | Resets breakers and separates stages | **Oxygen oven:** keep a MOXIE-style oven near 800 °C |
| **Oscar** | Data and telecom specialist | Data, communications | Docks with the tank in orbit and refuels, with Maya | **Relay pass:** choose what to send during a short Electra UHF pass |
| **Maya** | Mission scientist and medical officer | Science value, crew health | Orbital docking; seals the storm shelter | **Biosignature hunt:** search rock data as PIXL and SHERLOC did at Cheyava Falls |

Character sheets: [characters/characters.md](characters/characters.md).

## The mission

1. **Choose.** A 3D solar system (real orbital periods and axial tilts) opens on Mars. In the lobby the crew picks a
   landing site, **Jezero** (Perseverance) or **Gale** (Curiosity), each shown with a real HiRISE photo, and a
   difficulty level.
2. **Design.** The rocket builder has 55 parts based on real hardware: 13 engines (Rutherford, Merlin, RL10, RS-25,
   Raptor and others), 8 tanks, structures, fins and 28 equipment and cabin modules, such as PIXL/SHERLOC/SuperCam, HiRISE/SHARAD,
   Electra UHF relay, the DSOC laser, ROSA solar arrays, LOFTID, Terrain Relative Navigation, life support and a
   storm shelter. Live telemetry shows liftoff mass, thrust-to-weight, Δv stage by stage (rocket equation), power
   generated against power drawn, and cost against budget. Orbit takes 9,400 m/s and the Mars transfer 4,300 m/s,
   so the design has to plan an orbital refuelling.
3. **Launch.** The rocket stands on the pad, in a low-poly version of the Sorocaba Technology Park, while the
   countdown runs. The climb follows its thrust-to-weight. A rocket without a working engine never lights, one that
   is too heavy strains and shuts down, and one without enough Δv aborts and splashes down in the ocean.
4. **Fly.** From an Orion-style cockpit the crew flies four timed stages: liftoff and Max-Q (keep the navball target
   centred), crew-cabin docking, docking with a tank in orbit to refuel, and the landing, which follows
   Perseverance's real entry, descent and landing profile. Design choices show up in flight: a heavy rocket wallows
   in the wind, fins damp the gusts, and a power deficit throws sparks.
5. **Explore.** The crew walks on real terrain around the actual landing points, with a compass and an emote wheel,
   and each member runs an experiment. Each experiment ends with a **Real fact** card about the real mission. When the
   surface timer runs out, anyone not back at the lander is left behind.
6. **Debrief.** The game scores the flight, the experiments, the instruments carried and the landing, ranks the crew
   on a podium and explains each result. A failed launch shows its cause, and the crew can redesign and fly again.

| Difficulty | Budget | Rules |
|---|---|---|
| Easy | +20% | Rules only warn |
| Normal | Base | Rules apply, with some tolerance on Δv |
| Hard | −20% | Every rule, including matching each engine with a tank of the right propellant |

Game design: 21 experiment minigames from real missions on 7 reusable mechanics in
[docs/minigames.md](docs/minigames.md); this version plays the four surface experiments and the four flight stages.

## Built on real data

| In the game | Data | Source |
|---|---|---|
| Landing-site terrain: 512 × 512 m to walk on, horizon out to 100 km | HiRISE stereo elevation models and orthoimages; CTX elevation models; MOLA–HRSC blended global elevation | NASA MRO (via the USGS Astrogeology STAC catalog); NASA MGS and ESA Mars Express |
| Landing-site photos in the lobby | HiRISE images | NASA/JPL-Caltech/University of Arizona |
| Soundtrack and the radiation reading near Mars | Curiosity RAD dose rate | NASA SPDF CDAWeb and PDS PPI |
| Low-poly Earth | MODIS land cover, ETOPO1 relief, AMSR2 sea ice | NASA GIBS, NOAA, NSIDC/JAXA |
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
storm to 7,295.7 µGy/day at 06:15 UTC on 20 May, about 79 times higher, 53 minutes after the last normal reading.

| Data | Sound |
|---|---|
| Measured dose rate | Rate of Geiger clicks: 0.4 per second before the event, proportional to the dose after it (about 31 per second at the peak) |
| Dose rate on a log scale | Level and brightness of the noise, dissonance and flutter of the drone |
| The largest jump between two consecutive readings | A deep impact, about 3.7 s into the file |

It plays over the ambience, in the same key. The manifest stores the storm's dose curve every 0.25 s of audio, so a
dose meter on screen can follow the sound exactly.

### Geiger counter: `geiger_click_1…4.wav`

Four short clicks for the game to fire at a rate that follows the dose:
`clicks per second = 0.5 × dose / 115.7`, capped at 30. The 115.7 µGy/day is the real median of the quiet window; the
0.5 clicks per second and the cap are game choices. Intervals are random (exponential), as in a real counter, and each
click picks one of the four files.

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
- **In the game:** on the Martian surface the game loops the ambience under a Geiger counter. The storm track and its
  dose curve are ready for a solar storm event.

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

Plain HTML, CSS and JavaScript (ES modules, no build step) with [three.js](https://threejs.org) 0.186.1 from the CDN.
The 3D models and terrains come bundled in `index.models.js` and `index.terrain.<site>.js`, so the game also works
from `file://`, where the browser blocks `fetch`.

| File | Screen or job |
|---|---|
| [index.html](index.html) | Structure of every screen |
| [web/app.js](web/app.js) | Game flow: lobby, rocket builder, telemetry, cockpit rules, surface timer, scoring |
| [web/orbit.js](web/orbit.js) | 3D solar system |
| [web/launch.js](web/launch.js) | Launch pad, countdown, liftoff, splashdown |
| [web/flight.js](web/flight.js) | 3D cockpit and the debrief podium |
| [web/views.js](web/views.js) | 3D views from the generated models: menu, lobby, rocket builder, Mars surface |
| [web/experiments.js](web/experiments.js) | The 21 experiments and the draw of each run (8: one orbit and one ground experiment per crew member) |
| [web/minigames/](web/minigames/) | The experiment minigames: a shared core plus one file per experiment (seeded layouts, 3 levels, stars) |
| [web/experiment-run.js](web/experiment-run.js) | Links the minigames to the game: the run, the experiment dialog, bots and points |
| [web/net.js](web/net.js) | Link to the room server for team play |
| [web/styles.css](web/styles.css) | Styles |

The look is faceted low poly: flat colours, 45° chamfers, no blur or rounded corners, in the interface as in the
3D models. Palette, fonts (Barlow and Chakra Petch) and rules: [docs/visual-identity.md](docs/visual-identity.md).

### Generated assets

Every model, terrain and sound is generated by code from data, never edited by hand. The generators run in Node.js,
are deterministic, and their outputs are committed, so anyone can open the game without running them.

| Pipeline | Command | What it does | Output |
|---|---|---|---|
| Crew, rocket parts, Earth | `npm run models` | Builds every model with three.js and exports GLB: 4 avatars (at most 3,000 triangles, no textures) on a shared 15-joint rig with idle, walk, wave and action animations and particle anchors with presets under Mars gravity; 55 rocket parts; a low-poly Earth coloured from real land cover, relief and sea ice. Checked by our validator and the Khronos glTF Validator | [assets/models/](assets/models/), `index.models.js` |
| Mars terrain | `npm run terrain` | Reads HiRISE elevation models and orthoimages (geotiff.js), removes the shadows baked into the photo so the game light does not shade twice, and adds a 100 km horizon from CTX and the MOLA–HRSC global model, with Mars curvature. Each GLB stays under 5 MB | [assets/terrain/](assets/terrain/), `index.terrain.<site>.js` |
| Soundscape | `npm run audio` | See [the soundtrack](#a-soundtrack-made-from-real-mars-data) | [assets/audio/](assets/audio/) |
| Landing-site photos | `npm run web:sites` | Real HiRISE photo of each site for the lobby | [assets/sites/](assets/sites/) |

The builds read only the data stored in [references/datasets/](references/datasets/), so they work offline and give
the same result on any machine. A model viewer for checking animations, particles and rig: open
[tools/model-viewer/index.html](tools/model-viewer/index.html) and pick `assets/models`.

### Team play

[multiplayer/](multiplayer/README.md) holds a WebSocket room server (Node.js and `ws`) with room codes and invite
links. It only relays messages: the host's browser runs the game rules, and every seat without a player stays with
the AI. Plan and status: [docs/multiplayer.md](docs/multiplayer.md).

## Development

Requires Node.js 20 or newer (22 or newer for the room server).

```bash
npm install                    # once: three, geotiff and the glTF validator
npm run models                 # crew, rocket parts and Earth; validates and bundles index.models.js
npm run terrain                # Mars terrains; then npm run web:models to bundle them
npm run audio                  # soundscape from the RAD data; validates
npm run web:sites              # HiRISE photos of the landing sites
node tools/web/check-experiments.mjs  # experiment minigames: texts (en/pt/es), solvable layouts, the draw
cd multiplayer && npm install && npm start   # room server and test page on localhost:8787
```

- **Downloading data again:** `npm run models:fetch:bodies`, `npm run terrain:fetch` and `npm run audio:fetch`
  download the source data again. Normal builds do not need the network.

## Repository layout

```text
index.html               the game; index.models.js and index.terrain.*.js are generated bundles
web/                     game scripts and styles
assets/                  GENERATED: models, terrain, audio, landing-site photos
tools/
  modeling/              avatars, rocket parts and planets, generated by code
  terrain/               real Mars terrain from HiRISE, CTX and MOLA–HRSC
  audio/                 soundscape from the RAD data
  web/                   bundles for the page and landing-site photos
  model-viewer/          HTML viewer for checking the models
  minigame-lab/          HTML lab for playing any experiment minigame by level, seed and language
multiplayer/             room server, client and test page (own package)
references/              data and sources: datasets, rocket parts, experiments, prototypes
docs/                    challenge description and game design
characters/              crew character sheets
```

| Document | Content |
|---|---|
| [docs/description.md](docs/description.md) | The official challenge statement |
| [characters/characters.md](characters/characters.md) | The four crew members and their resources |
| [docs/minigames.md](docs/minigames.md) | Experiments and minigames per crew member, and the flight stages |
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
- **Libraries and fonts:** three.js (MIT), geotiff.js (MIT), Khronos glTF Validator (Apache-2.0), ws (MIT), Barlow
  and Chakra Petch (SIL Open Font License).
- **AI:** Claude Code as a coding assistant for the game, the generators and the data pipelines. The team checks every
  result and every number against the sources.

The game uses no real agency logos or insignia. Full source list, with links and licenses:
[references/README.md](references/README.md).
