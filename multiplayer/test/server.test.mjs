// Integration: a real server on a random port, RoomClient over Node's global WebSocket, and raw ws clients for
// the transport limits (origin, size, rate).
import fs from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { loadConfig } from '../config.mjs';
import { startServer } from '../server.mjs';
import '../client/room-client.js';

const { RoomClient } = globalThis;

async function withServer(overrides, fn) {
  const server = await startServer({ ...loadConfig({}), PORT: 0, DB_PATH: ':memory:', ...overrides }, { log: () => {} });
  const clients = [];
  const client = opts => { const c = new RoomClient({ url: server.url, reconnect: false, ...opts }); clients.push(c); return c; };
  try { await fn(server, client); } finally {
    for (const c of clients) c.close();
    await server.close();
  }
}
const next = (room, type) => new Promise(resolve => { const off = room.on(type, (...args) => { off(); resolve(args); }); });
function raw(url, headers) {
  const ws = new WebSocket(url, { headers });
  const inbox = [];
  const waiters = [];
  ws.on('message', data => { const m = JSON.parse(data); const w = waiters.shift(); if (w) w(m); else inbox.push(m); });
  return {
    ws,
    open: () => new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }),
    send: m => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    next: () => inbox.length ? Promise.resolve(inbox.shift()) : new Promise(resolve => waiters.push(resolve)),
  };
}

test('a mission flow: create, link, join, seats, phase, state, act, pose, results, host leaves', () => withServer({}, async (server, client) => {
  const host = client(), guest = client();
  const created = await host.create();
  assert.equal(host.isHost, true);
  const link = RoomClient.linkFor(created.code, 'https://example.org/index.html#lobby');
  assert.equal(RoomClient.codeFromUrl(link), created.code);

  host.setState('planner', { site: 'jezero', rocket: { stages: 2 } });
  const peers = next(host, 'peers');
  const joined = await guest.join(RoomClient.codeFromUrl(link), { seat: 'oscar' });
  assert.equal(joined.you.seat, 'oscar');
  assert.deepEqual(guest.state.planner, { site: 'jezero', rocket: { stages: 2 } }); // cached for newcomers
  assert.equal((await peers)[0].length, 2);
  assert.deepEqual(guest.freeSeats, ['lucas', 'maya']);

  const seatChange = next(host, 'peers');
  guest.setSeat('lucas');
  await seatChange;
  assert.equal(host.peers.find(p => !p.host).seat, 'lucas');

  const act = next(host, 'act');
  guest.act({ name: 'togglePart', args: ['engine-raptor'] });
  const [data, from] = await act;
  assert.deepEqual(data, { name: 'togglePart', args: ['engine-raptor'] });
  assert.deepEqual(from, { id: guest.you.id, seat: 'lucas' });

  const phase = next(guest, 'phase');
  host.setPhase('cockpit');
  assert.deepEqual(await phase, ['cockpit']);
  const late = client();
  await assert.rejects(late.join(created.code), { code: 'in-progress' });

  const flight = next(guest, 'state');
  host.setState('flight', { step: 1, breakers: [true, false, true] });
  assert.deepEqual(await flight, ['flight', { step: 1, breakers: [true, false, true] }]);

  const pose = next(host, 'pose');
  guest.pose({ x: 3, z: -2, yaw: 1.5 });
  assert.equal((await pose)[1].seat, 'lucas');

  const results = next(guest, 'event');
  host.emit({ k: 'results', grade: 'A' });
  assert.deepEqual(await results, [{ k: 'results', grade: 'A' }]);

  const promoted = next(guest, 'peers');
  host.leave();
  await promoted;
  assert.equal(guest.inRoom, true);
  assert.equal(guest.isHost, true);
  guest.leave();
  assert.equal(guest.inRoom, false);
}));

test('a guest that drops reconnects and keeps its seat', () => withServer({}, async (server, client) => {
  const host = client(), guest = client({ reconnect: true });
  const { code } = await host.create();
  const arrived = next(host, 'peers');
  await guest.join(code);
  await arrived;
  const seat = guest.you.seat;
  const offline = next(host, 'peers');
  const resumed = next(guest, 'welcome');
  guest.ws.close(); // network drop, not leave()
  assert.equal((await offline)[0].find(p => p.seat === seat).online, false);
  assert.equal((await resumed)[0].t, 'resumed');
  assert.equal(guest.you.seat, seat);
  assert.equal(guest.status, 'open');
}));

test('admin restart: off without a long enough token or a restart hook', async () => {
  const restart = server => fetch(`${server.http}/api/admin/restart`, { method: 'POST', headers: { Authorization: 'Bearer anything' } });
  for (const [overrides, onRestart] of [[{}, () => {}], [{ ADMIN_TOKEN: 'short-token' }, () => {}], [{ ADMIN_TOKEN: 'x'.repeat(40) }, null]]) {
    const server = await startServer({ ...loadConfig({}), PORT: 0, DB_PATH: ':memory:', ...overrides }, { log: () => {}, onRestart });
    try { assert.equal((await restart(server)).status, 404); } finally { await server.close(); }
  }
});

test('admin restart: needs the token, limits wrong ones, then restarts', async () => {
  const TOKEN = 'k'.repeat(43);
  let restarts = 0;
  const server = await startServer({ ...loadConfig({}), PORT: 0, DB_PATH: ':memory:', ADMIN_TOKEN: TOKEN, ADMIN_FAILS_PER_MIN: 4 },
    { log: () => {}, onRestart: () => { restarts++; } });
  try {
    const post = (authorization, method = 'POST') => fetch(`${server.http}/api/admin/restart`, { method, headers: authorization ? { Authorization: authorization } : {} });
    assert.equal((await post(`Bearer ${TOKEN}`, 'GET')).status, 405);
    assert.equal((await post(null)).status, 401);
    assert.equal((await post('Bearer wrong')).status, 401);
    assert.equal((await post(`Bearer ${TOKEN}x`)).status, 401);
    assert.equal((await post(TOKEN)).status, 401); // without "Bearer"
    const ok = await post(`Bearer ${TOKEN}`);
    assert.equal(ok.status, 429); // four wrong tokens this minute: even the right one waits
    assert.equal(restarts, 0);
  } finally { await server.close(); }

  const fresh = await startServer({ ...loadConfig({}), PORT: 0, DB_PATH: ':memory:', ADMIN_TOKEN: TOKEN }, { log: () => {}, onRestart: () => { restarts++; } });
  try {
    const res = await fetch(`${fresh.http}/api/admin/restart`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.restarting, true);
    assert.equal(body.rooms, 0);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(restarts, 1);
  } finally { await fresh.close(); }
});

test('health and the test page are served', () => withServer({}, async server => {
  const health = await (await fetch(`${server.http}/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.rooms, 0);
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(health.version, pkg.version); // what the VM's auto-update compares with the pulled package.json
  const page = await fetch(`${server.http}/`);
  assert.match(await page.text(), /RoomClient/);
  assert.equal((await fetch(`${server.http}/client/room-client.js`)).status, 200);
  assert.equal((await fetch(`${server.http}/../config.mjs`)).status, 404);
}));

test('origins outside ALLOWED_ORIGINS are refused; file:// (null) can be allowed', () => withServer({ ALLOWED_ORIGINS: ['https://game.example', 'null'] }, async server => {
  await assert.rejects(raw(server.url, { Origin: 'https://evil.example' }).open(), /403/);
  const ok = raw(server.url, { Origin: 'null' });
  await ok.open();
  ok.ws.close();
}));

test('bad version, bad JSON, oversized and flooding messages get errors', () => withServer({ MAX_MESSAGE_BYTES: 1024, RATE_PER_SEC: 5, RATE_BURST: 5 }, async server => {
  const c = raw(server.url);
  await c.open();
  c.send({ v: 99, t: 'create' });
  assert.deepEqual(await c.next(), { t: 'error', code: 'bad-version', ref: 'create' });
  c.send('{not json');
  assert.deepEqual(await c.next(), { t: 'error', code: 'bad-message' });
  c.send({ t: 'pose', data: 'x'.repeat(2000) });
  assert.deepEqual(await c.next(), { t: 'error', code: 'too-large' });
  for (let i = 0; i < 10; i++) c.send({ t: 'pose', data: i });
  const errors = new Set();
  for (let i = 0; i < 3; i++) errors.add((await c.next()).code);
  assert.ok(errors.has('rate-limited'));
  c.ws.close();
}));

test('room browser lists public rooms only; private rooms require code lookup', () => withServer({}, async (server, client) => {
  const hPub = client(), hPriv = client();
  const pub = await hPub.create({ name: 'Jezero Squad', meta: { name: 'Ana' } });
  hPub.setState('setup', { site: 'jezero', difficulty: 'hard' });
  const priv = await hPriv.create({ name: 'Secret Crew', isPrivate: true, meta: { name: 'Bia' } });

  const list = await (await fetch(`${server.http}/api/rooms`)).json();
  assert.equal(list.rooms.length, 1);
  assert.equal(list.rooms[0].code, pub.code);
  assert.equal(list.rooms[0].name, 'Jezero Squad');
  assert.equal(list.rooms[0].hostName, 'Ana');
  assert.equal(list.rooms[0].site, 'jezero');
  assert.equal(list.rooms[0].difficulty, 'hard');
  assert.equal(list.rooms[0].hasPassword, false);

  const info = await (await fetch(`${server.http}/api/rooms/${priv.code}`)).json();
  assert.equal(info.exists, true);
  assert.equal(info.isPrivate, true);
  assert.equal(info.name, 'Secret Crew');

  const g = client();
  await g.join(priv.code, { meta: { name: 'Caio' } });
  assert.equal(g.inRoom, true);
  assert.equal(g.roomName, 'Secret Crew');

  const missing = await (await fetch(`${server.http}/api/rooms/ZZZZ`)).json();
  assert.deepEqual(missing, { exists: false });
}));

test('password-protected rooms enforce password without leaking it', () => withServer({}, async (server, client) => {
  const host = client(), g1 = client(), g2 = client(), g3 = client();
  const created = await host.create({ name: 'Vault Mission', password: 'mars-2026', meta: { name: 'Helena' } });
  assert.equal(created.hasPassword, true);
  assert.equal(JSON.stringify(created).includes('mars-2026'), false);

  const list = await (await fetch(`${server.http}/api/rooms`)).json();
  assert.equal(list.rooms[0].hasPassword, true);
  assert.equal(JSON.stringify(list).includes('mars-2026'), false);

  await assert.rejects(g1.join(created.code), { code: 'password-required' });
  await assert.rejects(g2.join(created.code, { password: 'wrong' }), { code: 'wrong-password' });
  await g3.join(created.code, { password: 'mars-2026', meta: { name: 'Lucas' } });
  assert.equal(g3.inRoom, true);
}));

test('SQLite leaderboard records missions, deduplicates, filters, and ranks players; CORS works', () => withServer({ ALLOWED_ORIGINS: ['https://game.example'] }, async server => {
  const preflight = await fetch(`${server.http}/api/rooms`, { method: 'OPTIONS', headers: { Origin: 'https://game.example' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://game.example');

  const badOrigin = await fetch(`${server.http}/api/leaderboard`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ id: 'm-1' }),
  });
  assert.equal(badOrigin.status, 403);

  const invalid = await fetch(`${server.http}/api/leaderboard`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://game.example' },
    body: JSON.stringify({ id: 'bad', mode: 'multiplayer' }),
  });
  assert.equal(invalid.status, 400);

  const m1 = {
    id: 'mission-test-001', roomCode: 'ABCD', mode: 'multiplayer', site: 'jezero', difficulty: 'normal',
    grade: 'S+', teamScore: 1240, tasksDone: 4, tasksTotal: 4, strandedCount: 0,
    players: [
      { playerName: 'Ana', seat: 'helena', score: 380, grade: 'S+', stranded: false },
      { playerName: 'Bia', seat: 'lucas', score: 340, grade: 'A', stranded: false },
    ],
  };
  const m2 = {
    id: 'mission-test-002', roomCode: 'EFGH', mode: 'multiplayer', site: 'gale', difficulty: 'hard',
    grade: 'A', teamScore: 990, tasksDone: 3, tasksTotal: 4, strandedCount: 1,
    players: [
      { playerName: 'Ana', seat: 'maya', score: 310, grade: 'A', stranded: false },
      { playerName: 'Caio', seat: 'oscar', score: 0, grade: 'F', stranded: true },
    ],
  };
  const post1 = await fetch(`${server.http}/api/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://game.example' }, body: JSON.stringify(m1) });
  assert.equal(post1.status, 201);
  const dup = await fetch(`${server.http}/api/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://game.example' }, body: JSON.stringify(m1) });
  assert.equal(dup.status, 200);
  assert.equal((await dup.json()).duplicate, true);
  await fetch(`${server.http}/api/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://game.example' }, body: JSON.stringify(m2) });

  const missionsAll = await (await fetch(`${server.http}/api/leaderboard?tab=missions`)).json();
  assert.equal(missionsAll.entries.length, 2);
  assert.equal(missionsAll.entries[0].teamScore, 1240);
  assert.equal(missionsAll.entries[0].players.length, 2);

  const missionsHard = await (await fetch(`${server.http}/api/leaderboard?tab=missions&difficulty=hard&site=gale`)).json();
  assert.equal(missionsHard.entries.length, 1);
  assert.equal(missionsHard.entries[0].id, 'mission-test-002');

  const playersAll = await (await fetch(`${server.http}/api/leaderboard?tab=players`)).json();
  assert.equal(playersAll.entries[0].playerName, 'Ana');
  assert.equal(playersAll.entries[0].bestScore, 380);
  assert.equal(playersAll.entries[0].missions, 2);

  const snapshotResponse = await fetch(`${server.http}/api/leaderboard?snapshot=1`);
  assert.equal(snapshotResponse.status, 200);
  const { snapshot } = await snapshotResponse.json();
  assert.equal(Object.keys(snapshot).length, 24);
  assert.deepEqual(snapshot['missions:all:all'], missionsAll.entries);
  assert.deepEqual(snapshot['missions:hard:gale'], missionsHard.entries);
  assert.deepEqual(snapshot['players:all:all'], playersAll.entries);
  assert.equal(snapshot['players:hard:gale'].find(row => row.playerName === 'Ana').missions, 1);

  const health = await (await fetch(`${server.http}/health`)).json();
  assert.equal(health.dbOk, true);
  assert.equal(health.missionsRecorded, 2);
}));

test('Leaderboard keeps the drawn experiments, run seed and score multiplier; rejects bad ones', () => withServer({}, async server => {
  const post = body => fetch(`${server.http}/api/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const base = {
    id: 'mission-exp-0001', mode: 'solo', site: 'gale', difficulty: 'hard', grade: 'A', teamScore: 1500, tasksDone: 8, tasksTotal: 8,
    players: [{ playerName: 'Ana', seat: 'maya', score: 420, grade: 'A', stranded: false }],
  };
  const experiments = [{ id: 'H-O2', stars: 3 }, { id: 'H-S1', stars: 2 }, { id: 'L-O1', stars: 1, bot: true }, { id: 'M-S3', stars: 0 }];
  assert.equal((await post({ ...base, experiments, runSeed: 123456, scoreMultiplier: 1.5 })).status, 201);
  assert.equal((await post({ ...base, id: 'mission-exp-0002', experiments: [{ id: 'X-S9', stars: 2 }] })).status, 400);
  assert.equal((await post({ ...base, id: 'mission-exp-0003', experiments: [{ id: 'H-S1', stars: 4 }] })).status, 400);
  assert.equal((await post({ ...base, id: 'mission-exp-0004', experiments: [{ id: 'H-S1', stars: 1 }, { id: 'H-S1', stars: 2 }] })).status, 400);
  assert.equal((await post({ ...base, id: 'mission-exp-0005', scoreMultiplier: 2 })).status, 400);
  assert.equal((await post({ ...base, id: 'mission-exp-0006', runSeed: -1 })).status, 400);
  assert.equal((await post({ ...base, id: 'mission-exp-0007', teamScore: 900 })).status, 201); // older clients: no new fields

  const entries = (await (await fetch(`${server.http}/api/leaderboard?tab=missions`)).json()).entries;
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].experiments, experiments);
  assert.equal(entries[0].runSeed, 123456);
  assert.equal(entries[0].scoreMultiplier, 1.5);
  assert.equal(entries[1].experiments, null);
  assert.equal(entries[1].scoreMultiplier, null);
}));
