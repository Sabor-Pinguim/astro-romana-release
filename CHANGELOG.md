# Changelog

All notable changes to **Astro Romana** (`astro-romana-v2`) are documented in this file.

Versioning rules (per [AGENTS.md](AGENTS.md#10-git-versionamento-e-changelog)):
- Every commit bumps the version (`MAJOR.MINOR.PATCH`):
  - **Patch (`X.Y.Z`):** small changes, bug fixes, tweaks, docs, chores (`1.3.0` → `1.3.1`).
  - **Minor (`X.Y.0`):** major/significant features; resets the patch to `0` (`1.3.1` → `1.4.0`).
  - **Major (`X.0.0`):** only when explicitly requested by the user/team.
- `npm run version:bump -- patch` (or `minor`) sets the new version in `package.json`, `package-lock.json`, `index.html` and `web/locales/{en,pt,es}.js` and opens its section here; `npm run version:check` checks they all agree.

---

## [1.9.6] - 2026-11-25

### Changed
- Place settings at the right edge of headers and retain Nancy's desktop guide appearance on mobile.
- Position the mobile planner chat between the stage labels and module totals.
- Expand cockpit minigame controls to use the available landscape height.
- Place radar roll controls beside the game and compact completion facts for short landscape screens.

## [1.9.5] - 2026-11-25

### Changed
- Require leaving the multiplayer room before returning to the main menu, including room entry and reconnection flows.
- Show ordered character-colored borders on rocket modules viewed by room members, with a mustard highlight for Lucas.
- Guarantee a surface experiment for every crew member and protect that minimum from budget cuts.
- Keep real-fact completion cards open for seven seconds or until dismissed with the close button.
- Fill the mobile landscape cockpit viewport, reposition rocket navigation arrows, and raise the planner chat above module totals.
- Give the chat button a solid light-purple background.

## [1.9.4] - 2026-11-25

### Added
- The v2 VM updates itself: `setup-v2.sh` installs `astro-update-v2.timer`, which runs `multiplayer/deploy/auto-update.sh` every minute. It pulls `main` (the game's files are live at once) and restarts the room server when its version changes, once no room is open (60 minutes at most). A version that fails to start is logged and left alone until a newer one arrives. The timer runs a copy installed outside the repository, so pulled code never runs as root; changes to `multiplayer/deploy/` still need `setup-v2.sh` by hand. Run `setup-v2.sh` once to install it.
- The room server has its own version (room server 1.0.0, in `multiplayer/package.json`), shown at `/health`. `npm run version:bump:server -- patch` raises it, and the pre-commit hook blocks a change to the server's `.mjs` files or dependencies that does not.

## [1.9.3] - 2026-11-25

### Fixed
- Removing a player now works on both screens. The host's room panel used to keep the removed player listed, because it skipped redraws while the just-tapped × still had the focus; it now skips them only while a text field is being typed in. The removed player used to stay on the crew screen as a solo player with the host's mission; they now leave the mission for the menu, as when leaving the room, and `?room=` is dropped from the address so a reload does not join again.
- The "Remove?" confirmation stays armed when the room panel redraws between the two taps (another player joining, for example).

## [1.9.2] - 2026-11-25

### Changed
- Fit rocket assembly and cockpit layouts to the viewport and place fullscreen first in settings.
- Standardize player-facing automated crew labels as BOT in English, Portuguese and Spanish.
- Open the full leaderboard from results through a dedicated button and return to results afterward.
- Fold experiment descriptions, instructions and contextual information into a shared information button across all minigames.
- Replace failed minigame previews and controls with the failure message and retry actions in the same screen.

## [1.9.1] - 2026-11-25

### Changed
- Integrated the advanced multiplayer server controls with the updated fullscreen settings.

## [1.9.0] - 2026-11-25

### Added
- Added a host-only "remove player" action to the room panel: an × on each other player's chip that asks for a second tap within 4 s. The room server gains a `kick` message: the removed player gets a localized notice, their seat goes back to the AI and their old session can no longer be resumed (`npm test` covers it). The server changed, so the VM needs `setup-v2.sh` again, which restarts the room server.
- Added a web app manifest, home-screen icons and Apple web-app metas, so the game installed on the home screen opens fullscreen (also on iPhone). The fullscreen setting now stays visible where the browser cannot go fullscreen and explains "Add to Home Screen" instead.
- Added translation QA: `npm run i18n:check` now also catches keys used in code or HTML that no language defines, experiment keys, text identical to English and hard-coded HTML, canvas and toast text. The new `npm run i18n:audit` opens 19 screens in en, pt, es and pseudo-localization (`index.html?pseudo`) and reports raw keys, missing keys and silent English fallbacks. `npm run web:audit:mobile` accepts `--lang pt|es` and `--pseudo`.
- Added `npm run version:bump -- patch|minor` and `npm run version:check` (`tools/version.mjs`), which keep the version in step in all 7 places (now including `package-lock.json`) and open the new section here. A pre-commit hook (`.githooks/pre-commit`, turned on by `npm install`) blocks commits that keep the last version, disagree between files or leave this section empty.

### Changed
- Caddy now serves the game with `Cache-Control: no-cache`, so a phone no longer mixes a new `index.html` with an old `styles.css` and locale files (the cause of the unstyled chat showing raw keys on mobile). It takes effect after the next `setup-v2.sh`.
- Trimmed `AGENTS.md` from 24 KB to 16 KB: the 3D model and viewer rules moved to `tools/modeling/AGENTS.md` and the audio rules to `tools/audio/AGENTS.md`, with the same section numbers, and the version rule now uses the script.

### Fixed
- Translated nine hard-coded screen-reader labels and the cockpit's docking camera titles.
- The launch review no longer cuts the ascent time out of a translated sentence, which would show "undefined" in a translation without the " · " separator.
- The leaderboard shows the stored default solo name ("Commander") in the current language.
- The HiRISE caption follows the unit setting; Portuguese "Timing" became "Sincronia"; long text wraps inside the landing-site card; language buttons carry their `lang`; the Nancy Grace Roman name is marked `translate="no"`.
- Pseudo-localization keeps placeholder values (an e-mail, a player's name) as they are.
- Fixed the broken link to the characters document in `AGENTS.md`.

## [1.8.3] - 2026-11-25

### Changed
- Moved the multiplayer server controls into a collapsed Advanced options section.

## [1.8.2] - 2026-11-25

### Added
- Added a desktop-only, localized Nancy Grace Roman biography popover to the difficulty screen, linked to NASA's official biography.

### Changed
- Moved the multiplayer "Take seat" action from crew cards into the selected character preview and compacted the room layout for short landscape screens.
- Prevented mobile controls from selecting their text during taps and long presses.

## [1.8.1] - 2026-11-25

### Added
- Added Nancy Grace Roman portraits to desktop difficulty cards using the approved low-poly constellation artwork and difficulty theme colors.
- Added reproducible portrait generation and validation, including the source concept, generated assets, and web model bundle.
- Added a contact shortcut beside the menu version that opens email and copies the address with a localized confirmation toast.

### Changed
- Removed the Simulation badge from the rocket assembly header.
- Kept difficulty portraits hidden on narrow and mobile screens to preserve space.

## [1.8.0] - 2026-11-25

### Added
- **Multiplayer room text chat (`web/chat.js`, `index.html`, `web/styles.css`, `web/locales/{en,pt,es}.js`):** live text chat available across all screens while connected to a multiplayer room over `window.ASTRO_NET`, featuring host-synced history (`setState('chat', ...)` for up to 30 recent messages), unread badge and 3.5 s peek preview when collapsed, localized system notices (connect, peer join/leave, host promotion), `T`/`Esc` shortcuts, `200`-char cap, `500 ms` send cooldown, `textContent`-only escaping, and responsive desktop/mobile layouts.
- **Rocket build consequences (`web/app.js`, `web/experiment-run.js`, `web/flight.js`, `web/views.js`, `web/locales/experiments/_common.js`, `docs/rocket-consequences.md`, `docs/audio.md`):** recoverable Normal/Hard mission complications when a rocket lacks power (periodic cockpit brownouts and screen dimming until Lucas resets a breaker), has low TWR (second-half ascent pogo oscillation and +15% orbital refueling penalty), lacks an antenna (2-star experiment cap), lacks storm shielding (solar storm event with Curiosity RAD storm audio and 70% surface movement speed for one dosed crew member), or exceeds budget (cancels one seeded surface experiment), surfaced across the launch review, flight alerts, landing toast, and final report.

### Fixed
- **Keyboard focus isolation (`web/app.js`, `web/views.js`, `web/launch.js`):** prevented Cockpit, Mars Surface, and launchpad/splashdown `Escape` listeners from capturing keystrokes while typing in form inputs, textareas, selects, or editable controls.

## [1.7.6] - 2026-11-25

### Added
- Added a fullscreen toggle button to the main menu top-right bar (`#menu-fullscreen-btn`) and Settings screen (`#settings-fullscreen-btn`), with responsive touch sizing and automatic hiding when the browser Fullscreen API is unavailable.

### Changed
- Adapted the launch review modal (`#launch-dialog`) for portrait and landscape mobile with a scrollable 2-column summary and pinned bottom action buttons.
- Updated the 3D pilot cockpit model, flight deck visuals, documentation, and reference images (`tools/modeling/parts/cockpit.mjs`, `web/flight.js`, `web/app.js`, `assets/models/`, `index.models.js`).

### Fixed
- Adjusted the 3D results podium camera distance dynamically from aspect ratio so all 4 astronauts and pedestals remain framed without edge clipping on every screen size (`web/flight.js`).
- Initialized `i18next` synchronously (`initImmediate: false`, `nsSeparator: false`) with local-dictionary fallback in `web/i18n.js` to prevent raw translation keys from appearing, and added the missing `lobby.setup.steps.mode.next` key across EN/PT-BR/ES.

## [1.7.5] - 2026-11-24

### Changed
- Transferred host ownership to the next player in join order when the host leaves or times out (closing the room only when empty), and allowed the host to take over any active flight or surface simulation loop on promotion.
- Allowed the multiplayer host to freely switch to any unoccupied crew seat in the lobby (defaulting to Helena on room creation), while hiding player/NPC status badges on crew cards in solo mode where the player controls all four astronauts.
- Redistributed the mobile crew screen layout: overlaid the character name inside the full-height 3D preview above a full-width Continue button, compacted the multiplayer room panel into a single horizontal strip, and matched the "Take seat" button proportions to player name tags.

## [1.7.4] - 2026-11-24

### Changed
- Highlighted the multiplayer "Leave room" button in orange across the crew room panel (full-width below the list of connected players) and the mode selection strip (right-aligned), with a confirmation dialog that returns the player to the main menu.
- Added the assigned player's name badge to the bottom-right corner of their crew card and made the astronaut name edit control more prominent on a single row.
- Refined the hexagonal header settings shortcut (even 1.15:1 hexagon proportion, borderless orange fill at rest, and full starlight-cream fill on hover, focus, and active states) and compact mobile multiplayer header.

## [1.7.3] - 2026-11-24

### Changed
- Stacked the main menu actions with left-side icons, equal widths, and centered labels.
- Moved the crew continue button inside the dossier on mobile and removed the difficulty shortcut from the crew screen.
- Hid the duplicate multiplayer heading on mobile, made the lobby back button gold by default, and made the rocket wizard close button red by default.

## [1.7.2] - 2026-11-24

### Changed
- Replaced the site and crew lobby dossier titles with localized action-focused headings and removed the redundant site instruction.
- Moved the selected crew member's name into the desktop 3D preview above their specialties and anchored the multiplayer room panel to the bottom of the left crew column.

## [1.7.1] - 2026-11-24

### Changed
- Simplified the play-mode cards and used Offline, Online, player-count and NPC labels consistently across English, Portuguese and Spanish.
- Made crew cards select the character shown in a fixed 3D preview. Each specialty appears once beside its full localized name in the preview, with a compact layout for portrait and landscape phones.

## [1.7.0] - 2026-11-24

### Added
- **Experiment draw in the game (`web/app.js`, `web/experiment-run.js`, `web/experiments.js`):** every mission draws 8 of the 21 experiments when it starts (1 orbit and 1 ground experiment per crew member, pure random, seeded), revealed only when each one comes into play. In a room the host sends the draw with the flight state. Plan and decisions: [docs/experiments-implementation.md](docs/experiments-implementation.md).
- **Mars orbit stage (`web/app.js`, `index.html`, `web/flight.js`, `web/minigames.css`):** a new cockpit stage between orbital docking and the landing ("04 · Mars orbit" in the flight stepper; the landing becomes 05). Four experiment cards, one per crew member, plus a 150 s orbit window (game-balance) and a "Start the descent" button once every experiment has a result. Mars shows in the cockpit window. Solo: you play your own and may take over an AI seat while its bot works. In a room each player plays their own seat.
- **H-S2 in the descent:** when drawn, the precision-landing minigame opens before the landing burn starts (the burn waits for it).
- **Bots for AI seats (`web/experiment-run.js`, `web/app.js`):** AI crew members do their experiments "on average, nothing amazing" (1–2 stars, seeded) after the typical time of each minigame, in orbit and on the surface; taking over an astronaut stops its bot.
- **Star scoring and difficulty multiplier:** each crew member scores 25 points per star of their experiments, replacing the fixed points per surface experiment. The mission total is multiplied by the difficulty (easy ×0.75, normal ×1, hard ×1.5, game-balance decided by the team), and the grade is computed before the multiplier. The debrief lists the 8 experiments with their stars (and which ones the AI did), plus the multiplier line.
- **Leaderboard fields (`web/app.js`, `multiplayer/`):** missions send `experiments` (`[{ id, stars, bot? }]`), `runSeed` and `scoreMultiplier`. The room server already accepts and stores them (optional fields; older databases get the columns in place).
- **Spanish texts for the 21 experiments (`web/locales/experiments/*.js`):** every experiment and the shared texts now have `en`, `pt` and `es`; `tools/web/check-experiments.mjs` checks the three languages.
- **Dev Mode:** "Cockpit · Mars orbit" jump, using the Dev Mode seed.
- **Interface scale setting (`web/settings.js`, `index.html`, `web/styles.css`, `web/locales/{en,pt,es}.js`):** Settings → Interface scale (Auto, 75%, 85%, 100%, 115%), applied as the root font size (`html[data-ui-scale]`) and saved with the other settings.
- **Rocket assembly tabs on phones (`index.html`, `web/app.js`, `web/styles.css`):** Rocket / Parts / Telemetry tabs in portrait and short landscape screens, with an alert badge on Telemetry; selecting a module or following an engineering hint opens the Parts tab.

### Changed
- **Surface experiments (`web/views.js`, `index.html`):** the blocks and goals are the drawn ground experiments, played with the new minigames in `#minigame-dialog` (seeded layouts, 3 levels, stars). The legacy `web/scout.js` and the four fixed panels are removed (`scout.js` also overwrote `window.ASTRO_MINIGAMES` from the new core).
- **Compact touch controls and landscape layouts (`web/styles.css`, `web/minigames.css`):** faceted 32 px info, stage and tab buttons on touch screens, tighter Step 01 cards in short landscape screens (merged with the 1.6.3 expandable multiplayer panel), smaller minigame canvases and grids on short screens, and the surface toast moved under the HUD.
- **Mobile audit (`tools/web/mobile-audit.mjs`):** updated for the new layouts (`npm run web:audit:mobile`: 73 checks over 6 viewports, 0 issues).
- **README:** file table, the experiments validator command and the minigame lab.

### Fixed
- **Stars rendering:** the hollow star (☆) looks filled in bold Chakra Petch, so a 0-star result showed as ★★★. Missing stars are now dimmed full stars in the UI (minigame cap, restart button, completion card, orbit cards, debrief, cockpit stars) and "★ n/3" in logs and toasts.
- **Experiment dialog race (`web/experiment-run.js`):** the dialog `close` event arrives a moment after closing; when another experiment opened in between (orbit window closing straight into the H-S2 descent), it stopped the new minigame. The handler now ignores a dialog that is open again.
- **Surface joystick (`web/views.js`):** the touch stick returns to its default place when released.

## [1.6.3] - 2026-11-24

### Changed
- **Step 01 Play Mode separation & expandable Multiplayer panel (`index.html`, `web/app.js`, `web/styles.css`, `web/locales/{en,pt,es}.js`):**
  - Restored symmetric initial Play Mode cards (Singleplayer + Multiplayer) in Step 01 (`#lobby-step-mode`) with crew illustrations and primary action buttons (`#mode-solo-btn`, `#mode-mp-btn`), where Singleplayer advances directly to Step 02 (`difficulty`).
  - Added smooth in-step Multiplayer expansion (`mpExpanded`) that collapses the Singleplayer card (`aria-hidden="true"` / removed on collapse, `inert`, zeroed layout box, honoring `prefers-reduced-motion`) and expands the Multiplayer panel to 100% width with a clean top bar (`#mp-collapse-btn` `← Back` + inline-editable astronaut Name bar, removing the server IP bar).
  - Updated `#step-summary-mode` and `.setup-card.selected` to reflect the active mode selection (`soloTitle` when collapsed, `mpTitle` when expanded, `coop · CODE` in a room), and cleaned up the expanded Step 01 header by hiding `.micro` and `.setup-lead` while switching `.dossier-title` to `lobby.setup.mpTitle` (synced across `EN`, `PT-BR`, and `ES`).
  - Rendered side-by-side Find (`#room-browser-refresh`, `#room-browser-list`, join-by-code) and Host (`#mp-room-name`, `#mp-room-password`, `#mp-room-private`, `#mode-create-btn`) columns on desktop and mobile landscape (`915×412`, `844×390`, `667×375`), with portrait-only tab switching (`≤ 760px` portrait) preserving input drafts.
  - Updated `#lobby-back` to `← Play mode` (`lobby.setup.steps.difficulty.back`) while expanded so both `#lobby-back` and `#mp-collapse-btn` collapse back to the mode cards, guarded room browser fetches, fixed `enterRoom()` button recovery, and synchronized all new i18n keys across `en`, `pt`, and `es`.
  - Fixed Step 01 expansion reset on step/screen exit (`setLobbyStep()` calling `renderModeStep()` and `showScreen()` resetting `mpExpanded` / `editingPlayerName` when leaving `#lobby`), removed legacy multiplayer `.is-browser` / `.mp-create-box` / `.mp-create-inputs` / `.room-panel input` / `.room-or` CSS rules and unused multiplayer locale keys (`lobby.room.create`, `lobby.room.or`, `lobby.room.join`, `lobby.roomBrowser.serverLabel`, `lobby.roomBrowser.changeServer`, `lobby.roomBrowser.backToModeBtn`), removed the redundant inner `#mp-collapse-btn`, and upgraded `#lobby-back` to a prominent faceted header back button across `en`, `pt`, and `es`.
- **Step 02 Difficulty cards cleanup (`web/app.js`, `web/styles.css`):**
  - Removed the redundant `.diff-about` paragraph below each difficulty card in `renderDifficultyStep()` (and its CSS rules) while preserving `title` tooltips and `difficulty.*.about` locale keys.

## [1.6.2] - 2026-11-24

### Added
- **Hidden Dev Mode unlock easter egg (`web/dev.js`, `web/views.js`, `assets/audio/sabobor-pinguim.mp3`):**
  - Hid the Dev Mode menu button (`#dev-button`) by default and persisted unlock state in `localStorage` (`astro-romana-dev-unlocked`), also gating `Shift+D` and `?dev=1` / `#dev` until unlocked, with a **Hide Dev Mode** (`#dev-hide-btn`) toggle added inside the Dev panel (`dev.hideBtn` localized across EN/PT-BR/ES).
  - Added the Gentoo Penguin SVG icon inside `#dev-button` alongside a dedicated `<span data-i18n="dev.openBtn">` so `ASTRO_I18N.applyDOM()` updates only the label.
  - Hovering Mars on `#menu` and typing `13136767` triggers `sabobor-pinguim.mp3`, bursts a custom 3D flat-shaded low-poly **Gentoo Penguin** ("Absolute Cinema" raised gold hands + white belly + Gentoo head bonnet + blazing fire eyes) out of Mars in front of the menu UI, spin-dives into `#dev-button`, and triggers a radial shockwave/particle explosion revealing the button (replayable even after unlocking).
- **Menu Mars moons & overdrive (`web/app.js`, `web/styles.css`):**
  - Updated the faceted Mars SVG (`menuMars()`) to animate both **Phobos** and **Deimos** orbiting along dashed back/front orbital arcs in real time (`startMenuMoons()`), plus `window.ASTRO_OVERDRIVE_MARS()` which spins Mars faster and accelerates Mars and both moons indefinitely when the easter egg triggers.

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
