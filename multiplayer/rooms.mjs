// Room logic, without networking. A connection is any object with send(message); the server wraps a WebSocket
// in one, the tests use plain arrays. Time comes from `now` so the tests can move the clock.
//
// The hub knows rooms, seats, presence and the room phase. It never reads game data: `state`, `event`, `act`,
// `pose` and `send` payloads are relayed as they are. It stamps the sender ({id, seat}) on what it relays, so a
// host can check who may do an action without trusting the client.

import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

const NAME = /^[A-Za-z0-9_-]{1,32}$/; // seats, phases and state keys
const isName = v => typeof v === 'string' && NAME.test(v);
const isNameList = (v, max) => Array.isArray(v) && v.length >= 1 && v.length <= max && v.every(isName) && new Set(v).size === v.length;
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const stamp = peer => ({ id: peer.id, seat: peer.seat });

// Free text typed by players (room titles): no control characters, one space between words, a length cap.
export const sanitizeText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
function hashPassword(pw) { const salt = randomBytes(16); return { salt, hash: scryptSync(pw, salt, 32) }; }
function verifyPassword(pw, rec) { return timingSafeEqual(scryptSync(pw, rec.salt, 32), rec.hash); }

const ENTRY = new Set(['create', 'join', 'resume']);

export class RoomHub {
  constructor(config, { now = Date.now, log = () => {} } = {}) {
    this.config = config;
    this.now = now;
    this.log = log;
    this.rooms = new Map(); // code → room
    this.links = new Map(); // connection → { room, peer }
  }

  stats() {
    let peers = 0, online = 0;
    for (const room of this.rooms.values()) for (const p of room.peers.values()) { peers++; if (p.conn) online++; }
    return { rooms: this.rooms.size, peers, online };
  }

  // One parsed message from a connection.
  handle(conn, msg) {
    if (!isPlainObject(msg) || typeof msg.t !== 'string') return fail(conn, 'bad-message');
    const { t } = msg, link = this.links.get(conn);
    if (ENTRY.has(t)) {
      if (msg.v !== this.config.PROTOCOL_VERSION) return fail(conn, 'bad-version', t);
      if (link) return fail(conn, 'already-in-room', t);
      return this[`on_${t}`](conn, msg);
    }
    const handler = IN_ROOM[t];
    if (!handler) return fail(conn, 'bad-message', t);
    if (!link) return fail(conn, 'not-in-room', t);
    return handler.call(this, link.room, link.peer, msg, conn);
  }

  // The connection closed: the peer stays in the room, offline, until it resumes or the grace period ends.
  disconnect(conn) {
    const link = this.links.get(conn);
    if (!link) return;
    this.links.delete(conn);
    link.peer.conn = null;
    link.peer.offlineSince = this.now();
    this.broadcastPeers(link.room);
  }

  // Called every second or so: drops peers whose grace ended and rooms past their lifetime.
  sweep() {
    const now = this.now(), { RESUME_GRACE_MS, ROOM_TTL_MS } = this.config;
    for (const room of [...this.rooms.values()]) {
      if (now - room.createdAt >= ROOM_TTL_MS) { this.closeRoom(room, 'expired'); continue; }
      for (const peer of [...room.peers.values()]) {
        if (!peer.conn && now - peer.offlineSince >= RESUME_GRACE_MS) {
          this.removePeer(room, peer);
          if (!this.rooms.has(room.code)) break; // the host left: room closed
        }
      }
    }
  }

  closeAll(reason) {
    for (const room of [...this.rooms.values()]) this.closeRoom(room, reason);
  }

  // ---- entry messages ---------------------------------------------------------------------------------------

  on_create(conn, msg) {
    const c = this.config;
    if (this.rooms.size >= c.MAX_ROOMS) return fail(conn, 'too-many-rooms', 'create');
    const seats = msg.seats ?? c.DEFAULT_SEATS, joinable = msg.joinable ?? c.DEFAULT_JOINABLE, phase = msg.phase ?? c.DEFAULT_PHASE;
    if (!isNameList(seats, c.MAX_PEERS)) return fail(conn, 'bad-seat', 'create');
    if (!isNameList(joinable, c.MAX_PHASES) || !isName(phase)) return fail(conn, 'bad-message', 'create');
    const seat = msg.seat ?? seats[0];
    if (!seats.includes(seat)) return fail(conn, 'bad-seat', 'create');
    const meta = this.checkMeta(msg.meta);
    if (meta === undefined) return fail(conn, 'bad-message', 'create');
    if (msg.password != null && typeof msg.password !== 'string') return fail(conn, 'bad-message', 'create');
    const code = this.newCode(), hostName = sanitizeText(meta?.name, 20);
    const room = {
      code, createdAt: this.now(), seats: [...seats], joinable: [...joinable], phase,
      name: sanitizeText(msg.name, c.MAX_ROOM_NAME_LEN) || (hostName ? `${hostName}'s Crew` : `Mission ${code}`),
      isPrivate: msg.isPrivate === true,
      passwordHash: msg.password ? hashPassword(msg.password.slice(0, c.MAX_PASSWORD_LEN)) : null,
      hostId: null, peers: new Map(), state: new Map(), poses: new Map(),
    };
    const host = this.addPeer(room, conn, seat, meta);
    room.hostId = host.id;
    this.rooms.set(room.code, room);
    this.log(`room ${room.code} created (${this.rooms.size} open)`);
    conn.send(this.welcome('created', room, host));
  }

  on_join(conn, msg) {
    const room = this.rooms.get(normalizeCode(msg.code));
    if (!room) return fail(conn, 'room-not-found', 'join');
    if (!room.joinable.includes(room.phase)) return fail(conn, 'in-progress', 'join');
    const taken = new Set([...room.peers.values()].map(p => p.seat));
    if (taken.size >= room.seats.length) return fail(conn, 'room-full', 'join');
    if (room.passwordHash) {
      if (typeof msg.password !== 'string' || !msg.password) return fail(conn, 'password-required', 'join');
      if (!verifyPassword(msg.password.slice(0, this.config.MAX_PASSWORD_LEN), room.passwordHash)) return fail(conn, 'wrong-password', 'join');
    }
    let seat = msg.seat;
    if (seat == null) seat = room.seats.find(s => !taken.has(s));
    else if (!room.seats.includes(seat)) return fail(conn, 'bad-seat', 'join');
    else if (taken.has(seat)) return fail(conn, 'seat-taken', 'join');
    const meta = this.checkMeta(msg.meta);
    if (meta === undefined) return fail(conn, 'bad-message', 'join');
    const peer = this.addPeer(room, conn, seat, meta);
    conn.send(this.welcome('joined', room, peer));
    this.broadcastPeers(room, peer);
  }

  on_resume(conn, msg) {
    const room = this.rooms.get(normalizeCode(msg.code));
    if (!room) return fail(conn, 'room-not-found', 'resume');
    const peer = typeof msg.id === 'string' ? room.peers.get(msg.id) : null;
    if (!peer || typeof msg.token !== 'string' || msg.token !== peer.token) return fail(conn, 'bad-token', 'resume');
    if (peer.conn && peer.conn !== conn) { // the old connection is still open (e.g. a second tab): it loses the seat
      this.links.delete(peer.conn);
      peer.conn.send({ t: 'closed', reason: 'replaced' });
    }
    peer.conn = conn;
    peer.offlineSince = null;
    this.links.set(conn, { room, peer });
    conn.send(this.welcome('resumed', room, peer));
    this.broadcastPeers(room, peer);
  }

  // ---- helpers ----------------------------------------------------------------------------------------------

  addPeer(room, conn, seat, meta) {
    let id;
    do id = randomBytes(4).toString('hex'); while (room.peers.has(id));
    const peer = { id, seat, meta, token: randomBytes(18).toString('base64url'), conn, offlineSince: null };
    room.peers.set(id, peer);
    this.links.set(conn, { room, peer });
    return peer;
  }

  removePeer(room, peer) {
    if (peer.conn) this.links.delete(peer.conn);
    room.peers.delete(peer.id);
    room.poses.delete(peer.id);
    if (peer.id === room.hostId) this.closeRoom(room, 'host-left');
    else this.broadcastPeers(room);
  }

  closeRoom(room, reason) {
    for (const peer of room.peers.values()) {
      if (!peer.conn) continue;
      this.links.delete(peer.conn);
      peer.conn.send({ t: 'closed', reason });
    }
    this.rooms.delete(room.code);
    this.log(`room ${room.code} closed: ${reason} (${this.rooms.size} open)`);
  }

  newCode() {
    const { CODE_ALPHABET: abc, CODE_LENGTH: n } = this.config;
    for (;;) {
      let code = '';
      for (let i = 0; i < n; i++) code += abc[randomInt(abc.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  // undefined = invalid; null = no meta.
  checkMeta(meta) {
    if (meta == null) return null;
    if (!isPlainObject(meta)) return undefined;
    return JSON.stringify(meta).length <= this.config.MAX_META_BYTES ? meta : undefined;
  }

  peerList(room) {
    return [...room.peers.values()].map(p => ({ id: p.id, seat: p.seat, host: p.id === room.hostId, online: !!p.conn, meta: p.meta }));
  }

  summary(room) {
    const setup = room.state.get('setup'), host = room.peers.get(room.hostId);
    return {
      code: room.code, name: room.name, hostName: sanitizeText(host?.meta?.name, 20),
      players: room.peers.size, maxPlayers: room.seats.length, phase: room.phase,
      site: typeof setup?.site === 'string' ? setup.site : null, difficulty: typeof setup?.difficulty === 'string' ? setup.difficulty : null,
      hasPassword: !!room.passwordHash, createdAt: room.createdAt,
    };
  }

  // Rooms shown in the browser: public and still open to new players. Never includes the password.
  listPublicRooms() {
    return [...this.rooms.values()].filter(r => !r.isPrivate && r.joinable.includes(r.phase)).map(r => this.summary(r)).sort((a, b) => b.createdAt - a.createdAt);
  }

  // One room by code (private ones too, so the client knows whether to ask for a password).
  inspectRoom(code) {
    const room = this.rooms.get(normalizeCode(code));
    if (!room) return { exists: false };
    return { exists: true, ...this.summary(room), isPrivate: room.isPrivate, joinable: room.joinable.includes(room.phase), full: room.peers.size >= room.seats.length };
  }

  welcome(t, room, peer) {
    return {
      t, code: room.code, you: { id: peer.id, seat: peer.seat, token: peer.token },
      roomName: room.name, isPrivate: room.isPrivate, hasPassword: !!room.passwordHash,
      host: room.hostId, seats: room.seats, joinable: room.joinable, phase: room.phase,
      peers: this.peerList(room),
      state: Object.fromEntries(room.state),
      poses: [...room.poses].filter(([id]) => id !== peer.id).map(([id, data]) => ({ from: stamp(room.peers.get(id)), data })),
    };
  }

  broadcastPeers(room, except = null) {
    this.sendTo(room, p => p !== except, { t: 'peers', host: room.hostId, seats: room.seats, peers: this.peerList(room) });
  }

  sendTo(room, filter, message) {
    for (const peer of room.peers.values()) if (peer.conn && filter(peer)) peer.conn.send(message);
  }
}

// In-room messages: (room, peer, msg, conn). `this` is the hub.
const IN_ROOM = {
  leave(room, peer, msg, conn) {
    this.removePeer(room, peer);
    conn.send({ t: 'left' });
  },

  seat(room, peer, msg, conn) {
    if (peer.id === room.hostId) return fail(conn, 'not-guest', 'seat');
    if (!room.joinable.includes(room.phase)) return fail(conn, 'in-progress', 'seat');
    if (!room.seats.includes(msg.seat)) return fail(conn, 'bad-seat', 'seat');
    if (msg.seat !== peer.seat && [...room.peers.values()].some(p => p.seat === msg.seat)) return fail(conn, 'seat-taken', 'seat');
    peer.seat = msg.seat;
    this.broadcastPeers(room);
  },

  meta(room, peer, msg, conn) {
    const meta = this.checkMeta(msg.meta);
    if (meta === undefined) return fail(conn, 'bad-message', 'meta');
    peer.meta = meta;
    this.broadcastPeers(room);
  },

  phase(room, peer, msg, conn) {
    if (peer.id !== room.hostId) return fail(conn, 'not-host', 'phase');
    if (!isName(msg.phase)) return fail(conn, 'bad-message', 'phase');
    room.phase = msg.phase;
    this.sendTo(room, p => p !== peer, { t: 'phase', phase: room.phase });
  },

  // Host → guests. The last value of each key is kept and handed to whoever joins or resumes; null deletes it.
  state(room, peer, msg, conn) {
    if (peer.id !== room.hostId) return fail(conn, 'not-host', 'state');
    if (!isName(msg.key) || !('data' in msg)) return fail(conn, 'bad-message', 'state');
    if (msg.data === null) room.state.delete(msg.key);
    else if (!room.state.has(msg.key) && room.state.size >= this.config.MAX_STATE_KEYS) return fail(conn, 'too-many-keys', 'state');
    else room.state.set(msg.key, msg.data);
    this.sendTo(room, p => p !== peer, { t: 'state', key: msg.key, data: msg.data });
  },

  // Host → guests, one-shot (toasts, sounds, results). Not kept.
  event(room, peer, msg, conn) {
    if (peer.id !== room.hostId) return fail(conn, 'not-host', 'event');
    this.sendTo(room, p => p !== peer, { t: 'event', data: msg.data });
  },

  // Guest → host: an intent the host validates and applies.
  act(room, peer, msg, conn) {
    if (peer.id === room.hostId) return fail(conn, 'not-guest', 'act');
    const host = room.peers.get(room.hostId);
    if (!host?.conn) return fail(conn, 'host-offline', 'act');
    host.conn.send({ t: 'act', from: stamp(peer), data: msg.data });
  },

  // Anyone → the others. The last pose of each peer is kept for whoever joins or resumes.
  pose(room, peer, msg) {
    room.poses.set(peer.id, msg.data);
    this.sendTo(room, p => p !== peer, { t: 'pose', from: stamp(peer), data: msg.data });
  },

  // Free relay: to 'host', 'all' (including the sender), 'others' or one peer id.
  send(room, peer, msg, conn) {
    const out = { t: 'msg', from: stamp(peer), data: msg.data }, to = msg.to ?? 'all';
    if (to === 'all') return this.sendTo(room, () => true, out);
    if (to === 'others') return this.sendTo(room, p => p !== peer, out);
    const target = room.peers.get(to === 'host' ? room.hostId : to);
    if (!target) return fail(conn, 'peer-not-found', 'send');
    target.conn?.send(out);
  },
};

function fail(conn, code, ref) {
  conn.send(ref ? { t: 'error', code, ref } : { t: 'error', code });
}

function normalizeCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}
