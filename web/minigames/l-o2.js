// L-O2 · Keep the detector cold (Lucas / CRISM on MRO) · keep in range. Plan: docs/experiments-implementation.md §5.3.
// During Maya's observations, Lucas keeps the infrared detector in the cold band by splitting the instrument's power
// between the cryocooler and the rest of the spacecraft. Two coupled quantities: the detector temperature (it
// follows the heat load with a lag) and the cooler wear (it grows with the square of the cooler power). While an
// observation runs, the spacecraft needs its own share of the budget, so the cooler cannot take everything: the
// detector has to be cold before the observation starts. Overcooling leaves the band and wears the cooler for nothing.
// Real numbers (references/experiments/mars-experiments.md GE8; docs/minigames.md L-O2): CRISM weighed 32.9 kg, drew
// 44–47 W and made 2–2.5 Gb per observation; its coolers wore out by 2017 and it was retired in 2023; it mapped 86%
// of Mars. The detector temperature is shown on a game scale (no real temperature is claimed).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;
  const TAU = Math.PI * 2;
  const { sin, abs, min, max } = Math; // local aliases: fast in the validator's vm context too
  const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;

  const BUDGET_W = [44, 47]; // real (GE8): CRISM drew 44–47 W; each run draws its budget inside that range
  const OBS_GB = [2, 2.5]; // real (GE8): 2–2.5 Gb per CRISM observation
  const COOLER_MAX_W = 30; // game-balance: the most the cryocoolers can take from the budget
  const RESERVE_W = 22; // game-balance: what the spectrometer electronics and gimbal need while observing
  // game-balance: detector temperature on a 0–100 game scale. Equilibrium = T0 + K_LOAD·load − K_COOL·cooler;
  // the detector follows it with a lag of LAG_S seconds.
  const T0 = 28, K_LOAD = 80, K_COOL = 70, LAG_S = 1.4;
  const GAUGE = [12, 72];
  const WEAR_K = 3.5; // game-balance: wear in % per s at full cooler power (× power², so pushing hard costs most)
  const WEAR_STAR = 80; // game-balance: ending with more wear than this costs a star
  const WORN_EFF = 0.88, WORN_EXTRA = 18; // game-balance: wornCooler is 12% weaker and starts 18 points more worn
  const STORM_DROP = 5, STORM_S = 6; // game-balance: solarStorm lowers the top of the band for a few seconds
  const PRE_S = 3.5, TAIL_S = 1; // game-balance: lead-in before the first observation, tail after the last
  const CTRL_RATE = 0.65; // game-balance: cooler share per second while a trim is held
  const LEAD_S = 2.5; // the reference solver starts cooling this long before an observation

  // game-balance (plan §5.3). windows: Maya's observations; dur and gaps: their length and the pause between them
  // (s of play); band: cold band on the game scale; load: [amplitude, base Hz] of the seeded heat-load wave (the
  // orbit carries the instrument in and out of sunlight); wear: starting wear (%, the coolers had years of use);
  // stars: share of the clean data the reference solver gets on this layout, for 1, 2 and 3 stars.
  const LEVELS = {
    easy: { windows: 3, dur: [4, 5.5], gaps: [4, 6], band: [28, 50], load: [0.1, 0.09], wear: [8, 14], mods: 0, stars: [0.45, 0.68, 0.85] },
    normal: { windows: 4, dur: [4, 5.5], gaps: [3, 5], band: [32, 47], load: [0.15, 0.11], wear: [12, 20], mods: 1, stars: [0.5, 0.72, 0.87] },
    hard: { windows: 5, dur: [4, 5.5], gaps: [2.5, 4], band: [35, 45], load: [0.21, 0.13], wear: [18, 26], mods: [1, 2], stars: [0.55, 0.75, 0.88] },
  };
  // Modifiers with a real basis:
  //   wornCooler  CRISM's coolers wore out by 2017 (GE8): the run starts with more wear and a weaker cooler;
  //   bigTarget   observations were 2–2.5 Gb each (GE8): one of them is a long 2.5 Gb target;
  //   solarStorm  solar storms hit hardware (experiments.md §6.6: RAD P10, MAVEN AT4): energetic particles add
  //               noise, so for a few seconds only the colder part of the band gives clean data.
  const MODS = ['wornCooler', 'bigTarget', 'solarStorm'];

  function generate(R, P, { mods }) {
    const [amp, hz] = P.load;
    const parts = Array.from({ length: 3 }, (_, i) => ({ f: r3(hz * (1 + i * 1.37) * R.float(0.8, 1.25)), p: r3(R.float(0, TAU)), a: 1 / (i + 1) }));
    const big = mods.includes('bigTarget') ? R.int(1, P.windows - 1) : -1;
    const windows = [];
    let t = PRE_S;
    for (let i = 0; i < P.windows; i++) {
      const dur = r2(R.float(P.dur[0], P.dur[1]) * (i === big ? 1.6 : 1));
      windows.push({ start: r2(t), dur, gb: i === big ? OBS_GB[1] : r2(R.float(OBS_GB[0], OBS_GB[1])), big: i === big });
      t = r2(t + dur + (i < P.windows - 1 ? R.float(P.gaps[0], P.gaps[1]) : 0));
    }
    const end = r2(t + TAIL_S);
    const worn = mods.includes('wornCooler');
    const storm = mods.includes('solarStorm') ? { at: r2(R.float(PRE_S + 1, end - STORM_S - 1)), dur: STORM_S } : null;
    return {
      budget: r2(R.float(BUDGET_W[0], BUDGET_W[1])), mid: r3(R.float(0.42, 0.55)), amp, parts, windows, storm, worn,
      wear0: r2(R.float(P.wear[0], P.wear[1]) + (worn ? WORN_EXTRA : 0)), temp0: r2(R.float(58, 68)), end,
    };
  }

  const loadAt = (L, t) => {
    const norm = L.parts.reduce((s, x) => s + x.a, 0);
    return L.mid + (L.amp * L.parts.reduce((s, x) => s + x.a * sin(TAU * x.f * t + x.p), 0)) / norm;
  };
  const windowAt = (L, t) => L.windows.find(w => t >= w.start && t < w.start + w.dur) || null;
  const nextWindow = (L, t) => L.windows.find(w => w.start > t) || null;
  const stormAt = (L, t) => !!L.storm && t >= L.storm.at && t < L.storm.at + L.storm.dur;
  const bandAt = (L, P, t) => [P.band[0], P.band[1] - (stormAt(L, t) ? STORM_DROP : 0)];
  const capOf = L => (L.budget - RESERVE_W) / COOLER_MAX_W; // most cooler share allowed while observing
  const effOf = L => (L.worn ? WORN_EFF : 1);
  const teq = (L, t, c) => T0 + K_LOAD * loadAt(L, t) - K_COOL * effOf(L) * c;

  // Reference play: cool to the warm side of the band shortly before and during each observation (anticipating
  // the load), ease off between them. Gives the share of clean data a careful player can reach and the wear it costs.
  function solve(L, P) {
    const dt = 0.05, cap = capOf(L), total = L.windows.reduce((s, w) => s + w.gb, 0);
    let T = L.temp0, wear = L.wear0, clean = 0;
    for (let t = 0; t < L.end; t += dt) {
      const w = windowAt(L, t), next = nextWindow(L, t);
      const [lo, hi] = bandAt(L, P, t + 0.5);
      const busy = w || (next && next.start - t < LEAD_S);
      const target = busy ? lo + (hi - lo) * 0.55 : hi + 6;
      let c = (T0 + K_LOAD * loadAt(L, t + LAG_S * 0.6) - target) / (K_COOL * effOf(L)) + 0.04 * (T - target);
      c = clamp(c, 0, w ? cap : 1);
      T += ((teq(L, t, c) - T) * dt) / LAG_S;
      wear += WEAR_K * c * c * dt;
      const [blo, bhi] = bandAt(L, P, t);
      if (w && T >= blo && T <= bhi) clean += (w.gb / w.dur) * dt;
    }
    return { share: r3(min(1, clean / total)), wear: r2(wear) };
  }

  // Solvable: the careful reference play records most of the data without wearing the cooler out.
  function validate(L, P) {
    const s = solve(L, P);
    return s.share >= 0.85 && s.wear <= 76;
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const best = solve(L, P);
    const cap = capOf(L);
    const totalGb = L.windows.reduce((s, w) => s + w.gb, 0);
    const pctT = v => ((clamp(v, GAUGE[0], GAUGE[1]) - GAUGE[0]) / (GAUGE[1] - GAUGE[0])) * 100;
    const gb = v => `${U().decimal(v, 1)} Gb`;

    let time = 0, temp = L.temp0, wear = L.wear0, c = 0, clean = 0, keyDir = 0, drag = false, lastWin = null, stormTold = false, msgUntil = 0;
    const winClean = L.windows.map(() => 0);

    const timeline = ui.el('div', 'lo2-timeline');
    const blocks = L.windows.map((w, i) => {
      const b = ui.el('div', `lo2-win${w.big ? ' is-big' : ''}`);
      b.style.left = `${(w.start / L.end) * 100}%`; b.style.width = `${(w.dur / L.end) * 100}%`;
      const fill = ui.el('i', 'lo2-win-fill');
      b.append(fill, ui.el('span', '', String(i + 1)));
      timeline.append(b);
      return { b, fill };
    });
    const stormMark = L.storm ? ui.el('div', 'lo2-storm') : null;
    if (stormMark) { stormMark.style.left = `${(L.storm.at / L.end) * 100}%`; stormMark.style.width = `${(L.storm.dur / L.end) * 100}%`; stormMark.hidden = true; timeline.append(stormMark); }
    const head = ui.el('div', 'lo2-playhead');
    timeline.append(head);

    const badge = ui.el('div', 'mg-badge');
    const readout = ui.readout(['obs', 'power', 'data']);
    const labels = ui.el('div', 'mg-gauge-labels');
    const gauge = ui.el('div', 'mg-gauge');
    const zone = cls => { const z = ui.el('div', `mg-gauge-zone ${cls}`); gauge.append(z); return z; };
    const zCold = zone('is-cold'), zGood = zone('is-good'), zHot = zone('is-hot');
    const place = (z, a, b) => { z.style.left = `${pctT(a)}%`; z.style.width = `${pctT(b) - pctT(a)}%`; };
    const trend = ui.el('div', 'lo2-trend');
    const needle = ui.el('div', 'mg-needle');
    gauge.append(trend, needle);

    const split = ui.el('div', 'lo2-split');
    split.tabIndex = 0;
    split.setAttribute('role', 'slider');
    split.setAttribute('aria-valuemin', '0');
    split.setAttribute('aria-valuemax', String(COOLER_MAX_W));
    const sCool = ui.el('div', 'lo2-cool'), sReserve = ui.el('div', 'lo2-reserve'), sMax = ui.el('div', 'lo2-max'), sHandle = ui.el('div', 'lo2-handle');
    const sCoolTxt = ui.el('span', 'lo2-cool-txt'), sRestTxt = ui.el('span', 'lo2-rest-txt');
    split.append(sReserve, sCool, sMax, sHandle, sCoolTxt, sRestTxt);
    const wPct = watts => (watts / L.budget) * 100;
    sReserve.style.left = `${wPct(L.budget - RESERVE_W)}%`;
    sMax.style.left = `${wPct(COOLER_MAX_W)}%`;

    const meters = ui.el('div', 'mg-meters');
    const mWear = ui.meter(''), mData = ui.meter('');
    meters.append(mWear.node, mData.node);
    const less = ui.button('', ''), more = ui.button('', 'primary');
    less.classList.add('lo2-btn'); more.classList.add('lo2-btn');
    const holdLess = ui.hold(less, () => {}), holdMore = ui.hold(more, () => {});
    const controls = ui.el('div', 'mg-controls');
    controls.append(less, more);
    host.body.append(timeline, badge, readout.node, labels, gauge, split, controls, meters);

    host.onKey((e, down) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) { keyDir = down ? -1 : keyDir === -1 ? 0 : keyDir; less.classList.toggle('is-held', down || holdLess.on); return true; }
      if (['ArrowRight', 'KeyD'].includes(e.code)) { keyDir = down ? 1 : keyDir === 1 ? 0 : keyDir; more.classList.toggle('is-held', down || holdMore.on); return true; }
      return false;
    });
    const fromX = e => { const r = split.getBoundingClientRect(); c = clamp((((e.clientX - r.left) / max(1, r.width)) * L.budget) / COOLER_MAX_W, 0, 1); };
    split.addEventListener('pointerdown', e => {
      if (!host.active || e.button !== 0) return;
      drag = true; fromX(e);
      try { split.setPointerCapture(e.pointerId); } catch { /* gone */ }
      e.preventDefault();
    });
    split.addEventListener('pointermove', e => { if (drag && host.active) fromX(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) split.addEventListener(ev, () => { drag = false; });

    function labelsText() {
      labels.replaceChildren(ui.el('span', '', t('zoneCold')), ui.el('span', '', t('zoneBand')), ui.el('span', '', t('zoneHot')));
      zCold.textContent = t('coldTag'); zGood.textContent = '✓'; zHot.textContent = t('hotTag');
      less.textContent = t('lessBtn'); more.textContent = t('moreBtn');
      split.setAttribute('aria-label', t('splitAria'));
    }

    function render(status) {
      const w = windowAt(L, time), next = nextWindow(L, time);
      const [lo, hi] = bandAt(L, P, time);
      place(zCold, GAUGE[0], lo); place(zGood, lo, hi); place(zHot, hi, GAUGE[1]);
      const inBand = temp >= lo && temp <= hi, brown = !!w && c > cap + 1e-6;
      needle.style.left = `${pctT(temp).toFixed(2)}%`;
      needle.className = `mg-needle${inBand ? ' is-good' : temp > hi ? ' is-hot' : ' is-cold'}`;
      trend.style.left = `${pctT(teq(L, time, c)).toFixed(2)}%`;
      // Readouts
      const k = L.windows.indexOf(w), n = L.windows.length;
      readout.set('obs', w ? t('obsNow', { k: k + 1, n }) : next ? t('obsNext', { k: L.windows.indexOf(next) + 1, n, s: max(0, Math.ceil(next.start - time)) }) : t('obsDone', { n }), w ? 'good' : '');
      const coolW = c * COOLER_MAX_W;
      readout.set('power', t('powerReadout', { cool: Math.round(coolW), rest: Math.round(L.budget - coolW), budget: Math.round(L.budget) }), brown ? 'danger' : '');
      readout.set('data', t('dataReadout', { got: gb(clean), total: gb(totalGb) }), clean >= totalGb * P.stars[2] * best.share ? 'good' : '');
      // Badge
      let state, text;
      if (!w) { state = ''; text = next ? t('badgeStandby', { s: max(0, Math.ceil(next.start - time)) }) : t('badgeDone'); }
      else if (brown) { state = 'warn'; text = t('badgeBrownout'); }
      else if (inBand) { state = 'good'; text = t('badgeGood'); }
      else if (temp > hi) { state = 'danger'; text = t('badgeHot'); }
      else { state = 'cold'; text = t('badgeCold'); }
      badge.className = `mg-badge${state ? ` is-${state}` : ''}`;
      badge.textContent = text;
      // Split bar
      sCool.style.width = `${wPct(coolW)}%`;
      sHandle.style.left = `${wPct(coolW)}%`;
      sReserve.classList.toggle('is-on', !!w || (!!next && next.start - time < 1.5));
      sCoolTxt.textContent = t('coolTxt', { w: Math.round(coolW) });
      sRestTxt.textContent = t('restTxt', { w: Math.round(L.budget - coolW) });
      split.setAttribute('aria-valuenow', String(Math.round(coolW)));
      split.classList.toggle('is-brown', brown);
      // Timeline
      head.style.left = `${(min(time, L.end) / L.end) * 100}%`;
      L.windows.forEach((win, i) => {
        const done = time >= win.start + win.dur, on = win === w;
        const share = winClean[i] / win.gb;
        blocks[i].b.className = `lo2-win${win.big ? ' is-big' : ''}${on ? ' is-on' : done ? (share >= 0.7 ? ' is-good' : share >= 0.35 ? ' is-warn' : ' is-bad') : ''}`;
        blocks[i].fill.style.width = `${clamp(share, 0, 1) * 100}%`;
      });
      if (stormMark) stormMark.hidden = time < L.storm.at;
      // Meters
      mWear.set(wear / 100, wear > WEAR_STAR ? 'danger' : wear > 55 ? 'warn' : 'info');
      mWear.label(t('wearLabel', { pct: Math.round(wear) }));
      mData.set(clean / totalGb);
      mData.label(t('dataLabel', { got: gb(clean), total: gb(totalGb) }));
      if (status) host.status(status);
    }

    function finishRun() {
      less.disabled = more.disabled = true;
      const share = clean / totalGb, score = min(1, share / max(0.5, best.share));
      if (score < P.stars[0]) {
        render();
        host.fail(t('failNoisy', { got: gb(clean), total: gb(totalGb) }));
        return;
      }
      const stars = max(1, MG.lib.starsFrom(score, P.stars) - (wear > WEAR_STAR ? 1 : 0));
      render(t('statusDone', { got: gb(clean), left: Math.round(100 - wear) }));
      host.finish({
        stars,
        summary: t('summary', { pct: Math.round(share * 100), got: gb(clean), wear: Math.round(wear) }),
        metrics: { share: r3(share), best: best.share, score: r3(score), wear: Math.round(wear), cleanGb: r2(clean) },
      });
    }

    host.loop(dt => {
      time += dt;
      const dir = keyDir || (holdMore.on ? 1 : 0) - (holdLess.on ? 1 : 0);
      if (dir) c = clamp(c + dir * CTRL_RATE * dt, 0, 1);
      const w = windowAt(L, time);
      const [lo, hi] = bandAt(L, P, time);
      temp += ((teq(L, time, c) - temp) * dt) / LAG_S;
      wear += WEAR_K * c * c * dt;
      const inBand = temp >= lo && temp <= hi, brown = !!w && c > cap + 1e-6;
      if (w && inBand && !brown) { const g = (w.gb / w.dur) * dt; clean += g; winClean[L.windows.indexOf(w)] += g; }
      let status = '';
      const say = (text, hold = 2.2) => { status = text; msgUntil = time + hold; }; // event lines stay up a moment
      if (w !== lastWin) {
        if (w) say(t('statusObs', { k: L.windows.indexOf(w) + 1, n: L.windows.length, gb: gb(w.gb) }) + (w.big ? ` ${t('event.bigTarget')}` : ''), 1.6);
        else if (lastWin) { const i = L.windows.indexOf(lastWin); say(t('statusObsEnd', { k: i + 1, pct: Math.round((winClean[i] / lastWin.gb) * 100) })); }
        lastWin = w;
      } else if (L.storm && !stormTold && time >= L.storm.at) { stormTold = true; say(t('event.solarStorm'), 3); }
      else if (w && time >= msgUntil) status = brown ? t('statusBrownout') : inBand ? t('statusGood') : temp > hi ? t('statusHot') : t('statusCold');
      if (wear >= 100) {
        wear = 100;
        render();
        less.disabled = more.disabled = true;
        host.fail(t('failWear'));
        return;
      }
      if (time >= L.end) { finishRun(); return; }
      render(status);
    });

    labelsText();
    render(t('statusInitial', { band: t('bandTag') }) + (L.worn ? ` ${t('event.wornCooler')}` : ''));
    return { render: () => { labelsText(); render(); } };
  }

  MG.register('L-O2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 25, normal: 32, hard: 40 },
    generate, validate, solve, mount,
  });
})();
