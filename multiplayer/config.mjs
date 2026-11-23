// Limits and defaults of the room server. Every value can be overridden by an environment variable with the
// same name (lists are comma separated). All numbers here are operational limits, not game balance.

const DEFAULTS = {
  PORT: 8787, // Cloud Run sets PORT=8080
  // Interface to listen on. Empty = all (Cloud Run, local tests); 127.0.0.1 behind a proxy on the same machine (Caddy on the VM).
  HOST: '',
  // Origins allowed to open a WebSocket. Empty = any origin (local development). "null" = pages opened from file://.
  ALLOWED_ORIGINS: [],

  // The current game flow (web/app.js): four crew seats, the host takes the first one (Helena). A host can send
  // its own lists in `create`, so changing the crew or the screens does not need a server deploy.
  DEFAULT_SEATS: ['helena', 'lucas', 'oscar', 'maya'],
  // Screens where new players may join; after launch (cockpit, surface, results) only `resume` works.
  DEFAULT_JOINABLE: ['menu', 'orbit', 'lobby', 'planner'],
  DEFAULT_PHASE: 'lobby',

  MAX_PEERS: 4, // seats per room (the challenge asks for up to four participants)
  MAX_ROOMS: 500,
  MAX_PHASES: 32, // entries in a room's joinable list
  MAX_STATE_KEYS: 16, // cached `state` channels per room
  MAX_MESSAGE_BYTES: 16 * 1024,
  MAX_META_BYTES: 512, // a peer's free-form meta (sent with every peer list)
  RATE_PER_SEC: 60, // sustained messages per connection (poses ~10 Hz + flight state ~10 Hz fit easily)
  RATE_BURST: 120,

  RESUME_GRACE_MS: 30_000, // a dropped peer keeps its seat this long; a dropped host keeps the room this long
  ROOM_TTL_MS: 4 * 60 * 60 * 1000,
  PING_INTERVAL_MS: 25_000, // below common proxy idle timeouts
  SWEEP_INTERVAL_MS: 1_000,

  CODE_LENGTH: 4,
  CODE_ALPHABET: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // no 0/O, 1/I/L

  // Server leaderboard (SQLite file; ':memory:' in tests) and the HTTP API limits.
  DB_PATH: './data/astro.sqlite',
  MAX_API_BYTES: 8 * 1024,
  API_RATE_PER_MIN: 30, // POSTs per IP per minute
  MAX_ROOM_NAME_LEN: 32,
  MAX_PASSWORD_LEN: 32,
};

export const PROTOCOL_VERSION = 1;

export function loadConfig(env = process.env) {
  const out = { PROTOCOL_VERSION };
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const raw = env[key];
    if (raw == null || raw === '') out[key] = fallback;
    else if (Array.isArray(fallback)) out[key] = raw.split(',').map(s => s.trim()).filter(Boolean);
    else if (typeof fallback === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) throw new Error(`config: ${key} must be a non-negative number, got "${raw}"`);
      out[key] = n;
    } else out[key] = String(raw);
  }
  return Object.freeze(out);
}
