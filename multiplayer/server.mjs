// Astro Romana room server: HTTP (/health, the test page and the JSON API) and the WebSocket relay at /ws.
// Run: npm start (PORT, ALLOWED_ORIGINS, DB_PATH and the limits in config.mjs come from the environment).
//
// HTTP API (CORS follows ALLOWED_ORIGINS):
//   GET  /api/rooms             public rooms that are still open to new players
//   GET  /api/rooms/:code       one room by code (private ones too): exists, full, hasPassword…
//   GET  /api/leaderboard       ?tab=missions|players &difficulty=all|easy|normal|hard &site=all|jezero|gale &limit=1..50
//   POST /api/leaderboard       a finished mission (the host sends it); deduplicated by its id. Optional fields:
//                               experiments [{ id, stars, bot? }], runSeed, scoreMultiplier (0.75 | 1 | 1.5)

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

export async function startServer(config = loadConfig(), { log = console.log } = {}) {
  const hub = new RoomHub(config, { log });
  const db = openDatabase(config.DB_PATH);
  const started = Date.now();
  const allowed = new Set(config.ALLOWED_ORIGINS);
  const posts = new Map(); // ip → { count, resetAt } for POST rate limiting

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
    const ip = req.socket.remoteAddress || '?', now = Date.now();
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
    return json(req, res, 404, { error: 'not found' });
  }

  // maxPayload is a hard stop (the socket closes); messages above MAX_MESSAGE_BYTES but below it get a
  // polite `too-large` error instead.
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.MAX_MESSAGE_BYTES * 4 });
  http.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const origin = req.headers.origin; // browsers always send it ("null" from file://); other clients may not
    if (path !== '/ws' || (allowed.size && origin !== undefined && !allowed.has(origin))) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', ws => {
    const conn = { send: message => { if (ws.readyState === OPEN) ws.send(JSON.stringify(message)); } };
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
      hub.handle(conn, msg);
    });
    ws.on('close', () => hub.disconnect(conn));
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
    hub.sweep();
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
  const server = await startServer(config);
  console.log(`room server on ${config.HOST || '*'}:${server.port} · test page ${server.http}/ · db ${config.DB_PATH} · origins ${config.ALLOWED_ORIGINS.join(', ') || 'any'}`);
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, async () => { await server.close('server'); process.exit(0); }); // Cloud Run sends SIGTERM
  }
}
