// Astro Romana room server: HTTP (/health, the test page and the JSON API) and the WebSocket relay at /ws.
// Run: npm start (PORT, ALLOWED_ORIGINS, DB_PATH and the limits in config.mjs come from the environment).
// Abuse limits (config.mjs): message size, nesting and rate per socket; connections and rooms per client IP; a
// byte budget for what each room keeps; a slow reader is dropped. One bad message closes only its own socket.
//
// HTTP API (CORS follows ALLOWED_ORIGINS):
//   GET  /api/rooms             public rooms that are still open to new players
//   GET  /api/rooms/:code       one room by code (private ones too): exists, full, hasPassword…
//   GET  /api/leaderboard       ?tab=missions|players &difficulty=all|easy|normal|hard &site=all|jezero|gale &limit=1..50
//   POST /api/leaderboard       a finished mission (the host sends it); deduplicated by its id. Optional fields:
//                               experiments [{ id, stars, bot? }], runSeed, scoreMultiplier (0.75 | 1 | 1.5)
//   POST /api/admin/restart     Authorization: Bearer <ADMIN_TOKEN>. Closes every room ("the room server
//                               restarted") and exits; systemd (Restart=always) starts it again with the code on
//                               disk. Off without ADMIN_TOKEN. From your machine: npm run server:restart

import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadConfig } from './config.mjs';
import { openDatabase } from './db.mjs';
import { RoomHub, sanitizeText } from './rooms.mjs';

// The server's own version (multiplayer/package.json), shown at /health. The VM's auto-update
// (deploy/auto-update.sh) restarts the server when the pulled version differs from the running one.
const SERVER_VERSION = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')).version;

// Files served over HTTP. The test page loads ../client/room-client.js, which resolves to /client/… here and
// to multiplayer/client/… when the page is opened from disk.
const STATIC = {
  '/': ['demo/index.html', 'text/html; charset=utf-8'],
  '/index.html': ['demo/index.html', 'text/html; charset=utf-8'],
  '/client/room-client.js': ['client/room-client.js', 'text/javascript; charset=utf-8'],
};
const OPEN = 1; // WebSocket.OPEN
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const SITES = ['jezero', 'gale'];
const SEATS = ['helena', 'lucas', 'oscar', 'maya'];
const GRADES = ['S+', 'A', 'B', 'C', 'F'];
const MODES = ['solo', 'multiplayer'];
const EXPERIMENT_ID = /^[HLOM]-[OS][1-6]$/; // docs/minigames.md codes, e.g. H-S1, M-O3
const SCORE_MULTIPLIERS = [0.75, 1, 1.5]; // game-balance: easy, normal, hard (docs/experiments-implementation.md §4.6)
const MAX_SCORE = 100_000; // sanity cap on a submitted score (game scores are in the low thousands)

// onRestart: what POST /api/admin/restart does once it has answered (the entry point closes and exits). Without
// it, or without a long enough ADMIN_TOKEN, the endpoint does not exist.
export async function startServer(config = loadConfig(), { log = console.log, onRestart = null } = {}) {
  const hub = new RoomHub(config, { log });
  const db = openDatabase(config.DB_PATH);
  const started = Date.now();
  const allowed = new Set(config.ALLOWED_ORIGINS);
  const posts = new Map(); // ip → { count, resetAt } for POST rate limiting
  const proxies = new Set(config.TRUSTED_PROXIES);
  const ipOf = req => clientIp(req, proxies);

  // The admin token, kept only as a hash and compared in constant time.
  const sha = text => createHash('sha256').update(String(text)).digest();
  const token = config.ADMIN_TOKEN || '';
  if (token && token.length < config.ADMIN_TOKEN_MIN_LEN) log(`admin: ADMIN_TOKEN is shorter than ${config.ADMIN_TOKEN_MIN_LEN} characters, so /api/admin/restart stays off`);
  const adminHash = token.length >= config.ADMIN_TOKEN_MIN_LEN && onRestart ? sha(token) : null;
  const adminFails = { count: 0, resetAt: 0 };
  const tokenMatches = header => { const m = /^Bearer\s+(\S+)$/.exec(header || ''); return !!m && timingSafeEqual(sha(m[1]), adminHash); };

  // CORS: any origin when ALLOWED_ORIGINS is empty (local development), otherwise only the listed ones.
  function corsHeaders(req) {
    const origin = req.headers.origin;
    const headers = { Vary: 'Origin' };
    if (!origin) return headers;
    if (!allowed.size) headers['Access-Control-Allow-Origin'] = origin === 'null' ? '*' : origin;
    else if (allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin === 'null' ? '*' : origin;
    else return headers;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
    return headers;
  }
  const originAllowed = req => !allowed.size || req.headers.origin === undefined || allowed.has(req.headers.origin);
  function rateLimited(req) {
    const ip = ipOf(req), now = Date.now();
    let entry = posts.get(ip);
    if (!entry || now >= entry.resetAt) { entry = { count: 0, resetAt: now + 60_000 }; posts.set(ip, entry); }
    return ++entry.count > config.API_RATE_PER_MIN;
  }
  const json = (req, res, status, body) => reply(res, status, 'application/json', JSON.stringify(body), corsHeaders(req));

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', chunk => {
        size += chunk.length;
        if (size > config.MAX_API_BYTES) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
        chunks.push(chunk);
      });
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); } });
      req.on('error', reject);
    });
  }

  const http = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'), path = url.pathname;
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...corsHeaders(req), 'Content-Length': 0 }); return res.end(); }
    if (path.startsWith('/api/') || path === '/health') {
      try { return await handleApi(req, res, url, path); }
      catch (err) { return json(req, res, err.status || 500, { error: err.status ? err.message : 'server error' }); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, 'text/plain', 'method not allowed');
    const file = STATIC[path];
    if (!file) return reply(res, 404, 'text/plain', 'not found');
    try { reply(res, 200, file[1], await readFile(new URL(file[0], import.meta.url))); }
    catch { reply(res, 500, 'text/plain', 'file missing'); }
  });

  async function handleApi(req, res, url, path) {
    const get = req.method === 'GET' || req.method === 'HEAD';
    if (path === '/health') {
      if (!get) return json(req, res, 405, { error: 'method not allowed' });
      return json(req, res, 200, { ok: true, version: SERVER_VERSION, protocol: config.PROTOCOL_VERSION, uptimeSec: Math.round((Date.now() - started) / 1000), ...hub.stats(), dbOk: true, ...db.stats() });
    }
    if (path === '/api/rooms') {
      if (!get) return json(req, res, 405, { error: 'method not allowed' });
      return json(req, res, 200, { rooms: hub.listPublicRooms() });
    }
    const room = /^\/api\/rooms\/([^/]+)$/.exec(path);
    if (room) {
      if (!get) return json(req, res, 405, { error: 'method not allowed' });
      return json(req, res, 200, hub.inspectRoom(decodeURIComponent(room[1])));
    }
    if (path === '/api/leaderboard') {
      if (get) {
        if (url.searchParams.get('snapshot') === '1') {
          const snapshot = {};
          for (const tab of ['missions', 'players']) for (const difficulty of ['all', ...DIFFICULTIES]) for (const site of ['all', ...SITES]) {
            const filters = { difficulty, site, limit: 25 };
            snapshot[`${tab}:${difficulty}:${site}`] = tab === 'players' ? db.getPlayerLeaderboard(filters) : db.getMissionLeaderboard(filters);
          }
          return json(req, res, 200, { snapshot });
        }
        const q = url.searchParams, tab = q.get('tab') === 'players' ? 'players' : 'missions';
        const difficulty = DIFFICULTIES.includes(q.get('difficulty')) ? q.get('difficulty') : 'all';
        const site = SITES.includes(q.get('site')) ? q.get('site') : 'all';
        const limit = Math.min(50, Math.max(1, Math.trunc(Number(q.get('limit'))) || 25));
        const filters = { difficulty, site, limit };
        return json(req, res, 200, { tab, entries: tab === 'players' ? db.getPlayerLeaderboard(filters) : db.getMissionLeaderboard(filters) });
      }
      if (req.method !== 'POST') return json(req, res, 405, { error: 'method not allowed' });
      if (!originAllowed(req)) return json(req, res, 403, { error: 'forbidden origin' });
      if (rateLimited(req)) return json(req, res, 429, { error: 'rate limited' });
      const mission = validateMission(await readBody(req));
      if (!mission) return json(req, res, 400, { error: 'invalid mission' });
      const result = db.recordMission(mission);
      return json(req, res, result.recorded ? 201 : 200, { ok: true, id: mission.id, duplicate: result.duplicate });
    }
    if (path === '/api/admin/restart' && adminHash) {
      if (req.method !== 'POST') return json(req, res, 405, { error: 'method not allowed' });
      const now = Date.now();
      if (now >= adminFails.resetAt) Object.assign(adminFails, { count: 0, resetAt: now + 60_000 });
      if (adminFails.count >= config.ADMIN_FAILS_PER_MIN) return json(req, res, 429, { error: 'rate limited' });
      if (!tokenMatches(req.headers.authorization)) {
        adminFails.count++;
        log(`admin: restart refused (wrong or missing token)`);
        return json(req, res, 401, { error: 'unauthorized' });
      }
      const stats = hub.stats();
      log(`admin: restart requested with ${stats.rooms} room(s) and ${stats.online} player(s) online`);
      json(req, res, 202, { ok: true, restarting: true, version: SERVER_VERSION, ...stats });
      setTimeout(onRestart, 50); // the reply goes out first
      return;
    }
    return json(req, res, 404, { error: 'not found' });
  }

  // maxPayload is a hard stop (the socket closes); messages above MAX_MESSAGE_BYTES but below it get a
  // polite `too-large` error instead.
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.MAX_MESSAGE_BYTES * 4 });
  const connsByIp = new Map(); // ip → open sockets (counted from the upgrade until the socket closes)
  let sockets = 0;
  http.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const origin = req.headers.origin; // browsers always send it ("null" from file://); other clients may not
    if (path !== '/ws' || (allowed.size && origin !== undefined && !allowed.has(origin))) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const ip = ipOf(req), fromIp = connsByIp.get(ip) ?? 0, perIp = config.MAX_CONNECTIONS_PER_IP;
    if (sockets >= config.MAX_CONNECTIONS || (perIp > 0 && fromIp >= perIp)) {
      socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets++;
    connsByIp.set(ip, fromIp + 1);
    socket.once('close', () => {
      sockets--;
      const left = (connsByIp.get(ip) ?? 1) - 1;
      if (left > 0) connsByIp.set(ip, left); else connsByIp.delete(ip);
    });
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, ip));
  });

  wss.on('connection', (ws, req, ip) => {
    // Every send goes through here: a socket that cannot keep up (MAX_BUFFERED_BYTES queued) or fails is dropped
    // alone. Its peer goes offline and may resume, like any dropped connection.
    let dropped = false;
    const drop = why => {
      if (dropped) return;
      dropped = true;
      log(`ws ${ip}: dropped (${why})`);
      ws.terminate();
    };
    const sendText = text => {
      if (dropped || ws.readyState !== OPEN) return;
      if (ws.bufferedAmount > config.MAX_BUFFERED_BYTES) return drop('slow reader');
      try { ws.send(text); } catch (err) { drop(`send failed: ${err?.message}`); }
    };
    const conn = {
      ip,
      sendText,
      send: message => {
        let text;
        try { text = JSON.stringify(message); } catch (err) { log(`ws ${ip}: could not serialize a ${message?.t} message: ${err?.message}`); return; }
        sendText(text);
      },
    };
    const bucket = { tokens: config.RATE_BURST, at: Date.now(), warnedAt: 0 };
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw, isBinary) => {
      const now = Date.now();
      bucket.tokens = Math.min(config.RATE_BURST, bucket.tokens + (now - bucket.at) / 1000 * config.RATE_PER_SEC);
      bucket.at = now;
      if (bucket.tokens < 1) { // drop; tell the client at most once a second
        if (now - bucket.warnedAt > 1000) { bucket.warnedAt = now; conn.send({ t: 'error', code: 'rate-limited' }); }
        return;
      }
      bucket.tokens -= 1;
      if (isBinary) return conn.send({ t: 'error', code: 'bad-message' });
      if (raw.length > config.MAX_MESSAGE_BYTES) return conn.send({ t: 'error', code: 'too-large' });
      let msg;
      try { msg = JSON.parse(raw); } catch { return conn.send({ t: 'error', code: 'bad-message' }); }
      if (tooDeep(msg, config.MAX_JSON_DEPTH)) return conn.send({ t: 'error', code: 'bad-message' });
      // One message that makes the hub throw closes that socket only; the other rooms and players carry on.
      try { hub.handle(conn, msg); }
      catch (err) {
        log(`ws ${ip}: a ${typeof msg?.t === 'string' ? msg.t.slice(0, 32) : '?'} message failed: ${err?.message}`);
        if (!dropped) { dropped = true; ws.close(1011, 'server error'); }
      }
    });
    ws.on('close', () => {
      try { hub.disconnect(conn); } catch (err) { log(`ws ${ip}: disconnect failed: ${err?.message}`); }
    });
    ws.on('error', () => {}); // 'close' follows
  });

  // Heartbeat: a socket that missed the last ping is gone (closing it frees the seat after the grace period).
  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, config.PING_INTERVAL_MS);
  const sweep = setInterval(() => {
    try { hub.sweep(); } catch (err) { log(`sweep failed: ${err?.message}`); }
    const now = Date.now();
    for (const [ip, entry] of posts) if (now >= entry.resetAt) posts.delete(ip);
  }, config.SWEEP_INTERVAL_MS);

  await new Promise(resolve => http.listen(config.PORT, config.HOST || undefined, resolve));
  const { port } = http.address();

  async function close(reason = 'server') {
    clearInterval(ping);
    clearInterval(sweep);
    hub.closeAll(reason);
    for (const ws of wss.clients) ws.close(1001, 'server closing'); // flushes the `closed` messages first
    await Promise.race([new Promise(resolve => wss.close(() => resolve())), new Promise(resolve => setTimeout(resolve, 2000))]);
    for (const ws of wss.clients) ws.terminate();
    http.closeAllConnections();
    await new Promise(resolve => http.close(() => resolve()));
    db.close();
  }

  return { port, url: `ws://localhost:${port}/ws`, http: `http://localhost:${port}`, hub, db, close };
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// The client's address. Behind Caddy on the same machine every connection comes from loopback, so there the
// rightmost X-Forwarded-For entry (the address Caddy saw) is the client; from any other peer the header is ignored.
// `trusted`: the TRUSTED_PROXIES set ('*' = every peer).
export function clientIp(req, trusted) {
  const peer = req.socket?.remoteAddress || '?';
  if (!trusted.has('*') && !trusted.has(peer)) return peer;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return forwarded.at(-1)?.slice(0, 64) || peer;
}

// True when a parsed JSON value nests objects/arrays deeper than `max`. Iterative: a 6000-level message must not
// overflow the stack here (nor later in JSON.stringify, which is why it is refused).
export function tooDeep(value, max) {
  const stack = [[value, 1]];
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (v === null || typeof v !== 'object') continue;
    if (depth > max) return true;
    for (const child of Object.values(v)) if (child !== null && typeof child === 'object') stack.push([child, depth + 1]);
  }
  return false;
}

// A submitted mission, cleaned up; null when anything is out of range.
export function validateMission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const id = typeof body.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.id) ? body.id : null;
  if (!id || !MODES.includes(body.mode) || !SITES.includes(body.site) || !DIFFICULTIES.includes(body.difficulty) || !GRADES.includes(body.grade)) return null;
  if (!isInt(body.teamScore, 0, MAX_SCORE) || !isInt(body.tasksDone, 0, 16) || !isInt(body.tasksTotal, 0, 16) || body.tasksDone > body.tasksTotal) return null;
  if (!isInt(body.strandedCount ?? 0, 0, 4)) return null;
  if (!Array.isArray(body.players) || body.players.length < 1 || body.players.length > 4) return null;
  const players = [];
  for (const p of body.players) {
    const playerName = sanitizeText(p?.playerName, 20);
    if (playerName.length < 2 || !SEATS.includes(p.seat) || !GRADES.includes(p.grade) || !isInt(p.score, 0, MAX_SCORE)) return null;
    players.push({ playerName, seat: p.seat, score: p.score, grade: p.grade, stranded: p.stranded === true });
  }
  if (new Set(players.map(p => p.seat)).size !== players.length) return null;
  const roomCode = typeof body.roomCode === 'string' && /^[A-Za-z0-9]{1,8}$/.test(body.roomCode) ? body.roomCode.toUpperCase() : null;
  // Optional since the experiment draw: the drawn experiments with their stars (bot: done by the AI), the run
  // seed and the difficulty score multiplier. Older clients send none of them.
  let experiments = null;
  if (body.experiments != null) {
    if (!Array.isArray(body.experiments) || body.experiments.length > 16) return null;
    experiments = [];
    for (const e of body.experiments) {
      if (!e || typeof e.id !== 'string' || !EXPERIMENT_ID.test(e.id) || !isInt(e.stars, 0, 3)) return null;
      experiments.push(e.bot === true ? { id: e.id, stars: e.stars, bot: true } : { id: e.id, stars: e.stars });
    }
    if (new Set(experiments.map(e => e.id)).size !== experiments.length) return null;
  }
  if (body.runSeed != null && !isInt(body.runSeed, 0, 2 ** 31)) return null;
  if (body.scoreMultiplier != null && !SCORE_MULTIPLIERS.includes(body.scoreMultiplier)) return null;
  return { id, roomCode, mode: body.mode, site: body.site, difficulty: body.difficulty, grade: body.grade, teamScore: body.teamScore, tasksDone: body.tasksDone, tasksTotal: body.tasksTotal, strandedCount: body.strandedCount ?? 0, players,
    experiments, runSeed: body.runSeed ?? null, scoreMultiplier: body.scoreMultiplier ?? null, createdAt: Date.now() };
}

function reply(res, status, type, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}

// Entry point (npm start).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  // An admin restart closes every room (players see "the room server restarted") and exits; under systemd
  // (Restart=always) the server is back in a couple of seconds, with whatever code the VM has pulled.
  const server = await startServer(config, {
    onRestart: async () => { await server.close('server'); console.log('admin restart: exiting'); process.exit(0); },
  });
  console.log(`room server on ${config.HOST || '*'}:${server.port} · test page ${server.http}/ · db ${config.DB_PATH} · origins ${config.ALLOWED_ORIGINS.join(', ') || 'any'}`);
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, async () => { await server.close('server'); process.exit(0); }); // Cloud Run sends SIGTERM
  }
}
