// M-S2 · Laser on rocks (Maya / SuperCam and ChemCam) · aim. Plan: docs/experiments-implementation.md §4.3 and §5.3.
// "Sharp shot": fire the laser at small spots on a rock several metres away. The first hits on a spot only blow
// the dust off; the next ones read its chemistry. The mast sways, so the spots drift under the reticle, and the
// shots are limited. Real numbers (references/experiments/mars-experiments.md GE2): SuperCam 10.6 kg, 17.9 W,
// 15.5 Mb per experiment, reads rocks more than 7 m away; ChemCam fires dozens of pulses per spot (GE2b) and passed
// 1 million shots. Each run draws the rock, the distance, the spots (where, how much dust, how many readings) and
// the sway; the stars compare the shots used with the fewest shots that read enough spots on this rock.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const SUPERCAM = { watts: 17.9, mb: 15.5, rangeM: 7 }; // real (GE2)
  const REF_M = 3; // game-balance: distance at which a spot has its base size; derived: apparent size ∝ REF_M / d
  const COOLDOWN_S = 0.35; // game-balance: time between laser bursts (one "shot" = one burst of pulses)
  const KEY_SPEED = 0.32; // game-balance: reticle speed with the keys (view widths per second)
  const ASPECT = 0.58; // canvas height / width
  const TAP = { px: 10, ms: 350 }; // game-balance: a touch shorter and stiller than this fires the laser
  const DEVIL = { boost: 2.2, dur: 5, at: [5, 11] }; // game-balance: dust devil sway boost, length and start (s)
  const FAR_M = [6.4, 7]; // game-balance draw just inside the real > 7 m reach (GE2)
  // real: Fe, Si, Mg and Ca are among the most abundant elements of the Martian crust (docs/minigames.md, H-S1).
  const ELEMENTS = ['Fe', 'Si', 'Mg', 'Ca'];
  // Body ramps of the identity guide (docs/visual-identity.md §2; RAMPS in web/app.js), dark to light.
  const ROCK = ['#1a1022', '#33263a', '#4d3d4c', '#6b5a62', '#8e7c7c', '#b3a196'];
  const GALE = ['#24101f', '#3f1d24', '#6e3324', '#9c5129', '#c27a3a', '#e0a35a'];
  const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };

  // game-balance (plan §5.3). spots on the rock / spots to read; dust: hits that only clear dust per spot; read: hits
  // that read the chemistry per spot; dist: rock distance (m, inside the real reach); spot: spot radius at REF_M
  // (view widths); sway: mast sway (view widths) and its frequency; slack: extra shots above the minimum;
  // three / two: shots above the minimum allowed for 3 and 2 stars.
  const LEVELS = {
    easy: { spots: 4, need: 3, dust: [1, 2], read: [2, 2], dist: [2.5, 4], spot: 0.055, sway: 0.03, swayHz: 0.2, slack: 0.7, three: 2, two: 5, mods: 0 },
    normal: { spots: 5, need: 4, dust: [1, 2], read: [2, 3], dist: [3.5, 5.5], spot: 0.055, sway: 0.042, swayHz: 0.26, slack: 0.45, three: 1, two: 4, mods: 1 },
    hard: { spots: 6, need: 5, dust: [1, 3], read: [2, 3], dist: [5, 7], spot: 0.06, sway: 0.052, swayHz: 0.32, slack: 0.3, three: 1, two: 3, mods: [1, 2] },
  };
  // Modifiers with a real basis:
  //   dustDevil  MEDA counts ~4 whirlwinds a day and >25% carry dust (PH9): one passes, shakes the mast for a few
  //              seconds and dusts again the spots that were already cleared;
  //   heavyDust  rocks wear a dust coat (the reason the first pulses only clear dust; global dust storms, G6):
  //              every spot needs one more hit to clear;
  //   farRock    SuperCam reads rocks more than 7 m away (GE2): the rock is near that reach, so the spots look tiny.
  const MODS = ['dustDevil', 'heavyDust', 'farRock'];

  const r1 = x => Math.round(x * 10) / 10;
  const r3 = x => Math.round(x * 1000) / 1000;
  const sinesOf = (R, hz) => Array.from({ length: 3 }, (_, i) => ({ f: r3(hz * (1 + i * 1.37) * R.float(0.8, 1.25)), p: r3(R.float(0, Math.PI * 2)), a: r3(1 / (i + 1)) }));
  const costOf = s => s.dust + s.read;
  // Fewest shots that read `need` spots: the cheapest spots, one perfect hit at a time (exact).
  const minShots = (spots, need) => spots.map(costOf).sort((a, b) => a - b).slice(0, need).reduce((a, b) => a + b, 0);

  function generate(R, P, { mods }) {
    const dist = r1(mods.includes('farRock') ? R.float(FAR_M[0], FAR_M[1]) : R.float(P.dist[0], P.dist[1]));
    const spotR = r3((P.spot * REF_M) / dist);
    // The rock: a jagged outline around a centre, cut into facets from a light apex (game-balance sizes, view widths).
    const cx = R.float(0.46, 0.54), cy = R.float(0.28, 0.31), rx = R.float(0.32, 0.37), ry = R.float(0.18, 0.21);
    const N = 11;
    const rock = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 + R.float(-0.12, 0.12), k = R.float(0.86, 1.08);
      return [r3(cx + Math.cos(a) * rx * k), r3(cy + Math.sin(a) * ry * k)];
    });
    const apex = [r3(cx + R.float(-0.08, 0.04)), r3(cy - ry * R.float(0.2, 0.45))];
    const gap = Math.max(spotR * 2.6, 0.085); // game-balance: least distance between two spots
    const spots = [];
    for (let guard = 0; spots.length < P.spots && guard < 400; guard++) {
      const a = R.float(0, Math.PI * 2), k = Math.sqrt(R.float(0, 1)) * 0.74;
      const x = r3(cx + Math.cos(a) * rx * k), y = r3(cy + Math.sin(a) * ry * k);
      if (spots.some(s => Math.hypot(s.x - x, s.y - y) < gap)) continue;
      spots.push({ x, y, dust: R.span(P.dust) + (mods.includes('heavyDust') ? 1 : 0), read: R.span(P.read), el: R.pick(ELEMENTS) });
    }
    const best = minShots(spots, P.need);
    const devil = mods.includes('dustDevil') ? { at: r1(R.float(DEVIL.at[0], DEVIL.at[1])), dur: DEVIL.dur } : null;
    return {
      dist, spotR, rock, apex, spots, need: P.need, best,
      shots: Math.ceil(best * (1 + P.slack)) + (devil ? 1 : 0),
      sway: { amp: P.sway, x: sinesOf(R, P.swayHz), y: sinesOf(R, P.swayHz) },
      jitter: { amp: r3(P.sway * 0.18), x: sinesOf(R, 2.2), y: sinesOf(R, 2.2) }, // game-balance: fast mast jitter
      devil,
      start: [r3(cx + R.float(-0.1, 0.1)), r3(Math.min(ASPECT - 0.06, cy + ry + 0.04))],
    };
  }
  const validate = (L, P) => L.spots.length === P.spots && L.shots >= L.best + 2;
  const solve = L => ({ shots: L.best });

  function palette(node) {
    const cs = getComputedStyle(node);
    const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    return {
      view: v('--bg-viewport', '#17183B'), f0: v('--f0', '#0c0517'), amber: v('--solar-amber', '#F59E0B'), orange: v('--mars-orange', '#E04F26'),
      coral: v('--coral-hover', '#EE7B57'), safe: v('--safe', '#7EDAC2'), cream: v('--starlight-cream', '#FCE8A6'), muted: v('--muted', '#B9B0CE'),
      amethyst: v('--amethyst', '#9B5DE5'), void: v('--bg-void', '#11071F'), heading: v('--heading', 'sans-serif'),
    };
  }
  const hexPath = (ctx, x, y, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  };

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const C = palette(host.root);
    const EL_COLOR = { Fe: C.orange, Si: C.cream, Mg: C.safe, Ca: C.amethyst };

    const readout = ui.readout(['read', 'shots', 'dist']);
    const view = ui.canvas(ASPECT, 'ms2-view');
    view.node.setAttribute('role', 'img');
    const fireBtn = ui.button('', 'primary', () => fire());
    fireBtn.classList.add('ms2-fire');
    const controls = ui.el('div', 'mg-controls');
    controls.append(fireBtn);
    const legend = ui.el('div', 'mg-legend');
    const hint = ui.el('p', 'mg-hint');
    host.body.append(readout.node, view.node, controls, legend, hint);

    const wave = parts => {
      const norm = parts.reduce((s, q) => s + q.a, 0);
      return tt => parts.reduce((s, q) => s + q.a * Math.sin(2 * Math.PI * q.f * tt + q.p), 0) / norm;
    };
    const sx = wave(L.sway.x), sy = wave(L.sway.y), jx = wave(L.jitter.x), jy = wave(L.jitter.y);
    const slow = host.reduced ? 0.5 : 1; // reduced motion: the fast mast jitter is slower
    const spots = L.spots.map(s => ({ ...s, dustLeft: s.dust, readDone: 0, done: false }));
    const marks = [];
    let vt = 0, cooldown = 0, used = 0, readCount = 0, finished = false, devilOn = false, devilSeen = false;
    let aim = { x: L.start[0], y: L.start[1] }, flash = null, sway = { x: 0, y: 0 };
    let lastStatus = '', holdUntil = -1;

    const swayAt = tt => {
      const k = L.devil && tt >= L.devil.at && tt < L.devil.at + L.devil.dur ? DEVIL.boost : 1;
      return { x: k * L.sway.amp * sx(tt) + L.jitter.amp * jx(tt * slow), y: k * L.sway.amp * sy(tt) + L.jitter.amp * jy(tt * slow) };
    };
    const shotsLeft = () => L.shots - used;
    const remainingCost = () => spots.filter(s => !s.done).map(s => s.dustLeft + s.read - s.readDone).sort((a, b) => a - b).slice(0, Math.max(0, L.need - readCount)).reduce((a, b) => a + b, 0);

    function say(text, hold = 0) {
      if (hold) holdUntil = vt + hold; else if (vt < holdUntil) return;
      if (text !== lastStatus) { lastStatus = text; host.status(text); }
    }

    function fire() {
      if (!host.active || finished || cooldown > 0 || shotsLeft() <= 0) return;
      cooldown = COOLDOWN_S; used++;
      const p = { x: aim.x - sway.x, y: aim.y - sway.y }; // where the burst lands on the rock
      let hit = null, near = Infinity;
      for (const s of spots) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d <= L.spotR && d < near) { near = d; hit = s; } }
      flash = { ...p, until: vt + 0.16, hit: !!hit };
      if (!hit) { marks.push(p); say(t('statusMiss'), 1.6); }
      else if (hit.done) say(t('statusAlready'), 1.6);
      else if (hit.dustLeft > 0) { hit.dustLeft--; say(hit.dustLeft ? t('statusDust', { left: hit.dustLeft }) : t('statusDustClear'), 1.6); }
      else {
        hit.readDone++;
        if (hit.readDone >= hit.read) {
          hit.done = true; readCount++;
          say(t('statusSpotRead', { el: t(`elements.${hit.el}`), sym: hit.el, mb: mb(SUPERCAM.mb) }), 2.2);
        } else say(t('statusReading', { done: hit.readDone, total: hit.read }), 1.6);
      }
      hud();
      if (readCount >= L.need) return done();
      if (shotsLeft() < remainingCost()) {
        finished = true;
        draw();
        host.fail(t('failShots', { read: readCount, need: L.need }));
      }
    }

    function done() {
      finished = true;
      const extra = used - L.best;
      const stars = extra <= P.three ? 3 : extra <= P.two ? 2 : 1;
      fireBtn.disabled = true;
      host.status(t('statusDone', { read: readCount, mb: mb(readCount * SUPERCAM.mb) }));
      draw();
      host.finish({ stars, summary: t('summary', { read: readCount, shots: used, best: L.best, mb: mb(readCount * SUPERCAM.mb) }), metrics: { shots: used, best: L.best, read: readCount } });
    }
    const mb = x => `${U().decimal(x, 1)} Mb`;

    // Input: a mouse aims where it points and fires on click; touch drags the reticle and a quick tap fires;
    // the keys move the reticle and Space / Enter fire.
    const keys = new Set();
    host.onKey((e, down) => {
      if (KEYS[e.code]) { if (down) keys.add(e.code); else keys.delete(e.code); return true; }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { if (down && !e.repeat) fire(); return true; }
      return false;
    });
    const toView = e => { const r = view.node.getBoundingClientRect(); return { x: (e.clientX - r.left) / (r.width || 1), y: (e.clientY - r.top) / (r.width || 1) }; };
    let drag = null;
    view.node.addEventListener('pointerdown', e => {
      if (!host.active) return;
      if (e.pointerType === 'mouse') { if (e.button !== 0) return; aim = toView(e); fire(); e.preventDefault(); return; }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t0: performance.now() };
      try { view.node.setPointerCapture(e.pointerId); } catch { /* gone */ }
      e.preventDefault();
    });
    view.node.addEventListener('pointermove', e => {
      if (!host.active) return;
      if (e.pointerType === 'mouse') { aim = toView(e); return; }
      if (!drag || e.pointerId !== drag.id) return;
      const w = view.w || 1, ddx = e.clientX - drag.x, ddy = e.clientY - drag.y;
      aim = { x: aim.x + ddx / w, y: aim.y + ddy / w };
      drag.moved += Math.hypot(ddx, ddy); drag.x = e.clientX; drag.y = e.clientY;
    });
    view.node.addEventListener('pointerup', e => {
      if (drag && e.pointerId === drag.id && drag.moved < TAP.px && performance.now() - drag.t0 < TAP.ms) fire();
      drag = null;
    });
    for (const ev of ['pointercancel', 'lostpointercapture']) view.node.addEventListener(ev, () => { drag = null; });

    function labels() {
      fireBtn.textContent = t('fireBtn', { watts: U().decimal(SUPERCAM.watts, 1) });
      legend.replaceChildren(...[['dust', GALE[4]], ['read', C.amethyst], ['done', C.safe]].map(([k, col]) => {
        const s = ui.el('span'); const i = ui.el('i'); i.style.background = col; s.append(i, t(`legend.${k}`)); return s;
      }));
      hint.textContent = t('hint', { three: L.best + P.three, two: L.best + P.two });
      view.node.setAttribute('aria-label', t('viewAria'));
    }
    function hud() {
      readout.set('read', t('readReadout', { read: readCount, need: L.need }), readCount >= L.need ? 'good' : '');
      readout.set('shots', t('shotsReadout', { left: shotsLeft(), total: L.shots }), shotsLeft() <= remainingCost() + 1 ? 'danger' : '');
      readout.set('dist', t('distReadout', { dist: U().distanceM(L.dist, 1) }));
    }

    function draw() {
      view.fit();
      const ctx = view.ctx, s = view.w, H = view.h;
      if (!s) return;
      const ox = sway.x * s, oy = sway.y * s;
      // Sky and ground, shifted with the mast sway (drawn larger than the view so no edge shows).
      ctx.fillStyle = GALE[4]; ctx.fillRect(0, 0, s, H);
      ctx.fillStyle = GALE[5];
      ctx.beginPath(); ctx.moveTo(-20 + ox, -20); ctx.lineTo(s * 0.62 + ox, -20); ctx.lineTo(s * 0.2 + ox, s * 0.42 + oy); ctx.lineTo(-20 + ox, s * 0.42 + oy); ctx.closePath(); ctx.fill();
      const ground = [[-0.1, 0.42], [0.18, 0.4], [0.42, 0.43], [0.7, 0.39], [1.1, 0.42]];
      for (let i = 0; i < ground.length - 1; i++) {
        const [x0, y0] = ground[i], [x1, y1] = ground[i + 1];
        ctx.fillStyle = GALE[i % 2 ? 2 : 3];
        ctx.beginPath(); ctx.moveTo(x0 * s + ox, y0 * s + oy); ctx.lineTo(x1 * s + ox, y1 * s + oy); ctx.lineTo(x1 * s + ox, H + 20); ctx.lineTo(x0 * s + ox, H + 20); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = GALE[1];
      ctx.beginPath(); ctx.moveTo(-20, s * 0.5 + oy); ctx.lineTo(s * 0.4 + ox, s * 0.47 + oy); ctx.lineTo(s + 20, s * 0.52 + oy); ctx.lineTo(s + 20, H + 20); ctx.lineTo(-20, H + 20); ctx.closePath(); ctx.fill();
      // The rock: facets from the apex to each edge, lit from the upper left.
      const P2 = ([x, y]) => [x * s + ox, y * s + oy];
      const [ax, ay] = P2(L.apex);
      L.rock.forEach((v, i) => {
        const [x0, y0] = P2(v), [x1, y1] = P2(L.rock[(i + 1) % L.rock.length]);
        const nx = (y1 - y0), ny = -(x1 - x0), len = Math.hypot(nx, ny) || 1;
        const lit = 0.5 + 0.5 * ((-nx * 0.7 - ny * 0.7) / len);
        ctx.fillStyle = ROCK[clamp(Math.round(1 + lit * 4), 1, 5)];
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x0, y0); ctx.lineTo(x1, y1); ctx.closePath(); ctx.fill();
      });
      // Missed bursts leave small pits.
      ctx.fillStyle = ROCK[0];
      for (const m of marks) ctx.fillRect(m.x * s + ox - 1.5, m.y * s + oy - 1.5, 3, 3);
      // Spots: dust on top, then the bare rock with its element; pips show what is left.
      const rr = L.spotR * s;
      for (const sp of spots) {
        const x = sp.x * s + ox, y = sp.y * s + oy;
        hexPath(ctx, x, y, rr);
        if (sp.dustLeft > 0) { ctx.fillStyle = GALE[clamp(5 - sp.dustLeft, 2, 5)]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = GALE[1]; ctx.stroke(); }
        else {
          ctx.fillStyle = ROCK[1]; ctx.fill();
          const col = EL_COLOR[sp.el];
          ctx.fillStyle = col;
          const d = rr * (0.3 + 0.5 * (sp.readDone / sp.read));
          ctx.beginPath(); ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); ctx.fill();
          ctx.lineWidth = sp.done ? 2.5 : 1.5; ctx.strokeStyle = sp.done ? C.safe : col; hexPath(ctx, x, y, rr); ctx.stroke();
        }
        if (sp.done) {
          ctx.fillStyle = C.cream; ctx.font = `700 ${Math.max(10, Math.round(rr * 0.9))}px ${C.heading}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(sp.el, x, y - rr - 2);
        }
        const pips = sp.dustLeft + sp.read, pw = 4, gap = 2, total = pips * pw + (pips - 1) * gap;
        let px = x - total / 2;
        const py = y + rr + 3;
        for (let k = 0; k < pips; k++, px += pw + gap) {
          const isDust = k < sp.dustLeft, filled = !isDust && k - sp.dustLeft < sp.readDone;
          ctx.fillStyle = isDust ? GALE[5] : filled ? (sp.done ? C.safe : C.amethyst) : C.void;
          ctx.fillRect(px, py, pw, pw);
          if (!isDust && !filled) { ctx.lineWidth = 1; ctx.strokeStyle = C.amethyst; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, pw - 1); }
        }
      }
      // Laser burst: a line from the mast (bottom right) and a spark where it lands.
      if (flash && vt < flash.until) {
        const fx = flash.x * s + ox, fy = flash.y * s + oy;
        if (!host.reduced) { ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s * 0.92, H + 4); ctx.lineTo(fx, fy); ctx.stroke(); }
        ctx.fillStyle = flash.hit ? C.cream : C.coral;
        ctx.beginPath(); ctx.moveTo(fx, fy - 6); ctx.lineTo(fx + 6, fy); ctx.lineTo(fx, fy + 6); ctx.lineTo(fx - 6, fy); ctx.closePath(); ctx.fill();
      }
      // Reticle (fixed to the camera; the rock moves under it).
      const rx = aim.x * s, ry = aim.y * s, col = cooldown > 0 ? C.muted : C.amber;
      ctx.strokeStyle = C.void; ctx.lineWidth = 4;
      const cross = () => { ctx.beginPath(); for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(rx + ux * (rr + 3), ry + uy * (rr + 3)); ctx.lineTo(rx + ux * (rr + 12), ry + uy * (rr + 12)); } ctx.stroke(); };
      cross();
      ctx.strokeStyle = col; ctx.lineWidth = 2; cross();
      hexPath(ctx, rx, ry, rr); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
    }

    host.loop((dt, elapsed) => {
      vt = elapsed;
      cooldown = Math.max(0, cooldown - dt);
      let kx = 0, ky = 0;
      for (const c of keys) { kx += KEYS[c][0]; ky += KEYS[c][1]; }
      aim = { x: clamp(aim.x + clamp(kx, -1, 1) * KEY_SPEED * dt, 0.01, 0.99), y: clamp(aim.y + clamp(ky, -1, 1) * KEY_SPEED * dt, 0.01, ASPECT - 0.01) };
      sway = swayAt(vt);
      if (L.devil && !devilSeen && vt >= L.devil.at) {
        devilSeen = true; devilOn = true;
        let dusted = 0;
        for (const sp of spots) if (!sp.done && sp.dustLeft === 0) { sp.dustLeft = 1; dusted++; }
        say(t('event.dustDevil', { count: dusted }), 3);
        hud();
        if (shotsLeft() < remainingCost()) { finished = true; draw(); host.fail(t('failShots', { read: readCount, need: L.need })); return; }
      }
      if (devilOn && vt >= L.devil.at + L.devil.dur) { devilOn = false; say(t('statusDevilGone'), 1.5); }
      say(t('statusAim'));
      draw();
    });

    // Read-only snapshot for scripted tests (tools/minigame-lab); holds no game logic.
    host.root.mgProbe = () => ({ aim: { ...aim }, sway: { ...sway }, spotR: L.spotR, cooldown, used, shotsLeft: shotsLeft(), spots: spots.map(s => ({ x: s.x, y: s.y, dustLeft: s.dustLeft, readDone: s.readDone, read: s.read, done: s.done })) });

    labels();
    hud();
    draw();
    host.status(t('statusInitial', { need: L.need, dist: U().distanceM(L.dist, 1) })
      + (host.mods.includes('farRock') ? ` ${t('event.farRock', { range: U().distanceM(SUPERCAM.rangeM) })}` : '')
      + (host.mods.includes('heavyDust') ? ` ${t('event.heavyDust')}` : ''));
    lastStatus = '';
    holdUntil = 3;
    return { render: () => { labels(); hud(); draw(); } };
  }

  MG.register('M-S2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 25, normal: 35, hard: 45 },
    factVars: U => ({ range: U.distanceM(SUPERCAM.rangeM) }), // real (GE2): reads rocks more than 7 m away
    generate, validate, solve, mount,
  });
})();
