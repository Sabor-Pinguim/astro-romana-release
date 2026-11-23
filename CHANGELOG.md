# Changelog

All notable changes to **Astro Romana** (`astro-romana-v2`) are documented in this file.

Versioning rules (per [AGENTS.md](AGENTS.md#10-git-versionamento-e-changelog)):
- Every commit bumps the version (`MAJOR.MINOR.PATCH`):
  - **Patch (`X.Y.Z`):** small changes, bug fixes, tweaks, docs, chores (`1.3.0` → `1.3.1`).
  - **Minor (`X.Y.0`):** major/significant features; resets the patch to `0` (`1.3.1` → `1.4.0`).
  - **Major (`X.0.0`):** only when explicitly requested by the user/team.
- Keep `package.json`, `index.html`, `web/locales/en.js`, `web/locales/pt.js`, and this `CHANGELOG.md` synchronized on every commit.

---

## [1.6.1] - 2026-11-23

### Changed
- **Merge integration (i18n + mobile + Dev Mode + 21 experiments):** synced Spanish (`web/locales/es.js`) translations for `lobby.stepShort.*` and `dev.*`, loaded `web/locales/es.js` alongside the experiment locale packs, merged localized `lobbyStepMeta()` with neutral landing-site hint across EN/PT-BR/ES, and adapted `#menu-lang-bar` touch target height (`>= 36 px`) and landscape positioning.

## [1.6.0] - 2026-11-23

### Added
- **Full i18n support across English (`en`), Brazilian Portuguese (`pt-BR`), and Spanish (`es`):**
  - Added complete Spanish locale pack ([web/locales/es.js](web/locales/es.js)) with 100% key and rocket-part parity.
  - Added automatic browser language detection (`navigator.languages` / `navigator.language`) on first visit in `web/i18n.js`, respecting manual overrides saved in Settings.
  - Added a quick flag language switcher (`#menu-lang-bar`) with geometric SVG flags (`EN`, `PT-BR`, `ES`) on the main menu and in Settings (`web/settings.js`, `web/styles.css`).
  - Added `npm run i18n:check` (`tools/web/check-i18n.mjs`) to validate key parity, `{{placeholder}}` parity, and coverage of all 55 rocket parts across every locale pack.
- **Translated all 55 rocket parts (`parts.*`)** in `web/locales/en.js`, `web/locales/pt.js`, and `web/locales/es.js`, wired into `web/app.js` via `partName()` / `partRole()`.
- **Mobile responsiveness (Phases 0–4):** added short-height landscape breakpoints (`@media (max-height:500px) and (orientation:landscape)`), portrait compact hex stepper (`<= 640px`), `100dvh` fallbacks, `viewport-fit=cover` + `env(safe-area-inset-*)` sticky bars, `pointer:coarse` >= 36–44 px touch targets, collapsible surface experiment goals showing the nearest incomplete task (`web/views.js`), localized `lobby.stepShort.*` labels, `tools/web/mobile-audit.mjs` (`npm run web:audit:mobile`), and updated documentation (`docs/mobile-responsiveness.md`, `AGENTS.md`).
- **Dev Mode sandbox (`#dev-dialog`, `#dev-exp-dialog`):** added `web/dev.js` with Menu button (`#dev-button`), `Shift+D` shortcut, and `?dev=1` / `#dev` launcher to override difficulty/site/seed, jump straight to any mission screen/phase, and test all 21 science experiment minigames individually via `ASTRO_RUN.play`.
- **21 science experiment minigames & multiplayer schema:** added `web/experiments.js`, `web/experiment-run.js`, the 21 minigame modules/styles (`web/minigames/`, `web/minigames.css`), EN/PT experiment locales (`web/locales/experiments/`), validation/lab tools (`tools/minigame-lab/`, `tools/web/check-experiments.mjs`, `docs/experiments-implementation.md`), and optional leaderboard experiment tracking (`multiplayer/`).

### Changed
- **Eliminated remaining hardcoded English UI strings:** added `data-i18n` / `data-i18n-aria` across the 5-step Lobby (`index.html`), migrated `lobbyStepMeta()`, difficulty specs, mode badges, and cockpit docking readouts (`web/app.js`), and added an `astro:lang` listener to live-refresh every dynamic view on language change.
- **Clearer mission-abort and ocean-landing terminology in PT-BR and ES:** replaced `"Aborto"` with `"Abortar missão"` / `"Abortar misión"` and `"Amerissagem"` / `"Amerizaje"` with `"Pouso no mar"` / `"Descenso en el mar"` in `web/locales/pt.js` and `web/locales/es.js`.

### Removed
- **Dead EVA inventory UI:** removed leftover empty `#surface-inventory` markup and `.surface-inv-label` / `.surface-inventory` styles from `index.html` and `web/styles.css`.

## [1.5.2] - 2026-11-23

### Changed
- **AI Crew robot icon (`ROBOT_ICON` in `web/app.js`):** redesigned the low-poly SVG robot icon with a lighter silver faceted head, side ear bolts, diamond-tipped antenna, bright cyan visor eyes, and metallic mouth grille for clearer recognition and contrast.

## [1.5.1] - 2026-11-23

### Changed
- **Editable astronaut name on mode selection screen:** added a geometric SVG pencil button (`#mp-name-edit`) next to the saved astronaut name on `#lobby-step-mode` to allow editing (`Enter` / Confirm to save, `Escape` to cancel) while keeping the name locked on all other screens and inside active rooms (`web/app.js`, `web/net.js`, `web/styles.css`, `web/locales/en.js`, `web/locales/pt.js`).

## [1.5.0] - 2026-11-23

### Added
- **Rocket Construction Wizard narrated by Dr. Nancy Grace Roman (`#rocket-wizard`):** compact interactive 7-step guided builder inside `#planner` featuring Nancy's 3D low-poly avatar (`assets/models/characters/nancy.glb`, bundled into `index.models.js` via `npm run web:models`) with `wave`, `action_loop` (wooden ruler tap), `salute`, and `idle_loop` animations, classroom chalkboard (*lousa*) UI & toggle button, plain-language goals, live checklists, blinking-to-solid target highlights (`.wizard-blink` / `.wizard-highlight`), and a slim first-access recommendation prompt (`#wizard-prompt`, persisted in `localStorage`).
- **Auto-fullscreen on Play:** clicking the main menu **Play** button (`#play-button`) requests browser fullscreen via the Fullscreen API (failing silently if unsupported or blocked).
- **Keyboard module navigation in Rocket Assembly:** press `↑` / `↓` (`ArrowUp` / `ArrowDown`) on `#planner` to step through rocket modules without scrolling the page, and repositioned `.rocket-navigation` to avoid overlapping the cabin label.

### Changed
- **Collapsible Telemetry Details (`.meter-info-btn`):** hid verbose `.meter-hint` explanations under all 5 telemetry gauges by default behind an amber hexagonal `i` info button beside each metric value.
- **Unified Full-Image HiRISE Crater Cards (Step 04):** removed the non-interactive middle Satellite View card and merged the full-bleed HiRISE satellite imagery + `512 m walk area` overlay directly into the clickable crater selection cards alongside the 3D Mars globe.

## [1.4.6] - 2026-11-23

### Added
- **2D cabin docking scope:** added a simplified `.kir.kir-2d` docking scope (`#port-dock-ring`, `#kir-mark`) beside the directional pad, a Z-approach progress bar (`#port-dock-z-fill`), and side-by-side depth buttons (`.dock-depth-grid`) to the right cockpit panel during Phase 05B (`web/app.js`, `web/styles.css`).

### Changed
- **Repository documentation:** updated the exclusive repository reference in `AGENTS.md` to `Sabor-Pinguim/astro-romana-release`.

## [1.4.5] - 2026-11-23

### Removed
- **Multiplayer & cockpit UI emojis:** removed lock (`🔒`), gear (`⚙`), and double-arrow (`⏫`, `⏬`) emojis from the lobby room browser, locked name badges, and cockpit docking buttons (`web/app.js`, `web/locales/en.js`, `web/locales/pt.js`), replacing them with flat triangles (`▲`, `▼`) and the CSS `.settings-glyph` icon.

## [1.4.4] - 2026-11-23

### Changed
- **Astronaut name locked after first selection:** once a valid name (2–20 chars) is confirmed in `localStorage`, `ASTRO_NET.setPlayerName` ignores overwrites and the multiplayer lobby replaces the input with a read-only badge (with a one-time confirm prompt when joining directly via an invite link without a saved name).

## [1.4.3] - 2026-11-23

### Fixed
- **GitHub Pages default CORS & WebSocket origin:** included `https://sabor-pinguim.github.io` in default `ALLOWED_ORIGINS` in `multiplayer/deploy/setup-v2.sh` and `multiplayer/deploy/setup.sh`.

## [1.4.2] - 2026-11-23

### Added
- **Side-by-side VM deploy script (`multiplayer/deploy/setup-v2.sh`):** clones/updates `/srv/astro-romana-v2`, runs `astro-rooms-v2.service` on `127.0.0.1:8788` with its own SQLite database (`/var/lib/astro-romana-v2/astro.sqlite`), and appends an isolated `v2.<ip>.sslip.io` Caddy import without altering `/etc/caddy/Caddyfile`'s existing v1 server or `/srv/astro-romana`.

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
