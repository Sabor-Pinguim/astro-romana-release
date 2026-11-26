// M-S6 · Martian greenhouse (Maya / Veggie, APH, Mars-soil-simulant tests) · keep in range, two variables.
// Plan: docs/experiments-implementation.md §5.3. Over a few compressed sols Maya keeps the soil water and the light
// of a small crewed greenhouse inside their bands. Water comes in pulses (tap to irrigate; it soaks in over a
// moment) and drains faster under strong light; the light is the sunlight through the window (day and night)
// plus the grow LEDs, set in steps. Too dry or too wet, too dark or too bright, and the plants suffer; inside both
// bands they grow. Each run draws the sunlight of every sol, the time of day it starts and the starting soil water.
// Real numbers (references/experiments/experiments.md B4, mars-experiments.md BI7; docs/minigames.md M-S6): Veggie
// draws ~70 W; in the first ISS crop (2014) a pillow failed to germinate and two plants died of water stress; the
// first space lettuce was eaten in 2015; 10 crops grew in a Mars-soil simulant with organic matter (2019), spinach
// did poorly; no plant has ever grown in real Martian soil. Water and light are on game scales (0–100).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;
  const { sin, cos, min, max, floor } = Math; // local aliases: fast in the validator's vm context too
  const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;

  const VEGGIE_W = 70; // real (BI7, B4): Veggie draws ~70 W
  const LED_STEPS = 5; // game-balance: LED levels 0–5; each one is VEGGIE_W / LED_STEPS of power
  const LED_LIGHT = 13; // game-balance: light (0–100 scale) added by each LED level
  const SUN_PEAK = [38, 50]; // game-balance: peak sunlight through the window on a clear sol (game scale)
  const DAY = 0.55, RAMP = 0.35; // game-balance: share of a sol in daylight; share of the day spent rising/setting
  const DRAIN_BASE = 2, DRAIN_LIGHT = 3.2; // game-balance: soil water lost per s (+ more under strong light)
  const PULSE = 12, SOAK_S = 0.7; // game-balance: water added by one tap and how long it takes to soak in
  const HURT_WATER = 9, HURT_LIGHT = 4, HEAL = 1.5; // game-balance: health % per s out of / inside the bands
  const HEALTH_STAR = 50; // game-balance: ending below this health costs a star
  const GRACE_S = 2.5; // game-balance: the seeds do not suffer during the first seconds (time to read the gauges)
  const STORM_SUN = 0.3, CLOG_S = 8, SIMULANT_DRAIN = 1.3, SIMULANT_NARROW = 4; // game-balance (modifiers)

  // game-balance (plan §5.3). sols and sol: compressed sols and seconds of play per sol; water and light: bands on
  // the game scales; stars: share of the growth the reference solver gets on this layout for 1 (sprout), 2
  // (leaves) and 3 (ready to harvest) stars. Below the first the seeds do not germinate.
  const LEVELS = {
    easy: { sols: 3, sol: 11, water: [38, 78], light: [30, 72], mods: 0, stars: [0.4, 0.62, 0.82] },
    normal: { sols: 4, sol: 10, water: [42, 72], light: [35, 66], mods: 1, stars: [0.45, 0.68, 0.86] },
    hard: { sols: 5, sol: 9, water: [47, 68], light: [40, 62], mods: [1, 2], stars: [0.5, 0.72, 0.88] },
  };
  // Modifiers with a real basis:
  //   dustStorm  global dust storms (mars-experiments.md §1 "Dust"; the 2018 storm ended Opportunity): the window
  //              light drops for a sol or two and the LEDs must make up for it;
  //   wickClog   in the first Veggie crop (2014) two plants died of water stress (experiments.md B4): the watering
  //              wick clogs and each pulse delivers half for a few seconds;
  //   simulant   crops grown in Mars-soil simulant (2019, BI7; spinach did poorly): the soil drains faster and its
  //              water band is narrower.
  const MODS = ['dustStorm', 'wickClog', 'simulant'];

  function generate(R, P, { mods }) {
    const sols = Array.from({ length: P.sols }, () => ({ sun: r2(R.float(SUN_PEAK[0], SUN_PEAK[1])) }));
    if (mods.includes('dustStorm')) {
      const k = R.int(1, P.sols - 1), len = P.sols >= 4 && R.chance(0.5) ? 2 : 1;
      for (let i = k; i < min(P.sols, k + len); i++) { sols[i].sun = r2(sols[i].sun * STORM_SUN); sols[i].storm = true; }
    }
    const total = P.sols * P.sol;
    const simulant = mods.includes('simulant');
    const water = simulant ? [P.water[0] + SIMULANT_NARROW / 2, P.water[1] - SIMULANT_NARROW / 2] : P.water.slice();
    return {
      sols, total, phase0: r3(R.float(0.05, 0.85)), water, drain: simulant ? SIMULANT_DRAIN : 1,
      water0: r2(R.float(water[0] - 8, water[0] + 6)), led0: R.int(0, 2),
      clog: mods.includes('wickClog') ? { at: r2(R.float(total * 0.2, total * 0.7)), dur: CLOG_S } : null,
    };
  }

  // Sunlight through the window at time t: a trapezoid over the day part of each sol (sunrise, plateau, sunset).
  function sunAt(L, P, t) {
    const s = t / P.sol + L.phase0, i = min(L.sols.length - 1, floor(t / P.sol)), ph = s - floor(s);
    if (ph >= DAY) return 0;
    const u = ph / DAY, ramp = u < RAMP ? u / RAMP : u > 1 - RAMP ? (1 - u) / RAMP : 1;
    return L.sols[max(0, i)].sun * (0.5 - 0.5 * cos(Math.PI * ramp));
  }
  const isDay = (L, P, t) => { const s = t / P.sol + L.phase0; return s - floor(s) < DAY; };
  const clogged = (L, t) => !!L.clog && t >= L.clog.at && t < L.clog.at + L.clog.dur;
  const drainOf = (L, light) => (DRAIN_BASE + (DRAIN_LIGHT * light) / 100) * L.drain;

  // One step of the greenhouse (shared by the solver and the game). s = { water, pending, health, growth, led }.
  function step(L, P, s, t, dt) {
    const light = sunAt(L, P, t) + s.led * LED_LIGHT;
    const soak = min(s.pending, (PULSE / SOAK_S) * dt);
    s.pending -= soak;
    s.water = clamp(s.water + soak - drainOf(L, light) * dt, 0, 100);
    const [wl, wh] = L.water, [ll, lh] = P.light;
    const wIn = s.water >= wl && s.water <= wh, lIn = light >= ll && light <= lh;
    let hurt = 0;
    if (!wIn) hurt += HURT_WATER * (s.water < wl - 12 || s.water > wh + 12 ? 2 : 1);
    if (!lIn) hurt += HURT_LIGHT;
    if (t < GRACE_S) hurt = 0;
    s.health = clamp(s.health + (hurt ? -hurt : HEAL) * dt, 0, 100);
    if (wIn && lIn) s.growth += (s.health / 100) * dt;
    return { light, wIn, lIn };
  }

  // Reference grower: picks the LED level that puts the light nearest the middle of its band a moment ahead and
  // waters when the soil nears the dry edge. growth = seconds of full-health growth.
  function solve(L, P) {
    const dt = 0.05, s = { water: L.water0, pending: 0, health: 100, growth: 0, led: L.led0 };
    const mid = (P.light[0] + P.light[1]) / 2;
    let wait = 0;
    for (let t = 0; t < L.total; t += dt) {
      const sun = sunAt(L, P, t + 0.3);
      s.led = clamp(Math.round((mid - sun) / LED_LIGHT), 0, LED_STEPS);
      wait -= dt;
      if (wait <= 0 && s.water + s.pending < L.water[0] + 6) { s.pending += PULSE * (clogged(L, t) ? 0.5 : 1); wait = 0.25; }
      step(L, P, s, t, dt);
    }
    return { growth: r2(s.growth), health: r2(s.health) };
  }

  // Solvable: there is always an LED level that keeps the light in its band, and the reference grower reaches harvest.
  function validate(L, P) {
    for (let t = 0; t < L.total; t += 0.1) {
      const sun = sunAt(L, P, t);
      let ok = false;
      for (let k = 0; k <= LED_STEPS; k++) { const v = sun + k * LED_LIGHT; if (v >= P.light[0] + 2 && v <= P.light[1] - 2) ok = true; }
      if (!ok) return false;
    }
    const s = solve(L, P);
    return s.growth >= L.total * 0.8 && s.health >= 80;
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const best = solve(L, P).growth;
    const css = (name, fb) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
    const C = {
      viewport: css('--bg-viewport', '#17183B'), amber: css('--solar-amber', '#F59E0B'), cream: css('--starlight-cream', '#FCE8A6'),
      orange: css('--mars-orange', '#E04F26'), muted: css('--muted', '#B9B0CE'), amethyst: css('--amethyst', '#9B5DE5'),
      coral: css('--coral-hover', '#EE7B57'), f1: css('--f1', '#160b25'), f2: css('--f2', '#1D1128'), f3: css('--f3', '#24143a'), f4: css('--f4', '#281147'),
      heading: css('--heading', 'sans-serif'), leaf: ['#2BB673', '#1f8f59'], sick: ['#a39a4a', '#7d7438'],
      soil: ['#8a5a3c', '#6b4330', '#4a2c20', '#2c1a14'], sky: ['#b8643c', '#7a4a35'], wall: ['#2a1d40', '#221735'],
    };
    const s = { water: L.water0, pending: 0, health: 100, growth: 0, led: L.led0 };
    let time = 0, lastSol = -1, lastDay = null, msgUntil = 0, told = { clog: false, storm: new Set() }, view = { light: 0, wIn: true, lIn: true };

    const readout = ui.readout(['sol', 'led', 'stage']);
    const cv = ui.canvas(window.matchMedia?.('(max-width: 640px)').matches ? 0.62 : 0.42, 'ms6-view');
    const gauges = ui.el('div', 'ms6-gauges');
    const G = [0, 100];
    const pct = v => ((clamp(v, G[0], G[1]) - G[0]) / (G[1] - G[0])) * 100;
    function makeGauge() {
      const wrap = ui.el('div', 'ms6-gauge');
      const head = ui.el('div', 'mg-gauge-labels');
      const g = ui.el('div', 'mg-gauge');
      const zone = cls => { const z = ui.el('div', `mg-gauge-zone ${cls}`); g.append(z); return z; };
      const z = [zone('is-cold'), zone('is-good'), zone('is-hot')];
      const needle = ui.el('div', 'mg-needle');
      g.append(needle);
      wrap.append(head, g);
      gauges.append(wrap);
      return {
        head, needle, z,
        place(lo, hi) { const b = [G[0], lo, hi, G[1]]; z.forEach((zz, i) => { zz.style.left = `${pct(b[i])}%`; zz.style.width = `${pct(b[i + 1]) - pct(b[i])}%`; }); },
      };
    }
    const gW = makeGauge(), gL = makeGauge();
    gW.place(L.water[0], L.water[1]); gL.place(P.light[0], P.light[1]);
    const growth = ui.el('div', 'ms6-growth');
    const gLabel = ui.el('span', 'mg-meter-label'), gTrack = ui.el('div', 'mg-track'), gFill = ui.el('div', 'mg-fill');
    const ticks = [P.stars[0] / P.stars[2], P.stars[1] / P.stars[2]].map(f => { const i = ui.el('i', 'ms6-tick'); i.style.left = `${f * 100}%`; return i; });
    gTrack.append(gFill, ...ticks);
    growth.append(gLabel, gTrack);
    const mHealth = ui.meter('');
    const meters = ui.el('div', 'mg-meters');
    meters.append(growth, mHealth.node);
    const waterBtn = ui.button('', 'primary', () => irrigate());
    waterBtn.classList.add('ms6-water');
    const ledDown = ui.button('', '', () => setLed(-1)), ledUp = ui.button('', '', () => setLed(1));
    ledDown.classList.add('ms6-led'); ledUp.classList.add('ms6-led');
    const controls = ui.el('div', 'mg-controls ms6-controls');
    controls.append(ledDown, waterBtn, ledUp);
    host.body.append(readout.node, cv.node, gauges, controls, meters);

    function irrigate() {
      if (!host.active) return;
      s.pending += PULSE * (clogged(L, time) ? 0.5 : 1);
      waterBtn.classList.add('is-held');
      host.after(140, () => waterBtn.classList.remove('is-held'));
    }
    function setLed(d) { if (host.active) { s.led = clamp(s.led + d, 0, LED_STEPS); render(); } }
    host.onKey((e, down) => {
      const k = e.code;
      if (['Space', 'ArrowUp', 'KeyW'].includes(k)) { if (down && !e.repeat) irrigate(); return true; }
      if (['ArrowLeft', 'KeyA'].includes(k)) { if (down && !e.repeat) setLed(-1); return true; }
      if (['ArrowRight', 'KeyD'].includes(k)) { if (down && !e.repeat) setLed(1); return true; }
      return false;
    });

    const scoreOf = () => min(1, s.growth / max(0.01, best));
    const stageOf = sc => (sc >= P.stars[2] ? 3 : sc >= P.stars[1] ? 2 : sc >= P.stars[0] ? 1 : 0);

    function labelsText() {
      gW.head.replaceChildren(ui.el('span', '', t('waterDry')), ui.el('span', '', t('waterName')), ui.el('span', '', t('waterWet')));
      gL.head.replaceChildren(ui.el('span', '', t('lightDim')), ui.el('span', '', t('lightName')), ui.el('span', '', t('lightBright')));
      gW.z[0].textContent = t('tagDry'); gW.z[1].textContent = '✓'; gW.z[2].textContent = t('tagSoggy');
      gL.z[0].textContent = t('tagDim'); gL.z[1].textContent = '✓'; gL.z[2].textContent = t('tagHarsh');
      waterBtn.textContent = t('waterBtn');
      ledDown.textContent = t('ledDown'); ledUp.textContent = t('ledUp');
    }

    function render(status) {
      const sol = min(L.sols.length - 1, floor(time / P.sol)), day = isDay(L, P, time);
      const light = sunAt(L, P, time) + s.led * LED_LIGHT;
      const wIn = s.water >= L.water[0] && s.water <= L.water[1], lIn = light >= P.light[0] && light <= P.light[1];
      readout.set('sol', t('solReadout', { k: sol + 1, n: L.sols.length, part: t(day ? 'day' : 'night') }));
      readout.set('led', t('ledReadout', { level: s.led, max: LED_STEPS, watts: Math.round((s.led / LED_STEPS) * VEGGIE_W) }));
      const sc = scoreOf(), stage = stageOf(sc);
      readout.set('stage', t(`stage.${stage}`), stage >= 2 ? 'good' : '');
      gW.needle.style.left = `${pct(s.water).toFixed(2)}%`;
      gW.needle.className = `mg-needle${wIn ? ' is-good' : s.water > L.water[1] ? ' is-hot' : ' is-cold'}`;
      gL.needle.style.left = `${pct(light).toFixed(2)}%`;
      gL.needle.className = `mg-needle${lIn ? ' is-good' : light > P.light[1] ? ' is-hot' : ' is-cold'}`;
      gFill.style.width = `${clamp(sc / P.stars[2], 0, 1) * 100}%`;
      gFill.className = `mg-fill${stage >= 1 ? '' : ' is-info'}`;
      gLabel.textContent = t('growthLabel', { pct: Math.round(clamp(sc / P.stars[2], 0, 1) * 100) });
      mHealth.set(s.health / 100, s.health < HEALTH_STAR ? 'danger' : s.health < 80 ? 'warn' : '');
      mHealth.label(t('healthLabel', { pct: Math.round(s.health) }));
      ledDown.disabled = !host.active || s.led <= 0; ledUp.disabled = !host.active || s.led >= LED_STEPS;
      if (status) host.status(status);
      view = { light, wIn, lIn, sol, day };
      draw();
    }

    function draw() {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      if (w < 2 || h < 2) return;
      const top = 14; // sol strip
      // Sol strip: day/night of every sol, storm sols hatched, playhead.
      const n = L.sols.length, sw = w / n;
      L.sols.forEach((sol, i) => {
        for (let k = 0; k < 24; k++) {
          const tt = (i + k / 24) * P.sol, x = i * sw + (k / 24) * sw;
          ctx.fillStyle = isDay(L, P, tt) ? (sol.storm ? C.sky[1] : C.sky[0]) : C.f1;
          ctx.fillRect(floor(x), 0, Math.ceil(sw / 24) + 1, top - 3);
        }
        ctx.fillStyle = C.f3; ctx.fillRect(floor(i * sw), 0, 2, top - 3);
      });
      ctx.fillStyle = C.cream; ctx.fillRect(clamp((time / L.total) * w, 0, w - 2), 0, 2, top);
      // Wall and window.
      const y0 = top, hh = h - top;
      ctx.fillStyle = C.wall[0]; ctx.fillRect(0, y0, w, hh);
      ctx.fillStyle = C.wall[1]; ctx.fillRect(0, y0 + hh * 0.62, w, hh * 0.38);
      const wx = w * 0.05, wy = y0 + hh * 0.12, ww = w * 0.32, wh = hh * 0.5;
      const sun = sunAt(L, P, time), storm = L.sols[view.sol]?.storm;
      ctx.fillStyle = view.day ? (storm ? C.sky[1] : C.sky[0]) : C.viewport;
      ctx.beginPath(); ctx.moveTo(wx + 10, wy); ctx.lineTo(wx + ww, wy); ctx.lineTo(wx + ww, wy + wh - 10); ctx.lineTo(wx + ww - 10, wy + wh); ctx.lineTo(wx, wy + wh); ctx.lineTo(wx, wy + 10); ctx.fill();
      if (view.day) {
        const s0 = time / P.sol + L.phase0, u = (s0 - floor(s0)) / DAY;
        const sx = wx + ww * (0.1 + 0.8 * u), sy = wy + wh * (0.75 - 0.55 * sin(Math.PI * u));
        const r = 6 + (sun / SUN_PEAK[1]) * 3;
        ctx.fillStyle = storm ? '#c9a27a' : C.cream;
        ctx.beginPath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r, sy); ctx.fill();
      } else {
        ctx.fillStyle = C.cream;
        for (const [a, b] of [[0.2, 0.25], [0.55, 0.4], [0.8, 0.2], [0.35, 0.6]]) ctx.fillRect(wx + ww * a, wy + wh * b, 2, 2);
      }
      ctx.fillStyle = C.orange; // Mars ground in the window
      ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + wh * 0.82); ctx.lineTo(wx + ww * 0.4, wy + wh * 0.76); ctx.lineTo(wx + ww, wy + wh * 0.86); ctx.lineTo(wx + ww - 10, wy + wh); ctx.fill();
      // LED bar over the tray.
      const tx = w * 0.44, tw = w * 0.5, ly = y0 + hh * 0.1;
      for (let k = 0; k < LED_STEPS; k++) {
        ctx.fillStyle = k < s.led ? C.amber : C.f3;
        ctx.fillRect(tx + (k * tw) / LED_STEPS + 2, ly, tw / LED_STEPS - 4, 7);
      }
      if (s.led) {
        ctx.fillStyle = 'rgba(245,158,11,0.10)';
        ctx.beginPath(); ctx.moveTo(tx, ly + 7); ctx.lineTo(tx + tw, ly + 7); ctx.lineTo(tx + tw + 8, y0 + hh * 0.72); ctx.lineTo(tx - 8, y0 + hh * 0.72); ctx.fill();
      }
      // Tray of soil: darker when wet; a water film when soggy.
      const ty = y0 + hh * 0.72, th = hh * 0.2;
      const wet = s.water < L.water[0] ? 0 : s.water <= (L.water[0] + L.water[1]) / 2 ? 1 : s.water <= L.water[1] ? 2 : 3;
      ctx.fillStyle = C.f4;
      ctx.beginPath(); ctx.moveTo(tx - 10, ty); ctx.lineTo(tx + tw + 10, ty); ctx.lineTo(tx + tw, ty + th); ctx.lineTo(tx, ty + th); ctx.fill();
      ctx.fillStyle = C.soil[wet];
      ctx.fillRect(tx - 6, ty, tw + 12, th * 0.35);
      if (wet === 3) { ctx.fillStyle = C.amethyst; ctx.fillRect(tx - 6, ty - 2, tw + 12, 3); }
      // Plants: size from growth, colour from health.
      const g = clamp(scoreOf() / P.stars[2], 0, 1), sick = s.health < 60;
      for (let p = 0; p < 3; p++) {
        const px = tx + tw * (0.2 + p * 0.3), base = ty;
        if (g < 0.08) { ctx.fillStyle = C.soil[0]; ctx.fillRect(px - 2, base - 3, 4, 3); continue; }
        const hgt = 6 + g * hh * 0.42, leaves = 1 + floor(g * 5);
        ctx.fillStyle = sick ? C.sick[1] : C.leaf[1];
        ctx.fillRect(px - 1, base - hgt, 2, hgt);
        for (let k = 0; k < leaves; k++) {
          // Faceted leaf: a light upper facet and a dark lower facet sharing the midrib.
          const yy = base - hgt * (0.2 + (0.75 * k) / max(1, leaves)), side = (k + p) % 2 ? 1 : -1;
          const len = (8 + g * 16) * (1 - (0.35 * k) / max(1, leaves)), tx2 = px + side * len, ty2 = yy - len * 0.5;
          ctx.fillStyle = sick ? C.sick[0] : C.leaf[0];
          ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(tx2, ty2); ctx.lineTo(px + side * len * 0.4, yy - len * 0.45); ctx.fill();
          ctx.fillStyle = sick ? C.sick[1] : C.leaf[1];
          ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(tx2, ty2); ctx.lineTo(px + side * len * 0.6, yy + 1); ctx.fill();
        }
      }
      ctx.font = `700 10px ${C.heading}`; ctx.textAlign = 'left'; ctx.fillStyle = C.cream;
      ctx.fillText(t('canvasSol', { k: view.sol + 1, n }), 6, y0 + 13);
    }

    function finishRun() {
      // After render(): it still sees the run active and would turn the LED buttons back on.
      const off = () => { waterBtn.disabled = ledDown.disabled = ledUp.disabled = true; };
      const sc = scoreOf();
      if (sc < P.stars[0]) {
        render(); off();
        host.fail(t('failSprout'));
        return;
      }
      const stars = max(1, MG.lib.starsFrom(sc, P.stars) - (s.health < HEALTH_STAR ? 1 : 0));
      render(t('statusDone', { stage: t(`stage.${stageOf(sc)}`) })); off();
      host.finish({
        stars,
        summary: t('summary', { stage: t(`stage.${stageOf(sc)}`), pct: Math.round(sc * 100), health: Math.round(s.health) }),
        metrics: { score: r3(sc), growth: r2(s.growth), best, health: Math.round(s.health) },
      });
    }

    host.loop(dt => {
      time += dt;
      const r = step(L, P, s, time, dt);
      let status = '';
      const say = (text, hold = 2) => { status = text; msgUntil = time + hold; }; // event lines stay up a moment
      const sol = min(L.sols.length - 1, floor(time / P.sol)), day = isDay(L, P, time);
      if (sol !== lastSol) { lastSol = sol; if (sol > 0) say(t('statusSol', { k: sol + 1, n: L.sols.length }), 1.2); }
      if (L.sols[sol].storm && !told.storm.has(sol) && day) { told.storm.add(sol); say(t('event.dustStorm'), 3); }
      else if (day !== lastDay && lastDay !== null) say(t(day ? 'statusSunrise' : 'statusSunset'));
      lastDay = day;
      if (clogged(L, time) && !told.clog) { told.clog = true; say(t('event.wickClog'), 3); }
      if (!status && time >= msgUntil) {
        if (!r.wIn) status = s.water < L.water[0] ? t('statusDry') : t('statusSoggy');
        else if (!r.lIn) status = r.light < P.light[0] ? t('statusDim') : t('statusHarsh');
      }
      if (s.health <= 0) {
        render();
        waterBtn.disabled = ledDown.disabled = ledUp.disabled = true;
        host.fail(t(s.water > L.water[1] ? 'failDrowned' : s.water < L.water[0] ? 'failThirst' : 'failLight'));
        return;
      }
      if (time >= L.total) { finishRun(); return; }
      render(status);
    });

    labelsText();
    const intro = [t('statusInitial')];
    if (L.drain > 1) intro.push(t('event.simulant'));
    render(intro.join(' '));
    return { render: () => { labelsText(); render(); } };
  }

  MG.register('M-S6', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 33, normal: 40, hard: 45 },
    generate, validate, solve, mount,
  });
})();
