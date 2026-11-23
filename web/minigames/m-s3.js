// M-S3 · Listening for marsquakes (Maya / SEIS on InSight) · pattern search on a scrolling trace.
// Plan: docs/experiments-implementation.md §5.3. "Seismogram": the seismometer trace scrolls by over one compressed
// sol. Maya marks the marsquakes (a small P wave, then a bigger S wave, then a fading coda) and ignores the wind
// gusts (short, jagged, broadband bursts with no P and S). Wind noise ruins daytime data and drops at night (PH2),
// so the quiet night is the easiest time to hear them. Marking wind as a quake is false data (the failure).
// Real numbers (references/experiments/mars-experiments.md, PH2 and G9): SEIS ≤8.5 W, 38 Mb/day, works only on a
// stationary lander under a wind and thermal shield; InSight recorded 1,319 marsquakes. Each run draws the quake
// times, strengths and shapes, the gusts (more likely in windy hours) and the background noise.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const SEIS_W = 8.5; // real (PH2): ≤8.5 W
  const SEIS_MB_DAY = 38; // real (PH2): 38 Mb/day
  const INSIGHT_QUAKES = 1319; // real (PH2, G9): marsquakes recorded by InSight
  const CORE_RADIUS_KM = 1830; // real (PH2, G9): radius of the liquid core
  // game-balance: the trace runs from 14:00 to 10:00 local time (Mars hours); drawn samples per second; position
  // of the keyboard pick line (share of the chart width); slower scroll with reduced motion; minimum quiet gap
  // between a quake and any other event, and between two gusts (gusts come in clusters) (s); how far a tap may miss
  // an event (s).
  const START_H = 14, SPAN_H = 20, SPS = 40, PICK = 0.62, REDUCED_RATE = 0.8, EVENT_GAP = 0.6, GUST_GAP = 0.25, TAP_SLACK = 0.3;

  // game-balance. duration: s of play for the whole trace; view: s visible on the chart (less = faster scroll);
  // quakes / gusts: events; amp: quake strength (1 = full scale); dayQuakes: quakes that fall in windy hours;
  // maxFalse: false marks tolerated; two: share of quakes for 2 stars (3 = all of them and no false mark).
  const LEVELS = {
    easy: { duration: 46, view: 9, quakes: 4, gusts: 5, amp: [0.5, 0.8], dayQuakes: 0, maxFalse: 3, two: 0.6, mods: 0 },
    normal: { duration: 44, view: 7.5, quakes: 5, gusts: 8, amp: [0.38, 0.65], dayQuakes: 1, maxFalse: 2, two: 0.6, mods: 1 },
    hard: { duration: 44, view: 6, quakes: 5, gusts: 10, amp: [0.28, 0.5], dayQuakes: 2, maxFalse: 2, two: 0.6, mods: [1, 2] },
  };
  // Modifiers with a real basis:
  //   windy        Mars winds blow 2–7 m/s normally and 17–30 m/s in dust storms ("seismometer noise", Mars
  //                environment table): stronger, more frequent gusts that linger into the night;
  //   dustDevil    whirlwinds pass ~4 times a day (PH9, MEDA on Perseverance): slow pressure wobbles, no P and S;
  //   dustyPanels  dust cut InSight's power from 600–700 W to 200–300 W (EN3a, G9): SEIS is off for part of the night.
  const MODS = ['windy', 'dustDevil', 'dustyPanels'];
  const OFF_SHARE = 0.13; // game-balance: share of the trace with SEIS off (dustyPanels)

  const round2 = x => Math.round(x * 100) / 100;
  const hourAt = (t, D) => (START_H + (SPAN_H * t) / D) % 24;
  const timeAtHour = (h, D) => ((((h - START_H) % 24) + 24) % 24) * (D / SPAN_H);
  // Wind strength by local hour (0 quiet .. 1 windy): calm from 20:00 to 04:00, windy from 09:00 to 17:00.
  function windiness(h, windy) {
    const floor = windy ? 0.4 : 0.1;
    const base = h >= 9 && h < 17 ? 1 : h >= 17 && h < 20 ? 1 - (h - 17) / 3 : h >= 4 && h < 9 ? (h - 4) / 5 : 0;
    return Math.min(1.2, (floor + (1 - floor) * base) * (windy ? 1.15 : 1));
  }
  const isNight = h => h >= 20 || h < 4;

  function generate(R, P, { mods }) {
    const D = P.duration, windy = mods.includes('windy');
    const events = [];
    let off = null;
    if (mods.includes('dustyPanels')) {
      const span = D * OFF_SHARE, a0 = timeAtHour(21, D), a1 = timeAtHour(3, D) - span;
      const a = R.float(a0, Math.max(a0, a1));
      off = [round2(a), round2(a + span)];
    }
    const free = (a, b, kind) => (!off || b < off[0] - EVENT_GAP || a > off[1] + EVENT_GAP)
      && events.every(e => { const gap = kind === 'gust' && e.kind === 'gust' ? GUST_GAP : EVENT_GAP; return b + gap < e.ts || a > e.ts + e.dur + gap; });
    const add = e => events.push(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v])));
    for (let k = 0, g = 0; k < P.quakes && g < 500; g++) {
      const gap = R.float(0.8, 1.4), tau = R.float(0.45, 0.7), dur = gap + tau * 3.2;
      const ts = R.float(1.2, D - dur - 0.4);
      if (!free(ts, ts + dur, 'quake')) continue;
      add({ kind: 'quake', ts, dur, gap, tau, amp: R.span(P.amp), f: R.float(2, 3), ph: R.float(0, 6.28) });
      k++;
    }
    const gusts = P.gusts + (windy ? 2 : 0);
    for (let k = 0, g = 0; k < gusts && g < 900; g++) {
      const ts = R.float(0.8, D - 1.4), dur = R.float(0.35, 1);
      if (!R.chance(Math.min(1, windiness(hourAt(ts, D), windy))) || !free(ts, ts + dur, 'gust')) continue;
      add({ kind: 'gust', ts, dur, amp: R.float(0.35, 0.9) * (windy ? 1.15 : 1) });
      k++;
    }
    if (mods.includes('dustDevil')) {
      const n = R.int(2, 3);
      for (let k = 0, g = 0; k < n && g < 800; g++) {
        const dur = R.float(2.4, 3.4), ts = R.float(1, D - dur - 0.4);
        if (windiness(hourAt(ts, D), false) < 0.8 || !free(ts, ts + dur, 'devil')) continue;
        add({ kind: 'devil', ts, dur, amp: R.float(0.45, 0.8), f: R.float(0.6, 0.9) });
        k++;
      }
    }
    events.sort((a, b) => a.ts - b.ts);
    return { duration: D, view: P.view, windy, off, events };
  }

  const quakesOf = L => L.events.filter(e => e.kind === 'quake');
  function validate(L, P) {
    const q = quakesOf(L);
    if (q.length !== P.quakes || L.events.filter(e => e.kind === 'gust').length < P.gusts) return false;
    if (q.some(e => e.ts + e.dur > L.duration - 0.3)) return false;
    // Some quakes hide in the windy hours (the challenge grows with the level).
    return q.filter(e => windiness(hourAt(e.ts, L.duration), false) >= 0.6).length >= P.dayQuakes;
  }
  // The best result: every marsquake recorded and no false mark.
  const solve = L => ({ quakes: quakesOf(L).length, falses: 0 });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const D = L.duration, total = quakesOf(L).length;
    const css = getComputedStyle(host.root);
    const C = (name, fb) => css.getPropertyValue(name).trim() || fb;
    const COL = {
      void: C('--bg-void', '#11071F'), amber: C('--solar-amber', '#F59E0B'), coral: C('--coral-hover', '#EE7B57'), safe: C('--safe', '#7EDAC2'),
      muted: C('--muted', '#B9B0CE'), cream: C('--starlight-cream', '#FCE8A6'), crimson: C('--crimson-alert', '#8F241E'),
    };
    const TONE = { day: '#2b1d45', dusk: '#201a3e', night: '#121331', off: '#0c0517' };

    // The whole trace, precomputed from the layout and the seeded runtime random (a restart replays it exactly).
    const N = Math.ceil(D * SPS) + 2;
    const trace = new Float32Array(N);
    const inOff = tt => !!L.off && tt >= L.off[0] && tt <= L.off[1];
    for (let i = 0; i < N; i++) {
      const tt = i / SPS, n = host.R.next() + host.R.next() - 1;
      trace[i] = inOff(tt) ? 0 : n * (0.03 + 0.12 * windiness(hourAt(tt, D), L.windy));
    }
    for (const e of L.events) {
      const i0 = Math.max(0, Math.floor(e.ts * SPS)), i1 = Math.min(N - 1, Math.ceil((e.ts + e.dur) * SPS));
      for (let i = i0; i <= i1; i++) {
        const tt = i / SPS, s = tt - e.ts;
        if (s < 0) continue;
        let v = 0;
        if (e.kind === 'quake') {
          if (s < e.gap) v = e.amp * 0.35 * Math.min(1, s / 0.15) * Math.sin(2 * Math.PI * e.f * 1.6 * s);
          else { const q = s - e.gap; v = e.amp * Math.min(1, q / 0.12) * Math.exp(-q / e.tau) * Math.sin(2 * Math.PI * e.f * q + e.ph); }
        } else if (e.kind === 'gust') {
          const edge = Math.min(1, s / 0.06, (e.dur - s) / 0.06);
          v = e.amp * Math.max(0, edge) * (host.R.next() * 2 - 1);
        } else {
          v = e.amp * Math.sin((Math.PI * s) / e.dur) * Math.sin(2 * Math.PI * e.f * s);
        }
        trace[i] = clamp(trace[i] + v, -1, 1);
      }
    }

    const marked = new Map(); // event index → 'quake' | 'gust' | 'devil'
    const missed = new Set();
    let now = 0, caught = 0, falses = 0, period = null, offSaid = false, lastClock = '', tap = null;
    const rate = host.reduced ? REDUCED_RATE : 1;

    const readout = ui.readout(['clock', 'quakes', 'falses', 'data']);
    const tall = (window.innerHeight || 800) >= 640 && (host.body.clientWidth || 600) < 480;
    const cv = ui.canvas(tall ? 0.62 : 0.42, 'ms3-chart');
    cv.node.setAttribute('role', 'img');
    const legend = ui.el('div', 'mg-legend');
    const controls = ui.el('div', 'mg-controls');
    const bMark = ui.button('', 'primary', () => markAt(now - L.view * (1 - PICK), true));
    controls.append(bMark);
    host.body.append(readout.node, cv.node, controls, legend);

    const geo = () => {
      const padL = 4, padR = 4, padT = 18, padB = 14;
      return { padL, padT, pw: Math.max(1, cv.w - padL - padR), ph: Math.max(1, cv.h - padT - padB) };
    };
    const clock = tt => { const h = hourAt(tt, D), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
    const periodOf = h => (isNight(h) ? 'night' : windiness(h, false) >= 0.6 ? 'day' : 'dusk');

    // ------------------------------------------------------------------ drawing
    function draw() {
      cv.fit();
      const { ctx } = cv, g = geo(), t0 = now - L.view;
      const X = tt => g.padL + ((tt - t0) / L.view) * g.pw, mid = g.padT + g.ph / 2, A = (g.ph / 2) * 0.92;
      ctx.fillStyle = COL.void; ctx.fillRect(0, 0, cv.w, cv.h);
      // Day, dusk and night bands (flat tones), SEIS-off stripes.
      for (let tt = Math.floor(t0 * 4) / 4; tt < now; tt += 0.25) {
        if (tt + 0.25 < Math.max(0, t0)) continue;
        const a = Math.max(tt, t0, 0), b = Math.min(tt + 0.25, now);
        if (b <= a) continue;
        ctx.fillStyle = inOff(a) ? TONE.off : TONE[periodOf(hourAt(a, D))];
        ctx.fillRect(X(a), g.padT, X(b) - X(a) + 0.6, g.ph);
      }
      if (L.off && L.off[1] > t0 && L.off[0] < now) {
        const a = Math.max(L.off[0], t0), b = Math.min(L.off[1], now);
        ctx.save(); ctx.beginPath(); ctx.rect(X(a), g.padT, X(b) - X(a), g.ph); ctx.clip();
        ctx.strokeStyle = '#2a1d44'; ctx.lineWidth = 4;
        for (let x = X(a) - g.ph; x < X(b); x += 14) { ctx.beginPath(); ctx.moveTo(x, g.padT + g.ph); ctx.lineTo(x + g.ph, g.padT); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = COL.muted; ctx.font = '700 10px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t('offTag'), (X(a) + X(b)) / 2, mid);
      }
      // Marked events: a flat band behind them, ✓ or ✕ on top.
      ctx.font = '700 11px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      marked.forEach((kind, i) => {
        const e = L.events[i];
        if (e.ts + e.dur < t0 || e.ts > now) return;
        const a = X(Math.max(e.ts - 0.1, t0)), b = X(Math.min(e.ts + e.dur, now));
        ctx.fillStyle = kind === 'quake' ? '#1e5a50' : '#5a1c24'; ctx.fillRect(a, g.padT, Math.max(2, b - a), g.ph);
        ctx.fillStyle = kind === 'quake' ? COL.safe : COL.coral; ctx.fillRect(a, g.padT, Math.max(2, b - a), 3);
        ctx.fillText(kind === 'quake' ? '✓' : '✕', Math.min(b - 6, a + 8), g.padT + 5);
      });
      ctx.fillStyle = '#3a2d5c'; ctx.fillRect(g.padL, mid - 0.5, g.pw, 1);
      // The trace.
      const i0 = Math.max(0, Math.floor(t0 * SPS)), i1 = Math.min(N - 1, Math.floor(now * SPS));
      ctx.strokeStyle = COL.cream; ctx.lineWidth = 1.5; ctx.lineJoin = 'bevel'; ctx.beginPath();
      for (let i = i0; i <= i1; i++) { const x = X(i / SPS), y = mid - trace[i] * A; if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      // A tap that found nothing leaves a short muted tick.
      if (tap && tap.until > now && tap.t > t0) { ctx.fillStyle = COL.muted; ctx.fillRect(X(tap.t) - 1, g.padT, 2, g.ph); }
      // Keyboard pick line.
      const px = g.padL + g.pw * PICK;
      ctx.fillStyle = COL.amber; ctx.fillRect(px - 1, g.padT, 2, g.ph);
      ctx.beginPath(); ctx.moveTo(px - 6, g.padT); ctx.lineTo(px + 6, g.padT); ctx.lineTo(px, g.padT + 8); ctx.closePath(); ctx.fill();
      // Hour ticks below.
      ctx.fillStyle = COL.muted; ctx.font = '600 9px "Chakra Petch", sans-serif'; ctx.textBaseline = 'alphabetic';
      const perHour = D / SPAN_H;
      for (let k = Math.ceil(Math.max(0, t0) / perHour); k * perHour <= now; k++) {
        const x = X(k * perHour);
        ctx.fillRect(x - 0.5, g.padT + g.ph, 1, 4);
        ctx.textAlign = x < 20 ? 'left' : x > cv.w - 20 ? 'right' : 'center';
        ctx.fillText(clock(k * perHour), x, cv.h - 2);
      }
      // Sun or moon, and the local time, top left.
      const h = hourAt(now, D), night = isNight(h);
      ctx.fillStyle = night ? COL.cream : COL.amber;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; ctx.lineTo(10 + 6 * Math.cos(a), 9 + 6 * Math.sin(a)); }
      ctx.closePath(); ctx.fill();
      if (night) { ctx.fillStyle = COL.void; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; ctx.lineTo(13 + 5 * Math.cos(a), 7 + 5 * Math.sin(a)); } ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = COL.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 10px "Chakra Petch", sans-serif';
      ctx.fillText(t(`period.${periodOf(h)}`), 22, 9);
      ctx.textAlign = 'right'; ctx.fillText(t('pickTag'), px - 8, 9);
      cv.node.dataset.now = now.toFixed(2); // read by the lab play-through scripts
    }

    // ------------------------------------------------------------------ texts
    function labels() {
      bMark.textContent = t('markBtn');
      bMark.disabled = !host.active;
      cv.node.setAttribute('aria-label', t('chartAria'));
      legend.replaceChildren(...[['ms3-sw-quake', 'legendQuake'], ['ms3-sw-gust', 'legendGust'], ['ms3-sw-line', 'legendLine']]
        .map(([cls, key]) => { const s = ui.el('span'); s.append(ui.el('i', `ms3-swatch ${cls}`), document.createTextNode(t(key))); return s; }));
    }
    function readouts() {
      const h = hourAt(now, D);
      readout.set('clock', t('clockReadout', { time: clock(now) }), isNight(h) ? 'good' : '');
      readout.set('quakes', t('quakesReadout', { n: caught }), caught ? 'good' : '');
      readout.set('falses', t('falsesReadout', { n: falses, max: P.maxFalse }), falses ? (falses >= P.maxFalse ? 'danger' : 'warn') : '');
      readout.set('data', t('dataReadout', { mb: U().decimal((SEIS_MB_DAY * SPAN_H * Math.min(1, now / D)) / 24, 1), day: SEIS_MB_DAY }));
    }
    function render(status) { labels(); readouts(); draw(); if (status) host.status(status); }

    // ------------------------------------------------------------------ marking
    function eventAt(tx) {
      let best = -1, bestD = Infinity;
      L.events.forEach((e, i) => {
        if (e.ts > now) return;
        const a = e.ts - 0.25, b = Math.min(e.ts + e.dur, now) + 0.15;
        const d = tx < a ? a - tx : tx > b ? tx - b : 0;
        if (d < bestD) { bestD = d; best = i; }
      });
      return bestD <= TAP_SLACK ? best : -1;
    }
    function markAt(tx, fromLine) {
      if (!host.active) return;
      if (tx < Math.max(0, now - L.view) || tx > now) return;
      if (inOff(tx)) { host.status(t('statusOff')); return; }
      const i = eventAt(tx);
      if (i < 0) { tap = { t: tx, until: now + 0.6 * rate }; host.status(t(fromLine ? 'statusNothingLine' : 'statusNothing')); return; }
      if (marked.has(i)) { host.status(t('statusAlready')); return; }
      const e = L.events[i];
      marked.set(i, e.kind);
      if (e.kind === 'quake') { caught++; render(t('statusQuake', { n: caught })); return; }
      falses++;
      render(t(e.kind === 'devil' ? 'statusDevil' : 'statusGust', { n: falses, max: P.maxFalse }));
      if (falses > P.maxFalse) { host.fail(t('failFalse', { n: falses })); render(); }
    }

    cv.node.addEventListener('pointerdown', e => {
      if (!host.active || (e.button != null && e.button > 0)) return;
      const rect = cv.node.getBoundingClientRect(), g = geo();
      const x = e.clientX - rect.left - g.padL;
      if (x < 0 || x > g.pw) return;
      e.preventDefault();
      markAt(now - L.view + (x / g.pw) * L.view, false);
    });
    host.onKey((e, down) => {
      const line = e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS' || (e.code === 'Enter' && !e.target?.closest?.('button'));
      if (!line) return false;
      if (down && !e.repeat) markAt(now - L.view * (1 - PICK), true);
      return true;
    });

    function end() {
      const ratio = caught / Math.max(1, total);
      if (!caught) { host.fail(t('failNone', { total: U().number(INSIGHT_QUAKES) })); render(); return; }
      const stars = ratio >= 1 && falses === 0 ? 3 : ratio >= P.two && falses <= 1 ? 2 : 1;
      host.finish({ stars, summary: t('summary', { caught, total, falses }), metrics: { caught, total, falses, missed: missed.size } });
      render(t('statusDone', { caught, total, falses }));
    }

    host.loop(dt => {
      now = Math.min(D, now + dt * rate);
      let status = '';
      const p = periodOf(hourAt(now, D));
      if (p !== period) {
        if (period && p === 'night') status = t('statusNight');
        else if (period === 'night' && p !== 'night') status = t('statusMorning');
        period = p;
      }
      if (L.off && !offSaid && now >= L.off[0]) { offSaid = true; status = t('statusOffStart'); }
      L.events.forEach((e, i) => {
        if (e.kind === 'quake' && !marked.has(i) && !missed.has(i) && e.ts + e.dur < now - L.view) { missed.add(i); status = t('statusMissed'); }
      });
      draw();
      const c = clock(now);
      if (c !== lastClock) { lastClock = c; readouts(); }
      if (status) host.status(status);
      if (now >= D) end();
    });

    const notes = host.mods.map(m => t(`event.${m}`)).join(' ');
    render(t('statusInit', { watts: U().decimal(SEIS_W, 1), mb: SEIS_MB_DAY }) + (notes ? ` ${notes}` : ''));
    return { render: () => render() };
  }

  MG.register('M-S3', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 46, normal: 44, hard: 44 },
    factVars: U => ({ quakes: U.number(INSIGHT_QUAKES), core: U.distanceKm(CORE_RADIUS_KM, 0) }),
    generate, validate, solve, mount,
  });
})();
