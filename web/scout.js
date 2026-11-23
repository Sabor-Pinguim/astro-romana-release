// Surface experiment minigames (H-S1, L-S1, O-S1, M-S1) inside #minigame-dialog.
// Parameter values mark whether each number is real (from references/experiments/minigames/*/README.md)
// or game-balance.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('minigame-dialog');
  if (!dialog) return;
  const t = (key, opts) => window.ASTRO_I18N?.t(key, opts) ?? key;
  const U = window.ASTRO_UNITS || {
    decimal: (n, d = 1) => Number(n).toFixed(d),
    massGrams: (g, d = 1) => `${Number(g).toFixed(d)} g`,
    tempC: c => `${Math.round(c)} °C`,
    tempRangeC: (a, b) => `${a}–${b} °C`,
  };

  // ---------------------------------------------------------------------------
  // H-S1 · Surface escort (Helena): 5×5 route planning around sand hazards
  // ---------------------------------------------------------------------------
  const scout = (() => {
    const WIDTH = 5, HEIGHT = 5;
    // Waypoints 1..5 arranged around visible sand-trap sectors (game-balance).
    const CHECKPOINTS = [[0, 0], [4, 0], [4, 2], [0, 2], [4, 4]];
    const HAZARDS = [[1, 1], [2, 1], [2, 3], [3, 3]];
    // Waypoints are labelled with the most abundant elements in the Martian crust (by weight), in order.
    const ELEMENTS = [
      { symbol: 'O', get name() { return t('minigames.scout.elements.O'); } },
      { symbol: 'Si', get name() { return t('minigames.scout.elements.Si'); } },
      { symbol: 'Fe', get name() { return t('minigames.scout.elements.Fe'); } },
      { symbol: 'Mg', get name() { return t('minigames.scout.elements.Mg'); } },
      { symbol: 'Ca', get name() { return t('minigames.scout.elements.Ca'); } },
    ];
    const ORDER_TEXT = ELEMENTS.map(el => el.symbol).join(' → ');
    const elementLabel = i => `${ELEMENTS[i].symbol} (${ELEMENTS[i].name})`;
    const game = $('scout-game'), board = $('scout-board'), orderBox = $('scout-order');
    let path = [], active = false, drawing = false;

    const checkpointAt = (x, y) => CHECKPOINTS.findIndex(([cx, cy]) => cx === x && cy === y);
    const isHazard = (x, y) => HAZARDS.some(([hx, hy]) => hx === x && hy === y);

    function render() {
      const visited = new Map(path.map(([x, y], i) => [`${x},${y}`, i]));
      const reached = path.filter(([x, y]) => checkpointAt(x, y) >= 0).length;
      const [hx, hy] = path[path.length - 1] || [0, 0];

      board.querySelectorAll('.scout-tile').forEach(cell => {
        const x = Number(cell.dataset.x), y = Number(cell.dataset.y);
        const haz = isHazard(x, y), n = checkpointAt(x, y);
        const index = visited.get(`${x},${y}`), previous = path[index - 1], next = path[index + 1];
        cell.className = 'scout-tile';
        cell.disabled = haz;
        if (haz) {
          cell.classList.add('is-hazard');
          cell.textContent = '⚠';
          cell.title = t('minigames.scout.sandHazard');
          cell.setAttribute('aria-label', t('minigames.scout.tileHazardAria', { row: y + 1, col: x + 1 }));
          return;
        }
        if (index !== undefined) {
          cell.classList.add('visited');
          if (index === path.length - 1) cell.classList.add('drone');
          for (const neighbor of [previous, next]) {
            if (!neighbor) continue;
            if (neighbor[0] < x) cell.classList.add('link-left');
            if (neighbor[0] > x) cell.classList.add('link-right');
            if (neighbor[1] < y) cell.classList.add('link-up');
            if (neighbor[1] > y) cell.classList.add('link-down');
          }
        } else if (active && Math.abs(x - hx) + Math.abs(y - hy) === 1 && (n < 0 || n === reached)) {
          cell.classList.add('can-step');
        }
        if (active && n === reached) cell.classList.add('next-wp');
        const el = n >= 0 ? ELEMENTS[n] : null;
        cell.textContent = el ? el.symbol : '';
        cell.title = el ? `${el.symbol} — ${el.name}` : '';
        cell.setAttribute('aria-label', t('minigames.scout.tileAria', {
          row: y + 1,
          col: x + 1,
          el: el ? t('minigames.scout.tileEl', { el: elementLabel(n) }) : '',
          onRoute: index !== undefined ? t('minigames.scout.tileOnRoute') : '',
        }));
      });
      if (orderBox) {
        orderBox.innerHTML = `<span class="scout-order-label">${t('minigames.scout.orderLabel')}</span>` + ELEMENTS.map((el, i) => {
          const cls = i < reached ? 'done' : i === reached ? 'next' : '';
          return `<span class="scout-order-chip ${cls}" title="${el.name}">${el.symbol}</span>`;
        }).join('<span class="scout-order-arrow" aria-hidden="true">→</span>');
      }

      $('scout-points').textContent = t('minigames.scout.waypoint', { reached, total: CHECKPOINTS.length });
      $('scout-time').textContent = t('minigames.scout.steps', { steps: Math.max(0, path.length - 1) });
    }

    function stop() { active = false; drawing = false; }

    function reset() {
      stop();
      path = [CHECKPOINTS[0].slice()];
      active = true;
      $('scout-status').textContent = t('minigames.scout.startStatus', { order: ORDER_TEXT });
      $('scout-start').hidden = false;
      $('scout-start').textContent = t('minigames.scout.resetBtn');
      game.querySelectorAll('[data-scout]').forEach(btn => { btn.disabled = false; });
      render();
    }

    function moveTo(x, y, fromDrag = false) {
      if (!active || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || isHazard(x, y)) return;
      const prior = path.findIndex(([cx, cy]) => cx === x && cy === y);
      if (prior >= 0) {
        if (!fromDrag && prior < path.length - 1) {
          path = path.slice(0, prior + 1);
          const nextIdx = path.filter(([cx, cy]) => checkpointAt(cx, cy) >= 0).length;
          $('scout-status').textContent = t('minigames.scout.rewound', { el: elementLabel(nextIdx) });
          render();
        } else if (fromDrag && prior === path.length - 2) {
          path.pop();
          render();
        }
        return;
      }
      const [px, py] = path[path.length - 1];
      if (Math.abs(x - px) + Math.abs(y - py) !== 1) {
        if (!fromDrag) $('scout-status').textContent = t('minigames.scout.adjacentHint');
        return;
      }
      const checkpoint = checkpointAt(x, y);
      const reached = path.filter(([cx, cy]) => checkpointAt(cx, cy) >= 0).length;
      if (checkpoint >= 0 && checkpoint !== reached) {
        $('scout-status').textContent = t('minigames.scout.orderHint', { el: elementLabel(reached) });
        return;
      }
      path.push([x, y]);
      if (checkpoint === CHECKPOINTS.length - 1 && reached === CHECKPOINTS.length - 1) {
        stop();
        $('scout-status').textContent = t('minigames.scout.doneStatus', { order: ORDER_TEXT });
        game.querySelectorAll('[data-scout]').forEach(btn => { btn.disabled = true; });
        dialog.dispatchEvent(new CustomEvent('astro:minigame-completed', { detail: { id: 'H-S1' } }));
      } else {
        const nextIdx = path.filter(([cx, cy]) => checkpointAt(cx, cy) >= 0).length;
        $('scout-status').textContent = t('minigames.scout.headingTo', { el: elementLabel(nextIdx) });
      }
      render();
    }

    const move = (dx, dy) => {
      if (!path.length) return;
      const [x, y] = path[path.length - 1];
      moveTo(x + dx, y + dy, false);
    };

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.tabIndex = -1;
        cell.className = 'scout-tile';
        cell.addEventListener('click', () => moveTo(x, y, false));
        board.append(cell);
      }
    }

    $('scout-start').addEventListener('click', reset);
    game.querySelectorAll('[data-scout]').forEach(btn => btn.addEventListener('click', () => {
      const [dx, dy] = btn.dataset.scout.split(',').map(Number);
      move(dx, dy);
    }));
    board.addEventListener('pointerdown', event => {
      if (!active || event.button !== 0) return;
      const cell = event.target.closest('.scout-tile');
      if (!cell || cell.disabled) return;
      drawing = true;
      board.setPointerCapture(event.pointerId);
      moveTo(Number(cell.dataset.x), Number(cell.dataset.y), false);
      event.preventDefault();
    });
    board.addEventListener('pointermove', event => {
      if (!drawing) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.scout-tile');
      if (cell && board.contains(cell)) moveTo(Number(cell.dataset.x), Number(cell.dataset.y), true);
    });
    board.addEventListener('pointerup', () => { drawing = false; });
    board.addEventListener('pointercancel', () => { drawing = false; });
    dialog.addEventListener('keydown', event => {
      if (!dialog.open || dialog.dataset.exp !== 'H-S1' || !active) return;
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
      if (moves[event.code]) { event.preventDefault(); event.stopPropagation(); move(...moves[event.code]); }
    });

    return { reset, stop, render };
  })();

  // ---------------------------------------------------------------------------
  // L-S1 · Oxygen oven (Lucas / MOXIE): Keep in range at ~800 °C
  // Sources (references/experiments/minigames/l-s1-moxie/README.md):
  // - real: operating_temperature = 800 °C, power_electric = 300 W,
  //   o2_rate_required = 6 g/h, o2_rate_peak = 12 g/h, real runs 5.4–9.8 g O2.
  // - game-balance: zoomed gauge 720–860 °C, start 750 °C, green 780–820 °C,
  //   cold < 770 °C, hot > 830 °C, compressed time scale so optimal hold finishes in ~12 s.
  // ---------------------------------------------------------------------------
  const moxie = (() => {
    const MIN_C = 720, MAX_C = 860, START_C = 750;
    const COLD_C = 770, GREEN_MIN_C = 780, GREEN_MAX_C = 820, HOT_C = 830;
    const GOAL_O2_G = 6.0;
    const PEAK_RATE_GS = 0.55; // game-balance: compresses 12 g/h peak into ~11 s play
    const EDGE_RATE_GS = 0.25; // game-balance: partial O2 output in warm margins
    const HEAT_RATE_CS = 82, COOL_RATE_CS = 36, DAMAGE_RATE = 22; // game-balance

    const heatBtn = $('moxie-heat'), resetBtn = $('moxie-reset'), badge = $('moxie-zone-badge');
    const needle = $('moxie-needle'), o2Bar = $('moxie-bar'), healthBar = $('moxie-health');
    let temp = START_C, o2 = 0, health = 100, elapsed = 0;
    let active = false, pointerHeat = false, keyHeat = false, pulseUntil = 0;
    let raf = 0, lastTs = 0;

    const pctOf = val => Math.max(0, Math.min(100, ((val - MIN_C) / (MAX_C - MIN_C)) * 100));

    function syncLabels() {
      const range = U.tempRangeC(GREEN_MIN_C, GREEN_MAX_C);
      const target = U.tempC(800);
      const goal = U.massGrams(GOAL_O2_G, 1);
      if ($('moxie-target-readout')) $('moxie-target-readout').textContent = t('minigames.moxie.targetReadout', { range });
      if ($('moxie-zone-cold')) $('moxie-zone-cold').textContent = t('minigames.moxie.zoneCold', { cold: U.tempC(COLD_C) });
      if ($('moxie-zone-target')) $('moxie-zone-target').textContent = t('minigames.moxie.zoneTarget', { range });
      if ($('moxie-zone-hot')) $('moxie-zone-hot').textContent = t('minigames.moxie.zoneHot', { hot: U.tempC(HOT_C) });
      if ($('moxie-band-label')) $('moxie-band-label').textContent = `✓ ${target}`;
      if ($('moxie-o2-label')) $('moxie-o2-label').textContent = t('minigames.moxie.o2Label', { goal });
    }

    function render(statusText) {
      syncLabels();
      $('moxie-temp').textContent = U.tempC(Math.round(temp));
      $('moxie-o2').textContent = `${U.massGrams(o2, 1)} / ${U.massGrams(GOAL_O2_G, 1)} O₂`;
      $('moxie-health-text').textContent = `${Math.round(health)}%`;
      needle.style.left = `${pctOf(temp).toFixed(2)}%`;

      const inGreen = temp >= GREEN_MIN_C && temp <= GREEN_MAX_C;
      const isHot = temp > HOT_C;
      const isCold = temp < COLD_C;
      needle.className = 'moxie-needle' + (inGreen ? ' is-good' : isHot ? ' is-hot' : isCold ? ' is-cold' : '');

      const target = U.tempC(800), range = U.tempRangeC(GREEN_MIN_C, GREEN_MAX_C);
      if (inGreen) {
        badge.className = 'moxie-zone-badge is-good';
        badge.textContent = t('minigames.moxie.badgeGood', { target });
      } else if (isHot) {
        badge.className = 'moxie-zone-badge is-hot';
        badge.textContent = t('minigames.moxie.badgeHot', { hot: U.tempC(HOT_C) });
      } else if (isCold) {
        badge.className = 'moxie-zone-badge is-cold';
        badge.textContent = t('minigames.moxie.badgeCold', { cold: U.tempC(COLD_C) });
      } else {
        badge.className = 'moxie-zone-badge is-warm';
        badge.textContent = t('minigames.moxie.badgeWarm', { range });
      }

      o2Bar.style.width = `${Math.min(100, (o2 / GOAL_O2_G) * 100).toFixed(1)}%`;
      healthBar.style.width = `${Math.max(0, health).toFixed(1)}%`;
      healthBar.classList.toggle('is-danger', health < 40);
      heatBtn.classList.toggle('is-firing', pointerHeat || keyHeat || performance.now() < pulseUntil);
      if (statusText) $('moxie-status').textContent = statusText;
    }

    function stop() {
      active = false;
      pointerHeat = false;
      keyHeat = false;
      pulseUntil = 0;
      cancelAnimationFrame(raf);
      raf = 0;
      heatBtn?.classList.remove('is-firing');
    }

    function tick(ts) {
      if (!active || !dialog.open || dialog.dataset.exp !== 'L-S1') { stop(); return; }
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;
      elapsed += dt;

      const heating = pointerHeat || keyHeat || ts < pulseUntil;
      const fluct = Math.sin(elapsed * 1.8) * 5 + Math.sin(elapsed * 3.1) * 2;
      temp = Math.max(MIN_C, Math.min(MAX_C, temp + ((heating ? HEAT_RATE_CS : 0) - COOL_RATE_CS + fluct) * dt));

      const eff = Math.max(0.35, health / 100);
      const target = U.tempC(800), range = U.tempRangeC(GREEN_MIN_C, GREEN_MAX_C);
      let status = '';
      if (temp >= GREEN_MIN_C && temp <= GREEN_MAX_C) {
        o2 += PEAK_RATE_GS * eff * dt;
        status = t('minigames.moxie.statusGood', { target });
      } else if (temp >= COLD_C && temp <= HOT_C) {
        o2 += EDGE_RATE_GS * eff * dt;
        status = temp < GREEN_MIN_C
          ? t('minigames.moxie.statusWarmLow', { range })
          : t('minigames.moxie.statusWarmHigh');
      } else if (temp < COLD_C) {
        status = t('minigames.moxie.statusCold', { cold: U.tempC(COLD_C) });
      } else {
        health = Math.max(0, health - DAMAGE_RATE * dt);
        status = t('minigames.moxie.statusHot', { hot: U.tempC(HOT_C) });
      }

      if (health <= 0) {
        o2 = Math.max(0, o2 - 1.0);
        temp = START_C;
        health = 100;
        pointerHeat = false;
        keyHeat = false;
        pulseUntil = 0;
        render(t('minigames.moxie.statusCutout', { loss: U.massGrams(1.0, 1) }));
      } else if (o2 >= GOAL_O2_G) {
        o2 = GOAL_O2_G;
        stop();
        heatBtn.disabled = true;
        render(t('minigames.moxie.statusDone', { goal: U.massGrams(GOAL_O2_G, 1), target }));
        dialog.dispatchEvent(new CustomEvent('astro:minigame-completed', { detail: { id: 'L-S1' } }));
        return;
      } else {
        render(status);
      }

      raf = requestAnimationFrame(tick);
    }

    function reset() {
      stop();
      temp = START_C;
      o2 = 0;
      health = 100;
      elapsed = 0;
      lastTs = 0;
      active = true;
      heatBtn.disabled = false;
      render(t('minigames.moxie.statusInitial', { goal: U.massGrams(GOAL_O2_G, 1) }));
      raf = requestAnimationFrame(tick);
    }

    heatBtn.addEventListener('pointerdown', event => {
      if (!active || event.button !== 0) return;
      pointerHeat = true;
      temp = Math.min(MAX_C, temp + 4);
      heatBtn.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    const endPointer = () => { pointerHeat = false; };
    heatBtn.addEventListener('pointerup', endPointer);
    heatBtn.addEventListener('pointercancel', endPointer);
    window.addEventListener('blur', endPointer);
    heatBtn.addEventListener('click', event => {
      if (!active || event.detail !== 0) return;
      pulseUntil = performance.now() + 260;
    });
    resetBtn.addEventListener('click', reset);

    dialog.addEventListener('keydown', event => {
      if (!dialog.open || dialog.dataset.exp !== 'L-S1' || !active) return;
      const isSpace = event.code === 'Space' && (!event.target.closest('button') || event.target === heatBtn);
      if (isSpace || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) keyHeat = true;
      }
    });
    dialog.addEventListener('keyup', event => {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') keyHeat = false;
    });

    return { reset, stop, render, syncLabels };
  })();

  // ---------------------------------------------------------------------------
  // O-S1 · Orbiter pass (Oscar / Electra UHF Relay): Choice under a limit
  // Sources (references/experiments/minigames/o-s1-uhf-relay/README.md):
  // - real: data_volume = 100–250 Mb per ~8 min pass, data_rate_max = 2 Mbps;
  //   real packet sizes: Mastcam-Z ~148 Mb, SHERLOC 79.7 Mb, RIMFAX 40–80 Mb (60 Mb),
  //   SEIS 38 Mb, PIXL ~16 Mb, SuperCam 15.5 Mb.
  // - game-balance: 5 Mb crew telemetry locked as required, 40 s pass window, 200 pts target.
  // ---------------------------------------------------------------------------
  const relay = (() => {
    const CAPACITY_MB = 250;
    const WINDOW_S = 40;
    const SCORE_GOAL = 200;
    const PACKETS = [
      { id: 'telemetry', get name() { return t('minigames.relay.packets.telemetry.name'); }, sizeMb: 5.0, pts: 20, get badge() { return t('minigames.relay.packets.telemetry.badge'); }, cls: 'is-req', required: true },
      { id: 'sherloc', get name() { return t('minigames.relay.packets.sherloc.name'); }, sizeMb: 79.7, pts: 85, get badge() { return t('minigames.relay.packets.sherloc.badge'); }, cls: 'is-high' },
      { id: 'rimfax', get name() { return t('minigames.relay.packets.rimfax.name'); }, sizeMb: 60.0, pts: 55, get badge() { return t('minigames.relay.packets.rimfax.badge'); }, cls: 'is-high' },
      { id: 'seis', get name() { return t('minigames.relay.packets.seis.name'); }, sizeMb: 38.0, pts: 45, get badge() { return t('minigames.relay.packets.seis.badge'); }, cls: 'is-high' },
      { id: 'pixl', get name() { return t('minigames.relay.packets.pixl.name'); }, sizeMb: 16.0, pts: 40, get badge() { return t('minigames.relay.packets.pixl.badge'); }, cls: 'is-good' },
      { id: 'supercam', get name() { return t('minigames.relay.packets.supercam.name'); }, sizeMb: 15.5, pts: 35, get badge() { return t('minigames.relay.packets.supercam.badge'); }, cls: 'is-good' },
      { id: 'mastcam', get name() { return t('minigames.relay.packets.mastcam.name'); }, sizeMb: 148.0, pts: 60, get badge() { return t('minigames.relay.packets.mastcam.badge'); }, cls: 'is-warn' },
    ];

    const listEl = $('relay-list'), sendBtn = $('relay-send'), resetBtn = $('relay-reset');
    const passBar = $('relay-bar'), capBar = $('relay-cap-bar');
    let selected = new Set(['telemetry']);
    let timeLeft = WINDOW_S, active = false, raf = 0, lastTs = 0;

    function totals() {
      let mb = 0, pts = 0;
      for (const p of PACKETS) {
        if (selected.has(p.id)) { mb += p.sizeMb; pts += p.pts; }
      }
      return { mb, pts };
    }

    function render(statusText) {
      const { mb, pts } = totals();
      const progress = 1 - Math.max(0, timeLeft) / WINDOW_S;
      const rateMbps = 0.25 + 1.75 * Math.sin(Math.PI * progress);
      const valid = mb <= CAPACITY_MB && pts >= SCORE_GOAL && selected.has('telemetry');

      $('relay-time').textContent = `${U.decimal(Math.max(0, timeLeft), 1)} s`;
      $('relay-rate').textContent = `${U.decimal(rateMbps, 2)} Mbps`;
      const usedEl = $('relay-used');
      usedEl.textContent = `${U.decimal(mb, 1)} / ${CAPACITY_MB} Mb`;
      usedEl.classList.toggle('is-danger', mb > CAPACITY_MB);
      const scoreEl = $('relay-score');
      scoreEl.textContent = `${pts} / ${SCORE_GOAL} pts`;
      scoreEl.classList.toggle('is-good', valid);

      passBar.style.width = `${Math.min(100, progress * 100).toFixed(1)}%`;
      capBar.style.width = `${Math.min(100, (mb / CAPACITY_MB) * 100).toFixed(1)}%`;
      capBar.classList.toggle('is-danger', mb > CAPACITY_MB);

      sendBtn.classList.toggle('is-ready', valid);
      if (mb > CAPACITY_MB) sendBtn.textContent = t('minigames.relay.overLimitBtn');
      else if (pts < SCORE_GOAL) sendBtn.textContent = t('minigames.relay.needMoreBtn', { pts, goal: SCORE_GOAL });
      else sendBtn.textContent = t('minigames.relay.transmitBtn', { mb: U.decimal(mb, 1), pts });

      listEl.querySelectorAll('.relay-packet').forEach(btn => {
        btn.setAttribute('aria-pressed', String(selected.has(btn.dataset.packet)));
      });
      if (statusText) $('relay-status').textContent = statusText;
    }

    function stop() {
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }

    function tick(ts) {
      if (!active || !dialog.open || dialog.dataset.exp !== 'O-S1') { stop(); return; }
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        const { mb, pts } = totals();
        stop();
        sendBtn.disabled = true;
        if (mb <= CAPACITY_MB && pts >= SCORE_GOAL && selected.has('telemetry')) {
          render(t('minigames.relay.autoTransmitted', { mb: U.decimal(mb, 1), pts }));
          dialog.dispatchEvent(new CustomEvent('astro:minigame-completed', { detail: { id: 'O-S1' } }));
        } else {
          render(t('minigames.relay.missedStatus'));
        }
        return;
      }
      render();
      raf = requestAnimationFrame(tick);
    }

    function reset() {
      stop();
      selected = new Set(['telemetry']);
      timeLeft = WINDOW_S;
      lastTs = 0;
      active = true;
      sendBtn.disabled = false;
      render(t('minigames.relay.initialStatus'));
      raf = requestAnimationFrame(tick);
    }

    function rebuildList() {
      listEl.innerHTML = '';
      PACKETS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'relay-packet' + (p.required ? ' is-locked' : '');
        btn.dataset.packet = p.id;
        btn.disabled = Boolean(p.required);
        const sharePct = Math.min(100, (p.sizeMb / CAPACITY_MB) * 100).toFixed(1);
        btn.innerHTML = `<span class="relay-row"><span class="relay-name"><strong>${p.name}</strong><small class="relay-badge ${p.cls}">${p.badge}</small></span><span class="relay-meta"><strong>${U.decimal(p.sizeMb, 1)} Mb</strong><small>+${p.pts} pts</small></span></span><span class="relay-share" aria-hidden="true"><span style="width:${sharePct}%"></span></span>`;
        if (!p.required) {
          btn.addEventListener('click', () => {
            if (!active) return;
            if (selected.has(p.id)) selected.delete(p.id);
            else selected.add(p.id);
            const { mb, pts } = totals();
            if (mb > CAPACITY_MB) {
              render(t('minigames.relay.bufferFull', { over: U.decimal(mb - CAPACITY_MB, 1) }));
            } else if (pts >= SCORE_GOAL) {
              render(t('minigames.relay.readyStatus', { mb: U.decimal(mb, 1), pts }));
            } else {
              render(t('minigames.relay.selectedStatus', { count: selected.size, mb: U.decimal(mb, 1), pts, goal: SCORE_GOAL }));
            }
          });
        }
        listEl.append(btn);
      });
      render();
    }
    rebuildList();

    sendBtn.addEventListener('click', () => {
      if (!active) return;
      const { mb, pts } = totals();
      if (mb > CAPACITY_MB) {
        render(t('minigames.relay.overLimitErr', { over: U.decimal(mb - CAPACITY_MB, 1) }));
        return;
      }
      if (pts < SCORE_GOAL) {
        render(t('minigames.relay.needPtsErr', { goal: SCORE_GOAL, pts }));
        return;
      }
      stop();
      sendBtn.disabled = true;
      render(t('minigames.relay.relayedStatus', { mb: U.decimal(mb, 1), pts }));
      dialog.dispatchEvent(new CustomEvent('astro:minigame-completed', { detail: { id: 'O-S1' } }));
    });
    resetBtn.addEventListener('click', reset);

    return { reset, stop, render, rebuildList };
  })();

  // ---------------------------------------------------------------------------
  // M-S1 · Biosignature hunter (Maya / PIXL + SHERLOC on Cheyava Falls)
  // Sources (references/experiments/minigames/m-s1-pixl-sherloc/README.md):
  // - real/derived: SHERLOC 3×3 UV survey (< 10 min, 48.8 W -> 8.1 Wh);
  //   PIXL 1×1 X-ray point (10 h / 48 cells = 12.5 min, 25 W -> 5.2 Wh).
  // - game-balance: 8×6 grid, 5 spots, 3 abiotic decoys; find 3 real spots with PIXL.
  // ---------------------------------------------------------------------------
  const bio = (() => {
    const COLS = 8, ROWS = 6;
    const SPOT_COUNT = 5, DECOY_COUNT = 3, NEED_SPOTS = 3;
    const MAX_MIN = 300, MAX_WH = 120;
    const SHERLOC = { min: 10, wh: 8.1 };
    const PIXL = { min: 12.5, wh: 5.2 };

    const board = $('bio-board');
    const btnSherloc = $('bio-tool-sherloc'), btnPixl = $('bio-tool-pixl'), resetBtn = $('bio-reset');
    let tool = 'sherloc';
    let cells = [];
    let timeLeft = MAX_MIN, energyLeft = MAX_WH, found = 0, active = false;
    let hoverXY = null;

    const idxOf = (x, y) => y * COLS + x;
    const orthoNeighbors = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS);

    function generateGrid() {
      const picks = Array.from({ length: COLS * ROWS }, (_, i) => i);
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }
      const grid = Array.from({ length: COLS * ROWS }, (_, i) => ({
        x: i % COLS, y: Math.floor(i / COLS),
        kind: 'empty', nearSpot: false, uv: false, pixl: false,
      }));
      const spots = picks.slice(0, SPOT_COUNT);
      spots.forEach(idx => { grid[idx].kind = 'spot'; });
      spots.forEach(idx => {
        const c = grid[idx];
        orthoNeighbors(c.x, c.y).forEach(([nx, ny]) => {
          const n = grid[idxOf(nx, ny)];
          if (n.kind === 'empty') n.nearSpot = true;
        });
      });
      let decoysPlaced = 0;
      for (let i = SPOT_COUNT; i < picks.length && decoysPlaced < DECOY_COUNT; i++) {
        const c = grid[picks[i]];
        if (c.kind === 'empty' && !c.nearSpot) { c.kind = 'decoy'; decoysPlaced++; }
      }
      return grid;
    }

    function updateHover() {
      const btns = board.querySelectorAll('.bio-cell');
      btns.forEach((btn, i) => {
        if (!active || !hoverXY || tool !== 'sherloc') {
          btn.classList.remove('hover-3x3');
          return;
        }
        const cx = i % COLS, cy = Math.floor(i / COLS);
        const inside = Math.abs(cx - hoverXY[0]) <= 1 && Math.abs(cy - hoverXY[1]) <= 1;
        btn.classList.toggle('hover-3x3', inside);
      });
    }

    function setTool(next) {
      tool = next;
      btnSherloc.setAttribute('aria-pressed', String(tool === 'sherloc'));
      btnPixl.setAttribute('aria-pressed', String(tool === 'pixl'));
      updateHover();
    }

    function canAfford(cost) {
      return timeLeft + 1e-6 >= cost.min && energyLeft + 1e-6 >= cost.wh;
    }

    function render(statusText) {
      $('bio-found').textContent = t('minigames.bio.found', { found, need: NEED_SPOTS });
      const timeEl = $('bio-time');
      timeEl.textContent = t('minigames.bio.timeMin', { min: U.decimal(timeLeft, 1) });
      timeEl.classList.toggle('is-danger', timeLeft < 25);
      const energyEl = $('bio-energy');
      energyEl.textContent = `${U.decimal(energyLeft, 1)} Wh`;
      energyEl.classList.toggle('is-danger', energyLeft < 16);

      board.querySelectorAll('.bio-cell').forEach((btn, i) => {
        const c = cells[i];
        btn.className = 'bio-cell';
        let label = '';
        if (c.uv) {
          btn.classList.add('is-uv');
          if (c.kind === 'spot' || c.kind === 'decoy') {
            btn.classList.add('uv-glow');
            label = '✦';
          } else {
            btn.classList.add('uv-none');
            label = '·';
          }
        }
        if (c.pixl) {
          btn.classList.add('is-pixl');
          if (c.kind === 'spot') { btn.classList.add('pixl-spot'); label = '✓'; }
          else if (c.kind === 'decoy') { btn.classList.add('pixl-decoy'); label = '✕'; }
          else if (c.nearSpot) { btn.classList.add('pixl-near'); label = '↗'; }
          else { btn.classList.add('pixl-empty'); label = '—'; }
        }
        btn.textContent = label;
        btn.disabled = !active;
        const descKey = !label ? 'descUnscanned'
          : label === '✦' ? 'descSuspect'
          : label === '✓' ? 'descSpot'
          : label === '✕' ? 'descDecoy'
          : label === '↗' ? 'descNear'
          : 'descEmpty';
        btn.setAttribute('aria-label', t('minigames.bio.cellAria', { row: c.y + 1, col: c.x + 1, desc: t(`minigames.bio.${descKey}`) }));
      });

      updateHover();
      resetBtn.classList.toggle('primary', !active);
      resetBtn.classList.toggle('quiet', active);
      if (statusText) $('bio-status').textContent = statusText;
    }

    function checkCompleteOrExhausted(lastMsg) {
      if (found >= NEED_SPOTS) {
        active = false;
        hoverXY = null;
        render(t('minigames.bio.statusVerified'));
        dialog.dispatchEvent(new CustomEvent('astro:minigame-completed', { detail: { id: 'M-S1' } }));
        return;
      }
      if (!canAfford(PIXL) && !canAfford(SHERLOC)) {
        active = false;
        hoverXY = null;
        render(t('minigames.bio.statusExhausted'));
        return;
      }
      render(lastMsg);
    }

    function scanCell(x, y) {
      if (!active) return;
      if (tool === 'sherloc') {
        const block = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) block.push(cells[idxOf(nx, ny)]);
          }
        }
        if (block.every(c => c.uv)) {
          render(t('minigames.bio.statusAlreadySwept'));
          return;
        }
        if (!canAfford(SHERLOC)) {
          render(t('minigames.bio.statusNoBudgetSherloc'));
          return;
        }
        timeLeft -= SHERLOC.min;
        energyLeft -= SHERLOC.wh;
        let glowCount = 0;
        block.forEach(c => {
          c.uv = true;
          if (!c.pixl && (c.kind === 'spot' || c.kind === 'decoy')) glowCount++;
        });
        const msg = glowCount > 0
          ? t('minigames.bio.statusGlowFound', { count: glowCount, plural: glowCount > 1 ? 's' : '' })
          : t('minigames.bio.statusNoGlow');
        checkCompleteOrExhausted(msg);
      } else {
        const target = cells[idxOf(x, y)];
        if (target.pixl) { render(t('minigames.bio.statusAlreadyPixl')); return; }
        if (!canAfford(PIXL)) {
          render(t('minigames.bio.statusNoBudgetPixl'));
          return;
        }
        timeLeft -= PIXL.min;
        energyLeft -= PIXL.wh;
        target.pixl = true;
        if (target.kind === 'spot') {
          found++;
          checkCompleteOrExhausted(t('minigames.bio.statusSpotConfirmed', { found, need: NEED_SPOTS }));
        } else if (target.kind === 'decoy') {
          checkCompleteOrExhausted(t('minigames.bio.statusDecoy'));
        } else if (target.nearSpot) {
          checkCompleteOrExhausted(t('minigames.bio.statusHalo'));
        } else {
          checkCompleteOrExhausted(t('minigames.bio.statusEmpty'));
        }
      }
    }

    function stop() { active = false; hoverXY = null; }

    function reset() {
      cells = generateGrid();
      timeLeft = MAX_MIN;
      energyLeft = MAX_WH;
      found = 0;
      hoverXY = null;
      active = true;
      setTool('sherloc');
      render(t('minigames.bio.statusInit'));
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'bio-cell';
        cell.addEventListener('pointerenter', () => { hoverXY = [x, y]; updateHover(); });
        cell.addEventListener('focus', () => { hoverXY = [x, y]; updateHover(); });
        cell.addEventListener('click', () => scanCell(x, y));
        board.append(cell);
      }
    }
    board.addEventListener('pointerleave', () => { hoverXY = null; updateHover(); });

    btnSherloc.addEventListener('click', () => setTool('sherloc'));
    btnPixl.addEventListener('click', () => setTool('pixl'));
    resetBtn.addEventListener('click', reset);

    return { reset, stop, render };
  })();

  const GAMES = { 'H-S1': scout, 'L-S1': moxie, 'O-S1': relay, 'M-S1': bio };

  function close() {
    Object.values(GAMES).forEach(g => g.stop());
  }

  function open(id) {
    close();
    GAMES[id]?.reset();
  }

  moxie.syncLabels();
  window.addEventListener('astro:settings', () => {
    moxie.syncLabels();
    relay.rebuildList();
    if (dialog.open && dialog.dataset.exp) GAMES[dialog.dataset.exp]?.render?.();
  });

  dialog.addEventListener('close', close);
  window.ASTRO_SCOUT = { reset: () => open('H-S1'), stop: close };
  window.ASTRO_MINIGAMES = { open, close };
})();
