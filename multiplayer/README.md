# Room server (multiplayer)

WebSocket server for cooperative games (up to 4 players). It handles **rooms, seats, phase and message relay**, and knows nothing about the game rules:

- whoever creates the room is the **host**, and the host's browser runs the rules (`flightTick`, `surfaceTick`, `showResults`);
- the others send intentions and receive the state.

How `index.html` uses this is described in [docs/multiplayer.md](../docs/multiplayer.md).

A package separate from the rest of the repository: it has its own `package.json`, its only dependency is `ws`, and it needs Node ≥ 22.

```text
config.mjs             limits and defaults (seats, joinable phases); everything can be overridden by an environment variable
rooms.mjs              room logic, without networking (testable with a fake clock)
server.mjs             HTTP (/health, test page) + WebSocket at /ws
client/room-client.js  window.RoomClient for the browser (classic script, works on file://)
demo/index.html        test page
deploy/                GCP VM: create the VM, install and update (setup.sh), Caddy and systemd
test/                  node:test: unit (rooms) and integration (server + RoomClient)
```

## Run and test

```bash
cd multiplayer
npm install
npm test          # unit + integration, must pass without ✖
npm start         # http://localhost:8787/ opens the test page
```

**On the test page:**
1. One window clicks **Create room** and copies the link (`?room=CODE`).
2. Another window, or another device, opens the link and joins.
3. From there you can switch seats, change the phase (host) and send messages on each channel.
4. Reloading the page returns to the same seat.

The page also opens straight from disk: `multiplayer/demo/index.html?server=ws://localhost:8787/ws`.

## Protocol (v1)

JSON messages. `create`, `join` and `resume` carry `v: 1`. Every error comes back as `{t:'error', code, ref}`, where `ref` is the type of the message that failed.

### Client → server

| Message | Who can send it | Effect |
|---|---|---|
| `create {seat?, seats?, joinable?, phase?, meta?}` | Anyone | Creates the room; the creator becomes the host. Without lists, it uses the current game's (`config.mjs`) |
| `join {code, seat?, meta?}` | Anyone, only in a joinable phase | Takes the requested seat or the first free one |
| `resume {code, id, token}` | Someone who dropped, in any phase | Returns to the same seat |
| `seat {seat}` | Host or guest, only in a joinable phase | Switches to a free seat |
| `kick {id}` | Host | Removes that player: the seat frees, the session can no longer resume and the player gets `closed {reason: 'kicked'}` (a new join with the code still works) |
| `meta {meta}` | Anyone | Updates one's own `meta` (a free-form object, up to 512 B) |
| `phase {phase}` | Host | Changes the room's phase (the game's current screen) |
| `state {key, data}` | Host | State for the guests. **Stored** by `key`; `data: null` deletes it |
| `event {data}` | Host | One-off event for the guests (toast, sound, result) |
| `act {data}` | Guest | Intention for the host, with the sender stamped |
| `pose {data}` | Anyone | For the others. **The last one is stored** per participant |
| `send {to, data}` | Anyone | Free relay: `to` = `host`, `all` (includes you), `others` or an id |
| `leave` | Anyone | Leaves the room. If it is the host, the next player in join order becomes the host (the room closes when the last player leaves) |

### Server → client

| Message | Content |
|---|---|
| `created` / `joined` / `resumed` | `{code, you:{id, seat, token}, host, seats, joinable, phase, peers, state, poses}`: whoever arrives already receives the stored state and the latest poses |
| `peers` | `{host, seats, peers:[{id, seat, host, online, meta}]}` on every change of presence |
| `phase`, `state`, `event` | What the host sent |
| `act`, `pose`, `msg` | `{from:{id, seat}, data}`. The `from` is stamped by the server, so the host can trust the sender's seat |
| `closed {reason}` | `host-left`, `expired`, `server` or `replaced` (the same seat was resumed on another connection) |
| `left` | Confirms the `leave` |

**Error codes:** `bad-version`, `bad-message`, `already-in-room`, `not-in-room`, `room-not-found`, `room-full`, `in-progress`, `seat-taken`, `bad-seat`, `bad-token`, `not-host`, `not-guest`, `host-offline`, `peer-not-found`, `too-many-rooms`, `too-many-keys`, `rate-limited`, `too-large`.

### Lifecycle
- The room code has 4 characters and avoids the ones that get confused (no 0/O or 1/I/L).
- Someone who drops becomes `online: false` and can come back with `resume` within 30 s. After that, the seat becomes free (in the game, it returns to the AI).
- If the host drops and does not return within 30 s, the room closes for everyone.
- A room expires after 4 h.
- The server sends a ping every 25 s and drops anyone who does not answer.
- **Rooms live only in memory:** if the server restarts, open games are lost.

## Configuration (environment variables)

The defaults are in [config.mjs](config.mjs). The main ones:

| Variable | Default | Use |
|---|---|---|
| `PORT` | 8787 | Cloud Run sets 8080 on its own |
| `HOST` | empty (all interfaces) | `127.0.0.1` behind a proxy on the same machine (the VM's Caddy) |
| `ALLOWED_ORIGINS` | empty (accepts everything) | Origins allowed to open the WebSocket, comma-separated. `null` = pages opened from `file://` |
| `DEFAULT_SEATS` | `helena,lucas,oscar,maya` | Seats when the host does not send its own. The first one is the host's |
| `DEFAULT_JOINABLE` | `menu,orbit,lobby,planner` | Phases in which players can join; after the launch, only `resume` |
| `MAX_PEERS` | 4 | — |
| `MAX_ROOMS` | 500 | — |
| `MAX_MESSAGE_BYTES` | 16384 | — |
| `RATE_PER_SEC` / `RATE_BURST` | 60 / 120 | — |
| `RESUME_GRACE_MS` | 30000 | — |
| `ROOM_TTL_MS` | 4 h | — |

## Client (`client/room-client.js`)

```js
const room = new RoomClient({ url: 'wss://…/ws' });
await room.create();                         // host, or: await room.join(RoomClient.codeFromUrl())
const link = RoomClient.linkFor(room.code);  // the same page with ?room=CODE
room.on('peers', peers => …);                // also: welcome, phase, state, event, act, pose, msg, status, closed, error
room.setPhase('planner'); room.setState('planner', snapshot); room.emit({ k: 'toast', text });   // host
room.act({ name: 'togglePart', args });      // guest
room.pose({ x, z, yaw });                    // anyone
```

- If the connection drops, the client reconnects and takes the seat back on its own, for up to 35 s.
- `sessionStorage` keeps the session: after reloading the page, `room.rejoin()` returns to the same seat, and `room.join(code)` tries to resume before joining as someone new.
- While it is reconnecting, sends return `false` and are not stored.

## Deploy (GCP, VM with Caddy)

One VM serves everything on the same domain:
- **the game:** the repository's static files;
- **the room server:** at `/ws`, behind Caddy;
- **HTTPS:** Caddy requests and renews the Let's Encrypt certificate on its own.

```text
browser ──https/wss──> Caddy (:443) ──/ws, /health──> node server.mjs (127.0.0.1:8787, systemd)
                                    └─ everything else ──> /srv/astro-romana (repository checkout)
```

| File in `deploy/` | What it does |
|---|---|
| `gcp-create-vm.sh` | Creates the static IP, the firewall rule (80, 443) and the Debian VM in São Paulo. Runs in Cloud Shell |
| `setup.sh` | On the VM, installs and updates everything: Node 22, Caddy, the `astro` user, the checkout in `/srv/astro-romana`, the service and the Caddyfile |
| `astro-rooms.service` | systemd service for the room server (restarts on its own, only listens on `127.0.0.1`) |
| `Caddyfile.site` | The site: `/ws` and `/health` to the server, everything else static. Hides `.git` and `node_modules` |

**First time:**
1. **Create the VM.** In [Cloud Shell](https://shell.cloud.google.com/), with the project selected (`gcloud config set project <id>`), run `bash gcp-create-vm.sh` (upload the file through the ⋮ → Upload menu, or paste its content).
   - It shows the external IP.
   - With your own domain, create an A record pointing to that IP before step 3.
   - Without a domain, the site is at `https://<ip-with-hyphens>.sslip.io`.
2. **Log in to the VM:** the SSH button on the VM's page, or `gcloud compute ssh astro-romana --zone southamerica-east1-a`. Upload `setup.sh` with the SSH window's upload button.
3. **Install:** `sudo bash setup.sh [domain] [email]`. Both arguments are optional: without a domain, it uses sslip.io; the email is for Let's Encrypt notices.
   - The first time, the script stops and shows a **deploy key**, because the repository is private.
   - Add the key in GitHub → Settings → Deploy keys, **without** "Allow write access".
   - Run the same command again.
4. **Check:**
   - the game at `https://<domain>/`;
   - the rooms test page at `https://<domain>/multiplayer/demo/`;
   - `https://<domain>/health`, which answers `{"ok":true,…}`.

**Update** (after a push to `main`): `sudo bash /srv/astro-romana/multiplayer/deploy/setup.sh`.
- The game files change right away.
- The room server only restarts if something in `multiplayer/` changed, and then the open rooms close. Avoid updating in the middle of a game.
- The domain and the email are stored in `/etc/astro-romana/site.env`. To change the domain, pass the new one as an argument.

**Day to day:**
- **Logs:** `journalctl -u astro-rooms -f` and `journalctl -u caddy -f`.
- **Restart:** `sudo systemctl restart astro-rooms`.
- **Allowed origins:** `https://<domain>` and `null` (pages on `file://`), in `/etc/astro-romana/rooms.env`. `setup.sh` rewrites that file.
  - For the game on GitHub Pages to use this VM, set `NET_SERVER = 'wss://<domain>/ws'` in `web/net.js` (or open it with `?server=wss://<domain>/ws`) and run `sudo EXTRA_ORIGINS=https://<user>.github.io bash /srv/astro-romana/multiplayer/deploy/setup.sh`.
  - The value is stored like the domain.
- **Cost:** the VM stays on all the time. The default is `e2-small`, and `MACHINE=e2-micro bash gcp-create-vm.sh` uses a smaller one. Stop the VM when you do not need it; the static IP stays reserved.
- **If the certificate fails with sslip.io** (Let's Encrypt issuance limit), use your own domain.

### Alternative: Cloud Run (no VM)

Only the room server, with automatic HTTPS on `*.run.app`. The game is hosted somewhere else, such as Firebase Hosting. From [Cloud Shell](https://shell.cloud.google.com/) or a machine with `gcloud`, at the root of the repository:

```bash
gcloud run deploy astro-romana-rooms --source multiplayer --region southamerica-east1 \
  --allow-unauthenticated --max-instances 1 --concurrency 1000 --timeout 3600 \
  --set-env-vars "^;^ALLOWED_ORIGINS=https://<game-origin>,null"
```

- `--max-instances 1`: rooms live in the memory of a single instance. With two, players in the same room could land on different instances.
- `--concurrency 1000`: each open WebSocket counts as a request. The default of 80 would limit it to 20 full rooms.
- `--timeout 3600`: the maximum length of a connection on Cloud Run (60 min). The client reconnects and resumes on its own.
- **For the demo**, add `--min-instances 1` to avoid a cold start. Remove it afterwards, so you do not pay for an idle instance.
- `^;^` changes the separator of `--set-env-vars`, because the origin list already uses commas.

**After the deploy:**
1. `https://<service>.run.app/health` answers `{"ok":true,…}`.
2. The test page is at `https://<service>.run.app/`.
3. The game will use `wss://<service>.run.app/ws`.
