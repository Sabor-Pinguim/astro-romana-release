# Multiplayer

Online cooperative play for 1 to 4 players. The **room server** is ready in [multiplayer/](../multiplayer/README.md) (protocol, tests and deploy on a GCP VM with Caddy). This document is the **plan of what changes in the client** (`index.html` and `web/`) to connect the game to it. Items marked ✅ are already in the game; the others are still a plan.

## Principles

- **The host decides.** Whoever creates the room is the host and starts on Helena's seat by default (and can freely switch to any free seat in the lobby). The host's browser runs the rules that already exist: `flightTick`, `surfaceTick`, `completeSurfaceTask` and `showResults`.
- **Guests send intentions** (`act`) and draw the state they receive (`state`). They do not run the rule loops.
- **Each player moves their own astronaut** on the surface and sends its pose (`pose`).
- **A minigame runs in the browser of the seat's owner**, and only the result goes to the host, as an `act`. This rule applies to today's minigames and to future ones.
- **A seat without a player stays with the AI**, as today. Solo play is a host without guests, and without a server the game works just as it does now.
- **The server stamps who sent** each `act` (`from.seat`). The host checks the owner by that stamp, never by what the client says.

## Current flow → channels

| Screen (`state.screen`) | Today | In multiplayer |
|---|---|---|
| `menu`, `orbit` | Local `selectWorld` | The host moves through the screens and sends `phase`. The destination goes in `state setup` |
| `lobby` | Fake seats (`state.friends`), `site`, `difficulty` | Real seats (`peers`). `site` and `difficulty` belong to the host and go in `state setup` |
| `planner` | `togglePart`, `addStage`, `removeStage` change `state.rocket` | The guest sends `act`; the host applies it and sends `state setup` |
| `cockpit` | `startFlight` + `flightTick`; actions in `handleCockpitAction` | The host runs the flight and sends `state flight` (~10 Hz); the guests' actions arrive by `act` |
| `surface` | `surfaceTick` (timer) + `step()` in `views.js`; the AI moves the crewmates | The host sends `state surface` (sites, timer, completed tasks, who controls whom, ~2 Hz) and runs the AI; each player sends the `pose` (~10 Hz) of the astronauts they control |
| `results` | `showResults` | The host sends `event results`; each client runs the same `showResults` |

Players can only **join** the room up to the `planner`. After the launch, only someone who dropped can come back (`resume`). These phases are the server's defaults, and the host can change them in `create`.

## What changes, by file

- **Room browser, private & password rooms:** hosts can give a room a name, set an optional password (`scrypt` salted hash on the server), and mark `isPrivate: true` (hidden from the public browser, accessible via 4-letter code or `?room=CODE`).
  - `GET /api/rooms` lists public joinable rooms (`code`, `name`, `hostName`, `players`, `maxPlayers`, `site`, `difficulty`, `hasPassword`, `createdAt`).
  - `GET /api/rooms/:code` checks a specific room (including private ones) so guests know before connecting whether a password is needed.
- **Astronaut name & Leaderboards (`localStorage` + SQLite):**
  - Every multiplayer player enters a name (2–20 chars, stored in `localStorage` under `astro-romana-player-name`) and sends it in `meta.name`.
  - Finished co-op missions are submitted once by the host via `POST /api/leaderboard` and persisted in **SQLite** (`node:sqlite` in `multiplayer/db.mjs`, `WAL` mode, stored at `DB_PATH=/var/lib/astro-romana/astro.sqlite` via `StateDirectory=astro-romana` in `astro-rooms.service`). `GET /api/leaderboard` serves Top Missions and Top Astronauts filtered by difficulty and site.
  - Solo runs stay local in `localStorage` (`astro-romana-solo-leaderboard`) and appear in the **Local · Solo** view of the `#leaderboard` screen and on `#results`.
  - Caddy (`multiplayer/deploy/Caddyfile.site`) reverse-proxies `/ws`, `/health`, and `/api/*` to the Node room server on `127.0.0.1:8787`, with CORS controlled by `ALLOWED_ORIGINS`.
  - Side-by-side v2 deploy: [setup-v2.sh](../multiplayer/deploy/setup-v2.sh) installs `/srv/astro-romana-v2` on `127.0.0.1:8788` (`astro-rooms-v2.service` + `/var/lib/astro-romana-v2/astro.sqlite`) and appends `/etc/astro-romana-v2/Caddyfile.v2` (`v2.<ip>.sslip.io`) without altering the existing `/srv/astro-romana` v1 deployment.

### 1. Loading the client: `index.html` and `web/net.js` ✅
- `index.html` loads `multiplayer/client/room-client.js` and then `web/net.js`, both **before** `web/app.js`. They are classic scripts and work on `file://`.
- `web/net.js` connects the `RoomClient` to the game and exposes `window.ASTRO_NET`:
  - `mode` (`'solo'`, `'host'` or `'guest'`), `isHost`, `isGuest`, `seat`, `peers`, `code` and `link`;
  - `act(name, ...args)`, `setPhase`, `setState`, `emit`, `pose`, `send` and `setSeat`; each one only sends in the right role (host or guest);
  - `owns(seat)`: the seat is mine, or it belongs to the AI and I am the host;
  - `on(type, fn)` passes the room's events on to the game.
- **Server address:**
  - a page served by the site (the VM with Caddy) uses the page's own address, `wss://<host>/ws`;
  - on `localhost`, it uses `ws://localhost:8787/ws`;
  - on GitHub Pages and on `file://`, it uses the `NET_SERVER` constant in `web/net.js`: today the v2 VM endpoint, `wss://v2.35-193-156-110.sslip.io/ws` (IP 35.193.156.110, keep it static; the address `setup-v2.sh` prints). Empty, `file://` falls back to the local server;
  - any page accepts `?server=`.
- **GitHub Pages (`*.github.io`):** multiplayer turns on once `NET_SERVER` is filled in (or with `?server=wss://<VM domain>/ws`); while it is empty, multiplayer is off and the room panel disappears from the lobby. The VM must allow the Pages origin: `sudo EXTRA_ORIGINS=https://<user>.github.io bash /srv/astro-romana-v2/multiplayer/deploy/setup-v2.sh` ([setup-v2.sh](../multiplayer/deploy/setup-v2.sh)). Give the VM a static IP, or the `sslip.io` name in `NET_SERVER` changes when the VM restarts.
- **Without a server,** "Create room" shows a toast, and the game stays solo.
- **On opening the page:** with a saved session, it returns to the room (`rejoin`); with `?room=CODE`, it joins that room; with neither, it stays solo.

### 2. Lobby: `web/app.js` (`renderLobby`, `renderRoom`) ✅
- **Room panel**, below the crew:
  - solo: "Create room", or a code and "Join";
  - in a room: the code, "Copy invite link" and "Leave".
- The status of each card comes from `peers` (`seatStatus`): `HOST`, `PLAYER`, `(OFFLINE)` and `· YOU`, or `AI (NPC)` on a free seat. `#crew-count` counts who is online.
- **Host and guests:** each free seat gets a "Take seat" button (`room.setSeat`) while the room is in a joinable phase. In solo play, no player/NPC seat status is shown on the crew cards because the single player controls all 4 astronauts.
- **Destination, landing site and difficulty are host controls.** The screen already said "Host control". The guest sees the buttons disabled and can open the details of each site.
- The launch summary ("Crew: N players · M AI") uses `peers`.

### 3. Screens: `showScreen` ✅
- **On the host**, `showScreen(id)` also calls `setPhase(id)`.
- **On the guest:**
  - the screen follows the `phase` received (`guestScreen`), for now up to the `planner`;
  - the buttons that change screens or launch (`#orbit-back`, `#objective-next`, `#lobby-back`, `#to-assembly`, `#planner-back`, `#launch-button`) are disabled, with the text "Waiting for host";
  - when the host launches, the guest sees a toast and waits; the cockpit and the surface come in items 5 and 6.
- **A host who reloads the page** returns to the same room, with the assembly and the screen stored on the server.

### 4. Shared planner and assembly: `web/app.js` ✅
- **`setup` state:** the host sends `{world, site, difficulty, rocket}` whenever something changes (`syncSetup`), and the guest copies it (`applySetup`). These stay local on each screen: `sel`, `tab` and `detail`.
- **Rocket actions (`ROCKET_ACTIONS`):** `addStage(index)`, `removeStage(index)`, `stageType(index, type)` and `togglePart(id, sel, tab)`. Each one checks its arguments and returns an error text when it does not apply.
  - `plan(name, ...args)`: solo and on the host, it applies and redraws; on the guest, it sends `act('rocket', name, ...args)`.
  - The host only accepts names from the table, and only in the lobby and the planner. An error goes back only to the sender, as a toast (`send`).
  - `togglePart` carries the module and tab of whoever clicked, because the selection belongs to each player.
- After a change by another player, if the selected stage is gone, the selection falls back to the booster (`fitSelection`).

### 5. Launch and cockpit: `web/app.js` (`SIM`) ✅
- **Launch:** on confirming, the host sends `event {k:'launch', lift}`. The guest sees the same pad and countdown (`ASTRO_LAUNCHPAD`). If the rocket does not leave the ground, each one shows the same debrief (`failLaunch`). On a Δv abort, the host sends `event {k:'abort', info}`, and everyone sees the splashdown.
- **The host runs the flight** as in solo play and sends `state flight` every 100 ms and at each change of stage or controls (`flightSnapshot`). It carries the `flight` fields, the keep-in-range minigames as numbers, the log lines and the time left on the sparks.
- **The guest does not run `flightTick`.** It copies the snapshot into its own `ASTRO_SIM.flight`, which the 3D cockpit (`web/flight.js`) already reads every frame. Then it redraws the panel (`renderFlightUI`) if the stage or the controls changed, or only the HUD (`updateCockpitHUD`). `flight.design` comes from the same rocket and the same difficulty (`captureDesign`).
- **Who flies each stage (`STEP_CREW`):**

  | Stage | Who acts and flies |
  |---|---|
  | 0 · Liftoff & Max-Q | Helena |
  | 1 · Cabin docking | Helena |
  | 2 · Orbital docking and transfer | Oscar or Maya |
  | 3 · Mars landing | Helena |

  Exceptions (`ACTION_CREW`): `breaker` and `stage_sep` belong to Lucas; `shield_storm`, to Maya. An AI character counts as the host's (`owns`).
- **Actions:** `handleCockpitAction` is still the single entry point (buttons, keys and 3D clicks). Someone who is not the owner sees a toast ("Helena does that."). A guest who is the owner sends `act('cockpit', action, arg)`, and the host checks the stamped seat and applies it (`applyCockpitAction`).
- **Piloting:** the guest who owns the stage sends the piloting keys and the on-screen d-pad (`act('input', keys, hold)`) when they change. The host merges its own with those of whoever flies the stage (`inputOf`).
- **Those who are not flying** see the controls disabled and the message "Helena flies this phase: watch the crew work.".
- The mission toasts (liftoff stars, docking, landing, experiments, time up) go to everyone (`crewToast` → `event {k:'toast'}`).

### 6. Surface (open world): `web/views.js` and `web/app.js` ✅
**The problem behind the design:** each browser ran the crewmates' AI and drew the experiment sites with `Math.random`, so each screen would show the NPCs and the blocks in different places. The rule became: **the AI runs only on the host, and the sites come from a seed set by the host.**

The server did not change. The `pose` is free-form and stored per participant, so the host sends its own astronaut and the AI's in a single packet.

**Who moves each astronaut (`driverOf`):**

| Value | Who | How it moves |
|---|---|---|
| `me` | Mine (`world.avatar`) | `step()` with keyboard and touch, as in solo play |
| `ai` | Solo, or on the host for those without a player | The usual AI (wandering, `action_loop`, waving back) |
| `player` | Another player, or the AI as seen by a guest | Glides to the last pose received (`followRemote`) |

The `surf.control` map (character → peer id, or `null` for the AI) comes from the host in `state surface`.

**Entering.**
- The host runs `startSurface()` and draws `surf.seed`. The block sites come from that seed (`placeBlocks(seed)`), so every block is in the same place without waiting for the host.
- The host sends `state surface {site, seed, timerSec, completed, control, active}` every 500 ms and on every change.
- The guest enters through the `surface` phase with that state (`applySurface`). Each player starts on their own astronaut.
- **The timer only starts when everyone has loaded the terrain.** Each guest sends `act('loaded')`, and the host waits at most 20 s (`LOAD_WAIT_MS`).

**Pose (~10 Hz).**
- Each screen sends `pose {av: {<character>: {x, y, z, yaw, anim, spd}}}` with the astronauts it moves. The host includes the AI's.
- `anim` is `idle`, `walk`, `wave` or `action`. It covers the player's emotes and the AI's states.
- The pose is only sent when it changes, and at least once per second.
- Whoever joins or comes back applies the last stored poses (`ASTRO_NET.poses`).

**Movement of the others (`player`):**
- The astronaut glides to the last pose (`FOLLOW_RATE`). A jump larger than `SNAP_M` (5 m) happens at once.
- The animation follows the pose's `anim`.
- When the one moving an astronaut changes, the old pose is discarded.

**Switching characters (keys 1–4 and the crew bar).**
- In multiplayer, the request goes to the host (`requestCrew` → `act('control', id)`). The host only hands over a free or AI character (`grantCrew`), and the one you let go returns to the AI where it was.
- The buttons of other players' characters are disabled ("player").
- Whoever leaves the room for good returns their character to the AI (`onPeers`).

**Minigames without freezing the world.**
- With the minigame open, my astronaut stands still (`step(dt, false)`), and the others and the AI keep moving.
- **Timer (new rule, `game-balance`):** in multiplayer, the return-window timer does not pause during minigames. In solo play, it still pauses.

**Experiments.**
- The minigame runs in the browser of whoever moves the experiment's owner.
- When it ends, the guest sends `act('task', id)` and already sees the block as done. The host checks it against `control` (`completeSurfaceTask(id, from.id)`).
- A block completed by another player shows as done on every screen (`markDone`).

**Boarding (team rule, `game-balance`).**
- **Boarding only happens with every online player at the lander**, within `BOARD_REACH` plus `BOARD_SLACK_M` (1.5 m), because the host sees the others with a small delay.
- E at the lander, or the "Board & depart" button, requests boarding (`act('board')` on the guest). If someone is far away, the requester sees "Waiting for the crew at the lander: Oscar.".
- **If time runs out, whoever did not come back stays on Mars:** anyone more than 35 m from the lander, player or AI, as in solo play.

**Stays local on each screen:** camera, helmet, compass, objectives, labels, emote wheel and reduced motion.

**Left for later:** the NPCs waving back when a guest looks at them (today they only react to the host's camera) and the labels with the players' names.

### 7. Results ✅
- The host sends `event {k:'results', forced, flight, surf}` with the final numbers. The guest copies those numbers and runs the same `showResults`, which has no randomness.
- "Retry" and "Replay" belong to the host. They clear `state flight` and `state surface` in the room and take everyone back to the planner or the lobby. The room stays open.

### 8. Audio
- Each client plays its own sound: the surface ambience on entering it. The cockpit tones play only on the host, for now.
- The files stay the same ([audio.md](audio.md)).

### 9. Drops and errors
- **A guest drops:** the `RoomClient` reconnects and takes the seat back on its own. If it does not return within 30 s, the seat becomes free, and on the host the character returns to the AI.
- **The host drops or leaves:** if the host leaves or does not return within 30 s, host ownership transfers to the next player in join order (`peers` with the new `host` id); the room only closes when no players remain.
- **Join errors** become toasts in English:

  | Code | Toast |
  |---|---|
  | `room-not-found` | "Room not found" |
  | `room-full` | "This crew is full" |
  | `in-progress` | "The mission already launched" |

- Without a server, "Create room" shows a toast, and the game stays solo.

## New minigames

1. A minigame belongs to a seat and runs in the browser of whoever has that seat. If the seat belongs to the AI, it runs on the host.
2. When it ends, it sends an `act` with the result (for example `{name: 'task', args: [id, stars]}`). The host checks the owner by the stamp and applies it.
3. If the others need to see the minigame while it happens, the owner sends the progress by `send` with `to: 'others'`. That progress does not change any rule.

## Suggested order and tests

1. Items 1 and 2: join the room and see the seats. 3 and 4: shared planner. 5: cockpit. 6 in two parts (first astronauts, poses and AI on the host; then experiments, minigames and boarding). 7: results. Each one in its own commit, playable.
2. At each step, test with the local server (`cd multiplayer && npm start`) and two windows:
   - the host on `index.html?server=ws://localhost:8787/ws` (from disk, without `?server=` the game uses the VM);
   - the guest on the invite link, which keeps `?server=`.
3. At the end, a Playwright script with two contexts:
   - the guest takes Lucas;
   - the planner is the same in both;
   - Lucas resets the breakers and Helena flies;
   - each one walks and the other sees it;
   - the NPCs (Oscar and Maya, run by the AI) are in the same place and the same state on both screens;
   - with the minigame open in one browser, the other still sees everyone moving;
   - L-S1 can only be closed by Lucas;
   - boarding only happens with both at the lander, and on timeout whoever is far away stays on Mars;
   - the scoreboard is the same.

   No console errors at 1440 and 390 px and with reduced motion. Solo play on `file://`, without a server, stays as it is today.
