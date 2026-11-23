// Multiplayer link (docs/multiplayer.md): wraps the room client (multiplayer/client/room-client.js) for the game,
// manages the saved astronaut name and local solo leaderboard in localStorage, and talks to the HTTP REST API
// (/api/rooms, /api/rooms/:code, /api/leaderboard) on the same room server.
(() => {
  'use strict';
  const SETTINGS_KEY = 'astro-romana-settings';
  const PLAYER_NAME_KEY = 'astro-romana-player-name';
  const SOLO_LB_KEY = 'astro-romana-solo-leaderboard';
  const MAX_SOLO_ENTRIES = 50;
  const GRADE_ORDER = { 'S+': 5, A: 4, B: 3, C: 2, F: 1 };

  // Room server (multiplayer/README.md). Static copies of the game (GitHub Pages, pages opened from disk) cannot find
  // it on their own: they use NET_SERVER, the VM's address (multiplayer/deploy/setup-v2.sh prints it, and needs
  // EXTRA_ORIGINS=https://<user>.github.io for Pages). A page the VM serves talks to its own host at /ws; localhost uses
  // the local server (cd multiplayer && npm start). ?server=ws(s)://…/ws overrides all of it.
  const NET_SERVER = 'wss://v2.35-193-156-110.sslip.io/ws'; // the v2 VM service (port 8788, multiplayer/deploy/setup-v2.sh)
  const LOCAL_SERVER = 'ws://localhost:8787/ws';
  // Screens a guest can join in (the server's DEFAULT_JOINABLE); after the launch only a dropped player comes back.
  const JOINABLE = ['menu', 'orbit', 'lobby', 'planner'];
  const params = new URLSearchParams(location.search);
  const STATIC_HOSTS = /(^|\.)github\.io$/i;
  const staticHost = STATIC_HOSTS.test(location.hostname);
  const localhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const site = location.protocol.startsWith('http') && !localhost && !staticHost ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws` : '';
  const defaultUrl = localhost ? LOCAL_SERVER : site || NET_SERVER || LOCAL_SERVER;
  const queryOverride = params.get('server') || '';

  function sanitizePlayerName(raw) {
    return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
  }

  function getPlayerName() {
    try { return sanitizePlayerName(localStorage.getItem(PLAYER_NAME_KEY) || ''); } catch { return ''; }
  }

  const isPlayerNameLocked = () => getPlayerName().length >= 2;

  function setPlayerName(raw, allowOverwrite = false) {
    const existing = getPlayerName();
    if (existing.length >= 2 && !allowOverwrite) return existing;
    const clean = sanitizePlayerName(raw);
    if (clean.length < 2) return '';
    try { localStorage.setItem(PLAYER_NAME_KEY, clean); } catch { /* blocked storage */ }
    if (inRoom()) {
      room.setMeta({ ...(room.meta || {}), name: clean });
    }
    return clean;
  }

  function normalizeServerUrl(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    let candidate = trimmed;
    if (/^https?:\/\//i.test(candidate)) {
      candidate = candidate.replace(/^http/i, 'ws');
    } else if (!/^wss?:\/\//i.test(candidate)) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) return null;
      candidate = `ws://${candidate}`;
    }
    try {
      const parsed = new URL(candidate);
      if (!parsed.hostname || (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:')) return null;
      if (!/^wss?:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed) && !parsed.port) {
        parsed.port = '8787';
      }
      if (parsed.pathname === '/' || !parsed.pathname) parsed.pathname = '/ws';
      return parsed.toString();
    } catch {
      return null;
    }
  }

  function httpBaseFromWs(wsUrl) {
    if (!wsUrl) return '';
    try {
      const parsed = new URL(wsUrl);
      parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
      parsed.pathname = parsed.pathname.replace(/\/ws\/?$/, '');
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return '';
    }
  }

  function readStoredServer() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.serverUrl ? (normalizeServerUrl(parsed.serverUrl) || '') : '';
    } catch {
      return '';
    }
  }

  let customUrl = readStoredServer();
  let url = queryOverride || customUrl || defaultUrl;
  const isEnabled = () => Boolean(queryOverride || customUrl || NET_SERVER || !staticHost);

  const ERRORS = {
    'room-not-found': 'Room not found.', 'room-full': 'This crew is full.', 'in-progress': 'The mission already launched.',
    'seat-taken': 'That crew member already has a player.', 'password-required': 'This room requires a password.',
    'wrong-password': 'Wrong room password.', unreachable: 'Could not reach the room server.',
    'connection-lost': 'Lost the connection to the room server.', 'host-left': 'The host left: the room closed.',
    expired: 'The room expired.', server: 'The room server restarted.', replaced: 'This seat was opened in another tab.',
    'too-many-rooms': 'The room server is full. Try again later.',
  };
  const listeners = new Map();
  const fire = (type, ...args) => (listeners.get(type) || []).forEach(fn => { try { fn(...args); } catch (err) { console.error('ASTRO_NET listener failed:', err); } });
  let room = null;
  function client() {
    if (!isEnabled()) return null;
    if (room) return room;
    if (!window.RoomClient || !url) return null;
    room = new RoomClient({ url });
    for (const type of ['welcome', 'peers', 'phase', 'state', 'event', 'act', 'pose', 'msg', 'status', 'closed', 'error']) room.on(type, (...args) => fire(type, ...args));
    return room;
  }
  const inRoom = () => isEnabled() && !!room?.inRoom;

  async function apiJson(path, opts = {}) {
    const base = isEnabled() ? httpBaseFromWs(url) : '';
    if (!base || typeof fetch !== 'function') throw Object.assign(new Error('offline'), { code: 'unreachable' });
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error || `http-${res.status}`), { status: res.status, code: data?.error });
    return data;
  }

  function readSoloEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SOLO_LB_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function recordSoloScore(entry) {
    if (!entry || !entry.id) return false;
    const list = readSoloEntries().filter(item => item && item.id !== entry.id);
    list.push({ ...entry, mode: 'solo', createdAt: entry.createdAt || Date.now() });
    list.sort((a, b) => (b.teamScore - a.teamScore) || (b.createdAt - a.createdAt));
    try { localStorage.setItem(SOLO_LB_KEY, JSON.stringify(list.slice(0, MAX_SOLO_ENTRIES))); } catch { return false; }
    return true;
  }

  function getSoloLeaderboard({ tab = 'missions', difficulty = 'all', site = 'all', limit = 25 } = {}) {
    const filtered = readSoloEntries().filter(m =>
      (difficulty === 'all' || m.difficulty === difficulty) && (site === 'all' || m.site === site)
    );
    if (tab !== 'players') {
      return { tab: 'missions', entries: filtered.slice().sort((a, b) => (b.teamScore - a.teamScore) || (b.createdAt - a.createdAt)).slice(0, limit) };
    }
    const byPlayer = new Map();
    for (const m of filtered) {
      for (const p of (m.players || [])) {
        const key = String(p.playerName || '').toLowerCase();
        if (!key) continue;
        const cur = byPlayer.get(key) || { playerName: p.playerName, bestScore: -1, totalScore: 0, missions: 0, bestGrade: 'F', lastSeat: p.seat, lastPlayedAt: 0 };
        cur.missions += 1;
        cur.totalScore += Number(p.score || 0);
        if (Number(p.score || 0) >= cur.bestScore) { cur.bestScore = Number(p.score || 0); }
        if ((GRADE_ORDER[p.grade] || 0) > (GRADE_ORDER[cur.bestGrade] || 0)) cur.bestGrade = p.grade;
        if ((m.createdAt || 0) >= cur.lastPlayedAt) {
          cur.lastPlayedAt = m.createdAt || 0;
          cur.playerName = p.playerName;
          cur.lastSeat = p.seat;
        }
        byPlayer.set(key, cur);
      }
    }
    const entries = [...byPlayer.values()].sort((a, b) => (b.bestScore - a.bestScore) || (b.missions - a.missions) || (b.lastPlayedAt - a.lastPlayedAt)).slice(0, limit);
    return { tab: 'players', entries };
  }

  const net = {
    get enabled() { return isEnabled(); },
    get url() { return url; },
    defaultUrl,
    hardcodedServer: NET_SERVER,
    queryOverride,
    normalizeServerUrl,
    httpBase: () => httpBaseFromWs(url),
    sanitizePlayerName,
    getPlayerName,
    setPlayerName,
    isPlayerNameLocked,
    JOINABLE,
    get mode() { return inRoom() ? (room.isHost ? 'host' : 'guest') : 'solo'; },
    get isHost() { return inRoom() && room.isHost; },
    get isGuest() { return inRoom() && !room.isHost; },
    get code() { return inRoom() ? room.code : null; },
    get roomName() { return inRoom() ? room.roomName : ''; },
    get isPrivate() { return inRoom() && !!room.isPrivate; },
    get hasPassword() { return inRoom() && !!room.hasPassword; },
    get seat() { return inRoom() ? room.you.seat : null; },
    get you() { return inRoom() ? room.you : null; },
    get peers() { return inRoom() ? room.peers : []; },
    get phase() { return inRoom() ? room.phase : null; },
    get cached() { return inRoom() ? room.state : {}; },
    get poses() { return inRoom() ? [...room.poses.values()] : []; }, // the last pose of each peer: [{ from, data }]
    get status() { return room?.status || 'idle'; },
    get joinable() { return inRoom() && JOINABLE.includes(room.phase); },
    get link() { return inRoom() ? RoomClient.linkFor(room.code) : ''; },
    available: () => isEnabled() && !!(window.RoomClient && url),
    setServerUrl(raw) {
      const normalized = raw ? normalizeServerUrl(raw) : '';
      if (raw && normalized === null) return false;
      customUrl = normalized || '';
      url = queryOverride || customUrl || defaultUrl;
      if (room) {
        room.close();
        room = null;
      }
      fire('status', 'idle');
      return true;
    },
    message(err) {
      const code = err?.code || err;
      const i18n = window.ASTRO_I18N;
      if (i18n) {
        if (ERRORS[code]) return i18n.t(`net.errors.${code}`);
        return i18n.t('net.errors.generic', { code: err?.code || err?.message || err });
      }
      return ERRORS[code] || `Room error: ${err?.code || err?.message || err}.`;
    },
    on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type).delete(fn); },
    peerOf: seat => (inRoom() ? room.peers.find(p => p.seat === seat) : null) || null,
    // My crew member, or an AI one while I am the host (solo counts as host).
    owns: seat => !inRoom() ? true : room.you.seat === seat || (room.isHost && !room.peers.some(p => p.seat === seat)),
    create: (phase, opts = {}) => client()?.create({ phase, ...opts, meta: { name: getPlayerName(), ...(opts.meta || {}) } }),
    join: (code, opts = {}) => client()?.join(code, { ...opts, meta: { name: getPlayerName(), ...(opts.meta || {}) } }),
    leave() { room?.leave(); },
    setPhase: phase => inRoom() && room.isHost && room.setPhase(phase),
    setState: (key, data) => inRoom() && room.isHost && room.setState(key, data),
    emit: data => inRoom() && room.isHost && room.emit(data),
    act: (name, ...args) => inRoom() && !room.isHost && room.act({ name, args }),
    pose: data => inRoom() && room.pose(data),
    send: (data, to) => inRoom() && room.send(data, to),
    setSeat: seat => inRoom() && room.setSeat(seat),
    listRooms: () => apiJson('/api/rooms'),
    checkRoom: code => apiJson(`/api/rooms/${encodeURIComponent(String(code || '').trim().toUpperCase())}`),
    getLeaderboard: ({ tab = 'missions', difficulty = 'all', site = 'all', limit = 25 } = {}) =>
      apiJson(`/api/leaderboard?tab=${encodeURIComponent(tab)}&difficulty=${encodeURIComponent(difficulty)}&site=${encodeURIComponent(site)}&limit=${encodeURIComponent(limit)}`),
    submitScore: payload => apiJson('/api/leaderboard', { method: 'POST', body: JSON.stringify(payload) }),
    recordSoloScore,
    getSoloLeaderboard,
  };
  window.ASTRO_NET = net;
  // Back into the room after a reload, or into the room of an invite link (?room=CODE). app.js listens to
  // 'welcome' and 'error'; a failed link join is reported there.
  net.start = async () => {
    if (!isEnabled()) return;
    const c = client();
    if (!c) return;
    if (await c.rejoin().catch(() => null)) return;
    const code = RoomClient.codeFromUrl();
    if (code) await net.join(code).catch(err => fire('error', Object.assign(err, { roomCode: code })));
  };
})();
