# Changelog

All notable changes to **Astro Romana** (`astro-romana-v2`) are documented in this file.

Versioning rules (per [AGENTS.md](AGENTS.md#10-git-versionamento-e-changelog)):
- Every commit bumps the version (`MAJOR.MINOR.PATCH`):
  - **Patch (`X.Y.Z`):** small changes, bug fixes, tweaks, docs, chores (`1.3.0` → `1.3.1`).
  - **Minor (`X.Y.0`):** major/significant features; resets the patch to `0` (`1.3.1` → `1.4.0`).
  - **Major (`X.0.0`):** only when explicitly requested by the user/team.
- Keep `package.json`, `index.html`, `web/locales/en.js`, `web/locales/pt.js`, and this `CHANGELOG.md` synchronized on every commit.

---

## [1.4.1] - 2026-11-23

### Added
- **Nancy Grace Roman NPC 3D model & non-suited NPC pipeline (`astronaut: false`):** added [tools/modeling/characters/nancy.mjs](tools/modeling/characters/nancy.mjs) and generated [assets/models/characters/nancy.glb](assets/models/characters/nancy.glb), updated `tools/modeling/` (`build-avatars.mjs`, `characters/index.mjs`, `lib/avatar.mjs`, `lib/palette.mjs`, `validate.mjs`), `assets/models/manifest.json`, and documented her accent (`#9B5DE5`) in `docs/visual-identity.md`.
- **Local multi-agent coordination rule:** added `SHARED_CONTEXT.md` to `.gitignore` and documented shared coordination rules in `AGENTS.md` (§10).

### Changed
- **Multiplayer card:** split into "Find a room" and "Host a room" tabs, so connecting to a server no longer pushes you into creating a room; added an active-server bar with a shortcut to Settings.
- **Server change:** saving another server in Settings now clears and reloads the room browser.
- Default `NET_SERVER` is now `wss://v2.35-193-156-110.sslip.io/ws` (the v2 server running next to the old one on the same VM).

## [1.4.0] - 2026-11-23

### Added
- **Server Room Browser, Private & Password Rooms:** hosts can set a room name, mark a room as private (hidden from the browser, joinable only by code or invite link), and protect it with a salted `scrypt` password verified on join without ever exposing the plaintext secret.
- **Server SQLite Database & REST API (`multiplayer/db.mjs`, `multiplayer/server.mjs`):** built-in `node:sqlite` (`WAL` mode) stores finished co-op missions and individual astronaut scores, exposed over CORS-enabled `GET /api/rooms`, `GET /api/rooms/:code`, `GET /api/leaderboard`, and `POST /api/leaderboard`.
- **Player Name & Local Solo Leaderboard:** multiplayer requires an astronaut name persisted in `localStorage` (`astro-romana-player-name`) and shown in the crew cards; solo runs are stored locally in `localStorage` (`astro-romana-solo-leaderboard`).
- **Leaderboards Screen (`#leaderboard`) & Results Ranking:** new **Leaderboards** button on the main menu with Server (Co-op) / Local (Solo) and Top Missions / Top Astronauts views filtered by difficulty and landing site, plus a live leaderboard panel on the Mission Results screen.
- **VM Infrastructure Updates (`multiplayer/deploy/`):** added `StateDirectory=astro-romana` to `astro-rooms.service`, `handle /api/*` reverse proxy to `Caddyfile.site`, and `DB_PATH` + `astro-romana-v2` repo default in `setup.sh`.

## [1.3.1] - 2026-11-23

### Changed
- Versioning policy is now `MAJOR.MINOR.PATCH`: patch for small changes and fixes, minor for big features, major only on request (`AGENTS.md` §10–11 and this file's header).

## [1.3.0] - 2026-11-23

### Added
- **3D cockpit controls for every flight minigame:** the three monitors, the navball, both joysticks and the throttle lever can be clicked, held and dragged to steer liftoff, cabin docking, orbital docking and the Mars landing. Holding near a control's centre applies a guidance assist.
- **Mobile / touch controls:** cabin docking now has an on-screen D-pad plus Close In / Brake buttons (it was keyboard only); orbital docking has a D-pad and a draggable reticle; Mars landing has Deploy EDL Parachute and Trim buttons; the liftoff reticle accepts touch drag.
- Multiplayer guests now also send the `forward` / `back` hold states.

### Changed
- `EDL_Arm_Switch` now arms the EDL parachute; `Stage_Sep_Switch` and `Controller_THC` act in every phase; `Controller_THC` tilts with the command.
- `steer` / `stabilize` now correct the active minigame instead of only the cosmetic stick angle.
- The held-input state is cleared on every phase change.
- Compact 390 px layout for the control pads; touch-action disabled on the cockpit canvas and pads.

## [1.2.0] - 2026-11-23

### Added
- **Salute emote (`🫡 Salute` / `Continência`):**
  - Added procedural `salute` 3D animation clip (`salutePose` in `tools/modeling/lib/animations.mjs`) to all 4 astronaut GLBs (`helena.glb`, `lucas.glb`, `oscar.glb`, `maya.glb`), `assets/models/manifest.json`, and `index.models.js`.
  - Added `🫡 Salute` / `Continência` to the Mars surface emote wheel (`web/views.js`, `web/locales/en.js`, `web/locales/pt.js`) with multiplayer pose synchronization.
- **Lander gear retraction on Mars liftoff (`web/views.js`):**
  - Articulated the lander's 4 landing legs and boarding ladder so they fold and retract smoothly against the hull as the ascent engine lifts off from Mars.

### Changed
- **Ghost podium & stranded crew scoring (`web/app.js`, `web/flight.js`):**
  - Hidden all backpacks, sample bags, chest modules, screens, LEDs, and tool props on ghost astronauts (`👻`) in both the 3D podium and 2D fallback SVG so only the clean legless ghost suit silhouette remains.
  - Stranded astronauts now have their individual score zeroed (`0 pts`, grade `F`) and are always ranked last on the leaderboard and podium; the team's total score is computed directly from the sum of the crew members' individual points so the team penalty comes strictly from the stranded astronaut's lost points.
  - Removed the redundant `Radiation (RAD)` row from the final results breakdown (`#results-breakdown`).

## [1.1.0] - 2026-11-23

### Added
- **Engineering Hints setting (`#settings`, `web/settings.js`):**
  - Added an **Engineering hints** (`On` / `Off`, enabled by default, persisted in `localStorage`) preference with full EN/PT-BR localization (`web/locales/en.js`, `web/locales/pt.js`).
- **Contextual fix hints & quick shortcuts in rocket telemetry (`web/app.js`):**
  - Each telemetry warning (`#booster-alert`, `#stage-alert`, `#twr-alert`, `#dv-alert`, `#budget-alert`, `#power-alert`) now displays a dynamic, contextual fix suggestion based on the current rocket state (propellant type, budget overshoot, power deficit, upper-stage presence) plus a one-click shortcut button that opens the relevant module and catalog tab.
- **Scrollable telemetry alerts (`index.html`, `web/styles.css`):**
  - Wrapped telemetry alerts in `.telemetry-alerts` with vertical scrolling so multiple active warnings never get clipped.

## [1.0.0] - 2026-11-23

### Added
- **5-Step Mission Setup & Interactive 3D Mars Globe (`#lobby`):**
  - Refactored mission setup into a 5-step flow (`01 Play mode` → `02 Difficulty` → `03 Destination` → `04 Landing site` → `05 Crew`) with step summaries and singleplayer/co-op cards.
  - Added interactive 3D low-poly Mars globe (`#mars-globe-view`) with real Martian albedo regions and clickable crater markers (`Jezero Crater`, `Gale Crater`) paired with HiRISE satellite preview cards.
- **Settings screen (`#settings`):**
  - Multi-language support (`English` and `Português (BR)`) powered by `i18next` (`23.16.8`) with an offline fallback (`web/i18n.js`, `web/locales/en.js`, `web/locales/pt.js`).
  - Measurement system selector (`Metric (SI)` vs. `Imperial (US)`) converting mass, thrust, velocity, distance, altitude, and temperature across all screens (`web/units.js`).
  - Configurable multiplayer WebSocket room server IP/URL with live normalization preview and local persistence (`web/settings.js`, `web/net.js`).
- **Mars surface timeout departure & ghost podium mechanic:**
  - 10-second return rush warning and autonomous NPC sprint back to the lander (`CREW_BOARD`) when `timerSec <= 10`, with far-away crew members able to miss the boarding window (`BOARD_SAFE_R = 6.5 m`).
  - Automatic lander ignition and departure when the surface mission timer reaches zero (`playDeparture` in `web/views.js`).
  - Two-stage departure camera: ground view of the rocket rising into the Martian sky followed by a rocket-mounted camera looking down at stranded crew members waving both arms.
  - Team-wide and individual crew score penalties when any crew member is left behind on Mars.
  - Translucent legless ghost representation (`👻`, with a 3D faceted wavy ghost tail in `#podium-viewport` and a legless wavy ghost SVG in `#podium-fallback`) for stranded crew members on the debrief podium.
- **Project audit & versioning policy:**
  - Added comprehensive project audit report ([AUDITORIA.md](AUDITORIA.md)).
  - Established automatic minor version bumping (`1.0.0` baseline) and mandatory `CHANGELOG.md` updates in [AGENTS.md](AGENTS.md).

### Fixed
- Fixed `ReferenceError` caused by local `let t` / `const t` variables shadowing the `t()` translation helper in `web/launch.js`, `web/views.js`, and `web/app.js`.
- Prevented WebGL context exhaustion by disposing the offscreen part-thumbnail studio context after rendering and lazily initializing the launchpad and 3D podium renderers.
