// H-O1 · Aerobraking (Helena / MRO, TGO) · keep in range. Plan: docs/experiments-implementation.md §5.3.
// Over N passes through periapsis Helena trims the dive altitude so the spacecraft flies inside the drag corridor:
// too deep heats the solar panels, too shallow barely brakes. Each pass has its own seeded air density (a base
// level plus a wobble); the corridor is the altitude band where the heating stays under the limit and the braking
// is still worth it. The lower edge of the corridor brakes most and is the heat limit: hugging it is the best play.
// Real numbers (references/experiments/mars-experiments.md EN10; docs/minigames.md H-O1): MRO braked ~2 m/s and
// saved ~1 kg of propellant per pass, ~400 passes over ~5 months, ~600 kg in total (⚠ sources diverge); TGO took
// about a year (2017–18) with a pause for solar conjunction. Altitudes, heat and integrity are game values.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;
  const TAU = Math.PI * 2;
  const { sin, exp, abs, min, max, log } = Math; // local aliases: fast in the validator's vm context too
  const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;

  const PASS_DV_MS = 2; // real (EN10): MRO slowed ~2 m/s per pass
  const KG_PER_MS = 0.5; // derived (EN10): ~1 kg of propellant saved per ~2 m/s pass
  const NOMINAL_PASS_S = 5; // game-balance: a real pass through the air lasts minutes; here ~5 s
  const DV_RATE = PASS_DV_MS / NOMINAL_PASS_S; // derived: ~2 m/s over a nominal pass flown at the corridor floor
  // game-balance: altitude scale of the dive. The corridor sits below MAVEN's 125 km "deep dips" (real, AT4),
  // deeper in the air; REF_KM, SCALE_KM and the view are game values, not a real density model.
  const REF_KM = 105, SCALE_KM = 7, VIEW = [94, 127];
  const CLIMB_KMS = 13; // game-balance: how fast the planned periapsis moves while a trim is held
  const MAX_FLOOR_KMS = CLIMB_KMS * 0.8; // game-balance: the corridor never moves faster than the player can follow
  const HEAT_GAIN = 80, COOL_PASS = 8, COOL_COAST = 30; // game-balance: panel heat, % per s
  const HEAT_STAR = 80; // game-balance: peak heat above this costs a star (thin heat margin)
  const INTEGRITY_HIT = 25, POP_KM = 8; // game-balance: integrity lost and automatic climb on an overheat
  const COAST_S = 1.7, FIRST_COAST_S = 2.4; // game-balance: coast to apoapsis between passes
  const STORM_RAMP_S = 2; // game-balance: how fast the dust storm swells the air
  const DT = 0.02;

  // game-balance (plan §5.3). passes: dives (docs: 5); ratio: braking at the floor ÷ at the ceiling (corridor
  // width = SCALE_KM·ln ratio: 7.0 / 5.5 / 4.1 km); wobble: [amplitude in ln-density, base Hz] of the seeded
  // density wobble inside a pass; look: seconds of corridor forecast shown ahead; stars: share of the best braking
  // of this layout for 1, 2 and 3 stars (the first one is also the goal).
  const LEVELS = {
    easy: { passes: 4, ratio: 2.7, wobble: [0.22, 0.22], look: 2.0, mods: 0, stars: [0.5, 0.72, 0.86] },
    normal: { passes: 5, ratio: 2.2, wobble: [0.32, 0.28], look: 1.5, mods: 1, stars: [0.6, 0.76, 0.88] },
    hard: { passes: 6, ratio: 1.8, wobble: [0.42, 0.32], look: 1.0, mods: [1, 2], stars: [0.65, 0.8, 0.9] },
  };
  // Modifiers with a real basis:
  //   dustStorm    global dust storms (mars-experiments.md §1 "Dust"; the 2018 storm ended Opportunity): the air
  //                swells mid-run and the corridor rises (the size of the swell is game-balance);
  //   conjunction  solar conjunction blocks commands for ~2–3 weeks (mars-experiments.md §1) and TGO paused its
  //                aerobraking for one (EN10): one pass flies on the altitude set before it, with no trims.
  const MODS = ['dustStorm', 'conjunction'];

  function generate(R, P, { mods }) {
    const [amp, hz] = P.wobble;
    const passes = [];
    let t = FIRST_COAST_S;
    for (let i = 0; i < P.passes; i++) {
      const dur = r2(R.float(4.2, 5.4));
      passes.push({
        start: r2(t), dur, ln: r3(R.float(-0.35, 0.4)), amp, locked: false,
        parts: [
          { f: r3(hz * R.float(0.8, 1.25)), p: r3(R.float(0, TAU)), a: 1 },
          { f: r3(hz * 1.9 * R.float(0.85, 1.2)), p: r3(R.float(0, TAU)), a: 0.4 },
        ],
      });
      t = r2(t + dur + COAST_S);
    }
    let storm = null;
    if (mods.includes('dustStorm')) storm = { pass: R.int(1, P.passes - 2), at: r2(R.float(0.8, 2.2)), ln: r3(R.float(0.38, 0.5)), ramp: STORM_RAMP_S };
    if (mods.includes('conjunction')) {
      const options = passes.map((_, i) => i).filter(i => i >= 1 && i !== storm?.pass);
      passes[R.pick(options)].locked = true;
    }
    const last = passes[passes.length - 1];
    return { passes, storm, startKm: r2(R.float(116, 122)), end: r2(last.start + last.dur + 0.4) };
  }

  // ln of the air density of pass i, tau seconds into it (0 = the reference density at REF_KM).
  function lnDens(L, i, tau) {
    const ps = L.passes[i];
    const norm = ps.parts.reduce((s, x) => s + x.a, 0);
    let ln = ps.ln + (ps.amp * ps.parts.reduce((s, x) => s + x.a * sin(TAU * x.f * tau + x.p), 0)) / norm;
    const st = L.storm;
    if (st && i > st.pass) ln += st.ln;
    else if (st && i === st.pass) ln += st.ln * clamp((tau - st.at) / st.ramp, 0, 1);
    return ln;
  }
  const floorKm = ln => REF_KM + SCALE_KM * ln; // heating rate q = 1 here: the heat limit (lower edge)
  const qAt = (ln, km) => min(4, exp(ln + (REF_KM - km) / SCALE_KM)); // drag/heating rate, 1 = limit

  // Best braking of each pass: tracking the floor exactly (q = 1 all the time). A locked pass (conjunction) keeps
  // one altitude: the best fixed altitude that does not overheat, found by a scan.
  function solve(L, P) {
    const passes = L.passes.map((ps, i) => {
      if (!ps.locked) return r3(DV_RATE * ps.dur);
      const lns = [];
      for (let tau = 0; tau < ps.dur; tau += 0.05) lns.push(lnDens(L, i, tau));
      const top = floorKm(max(...lns)) + SCALE_KM * log(P.ratio);
      let best = 0;
      for (let km = floorKm(min(...lns)) - 3; km <= top; km += 0.1) {
        let heat = 0, dv = 0, ok = true;
        for (const ln of lns) {
          const q = qAt(ln, km);
          dv += DV_RATE * q * 0.05;
          heat = max(0, heat + (HEAT_GAIN * max(0, q - 1) - COOL_PASS) * 0.05);
          if (heat >= 100) { ok = false; break; }
        }
        if (ok && dv > best) best = dv;
      }
      return r3(best);
    });
    return { dv: r3(passes.reduce((s, v) => s + v, 0)), passes };
  }

  // Solvable: the corridor stays on screen and never outruns the trim rate; a locked pass still allows a fair
  // share of its braking at a fixed altitude.
  function validate(L, P) {
    const width = SCALE_KM * log(P.ratio);
    for (let i = 0; i < L.passes.length; i++) {
      const ps = L.passes[i];
      let prev = floorKm(lnDens(L, i, 0));
      for (let tau = DT; tau <= ps.dur; tau += DT) {
        const f = floorKm(lnDens(L, i, tau));
        if (abs(f - prev) / DT > MAX_FLOOR_KMS) return false;
        if (f < VIEW[0] + 4 || f + width > VIEW[1] - 3) return false;
        prev = f;
      }
    }
    const best = solve(L, P);
    return L.passes.every((ps, i) => !ps.locked || best.passes[i] >= 0.6 * DV_RATE * ps.dur);
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const best = solve(L, P).dv;
    const goal = best * P.stars[0];
    const width = SCALE_KM * log(P.ratio);
    const css = (name, fb) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
    const C = {
      viewport: css('--bg-viewport', '#17183B'), void: css('--bg-void', '#11071F'), amber: css('--solar-amber', '#F59E0B'),
      cream: css('--starlight-cream', '#FCE8A6'), amethyst: css('--amethyst', '#9B5DE5'), safe: css('--safe', '#7EDAC2'),
      coral: css('--coral-hover', '#EE7B57'), orange: css('--mars-orange', '#E04F26'), crimson: css('--crimson-alert', '#8F241E'),
      muted: css('--muted', '#B9B0CE'), heading: css('--heading', 'sans-serif'),
      corridor: '#1e6357', heatZone: '#3a1220', limb: ['#7a2c1a', '#a43a20'],
      layers: [[124, '#1b1a42'], [118, '#201b47'], [112, '#251c4a'], [106, '#2b1e4c'], [100, '#311f4c']],
    };
    const stars = Array.from({ length: 14 }, () => [host.R.float(0, 1), host.R.float(0, 0.22)]);

    let T = 0, alt = L.startKm, heat = 0, integrity = 100, dv = 0, overheats = 0, peakHeat = 0;
    let keyUp = false, keyDown = false, dragKm = null, lastPass = -2, q = 0, stormTold = false, wasLocked = false, msgUntil = 0;
    const say = (text, hold = 2.2) => { host.status(text); msgUntil = T + hold; }; // event lines stay up a moment
    const trail = [];

    const readout = ui.readout(['alt', 'pass', 'dv']);
    // Taller view on narrow (portrait) screens; ≤ 0.46 elsewhere so it fits 412 px tall landscape phones.
    const cv = ui.canvas(window.matchMedia?.('(max-width: 640px)').matches ? 0.64 : 0.46, 'ho1-view');
    const labels = ui.el('div', 'mg-gauge-labels');
    const gauge = ui.el('div', 'mg-gauge');
    const G = [-1.9, 0.9]; // ln q shown by the heat × braking bar
    const pct = v => ((clamp(v, G[0], G[1]) - G[0]) / (G[1] - G[0])) * 100;
    const zone = (cls, a, b) => { const z = ui.el('div', `mg-gauge-zone ${cls}`); z.style.left = `${pct(a)}%`; z.style.width = `${pct(b) - pct(a)}%`; gauge.append(z); return z; };
    const zCold = zone('is-cold', G[0], -log(P.ratio)), zGood = zone('is-good', -log(P.ratio), 0), zHot = zone('is-hot', 0, G[1]);
    const needle = ui.el('div', 'mg-needle');
    gauge.append(needle);
    const meters = ui.el('div', 'mg-meters');
    const mDv = ui.meter(''), mHeat = ui.meter(''), mInt = ui.meter('');
    meters.append(mDv.node, mHeat.node, mInt.node);
    const climb = ui.button('', 'primary'), dive = ui.button('', 'primary');
    climb.classList.add('ho1-btn'); dive.classList.add('ho1-btn');
    const holdUp = ui.hold(climb, () => {}), holdDown = ui.hold(dive, () => {});
    const controls = ui.el('div', 'mg-controls');
    controls.append(climb, dive);
    host.body.append(readout.node, cv.node, labels, gauge, meters, controls);

    host.onKey((e, down) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) { keyUp = down; climb.classList.toggle('is-held', down || holdUp.on); return true; }
      if (['ArrowDown', 'KeyS'].includes(e.code)) { keyDown = down; dive.classList.toggle('is-held', down || holdDown.on); return true; }
      return false;
    });
    const kmFromY = y => VIEW[1] - (y / max(1, cv.h)) * (VIEW[1] - VIEW[0]);
    cv.node.addEventListener('pointerdown', e => {
      if (!host.active) return;
      dragKm = kmFromY(e.offsetY);
      try { cv.node.setPointerCapture(e.pointerId); } catch { /* gone */ }
      e.preventDefault();
    });
    cv.node.addEventListener('pointermove', e => { if (dragKm != null) dragKm = kmFromY(e.offsetY); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.node.addEventListener(ev, () => { dragKm = null; });

    const passAt = time => L.passes.findIndex(ps => time >= ps.start && time < ps.start + ps.dur);
    const nextPass = time => L.passes.findIndex(ps => ps.start > time);

    function labelsText() {
      labels.replaceChildren(ui.el('span', '', t('zoneShallow')), ui.el('span', '', t('zoneCorridor')), ui.el('span', '', t('zoneDeep')));
      zCold.textContent = t('tagCold'); zGood.textContent = t('tagGood'); zHot.textContent = t('tagHot');
      climb.textContent = t('climbBtn'); dive.textContent = t('diveBtn');
      mDv.label(t('dvLabel', { goal: U().velocityMs(goal, 1) }));
    }

    function render(status) {
      const i = passAt(T), ps = L.passes[i];
      readout.set('alt', t('altReadout', { alt: U().altitudeKm(alt) }));
      const k = i >= 0 ? i : nextPass(T), n = L.passes.length;
      readout.set('pass', i >= 0 ? t('passReadout', { k: i + 1, n }) : k >= 0 ? t('coastReadout', { k: k + 1, n }) : t('doneReadout', { n }), ps?.locked ? 'danger' : '');
      readout.set('dv', t('dvReadout', { dv: U().velocityMs(dv, 1), goal: U().velocityMs(goal, 1) }), dv >= goal ? 'good' : '');
      const lnq = log(max(1e-3, q));
      needle.hidden = i < 0;
      needle.style.left = `${pct(lnq).toFixed(2)}%`;
      needle.className = `mg-needle${lnq > 0 ? ' is-hot' : lnq >= -log(P.ratio) ? ' is-good' : ' is-cold'}`;
      mDv.set(dv / max(0.01, goal), dv >= goal ? '' : 'info');
      mHeat.set(heat / 100, heat > HEAT_STAR ? 'danger' : heat > 40 ? 'warn' : '');
      mHeat.label(t('heatLabel', { pct: Math.round(heat) }));
      mInt.set(integrity / 100, integrity <= 50 ? 'danger' : '');
      mInt.label(t('integrityLabel', { pct: Math.round(integrity) }));
      if (status) host.status(status);
      draw();
    }

    function draw() {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      if (w < 2 || h < 2) return;
      const yOf = km => (h * (VIEW[1] - km)) / (VIEW[1] - VIEW[0]);
      const x0 = Math.round(w * 0.28), ahead = 2.4, back = 1.2;
      const pps = (w - x0) / ahead;
      const xOf = tt => x0 + (tt - T) * pps;
      const tLook = T + P.look;
      ctx.fillStyle = C.viewport; ctx.fillRect(0, 0, w, h);
      for (const [km, color] of C.layers) { ctx.fillStyle = color; ctx.fillRect(0, yOf(km), w, h); }
      ctx.fillStyle = C.cream;
      for (const [sx, sy] of stars) { const x = sx * w, y = sy * h; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 1.5, y); ctx.lineTo(x, y + 2); ctx.lineTo(x - 1.5, y); ctx.fill(); }
      // Mars below: a faceted limb.
      const limbY = h - max(10, h * 0.07);
      ctx.fillStyle = C.limb[0];
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let s = 0; s <= 8; s++) { const x = (w * s) / 8, u = (s - 4) / 4; ctx.lineTo(x, limbY + u * u * h * 0.04); }
      ctx.lineTo(w, h); ctx.fill();
      ctx.fillStyle = C.limb[1];
      ctx.beginPath(); ctx.moveTo(0, limbY + h * 0.04);
      for (let s = 0; s <= 8; s++) { const x = (w * s) / 8, u = (s - 4) / 4; ctx.lineTo(x, limbY + u * u * h * 0.04); }
      for (let s = 8; s >= 0; s--) { const x = (w * s) / 8, u = (s - 4) / 4; ctx.lineTo(x, limbY + 4 + u * u * h * 0.04); }
      ctx.fill();

      // Corridor of each pass inside the forecast window: heat zone under the floor, green band above it.
      L.passes.forEach((ps, i) => {
        const a = max(T - back, ps.start), b = min(T + ahead, tLook, ps.start + ps.dur);
        if (b <= a) return;
        const pts = [];
        for (let tt = a; ; tt = min(b, tt + 0.05)) { pts.push([xOf(tt), floorKm(lnDens(L, i, tt - ps.start))]); if (tt >= b) break; }
        ctx.fillStyle = C.heatZone;
        ctx.beginPath(); ctx.moveTo(pts[0][0], limbY);
        for (const [x, km] of pts) ctx.lineTo(x, yOf(km));
        ctx.lineTo(pts[pts.length - 1][0], limbY); ctx.fill();
        ctx.fillStyle = C.corridor;
        ctx.beginPath();
        pts.forEach(([x, km], n) => (n ? ctx.lineTo(x, yOf(km)) : ctx.moveTo(x, yOf(km))));
        for (let n = pts.length - 1; n >= 0; n--) ctx.lineTo(pts[n][0], yOf(pts[n][1] + width));
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = C.coral;
        ctx.beginPath(); pts.forEach(([x, km], n) => (n ? ctx.lineTo(x, yOf(km)) : ctx.moveTo(x, yOf(km)))); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = C.safe;
        ctx.beginPath(); pts.forEach(([x, km], n) => (n ? ctx.lineTo(x, yOf(km + width)) : ctx.moveTo(x, yOf(km + width)))); ctx.stroke();
        if (ps.locked) {
          ctx.fillStyle = C.coral; ctx.font = `700 10px ${C.heading}`; ctx.textAlign = 'left';
          ctx.fillText(t('canvasLocked'), max(4, pts[0][0] + 4), yOf(pts[0][1] + width) - 6);
        }
      });
      // Past (left of the spacecraft) is dimmed; beyond the forecast the air is unknown.
      ctx.fillStyle = 'rgba(12,5,23,0.3)'; ctx.fillRect(0, 0, x0, limbY);
      const xl = xOf(tLook);
      if (xl < w) {
        ctx.fillStyle = 'rgba(12,5,23,0.32)'; ctx.fillRect(xl, 0, w - xl, limbY);
        ctx.fillStyle = C.muted; ctx.fillRect(xl, 0, 1, limbY);
        ctx.font = `600 9px ${C.heading}`; ctx.textAlign = 'left';
        const label = t('canvasForecast');
        if (w - xl > ctx.measureText(label).width + 8) ctx.fillText(label, xl + 4, 12);
      }
      // Next pass bracket at the right edge (base density known in advance, like a navigation forecast).
      const j = nextPass(T);
      if (j >= 0 && L.passes[j].start > tLook) {
        const f = floorKm(lnDens(L, j, 0)), x = w - 8;
        ctx.fillStyle = L.passes[j].locked ? C.coral : C.amethyst;
        ctx.fillRect(x, yOf(f + width), 4, yOf(f) - yOf(f + width));
        ctx.fillRect(x - 6, yOf(f + width), 6, 2); ctx.fillRect(x - 6, yOf(f) - 2, 6, 2);
        ctx.font = `700 9px ${C.heading}`; ctx.textAlign = 'right';
        ctx.fillText(L.passes[j].locked ? t('canvasLocked') : t('canvasNext'), x - 8, yOf(f + width) - 4);
      }
      // Altitude ticks.
      ctx.font = `600 9px ${C.heading}`; ctx.textAlign = 'left'; ctx.fillStyle = C.muted;
      for (const km of [100, 110, 120]) { const y = yOf(km); if (y < 20 || y > limbY - 4) continue; ctx.fillRect(0, y, 6, 1); ctx.fillText(U().altitudeKm(km), 9, y + 3); }
      // Trail and spacecraft.
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach(([tt, km], n) => (n ? ctx.lineTo(xOf(tt), yOf(km)) : ctx.moveTo(xOf(tt), yOf(km))));
      ctx.stroke();
      const y = yOf(alt), i = passAt(T);
      if (i >= 0 && q > 1) {
        const k = 6 + 12 * min(1, q - 1);
        ctx.fillStyle = C.coral; ctx.beginPath(); ctx.moveTo(x0 + 9, y - 6); ctx.lineTo(x0 + 9 + k, y); ctx.lineTo(x0 + 9, y + 6); ctx.fill();
      }
      ctx.fillStyle = C.amethyst;
      ctx.beginPath(); ctx.moveTo(x0 - 20, y - 3); ctx.lineTo(x0 - 6, y - 3); ctx.lineTo(x0 - 8, y + 2); ctx.lineTo(x0 - 22, y + 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 + 6, y - 3); ctx.lineTo(x0 + 20, y - 3); ctx.lineTo(x0 + 18, y + 2); ctx.lineTo(x0 + 4, y + 2); ctx.fill();
      ctx.fillStyle = C.cream;
      ctx.beginPath(); ctx.moveTo(x0 - 4, y - 7); ctx.lineTo(x0 + 4, y - 7); ctx.lineTo(x0 + 8, y); ctx.lineTo(x0 + 4, y + 7); ctx.lineTo(x0 - 4, y + 7); ctx.lineTo(x0 - 8, y); ctx.fill();
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(x0 - 4, y - 7); ctx.lineTo(x0 + 4, y - 7); ctx.lineTo(x0, y - 12); ctx.fill();
      // Phase label.
      const ps = L.passes[i];
      ctx.font = `700 10px ${C.heading}`; ctx.textAlign = 'left';
      ctx.fillStyle = ps?.locked ? C.coral : i >= 0 ? C.cream : C.muted;
      ctx.fillText(i >= 0 ? t('canvasPass', { k: i + 1, n: L.passes.length }) : t('canvasCoast'), 8, 14);
    }

    function finishRun() {
      const score = min(1, dv / max(0.01, best));
      const kg = dv * KG_PER_MS;
      climb.disabled = dive.disabled = true;
      if (dv < goal) {
        render();
        host.fail(t('failShort', { dv: U().velocityMs(dv, 1), goal: U().velocityMs(goal, 1) }));
        return;
      }
      const penalty = overheats > 0 ? overheats : peakHeat > HEAT_STAR ? 1 : 0;
      const stars = max(1, MG.lib.starsFrom(score, P.stars) - penalty);
      render(t('statusDone', { dv: U().velocityMs(dv, 1), kg: U().massKg(kg) }));
      host.finish({
        stars,
        summary: t('summary', { dv: U().velocityMs(dv, 1), pct: Math.round(score * 100), kg: U().massKg(kg), over: overheats }),
        metrics: { dv: r2(dv), best, score: r3(score), overheats, integrity, peakHeat: Math.round(peakHeat), propellantKg: r2(kg) },
      });
    }

    host.loop(dt => {
      T += dt;
      const i = passAt(T), ps = L.passes[i];
      if (i !== lastPass) {
        if (i >= 0) say(ps.locked ? t('statusLocked') : t('statusPass', { k: i + 1, n: L.passes.length }), ps.locked ? 99 : 1.2);
        else { const j = nextPass(T); if (j >= 0 && lastPass >= 0) say(L.passes[j].locked ? t('event.conjunction') : t('statusCoast', { k: j + 1, n: L.passes.length })); }
        lastPass = i;
      }
      if (L.storm && i === L.storm.pass && T - ps.start >= L.storm.at && !stormTold) {
        stormTold = true;
        say(t('event.dustStorm'), 3);
      }
      let dir = (keyUp || holdUp.on ? 1 : 0) - (keyDown || holdDown.on ? 1 : 0);
      if (!dir && dragKm != null) dir = clamp((dragKm - alt) / 1.2, -1, 1);
      const locked = !!ps?.locked;
      if (locked !== wasLocked) { // no commands during a conjunction pass: drop every held trim
        wasLocked = locked;
        climb.disabled = dive.disabled = locked;
        holdUp.release(); holdDown.release(); dragKm = null;
        climb.classList.remove('is-held'); dive.classList.remove('is-held');
      }
      if (!locked) alt = clamp(alt + dir * CLIMB_KMS * dt, VIEW[0] + 1, VIEW[1] - 1);
      let status = '';
      if (ps) {
        q = qAt(lnDens(L, i, T - ps.start), alt);
        dv += DV_RATE * q * dt;
        heat = max(0, heat + (HEAT_GAIN * max(0, q - 1) - COOL_PASS) * dt);
        if (!locked && T >= msgUntil) status = q > 1 ? t('statusDeep') : q >= 1 / P.ratio ? t('statusGood') : t('statusShallow');
      } else {
        q = 0;
        heat = max(0, heat - COOL_COAST * dt);
      }
      peakHeat = max(peakHeat, heat);
      trail.push([T, alt]);
      while (trail.length && trail[0][0] < T - 1.4) trail.shift();
      if (heat >= 100) {
        overheats++;
        integrity = max(0, integrity - INTEGRITY_HIT);
        heat = 55; alt = min(VIEW[1] - 1, alt + POP_KM);
        if (integrity <= 0) {
          render();
          climb.disabled = dive.disabled = true;
          host.fail(t('failIntegrity'));
          return;
        }
        say(t('statusOverheat', { hit: INTEGRITY_HIT }));
        render();
        return;
      }
      if (T >= L.end) { finishRun(); return; }
      render(status);
    });

    labelsText();
    render(t('statusInitial', { goal: U().velocityMs(goal, 1), n: L.passes.length }));
    return { render: () => { labelsText(); render(); } };
  }

  MG.register('H-O1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 28, normal: 36, hard: 45 },
    // real (EN10): ~2 m/s and ~1 kg per pass, ~600 kg in total (⚠ sources diverge)
    factVars: U => ({ dv: U.velocityMs(PASS_DV_MS), kg: U.massKg(1), total: U.massKg(600) }),
    generate, validate, solve, mount,
  });
})();
