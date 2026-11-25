/* RoomClient: client of the Astro Romana room server (multiplayer/server.mjs).
 * Classic script with no dependencies, so it works from file:// like the game's web/ scripts; it defines
 * window.RoomClient (globalThis.RoomClient in Node ≥ 22, which has a global WebSocket).
 *
 *   const room = new RoomClient({ url: 'wss://…/ws' });
 *   await room.create();                    // host; or: await room.join('ABCD')
 *   room.on('act', (data, from) => …);      // host: intents from guests, `from` stamped by the server
 *   room.setState('planner', snapshot);     // host → guests, cached for whoever joins later
 *
 * Events: welcome, peers, phase, state, event, act, pose, msg, status, closed, error. A kicked player gets
 * closed with the reason 'kicked'.
 * A dropped connection reconnects and resumes the same seat on its own; the session also survives a page
 * reload (sessionStorage), see rejoin().
 */
(function (root) {
  'use strict';

  const PROTOCOL_VERSION = 1;
  const STORAGE_KEY = 'astro-room-session';
  const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000]; // then the last one again
  const RECONNECT_GIVE_UP_MS = 35000; // a little past the server's resume grace (30 s)
  const REPLY = { create: 'created', join: 'joined', resume: 'resumed' };
  const OPEN = 1;

  const storage = () => { try { return root.sessionStorage || null; } catch (e) { return null; } };
  function loadSession() {
    try { const raw = storage() && storage().getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function saveSession(session) {
    try {
      const s = storage();
      if (!s) return;
      if (session) s.setItem(STORAGE_KEY, JSON.stringify(session)); else s.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode or blocked storage: reload just won't resume */ }
  }

  class RoomError extends Error {
    constructor(code, ref) { super('room error: ' + code); this.name = 'RoomError'; this.code = code; this.ref = ref; }
  }

  class RoomClient {
    constructor({ url, seat, meta, reconnect = true, WebSocketImpl } = {}) {
      if (!url) throw new Error('RoomClient needs the server url (ws:// or wss://…/ws)');
      this.url = url;
      this.seat = seat;
      this.meta = meta;
      this.reconnect = reconnect;
      this.WS = WebSocketImpl || root.WebSocket;
      this.ws = null;
      this.status = 'idle'; // idle | connecting | open | reconnecting | closed (the connection, not the room)
      this.listeners = new Map();
      this.pending = null;
      this.connecting = null;
      this.lostAt = 0;
      this.attempt = 0;
      this.timer = null;
      this.reset();
    }

    reset() {
      this.code = null;
      this.you = null; // { id, seat, token }
      this.hostId = null;
      this.seats = [];
      this.joinable = [];
      this.peers = []; // [{ id, seat, host, online, meta }]
      this.phase = null;
      this.state = {}; // key → last data from the host
      this.poses = new Map(); // peer id → { from, data }
      this.roomName = '';
      this.isPrivate = false;
      this.hasPassword = false;
    }

    get isHost() { return !!this.you && this.you.id === this.hostId; }
    get inRoom() { return !!this.code; }
    // Seats nobody holds (the game treats them as AI crew).
    get freeSeats() { const taken = new Set(this.peers.map(p => p.seat)); return this.seats.filter(s => !taken.has(s)); }

    on(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
      return () => this.off(type, fn);
    }
    off(type, fn) { const set = this.listeners.get(type); if (set) set.delete(fn); }
    fire(type, ...args) {
      for (const fn of [...(this.listeners.get(type) || [])]) {
        try { fn(...args); } catch (err) { console.error('RoomClient listener failed:', err); }
      }
    }

    // ---- entering a room ------------------------------------------------------------------------------------

    // Host. opts: { seat, meta, seats, joinable, phase, name, isPrivate, password } (the server has defaults for the current game).
    create(opts = {}) {
      return this.enter({ t: 'create', seat: pick(opts.seat, this.seat), meta: pick(opts.meta, this.meta), seats: opts.seats, joinable: opts.joinable, phase: opts.phase, name: opts.name, isPrivate: !!opts.isPrivate, password: opts.password || undefined });
    }

    // Guest. Resumes the saved seat when this tab was already in that room. opts: { seat, meta, password }.
    async join(code, opts = {}) {
      code = String(code || '').trim().toUpperCase();
      const saved = loadSession();
      if (saved && saved.code === code && saved.url === this.url) {
        try { return await this.resume(saved); } catch (err) { saveSession(null); }
      }
      return this.enter({ t: 'join', code, seat: pick(opts.seat, this.seat), meta: pick(opts.meta, this.meta), password: opts.password || undefined });
    }

    resume({ code, id, token }) { return this.enter({ t: 'resume', code, id, token }); }

    // After a page reload: back to the saved room and seat, or null when there is none (or it is gone).
    async rejoin() {
      const saved = loadSession();
      if (!saved || saved.url !== this.url) return null;
      try { return await this.resume(saved); } catch (err) { saveSession(null); return null; }
    }

    async enter(msg) {
      if (this.pending) throw new Error('RoomClient: another request is in progress');
      if (this.inRoom) throw new Error('RoomClient: already in a room, leave() first');
      await this.connect();
      return new Promise((resolve, reject) => {
        this.pending = { ref: msg.t, reply: REPLY[msg.t], resolve, reject };
        msg.v = PROTOCOL_VERSION;
        if (!this.raw(msg)) { this.pending = null; reject(new RoomError('connection-lost', msg.t)); }
      });
    }

    leave() {
      if (!this.inRoom) return;
      this.raw({ t: 'leave' });
      saveSession(null);
      this.stopReconnect();
      this.reset();
      this.fire('closed', 'left');
    }

    // Leaves and closes the connection.
    close() {
      this.leave();
      this.stopReconnect();
      if (this.ws) { const ws = this.ws; this.ws = null; ws.close(1000); }
      this.setStatus('closed');
    }

    // ---- channels -------------------------------------------------------------------------------------------

    setPhase(phase) { this.phase = phase; return this.raw({ t: 'phase', phase }); } // host
    setState(key, data) { // host; null deletes the key
      if (data === null) delete this.state[key]; else this.state[key] = data;
      return this.raw({ t: 'state', key, data });
    }
    emit(data) { return this.raw({ t: 'event', data }); } // host → guests, one-shot
    act(data) { return this.raw({ t: 'act', data }); } // guest → host
    pose(data) { return this.raw({ t: 'pose', data }); } // anyone → the others
    send(data, to = 'all') { return this.raw({ t: 'send', to, data }); } // 'host' | 'all' (with you) | 'others' | id
    setSeat(seat) { return this.raw({ t: 'seat', seat }); } // host or guest, joinable phases only
    kick(id) { return this.raw({ t: 'kick', id }); } // host only: removes that player from the room
    setMeta(meta) { this.meta = meta; return this.raw({ t: 'meta', meta }); }

    // ---- connection -----------------------------------------------------------------------------------------

    raw(msg) {
      if (!this.ws || this.ws.readyState !== OPEN) return false;
      this.ws.send(JSON.stringify(msg));
      return true;
    }

    setStatus(status) {
      if (status === this.status) return;
      this.status = status;
      this.fire('status', status);
    }

    connect() {
      if (this.ws && this.ws.readyState === OPEN) return Promise.resolve();
      if (this.connecting) return this.connecting;
      if (!this.WS) return Promise.reject(new Error('RoomClient: no WebSocket in this environment'));
      if (!this.lostAt) this.setStatus('connecting');
      this.connecting = new Promise((resolve, reject) => {
        let ws;
        try { ws = new this.WS(this.url); } catch (err) { this.connecting = null; this.setStatus('closed'); reject(err); return; }
        this.ws = ws;
        let opened = false;
        ws.onopen = () => { opened = true; this.connecting = null; if (!this.lostAt) this.setStatus('open'); resolve(); };
        ws.onmessage = event => this.receive(event.data);
        ws.onerror = () => {}; // onclose follows
        ws.onclose = () => {
          if (this.ws === ws) this.ws = null;
          if (!opened) { this.connecting = null; reject(new RoomError('unreachable')); }
          this.lost();
        };
      });
      return this.connecting;
    }

    lost() {
      if (this.pending && !this.lostAt) { const p = this.pending; this.pending = null; p.reject(new RoomError('connection-lost', p.ref)); }
      if (this.inRoom && this.reconnect) { this.scheduleReconnect(); return; }
      this.setStatus('closed');
    }

    scheduleReconnect() {
      if (this.timer) return;
      if (!this.lostAt) this.lostAt = Date.now();
      if (Date.now() - this.lostAt > RECONNECT_GIVE_UP_MS) { this.drop('lost'); return; }
      this.setStatus('reconnecting');
      const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt++, RECONNECT_DELAYS_MS.length - 1)];
      this.timer = setTimeout(() => {
        this.timer = null;
        // A failed connect fires onclose → lost() → the next attempt.
        this.connect().then(() => {
          this.raw({ v: PROTOCOL_VERSION, t: 'resume', code: this.code, id: this.you.id, token: this.you.token });
        }, () => {});
      }, delay);
    }

    stopReconnect() {
      clearTimeout(this.timer);
      this.timer = null;
      this.lostAt = 0;
      this.attempt = 0;
    }

    // The room is gone for this client (closed by the server, or the seat could not be resumed).
    drop(reason) {
      this.stopReconnect();
      saveSession(null);
      this.reset();
      this.setStatus(this.ws && this.ws.readyState === OPEN ? 'open' : 'closed');
      this.fire('closed', reason);
    }

    receive(raw) {
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }
      switch (m.t) {
        case 'created': case 'joined': case 'resumed': this.welcome(m); break;
        case 'peers':
          this.hostId = m.host; this.seats = m.seats; this.peers = m.peers;
          if (this.you) { const me = m.peers.find(p => p.id === this.you.id); if (me) this.you.seat = me.seat; }
          this.fire('peers', this.peers);
          break;
        case 'phase': this.phase = m.phase; this.fire('phase', m.phase); break;
        case 'state':
          if (m.data === null) delete this.state[m.key]; else this.state[m.key] = m.data;
          this.fire('state', m.key, m.data);
          break;
        case 'event': this.fire('event', m.data); break;
        case 'act': this.fire('act', m.data, m.from); break;
        case 'pose': this.poses.set(m.from.id, { from: m.from, data: m.data }); this.fire('pose', m.data, m.from); break;
        case 'msg': this.fire('msg', m.data, m.from); break;
        case 'closed': if (this.inRoom) this.drop(m.reason); break;
        case 'error': this.error(m); break;
        default: break; // 'left' and anything newer
      }
    }

    welcome(m) {
      this.code = m.code; this.you = m.you; this.hostId = m.host; this.seats = m.seats; this.joinable = m.joinable;
      this.phase = m.phase; this.peers = m.peers; this.state = Object.assign({}, m.state);
      this.roomName = m.roomName || ''; this.isPrivate = !!m.isPrivate; this.hasPassword = !!m.hasPassword;
      this.poses = new Map(m.poses.map(p => [p.from.id, p]));
      saveSession({ url: this.url, code: m.code, id: m.you.id, token: m.you.token });
      this.stopReconnect();
      this.setStatus('open');
      const p = this.pending;
      if (p && p.reply === m.t) { this.pending = null; p.resolve(m); }
      this.fire('welcome', m);
      this.fire('peers', this.peers);
      this.fire('phase', this.phase);
    }

    error(m) {
      const err = new RoomError(m.code, m.ref), p = this.pending;
      if (p && m.ref === p.ref) { this.pending = null; p.reject(err); return; }
      if (m.ref === 'resume' && this.lostAt) { this.drop(m.code); return; } // the room or the seat is gone
      this.fire('error', err);
    }

    // ---- links ----------------------------------------------------------------------------------------------

    // The same page with ?room=CODE (an invite link).
    static linkFor(code, base) {
      const url = new URL(base || root.location.href);
      url.searchParams.set('room', code);
      return url.toString();
    }
    static codeFromUrl(href) {
      try { const v = new URL(href || root.location.href).searchParams.get('room'); return v ? v.trim().toUpperCase() : null; } catch (e) { return null; }
    }
    static savedSession() { return loadSession(); }
  }

  function pick(value, fallback) { return value === undefined ? fallback : value; }

  RoomClient.PROTOCOL_VERSION = PROTOCOL_VERSION;
  RoomClient.RoomError = RoomError;
  root.RoomClient = RoomClient;
})(typeof globalThis !== 'undefined' ? globalThis : window);
