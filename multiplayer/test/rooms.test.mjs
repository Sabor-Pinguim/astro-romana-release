// Unit tests of the room logic (no network): fake connections and a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.mjs';
import { RoomHub } from '../rooms.mjs';

const V = 1;
function setup(overrides = {}) {
  let clock = 0;
  const hub = new RoomHub({ ...loadConfig({}), ...overrides }, { now: () => clock });
  const conn = () => ({ sent: [], send(m) { this.sent.push(m); }, last(t) { return this.sent.filter(m => !t || m.t === t).at(-1); } });
  return { hub, conn, tick: ms => { clock += ms; hub.sweep(); } };
}
function host(env, msg = {}) {
  const c = env.conn();
  env.hub.handle(c, { v: V, t: 'create', ...msg });
  return { c, room: c.last('created') };
}
function guest(env, code, msg = {}) {
  const c = env.conn();
  env.hub.handle(c, { v: V, t: 'join', code, ...msg });
  return c;
}

test('create gives a code, the first seat and the game defaults', () => {
  const env = setup();
  const { room } = host(env);
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(room.you.seat, 'helena');
  assert.deepEqual(room.seats, ['helena', 'lucas', 'oscar', 'maya']);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.host, room.you.id);
  assert.ok(room.you.token.length >= 20);
});

test('create accepts the host own seats, joinable phases and starting phase', () => {
  const env = setup();
  const { room } = host(env, { seats: ['a', 'b'], joinable: ['x'], phase: 'x', seat: 'b' });
  assert.deepEqual(room.seats, ['a', 'b']);
  assert.equal(room.you.seat, 'b');
  const bad = env.conn();
  env.hub.handle(bad, { v: V, t: 'create', seats: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(bad.last().code, 'bad-seat');
});

test('join takes the first free seat or the one asked for; full and taken seats are refused', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g1 = guest(env, room.code.toLowerCase()); // codes are case-insensitive
  assert.equal(g1.last('joined').you.seat, 'lucas');
  assert.equal(h.last('peers').peers.length, 2);
  const g2 = guest(env, room.code, { seat: 'maya' });
  assert.equal(g2.last('joined').you.seat, 'maya');
  assert.equal(guest(env, room.code, { seat: 'maya' }).last().code, 'seat-taken');
  assert.equal(guest(env, room.code, { seat: 'pilot' }).last().code, 'bad-seat');
  guest(env, room.code); // oscar
  assert.equal(guest(env, room.code).last().code, 'room-full');
  assert.equal(guest(env, 'ZZZZ').last().code, 'room-not-found');
});

test('joining is refused once the host leaves the joinable phases; resume still works', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g = guest(env, room.code);
  const you = g.last('joined').you;
  env.hub.handle(h, { t: 'phase', phase: 'cockpit' });
  assert.deepEqual(g.last('phase'), { t: 'phase', phase: 'cockpit' });
  assert.equal(guest(env, room.code).last().code, 'in-progress');
  env.hub.disconnect(g);
  const back = env.conn();
  env.hub.handle(back, { v: V, t: 'resume', code: room.code, id: you.id, token: you.token });
  assert.equal(back.last('resumed').phase, 'cockpit');
});

test('channels: only the host sends phase, state and event; only guests send act', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g = guest(env, room.code);
  for (const t of ['phase', 'state', 'event']) {
    env.hub.handle(g, { t, phase: 'x', key: 'k', data: 1 });
    assert.equal(g.last().code, 'not-host', t);
  }
  env.hub.handle(h, { t: 'act', data: 1 });
  assert.equal(h.last().code, 'not-guest');
});

test('both host and guests can change seat to a free one in joinable phases', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g1 = guest(env, room.code), g2 = guest(env, room.code);
  env.hub.handle(g1, { t: 'seat', seat: g2.last('joined').you.seat });
  assert.equal(g1.last().code, 'seat-taken');
  env.hub.handle(g1, { t: 'seat', seat: 'maya' });
  assert.equal(h.last('peers').peers.find(p => p.id === g1.last('joined').you.id).seat, 'maya');
  // Host switches from helena to free seat lucas; then g1 can take helena
  env.hub.handle(h, { t: 'seat', seat: 'lucas' });
  assert.equal(h.last('peers').peers.find(p => p.id === room.you.id).seat, 'lucas');
  env.hub.handle(g1, { t: 'seat', seat: 'helena' });
  assert.equal(h.last('peers').peers.find(p => p.id === g1.last('joined').you.id).seat, 'helena');
  env.hub.handle(h, { t: 'phase', phase: 'surface' });
  env.hub.handle(g1, { t: 'seat', seat: 'maya' });
  assert.equal(g1.last().code, 'in-progress');
  env.hub.handle(h, { t: 'seat', seat: 'maya' });
  assert.equal(h.last().code, 'in-progress');
});

test('act reaches the host stamped with the sender seat', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g = guest(env, room.code, { seat: 'lucas' });
  env.hub.handle(g, { t: 'act', data: { name: 'cockpit', args: ['breaker', 0] } });
  const act = h.last('act');
  assert.equal(act.from.seat, 'lucas');
  assert.deepEqual(act.data, { name: 'cockpit', args: ['breaker', 0] });
  env.hub.disconnect(h);
  env.hub.handle(g, { t: 'act', data: 1 });
  assert.equal(g.last().code, 'host-offline');
});

test('state is cached per key and handed to whoever joins; null deletes; key limit holds', () => {
  const env = setup({ MAX_STATE_KEYS: 2 });
  const { c: h, room } = host(env);
  const g = guest(env, room.code);
  env.hub.handle(h, { t: 'state', key: 'planner', data: { rocket: 1 } });
  env.hub.handle(h, { t: 'state', key: 'planner', data: { rocket: 2 } });
  env.hub.handle(h, { t: 'state', key: 'flight', data: { step: 0 } });
  assert.deepEqual(g.last('state'), { t: 'state', key: 'flight', data: { step: 0 } });
  env.hub.handle(h, { t: 'state', key: 'surface', data: {} });
  assert.equal(h.last().code, 'too-many-keys');
  env.hub.handle(h, { t: 'state', key: 'flight', data: null });
  const late = guest(env, room.code);
  assert.deepEqual(late.last('joined').state, { planner: { rocket: 2 } });
});

test('poses go to the others, stamped, and the last one is kept for newcomers', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g = guest(env, room.code);
  env.hub.handle(h, { t: 'pose', data: { x: 1 } });
  assert.equal(g.last('pose').from.seat, 'helena');
  assert.equal(h.last('pose'), undefined); // not echoed
  const late = guest(env, room.code);
  assert.deepEqual(late.last('joined').poses, [{ from: { id: room.you.id, seat: 'helena' }, data: { x: 1 } }]);
});

test('send relays to host, all, others or one peer', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g1 = guest(env, room.code), g2 = guest(env, room.code);
  const id2 = g2.last('joined').you.id;
  env.hub.handle(g1, { t: 'send', to: 'all', data: 'a' });
  assert.equal([h, g1, g2].filter(c => c.last('msg')?.data === 'a').length, 3);
  env.hub.handle(g1, { t: 'send', to: 'others', data: 'o' });
  assert.equal(g1.last('msg').data, 'a');
  env.hub.handle(g1, { t: 'send', to: id2, data: 'p' });
  assert.equal(g2.last('msg').data, 'p');
  assert.equal(h.last('msg').data, 'o');
  env.hub.handle(g1, { t: 'send', to: 'host', data: 'h' });
  assert.equal(h.last('msg').data, 'h');
  env.hub.handle(g1, { t: 'send', to: 'nobody', data: 1 });
  assert.equal(g1.last().code, 'peer-not-found');
});

test('a dropped guest is offline for the grace period, then its seat is free', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g = guest(env, room.code);
  const you = g.last('joined').you;
  env.hub.disconnect(g);
  assert.equal(h.last('peers').peers.find(p => p.id === you.id).online, false);
  env.tick(29_000);
  const back = env.conn();
  env.hub.handle(back, { v: V, t: 'resume', code: room.code, id: you.id, token: 'wrong' });
  assert.equal(back.last().code, 'bad-token');
  env.hub.handle(back, { v: V, t: 'resume', code: room.code, id: you.id, token: you.token });
  assert.equal(back.last('resumed').you.seat, 'lucas');
  env.hub.disconnect(back);
  env.tick(30_000);
  assert.equal(h.last('peers').peers.length, 1);
  assert.equal(guest(env, room.code).last('joined').you.seat, 'lucas');
});

test('resume from a second connection takes the seat from the first', () => {
  const env = setup();
  const { room } = host(env);
  const g = guest(env, room.code), you = g.last('joined').you;
  const other = env.conn();
  env.hub.handle(other, { v: V, t: 'resume', code: room.code, id: you.id, token: you.token });
  assert.deepEqual(g.last(), { t: 'closed', reason: 'replaced' });
  env.hub.handle(g, { t: 'pose', data: 1 });
  assert.equal(g.last().code, 'not-in-room');
});

test('the host kicks a guest: the seat frees, the guest hears kicked and cannot resume; guests cannot kick', () => {
  const env = setup();
  const { c: h, room } = host(env);
  const g = guest(env, room.code), you = g.last('joined').you;
  const g2 = guest(env, room.code), you2 = g2.last('joined').you;
  env.hub.handle(g2, { t: 'kick', id: you.id });
  assert.equal(g2.last('error').code, 'not-host');
  env.hub.handle(h, { t: 'kick', id: room.you.id });
  assert.equal(h.last('error').code, 'bad-message');
  env.hub.handle(h, { t: 'kick', id: 'nope' });
  assert.equal(h.last('error').code, 'peer-not-found');
  env.hub.handle(h, { t: 'kick', id: you.id });
  assert.deepEqual(g.last(), { t: 'closed', reason: 'kicked' });
  assert.deepEqual(h.last('peers').peers.map(p => p.id), [room.you.id, you2.id]);
  env.hub.handle(g, { t: 'pose', data: 1 });
  assert.equal(g.last().code, 'not-in-room');
  const back = env.conn();
  env.hub.handle(back, { v: V, t: 'resume', code: room.code, id: you.id, token: you.token });
  assert.equal(back.last('error').code, 'bad-token');
  const again = guest(env, room.code, { seat: you.seat }); // a fresh join with the code still works
  assert.equal(again.last('joined').you.seat, you.seat);
});

test('host title transfers to the next player in join order when the host leaves or times out; room closes when empty or expired', () => {
  const env = setup();
  let { c: h, room } = host(env);
  const g1 = guest(env, room.code);
  const g2 = guest(env, room.code);
  const id1 = g1.last('joined').you.id;
  const id2 = g2.last('joined').you.id;

  env.hub.handle(h, { t: 'leave' });
  assert.deepEqual(h.last(), { t: 'left' });
  assert.equal(env.hub.rooms.size, 1);
  assert.equal(g1.last('peers').host, id1);
  assert.equal(g2.last('peers').host, id1);

  // New host (g1) drops and grace period expires -> host transfers to g2
  env.hub.disconnect(g1);
  env.tick(30_000);
  assert.equal(env.hub.rooms.size, 1);
  assert.equal(g2.last('peers').host, id2);

  // Last remaining player (g2) leaves -> room closes
  env.hub.handle(g2, { t: 'leave' });
  assert.deepEqual(g2.last(), { t: 'left' });
  assert.equal(env.hub.rooms.size, 0);

  ({ room } = host(env));
  const g = guest(env, room.code);
  env.tick(4 * 60 * 60 * 1000);
  assert.deepEqual(g.last(), { t: 'closed', reason: 'expired' });
  assert.deepEqual(env.hub.stats(), { rooms: 0, peers: 0, online: 0 });
});

test('protocol errors: version, shape, room state and limits', () => {
  const env = setup({ MAX_ROOMS: 1 });
  const c = env.conn();
  env.hub.handle(c, { t: 'create' });
  assert.equal(c.last().code, 'bad-version');
  env.hub.handle(c, ['x']);
  assert.equal(c.last().code, 'bad-message');
  env.hub.handle(c, { t: 'nope' });
  assert.equal(c.last().code, 'bad-message');
  env.hub.handle(c, { t: 'pose', data: 1 });
  assert.equal(c.last().code, 'not-in-room');
  env.hub.handle(c, { v: V, t: 'create', meta: { big: 'x'.repeat(600) } });
  assert.equal(c.last().code, 'bad-message');
  env.hub.handle(c, { v: V, t: 'create' });
  env.hub.handle(c, { v: V, t: 'create' });
  assert.equal(c.last().code, 'already-in-room');
  const other = env.conn();
  env.hub.handle(other, { v: V, t: 'create' });
  assert.equal(other.last().code, 'too-many-rooms');
});
