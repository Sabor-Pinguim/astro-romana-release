// Multiplayer room text chat (desktop + mobile) synced over window.ASTRO_NET without server changes.
(() => {
  'use strict';

  const MAX_LEN = 200;
  const MAX_MESSAGES = 60;
  const SYNC_HISTORY = 30;
  const SEND_COOLDOWN_MS = 500;
  const PEEK_MS = 3500;
  const CREW_COLORS = {
    helena: '#E04F26',
    lucas: '#F59E0B',
    oscar: '#9B5DE5',
    maya: '#7EDAC2',
  };

  const i18n = () => window.ASTRO_I18N;
  const t = (key, opts) => (i18n() ? i18n().t(key, opts) : key);
  const net = () => window.ASTRO_NET;

  const root = document.getElementById('chat-root');
  const toggleBtn = document.getElementById('chat-toggle');
  const unreadEl = document.getElementById('chat-unread');
  const peekBtn = document.getElementById('chat-peek');
  const panelEl = document.getElementById('chat-panel');
  const roomTagEl = document.getElementById('chat-room-tag');
  const closeBtn = document.getElementById('chat-close');
  const listEl = document.getElementById('chat-list');
  const formEl = document.getElementById('chat-form');
  const inputEl = document.getElementById('chat-input');

  if (!root || !toggleBtn || !panelEl || !listEl || !formEl || !inputEl) return;

  let open = false;
  let unread = 0;
  let messages = [];
  const seenIds = new Set();
  let knownPeers = new Map();
  let knownHostId = null;
  let activeRoomCode = null;
  let lastSentAt = 0;
  let seq = 0;
  let peekTimer = null;
  let lastSyncedSig = '';

  function cleanText(raw) {
    return String(raw ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_LEN);
  }

  function crewName(seat) {
    if (!seat || !CREW_COLORS[seat]) return '';
    const translated = t(`crew.${seat}.name`);
    return translated && translated !== `crew.${seat}.name`
      ? translated
      : seat.charAt(0).toUpperCase() + seat.slice(1);
  }

  function senderName(peerOrFrom) {
    const rawName = cleanText(peerOrFrom?.meta?.name || '').slice(0, 20);
    if (rawName) return rawName;
    if (!peerOrFrom?.meta && peerOrFrom?.id) {
      const peer = net()?.peers?.find(p => p.id === peerOrFrom.id);
      const liveName = cleanText(peer?.meta?.name || '').slice(0, 20);
      if (liveName) return liveName;
      const known = knownPeers.get(peerOrFrom.id)?.name;
      if (known) return known;
    }
    return crewName(peerOrFrom?.seat) || t('common.player');
  }

  function inMultiplayerRoom() {
    const n = net();
    return Boolean(n && n.mode !== 'solo' && n.code);
  }

  function hidePeek() {
    clearTimeout(peekTimer);
    peekTimer = null;
    if (peekBtn) peekBtn.hidden = true;
  }

  function showPeek(author, text) {
    if (!peekBtn || open) return;
    peekBtn.replaceChildren();
    const who = document.createElement('strong');
    who.textContent = `${author}: `;
    const body = document.createElement('span');
    body.textContent = text;
    peekBtn.append(who, body);
    peekBtn.hidden = false;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(hidePeek, PEEK_MS);
  }

  function syncChrome() {
    const visible = inMultiplayerRoom();
    root.hidden = !visible;
    if (!visible) return;
    const n = net();
    if (roomTagEl) roomTagEl.textContent = n?.code || '';
    panelEl.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
    const toggleLabel = t(open ? 'chat.close' : 'chat.open');
    toggleBtn.setAttribute('aria-label', toggleLabel);
    toggleBtn.title = toggleLabel;
    if (unreadEl) {
      const count = open ? 0 : unread;
      unreadEl.hidden = count <= 0;
      unreadEl.textContent = count > 99 ? '99+' : String(count);
    }
    toggleBtn.classList.toggle('has-unread', !open && unread > 0);
  }

  function renderMessages() {
    listEl.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = t('chat.empty');
      listEl.append(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const m of messages) {
      const item = document.createElement('div');
      if (m.sys) {
        item.className = 'chat-msg is-sys';
        if (m.seat && CREW_COLORS[m.seat]) item.style.setProperty('--crew', CREW_COLORS[m.seat]);
        item.textContent = t(m.sysKey, m.sysVars);
      } else {
        item.className = `chat-msg${m.mine ? ' is-mine' : ''}`;
        item.style.setProperty('--crew', CREW_COLORS[m.seat] || 'var(--solar-amber)');
        const head = document.createElement('span');
        head.className = 'chat-msg-author';
        head.textContent = m.mine ? `${m.name} (${t('chat.you')})` : m.name;
        const body = document.createElement('span');
        body.className = 'chat-msg-text';
        body.textContent = m.text;
        item.append(head, body);
      }
      frag.append(item);
    }
    listEl.append(frag);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function render() {
    syncChrome();
    if (!root.hidden) renderMessages();
  }

  function pushMessage(entry, { announce = false } = {}) {
    if (!entry || !entry.id || seenIds.has(entry.id)) return false;
    seenIds.add(entry.id);
    messages.push(entry);
    while (messages.length > MAX_MESSAGES) messages.shift();
    if (announce && !open && !entry.sys) {
      unread += 1;
      showPeek(entry.name, entry.text);
    }
    return true;
  }

  function syncHistoryToRoom() {
    const n = net();
    if (!n || !n.isHost || n.mode === 'solo') return;
    const payload = messages
      .filter(m => !m.sys)
      .slice(-SYNC_HISTORY)
      .map(({ id, name, seat, text, ts }) => ({ id, name, seat, text, ts }));
    const sig = JSON.stringify(payload);
    if (sig === lastSyncedSig) return;
    lastSyncedSig = sig;
    n.setState('chat', { messages: payload });
  }

  function hydrateCached(list) {
    if (!Array.isArray(list) || !list.length) return false;
    const n = net();
    const mySeat = n?.seat || '';
    const myName = cleanText(n?.getPlayerName?.() || '');
    let changed = false;
    for (const raw of list) {
      if (!raw || typeof raw.id !== 'string') continue;
      const text = cleanText(raw.text);
      if (!text) continue;
      const name = cleanText(raw.name || '') || crewName(raw.seat) || t('common.player');
      const mine = Boolean(raw.seat && mySeat && raw.seat === mySeat && (!myName || name === myName));
      if (pushMessage({
        id: raw.id.slice(0, 64),
        sys: false,
        name,
        seat: typeof raw.seat === 'string' ? raw.seat : '',
        mine,
        text,
        ts: Number(raw.ts) || Date.now(),
      }, { announce: false })) {
        changed = true;
      }
    }
    return changed;
  }

  function resetRoomState() {
    open = false;
    unread = 0;
    messages = [];
    seenIds.clear();
    knownPeers = new Map();
    knownHostId = null;
    activeRoomCode = null;
    lastSyncedSig = '';
    hidePeek();
    if (document.activeElement === inputEl) inputEl.blur();
    render();
  }

  function openChat() {
    if (!inMultiplayerRoom()) return;
    open = true;
    unread = 0;
    hidePeek();
    render();
    if (!window.matchMedia?.('(pointer:coarse)')?.matches) {
      requestAnimationFrame(() => inputEl.focus());
    }
  }

  function closeChat() {
    if (!open) return;
    open = false;
    if (document.activeElement === inputEl) inputEl.blur();
    syncChrome();
  }

  function toggleChat() {
    if (open) closeChat();
    else openChat();
  }

  function send(rawText) {
    if (!inMultiplayerRoom()) return false;
    const text = cleanText(rawText ?? inputEl.value);
    if (!text) return false;
    const now = Date.now();
    if (now - lastSentAt < SEND_COOLDOWN_MS) return false;
    lastSentAt = now;

    const n = net();
    const me = n.peers?.find(p => p.id === n.you?.id) || {
      id: n.you?.id,
      seat: n.seat,
      meta: { name: n.getPlayerName?.() },
    };
    const id = `${n.you?.id || 'me'}-${now}-${++seq}`;
    const entry = {
      id,
      sys: false,
      name: senderName(me),
      seat: n.seat || '',
      mine: true,
      text,
      ts: now,
    };
    pushMessage(entry, { announce: false });
    n.send({ k: 'chat', id, text, ts: now }, 'others');
    if (n.isHost) syncHistoryToRoom();
    if (rawText === undefined) inputEl.value = '';
    render();
    return true;
  }

  toggleBtn.addEventListener('click', toggleChat);
  closeBtn?.addEventListener('click', closeChat);
  peekBtn?.addEventListener('click', openChat);
  formEl.addEventListener('submit', e => {
    e.preventDefault();
    send();
  });

  window.addEventListener('keydown', e => {
    if (!inMultiplayerRoom()) return;
    if (open && e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeChat();
      return;
    }
    if (e.code === 'KeyT' && !open && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (document.querySelector('dialog[open]')) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      openChat();
    }
  }, true);

  window.addEventListener('astro:lang', render);

  const n = net();
  if (n) {
    n.on('welcome', m => {
      const code = m?.code || n.code;
      const freshRoom = !activeRoomCode || code !== activeRoomCode;
      if (freshRoom) {
        messages = [];
        seenIds.clear();
        unread = 0;
        lastSyncedSig = '';
        hidePeek();
        activeRoomCode = code;
      }
      hydrateCached(n.cached?.chat?.messages);
      knownPeers = new Map();
      for (const p of (n.peers || [])) {
        knownPeers.set(p.id, { id: p.id, name: senderName(p), seat: p.seat, host: !!p.host });
      }
      knownHostId = m?.host || n.peers?.find(p => p.host)?.id || null;
      if (m?.t !== 'resumed' && code) {
        pushMessage({
          id: `sys-conn-${code}-${Date.now()}-${++seq}`,
          sys: true,
          sysKey: 'chat.sysConnected',
          sysVars: { code },
          ts: Date.now(),
        });
      }
      if (n.isHost) syncHistoryToRoom();
      render();
    });

    n.on('peers', peers => {
      if (!inMultiplayerRoom()) {
        resetRoomState();
        return;
      }
      const list = Array.isArray(peers) ? peers : (n.peers || []);
      const nextMap = new Map();
      let nextHost = null;
      for (const p of list) {
        const info = { id: p.id, name: senderName(p), seat: p.seat, host: !!p.host };
        nextMap.set(p.id, info);
        if (info.host) nextHost = info;
      }
      for (const [id, info] of nextMap) {
        if (!knownPeers.has(id)) {
          pushMessage({
            id: `sys-join-${id}-${Date.now()}-${++seq}`,
            sys: true,
            sysKey: 'chat.sysJoined',
            sysVars: { name: info.name, seat: crewName(info.seat) },
            seat: info.seat,
            ts: Date.now(),
          });
        }
      }
      for (const [id, prev] of knownPeers) {
        if (!nextMap.has(id)) {
          pushMessage({
            id: `sys-left-${id}-${Date.now()}-${++seq}`,
            sys: true,
            sysKey: 'chat.sysLeft',
            sysVars: { name: prev.name, seat: crewName(prev.seat) },
            seat: prev.seat,
            ts: Date.now(),
          });
        }
      }
      if (knownHostId && nextHost && nextHost.id !== knownHostId) {
        pushMessage({
          id: `sys-host-${nextHost.id}-${Date.now()}-${++seq}`,
          sys: true,
          sysKey: 'chat.sysHost',
          sysVars: { name: nextHost.name },
          seat: nextHost.seat,
          ts: Date.now(),
        });
      }
      knownPeers = nextMap;
      knownHostId = nextHost?.id || knownHostId;
      if (n.isHost) syncHistoryToRoom();
      render();
    });

    n.on('state', (key, data) => {
      if (key === 'chat' && hydrateCached(data?.messages)) render();
    });

    n.on('msg', (data, from) => {
      if (!data || data.k !== 'chat') return;
      const text = cleanText(data.text);
      if (!text) return;
      const id = typeof data.id === 'string' && data.id
        ? data.id.slice(0, 64)
        : `msg-${from?.id || 'peer'}-${data.ts || Date.now()}-${++seq}`;
      const mine = Boolean(from?.id && n.you?.id && from.id === n.you.id);
      const added = pushMessage({
        id,
        sys: false,
        name: senderName(from),
        seat: typeof from?.seat === 'string' ? from.seat : '',
        mine,
        text,
        ts: Number(data.ts) || Date.now(),
      }, { announce: !mine });
      if (added) {
        if (n.isHost) syncHistoryToRoom();
        render();
      }
    });

    n.on('closed', resetRoomState);
    n.on('status', () => {
      if (!inMultiplayerRoom() && !root.hidden) resetRoomState();
      else syncChrome();
    });
  }

  window.ASTRO_CHAT = {
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    send,
    get messages() { return messages.slice(); },
  };

  render();
})();
