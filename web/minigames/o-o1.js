// O-O1 · Laser to Earth (Oscar / DSOC on Psyche) · aim. Plan: docs/experiments-implementation.md §4.3 and §5.3.
// "Steady beam": keep the laser on the ground station on Earth while the spacecraft vibrates, until the onboard
// memory is empty or the session ends. Real numbers (references/experiments/experiments.md E11 and
// references/experiments/mars-experiments.md EN13, §1): DSOC sent 267 Mbps at 31 million km, 25 Mbps at
// 226 million km and ~8 Mbps at ~400 million km; the Earth–Mars distance runs from 54.6 to 401.4 million km.
// Each run draws the distance (and with it the data rate and the size of the lock ring), the vibration (seeded
// noise), the track of the station as Earth turns, the clouds and the modifier events. The stars compare the data
// sent with the most this layout allows (perfect aim during every clear second).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp, lerp } = MG.lib;

  const DSOC = [[31, 267], [226, 25], [400, 8]]; // real (E11): [million km, Mbps] measured by DSOC
  const MARS_KM = [54.6, 401.4]; // real (mars-experiments.md §1, NSSDCA): Earth–Mars distance, million km
  // derived: the rate between two DSOC points follows the power law through them (log-log interpolation),
  //   rate(d) = r1 · (d / d1)^(ln(r2 / r1) / ln(d2 / d1)); the 226–400 segment continues up to 401.4 million km.
  function rateAt(d) {
    const seg = d <= DSOC[1][0] ? 0 : 1;
    const [d1, r1] = DSOC[seg], [d2, r2] = DSOC[seg + 1];
    return r1 * Math.pow(d / d1, Math.log(r2 / r1) / Math.log(d2 / d1));
  }
  const TIME_SCALE = 120; // game-balance: 1 s of play = 2 min of laser link
  const GRACE_S = 3; // game-balance: the session starts at the first move or after this many seconds
  const KEY_SPEED = 0.4; // game-balance: beam speed with the keys (view widths per second)
  const ASPECT = 0.56; // canvas height / width (fits 412 px tall screens)
  const VIEW = { pad: 0.02 }; // game-balance: the beam stays inside the view, this far from the edges
  const EARTH = { x: 0.5, y: 0.28, r: 0.235 }; // game-balance: Earth disc in the telescope view (view widths)
  const SUN_NOISE = 0.8; // game-balance: lock ring scale when the Sun is near the line of sight
  const FRONT = 1.8; // game-balance: a weather front lasts this many times a normal cloud
  // Body ramps of the identity guide (docs/visual-identity.md §2; RAMPS in web/app.js), dark to light.
  const OCEAN = ['#0b1a3a', '#123a6b', '#1d5f9a', '#2c86ba', '#5fb8dc', '#a8e6f0'];
  const LAND = ['#14261a', '#24432a', '#3d6b3a', '#5f8f4a', '#93b46a', '#cfe0a0'];
  const ICE = ['#8a7a86', '#c9b8b0', '#e9dccb', '#FCE8A6', '#fff6dc', '#ffffff'];
  const SUN = ['#8F241E', '#E04F26', '#F59E0B', '#f8c14a', '#FCE8A6', '#fff7df'];
  const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };

  // game-balance (plan §5.3). dist: Earth–Mars distance drawn for the run (million km, inside the real range);
  // window: session (s of play); clouds: clouds that cross the station, each lasting `cloud` s; drift/driftHz: slow
  // pointing drift (view widths, Hz); jitter: fast vibration (view widths); zone: lock ring radius at the closest
  // distance (it shrinks with √(54.6 / d)); mem: onboard memory as a share of the best possible; stars: shares of the
  // best possible for 1 and 2 stars (3 stars = memory empty).
  const LEVELS = {
    easy: { dist: [54.6, 150], window: 30, clouds: 1, cloud: [3, 4], drift: 0.07, driftHz: 0.12, jitter: 0.006, jitterHz: 1.6, zone: 0.07, mem: 0.6, stars: [0.25, 0.42], mods: 0 },
    normal: { dist: [150, 280], window: 32, clouds: 2, cloud: [3, 4.5], drift: 0.1, driftHz: 0.16, jitter: 0.009, jitterHz: 2, zone: 0.075, mem: 0.62, stars: [0.28, 0.44], mods: 1 },
    hard: { dist: [280, 401.4], window: 34, clouds: 3, cloud: [2.5, 4], drift: 0.12, driftHz: 0.19, jitter: 0.011, jitterHz: 2.4, zone: 0.08, mem: 0.64, stars: [0.3, 0.46], mods: [1, 2] },
  };
  // Modifiers with a real basis:
  //   sunNoise          near solar conjunction (every ~26 months, mars-experiments.md §1) the Sun sits close to the
  //                     line of sight: background light adds noise, so the lock ring is smaller;
  //   cloudFront        clouds over the ground station block the laser (EN13); a front makes one of them much longer;
  //   thrusterPointing  Dawn lost its reaction wheels and pointed with hydrazine thrusters (E8): each pulse kicks the
  //                     spacecraft, and the beam jumps.
  const MODS = ['sunNoise', 'cloudFront', 'thrusterPointing'];

  const r1 = x => Math.round(x * 10) / 10;
  const r3 = x => Math.round(x * 1000) / 1000;
  const polar = (a, d) => ({ x: r3(Math.cos(a) * d), y: r3(Math.sin(a) * d) });
  const sinesOf = (R, hz) => Array.from({ length: 3 }, (_, i) => ({ f: r3(hz * (1 + i * 1.37) * R.float(0.8, 1.25)), p: r3(R.float(0, Math.PI * 2)), a: r3(1 / (i + 1)) }));

  // Seconds of the session without a cloud over the station (cloud intervals may overlap).
  function clearSeconds(L) {
    let covered = 0, reach = 0;
    for (const c of [...L.clouds].sort((a, b) => a.at - b.at)) {
      const s = Math.max(c.at, reach), e = Math.min(L.window, c.at + c.dur);
      if (e > s) covered += e - s;
      reach = Math.max(reach, c.at + c.dur);
    }
    return L.window - covered;
  }

  function generate(R, P, { mods }) {
    const dist = r1(R.float(P.dist[0], P.dist[1]));
    const rate = Math.round(rateAt(dist) * 10) / 10;
    const zone = r3(P.zone * Math.sqrt(MARS_KM[0] / dist) * (mods.includes('sunNoise') ? SUN_NOISE : 1));
    // The station rides Earth's rotation across the disc during the session (game-balance: start 0.1–0.4 Earth radii
    // from the centre, heading roughly across the disc, travel 0.25–0.45 radii per session).
    const a0 = R.float(0, Math.PI * 2), from = polar(a0, R.float(0.1, 0.4) * EARTH.r);
    const heading = a0 + Math.PI + R.float(-1.1, 1.1), travel = R.float(0.25, 0.45) * EARTH.r;
    const r5 = x => Math.round(x * 1e5) / 1e5;
    const station = { x: r3(EARTH.x + from.x), y: r3(EARTH.y + from.y), vx: r5((Math.cos(heading) * travel) / P.window), vy: r5((Math.sin(heading) * travel) / P.window) };
    // Clouds: one per slot of the session, so they never pile up (game-balance: none in the first 4 s or last 3 s).
    const front = mods.includes('cloudFront');
    const n = P.clouds, frontAt = front ? R.int(0, n - 1) : -1;
    const span = [4, P.window - 3], slot = (span[1] - span[0]) / n;
    const clouds = Array.from({ length: n }, (_, i) => {
      const dur = Math.min(slot - 0.6, R.float(P.cloud[0], P.cloud[1]) * (i === frontAt ? FRONT : 1));
      return { at: r1(span[0] + i * slot + R.float(0, Math.max(0, slot - dur - 0.3))), dur: r1(dur), dir: R.chance(0.5) ? 1 : -1, front: i === frontAt };
    });
    const kicks = []; // game-balance: a thruster kick every 4.5–6.5 s moves the beam 0.05–0.08 view widths
    if (mods.includes('thrusterPointing')) {
      for (let at = R.float(3.5, 5); at < P.window - 2; at += R.float(4.5, 6.5)) kicks.push({ at: r1(at), ...polar(R.float(0, Math.PI * 2), R.float(0.05, 0.08)) });
    }
    const L = {
      dist, rate, zone, window: P.window, station, clouds, kicks,
      start: polar(R.float(0, Math.PI * 2), R.float(0.1, 0.16)), // game-balance: the beam starts off the ring
      drift: { amp: P.drift, x: sinesOf(R, P.driftHz), y: sinesOf(R, P.driftHz) },
      jitter: { amp: P.jitter, x: sinesOf(R, P.jitterHz), y: sinesOf(R, P.jitterHz) },
      land: R.sample(Array.from({ length: 16 }, (_, i) => i), 5).sort((a, b) => a - b),
      sun: mods.includes('sunNoise') ? (R.chance(0.5) ? 1 : -1) : 0,
    };
    L.clear = r1(clearSeconds(L));
    L.optimumGb = r1((rate * TIME_SCALE * L.clear) / 1000); // derived: Mbps × link seconds / 1000 = Gb
    L.memoryGb = r1(L.optimumGb * P.mem);
    return L;
  }

  // The station must stay on the disc for the whole session, and most of the session must be clear.
  function validate(L) {
    const end = { x: L.station.x + L.station.vx * L.window, y: L.station.y + L.station.vy * L.window };
    const inside = p => Math.hypot(p.x - EARTH.x, p.y - EARTH.y) <= EARTH.r * 0.82;
    return inside(L.station) && inside(end) && L.clear >= L.window * 0.55 && L.memoryGb > 0;
  }
  // The best possible: the beam locked during every clear second.
  const solve = L => ({ gb: L.optimumGb, clearSeconds: L.clear });

  function palette(node) {
    const cs = getComputedStyle(node);
    const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    return {
      view: v('--bg-viewport', '#17183B'), f0: v('--f0', '#0c0517'), f3: v('--f3', '#24143a'), amber: v('--solar-amber', '#F59E0B'),
      orange: v('--mars-orange', '#E04F26'), coral: v('--coral-hover', '#EE7B57'), safe: v('--safe', '#7EDAC2'),
      cream: v('--starlight-cream', '#FCE8A6'), muted: v('--muted', '#B9B0CE'), amethyst: v('--amethyst', '#9B5DE5'),
    };
  }
  const hexPath = (ctx, x, y, r, rot = 0) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = rot + (i * Math.PI) / 3; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  };

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const C = palette(host.root);
    const gbPerS = (L.rate * TIME_SCALE) / 1000; // derived: Gb sent per second of play while locked
    const sky = Array.from({ length: 46 }, () => ({ x: host.R.float(0, 1), y: host.R.float(0, ASPECT), s: host.R.pick([1, 1, 2]) }));

    const readout = ui.readout(['dist', 'rate', 'time']);
    const badge = ui.el('div', 'mg-badge');
    const view = ui.canvas(ASPECT, 'oo1-view');
    view.node.setAttribute('role', 'img');
    const meters = ui.el('div', 'mg-meters');
    const mMem = ui.meter('');
    meters.append(mMem.node);
    const hint = ui.el('p', 'mg-hint');
    host.body.append(readout.node, badge, view.node, meters, hint);

    const wave = parts => {
      const norm = parts.reduce((s, q) => s + q.a, 0);
      return tt => parts.reduce((s, q) => s + q.a * Math.sin(2 * Math.PI * q.f * tt + q.p), 0) / norm;
    };
    const dx = wave(L.drift.x), dy = wave(L.drift.y), jx = wave(L.jitter.x), jy = wave(L.jitter.y);
    const slow = host.reduced ? 0.5 : 1; // reduced motion: the fast vibration is slower
    let time = 0, vt = 0, started = false, sent = 0, lockTime = 0, done = false;
    let lastStatus = '', eventUntil = -1;
    const kicked = new Set(), clouded = new Set();
    const shake = () => {
      let x = L.drift.amp * dx(vt) + L.jitter.amp * jx(vt * slow), y = L.drift.amp * dy(vt) + L.jitter.amp * jy(vt * slow);
      for (const k of L.kicks) if (time >= k.at) { x += k.x; y += k.y; }
      return { x, y };
    };
    const stationAt = tt => ({ x: L.station.x + L.station.vx * tt, y: L.station.y + L.station.vy * tt });
    const s0 = shake();
    const aim = { x: L.station.x + L.start.x - s0.x, y: L.station.y + L.start.y - s0.y };
    let beam = { x: 0, y: 0 }, st = stationAt(0), locked = false, cloud = null;

    const keys = new Set();
    const begin = () => {
      if (started || done) return;
      started = true;
      eventUntil = -1;
      say(t('statusGo'), 2);
    };
    host.onKey((e, down) => {
      if (!KEYS[e.code]) return false;
      if (down) { keys.add(e.code); begin(); } else keys.delete(e.code);
      return true;
    });
    let drag = null;
    view.node.addEventListener('pointerdown', e => {
      if (!host.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { view.node.setPointerCapture(e.pointerId); } catch { /* gone */ }
      begin();
      e.preventDefault();
    });
    view.node.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id || !host.active) return;
      const w = view.w || 1;
      aim.x += (e.clientX - drag.x) / w; aim.y += (e.clientY - drag.y) / w;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) view.node.addEventListener(ev, () => { drag = null; });

    function say(text, hold = 0) {
      if (hold) eventUntil = vt + hold;
      else if (vt < eventUntil) return;
      if (text !== lastStatus) { lastStatus = text; host.status(text); }
    }
    const gb = x => `${U().decimal(Math.max(0, x), 1)} Gb`;
    const mbps = x => U().decimal(x, 1);

    function labels() {
      readout.set('dist', t('distReadout', { dist: U().distanceKm(L.dist * 1e6, 0) }));
      readout.set('rate', t('rateReadout', { rate: mbps(L.rate) }), 'good');
      hint.textContent = t('hint', { one: Math.round(P.stars[0] * 100), two: Math.round(P.stars[1] * 100) });
      view.node.setAttribute('aria-label', t('viewAria'));
    }

    function hud() {
      const left = Math.max(0, L.window - time);
      readout.set('time', started ? t('timeReadout', { left: Math.ceil(left) }) : t('timeReady'), started && left < 6 ? 'danger' : '');
      const full = sent >= L.memoryGb - 1e-6;
      mMem.label(t('memLabel', { sent: gb(sent), total: gb(L.memoryGb) }));
      mMem.set(sent / L.memoryGb, full ? '' : 'info');
      const state = !started ? '' : cloud ? 'cold' : locked ? 'good' : 'warn';
      badge.className = `mg-badge${state ? ` is-${state}` : ''}`;
      badge.textContent = !started ? t('badgeReady') : cloud ? t('badgeCloud') : locked ? t('badgeLocked', { rate: mbps(L.rate) }) : t('badgeSearching');
    }

    function draw() {
      view.fit();
      const ctx = view.ctx, s = view.w, H = view.h;
      if (!s) return;
      ctx.fillStyle = C.view; ctx.fillRect(0, 0, s, H);
      ctx.fillStyle = C.muted;
      for (const p of sky) ctx.fillRect(Math.round(p.x * s), Math.round(p.y * s), p.s, p.s);
      // Sun glare (sunNoise): a hard-edged wedge of light from one side of the view.
      if (L.sun) {
        const x0 = L.sun > 0 ? s : 0, k = L.sun > 0 ? -1 : 1;
        [[0.42, SUN[1]], [0.3, SUN[2]], [0.18, SUN[4]]].forEach(([w, col]) => {
          ctx.globalAlpha = 0.28; ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + k * w * s, 0); ctx.lineTo(x0 + k * w * s * 0.35, H); ctx.lineTo(x0, H); ctx.closePath(); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      // Earth: a faceted disc lit from the upper left; a few land facets; it turns slowly.
      const ex = EARTH.x * s, ey = EARTH.y * s, er = EARTH.r * s, N = 16, rot = host.reduced ? 0 : vt * 0.01;
      const light = -Math.PI * 0.75;
      for (let i = 0; i < N; i++) {
        const a0 = rot + (i / N) * Math.PI * 2, a1 = rot + ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
        const lit = 0.5 + 0.5 * Math.cos(am - light);
        const ramp = L.land.includes(i) ? LAND : OCEAN;
        ctx.fillStyle = ramp[clamp(Math.round(1 + lit * 3), 0, 5)];
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a0) * er, ey + Math.sin(a0) * er); ctx.lineTo(ex + Math.cos(a1) * er, ey + Math.sin(a1) * er); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 8; i++) {
        const a0 = rot + Math.PI / 8 + (i / 8) * Math.PI * 2, a1 = a0 + Math.PI / 4, am = (a0 + a1) / 2;
        const lit = 0.5 + 0.5 * Math.cos(am - light);
        ctx.fillStyle = (L.land.includes(i * 2) ? LAND : OCEAN)[clamp(Math.round(2 + lit * 3), 0, 5)];
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a0) * er * 0.55, ey + Math.sin(a0) * er * 0.55); ctx.lineTo(ex + Math.cos(a1) * er * 0.55, ey + Math.sin(a1) * er * 0.55); ctx.closePath(); ctx.fill();
      }
      // Ground station and its lock ring.
      const sx = st.x * s, sy = st.y * s, zr = L.zone * s;
      hexPath(ctx, sx, sy, zr, Math.PI / 6);
      if (locked && !cloud) { ctx.fillStyle = C.safe; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.lineWidth = 2; ctx.strokeStyle = locked && !cloud ? C.safe : C.cream; ctx.stroke();
      ctx.fillStyle = C.amber;
      ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx + 4.5, sy + 3.5); ctx.lineTo(sx - 4.5, sy + 3.5); ctx.closePath(); ctx.fill();
      // Clouds: they slide in a little before they cut the signal and out a little after.
      for (const c of L.clouds) {
        const a = c.at - 1.2, b = c.at + c.dur + 1.2;
        if (!started || time < a || time > b) continue;
        const k = (time - a) / (b - a), cx = sx + c.dir * lerp(-0.2, 0.2, k) * s, cy = sy - 0.01 * s;
        const puffs = [[-0.05, 0.01, 0.045], [0, -0.012, 0.06], [0.052, 0.006, 0.042], [0.02, 0.025, 0.04], [-0.025, 0.028, 0.035]];
        puffs.forEach(([ox, oy, r], i) => {
          hexPath(ctx, cx + ox * s * (c.front ? 1.4 : 1), cy + oy * s, r * s * (c.front ? 1.25 : 1), i * 0.4);
          ctx.fillStyle = ICE[2 + (i % 3)]; ctx.globalAlpha = 0.92; ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      // The beam: a reticle where the laser lands.
      const bx = beam.x * s, by = beam.y * s, col = cloud ? C.coral : locked ? C.safe : C.amber;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(bx + ux * 6, by + uy * 6); ctx.lineTo(bx + ux * 14, by + uy * 14); }
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.lineTo(bx + 4, by); ctx.lineTo(bx, by + 4); ctx.lineTo(bx - 4, by); ctx.closePath(); ctx.fill();
      // Session bar along the bottom: clouds ahead in ice, time spent in amber.
      const barY = H - 6, w = s - 16;
      ctx.fillStyle = C.f0; ctx.fillRect(8, barY, w, 4);
      ctx.fillStyle = ICE[2];
      for (const c of L.clouds) ctx.fillRect(8 + (c.at / L.window) * w, barY, (c.dur / L.window) * w, 4);
      ctx.fillStyle = C.amber; ctx.fillRect(8, barY, clamp(time / L.window, 0, 1) * w, 4);
    }

    host.loop((dt, elapsed) => {
      vt = elapsed;
      if (!started && elapsed >= GRACE_S) begin();
      if (started) time += dt;
      let kx = 0, ky = 0;
      for (const c of keys) { kx += KEYS[c][0]; ky += KEYS[c][1]; }
      aim.x += clamp(kx, -1, 1) * KEY_SPEED * dt; aim.y += clamp(ky, -1, 1) * KEY_SPEED * dt;
      const sh = shake();
      aim.x = clamp(aim.x, VIEW.pad - sh.x, 1 - VIEW.pad - sh.x);
      aim.y = clamp(aim.y, VIEW.pad - sh.y, ASPECT - VIEW.pad - sh.y);
      beam = { x: aim.x + sh.x, y: aim.y + sh.y };
      st = stationAt(time);
      locked = Math.hypot(beam.x - st.x, beam.y - st.y) <= L.zone;
      cloud = started ? L.clouds.find(c => time >= c.at && time < c.at + c.dur) || null : null;
      if (started && locked && !cloud) { sent = Math.min(L.memoryGb, sent + gbPerS * dt); lockTime += dt; }

      if (started) {
        for (const k of L.kicks) if (time >= k.at && !kicked.has(k)) { kicked.add(k); say(t('event.kick'), 2.5); }
        for (const c of L.clouds) if (time >= c.at && !clouded.has(c)) { clouded.add(c); say(t(c.front ? 'event.front' : 'event.cloud'), 3); }
        say(cloud ? t('statusCloud') : locked ? t('statusLocked') : t('statusSearching'));
      }
      hud();
      draw();
      if (sent >= L.memoryGb - 1e-6) return end();
      if (time >= L.window) end();
    });

    function end() {
      if (done) return;
      done = true;
      const share = sent / L.optimumGb;
      const full = sent >= L.memoryGb - 1e-6;
      const stars = full ? 3 : share >= P.stars[1] ? 2 : share >= P.stars[0] ? 1 : 0;
      hud(); draw();
      if (!stars) { host.fail(t('failStuck', { left: gb(L.memoryGb - sent), total: gb(L.memoryGb) })); return; }
      host.status(full ? t('statusEmpty', { time: Math.ceil(time) }) : t('statusEnded', { left: gb(L.memoryGb - sent) }));
      host.finish({
        stars,
        summary: t('summary', { sent: gb(sent), best: gb(L.optimumGb), pct: Math.round(share * 100), rate: mbps(L.rate) }),
        metrics: { sentGb: Math.round(sent * 10) / 10, optimumGb: L.optimumGb, memoryGb: L.memoryGb, lockShare: Math.round((lockTime / L.clear) * 100) / 100 },
      });
    }

    // Read-only snapshot for scripted tests (tools/minigame-lab); holds no game logic.
    host.root.mgProbe = () => ({ beam: { ...beam }, station: { ...st }, zone: L.zone, time, started, sent, memory: L.memoryGb, locked, cloud: !!cloud });

    labels();
    hud();
    draw();
    host.status(t('statusInitial', { s: GRACE_S }) + (L.sun ? ` ${t('event.sunNoise')}` : '') + (L.kicks.length ? ` ${t('event.thrusterPointing')}` : '') + (L.clouds.some(c => c.front) ? ` ${t('event.cloudFront')}` : ''));
    lastStatus = '';
    eventUntil = GRACE_S;
    return { render: () => { labels(); hud(); draw(); } };
  }

  MG.register('O-O1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 30, normal: 32, hard: 34 },
    // real (E11): 267 Mbps at 31 million km, ~8 Mbps at ~400 million km
    factVars: U => ({ near: U.distanceKm(31e6, 0), far: U.distanceKm(400e6, 0) }),
    generate, validate, solve, mount,
  });
})();
