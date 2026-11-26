// M-S5 · Radiation alert (Maya / RAD on Curiosity, crewed mission) · timing (decision). Plan: docs/experiments-implementation.md §5.3.
// The crew works outside while RAD traces the dose rate. A solar storm alert gives a forecast window; Maya decides
// when to send the crew to the shelter (too early loses work, too late adds dose) and when it is safe enough to go
// back out and finish the tasks before the sol ends. The storm replays the real 20 May 2024 event measured by RAD.
// Real data (references/datasets/msl-rad/): detector B dose rate, quiet median 92.8 µGy/day before the storm, peak
// 7,295.7 µGy/day; the rise from the last normal reading (05:05 UTC) to the peak (06:15 UTC) took about 70 min.
// RAD: 1.56 kg, 4.2 W (PH1).
// Each run draws the alert, the forecast window, the onset inside it, the tasks and, with modifiers, a second wave
// or a late alert. Stars compare the player with the best plan for that layout (an exact search over the timeline).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const QUIET = 92.8; // real: detector B median before the storm, µGy/day (msl-rad README)
  const QUIET_SD = 7; // derived: scatter of the quiet readings (sd of storm_2024-05-20.csv before 04:39 UTC ≈ 7.1)
  // real: detector B every 10 min from 30 min before the onset (05:21:50 UTC) to +8 h, µGy/day, linear interpolation
  // of storm_2024-05-20.csv.
  const STORM = [96, 105, 137, 179, 917, 2218, 4625, 6310, 7149, 6920, 6563, 6252, 5999, 5927, 5674, 5518, 5378, 5186, 4469, 4128,
    4272, 3708, 3676, 3171, 2890, 2647, 2517, 2406, 2181, 2113, 1998, 1951, 1946, 2049, 2196, 2502, 2403, 2279, 2188, 2178, 2172,
    2187, 2175, 2009, 2015, 2002, 1891, 1880, 1799, 1726, 1583, 1550];
  const RAD = { kg: 1.56, watts: 4.2 }; // real (PH1)
  // game-balance
  const MIN_PER_S = 10; // one second of play is 10 minutes of the sol (one STORM sample per second)
  const STORM_T0 = -3; // the first STORM sample is 30 min (3 s of play) before the onset
  const SHELTER_K = 0.05; // share of the outside dose that still reaches the crew inside the shelter
  const LIMIT = 200; // crew dose allowed for this sol (µGy); above it the attempt fails
  const DOSE_W = 1; // score: 1 point per % of the work done, minus DOSE_W points per % of the dose limit
  const LAPSE = 2.5; // time-lapse while the whole crew waits in the shelter
  const TAIL = 14; // the sol goes on this long after the main onset (s of play)
  const SMALL = { scale: 0.06, gap: [8, 11] }; // two waves: a small first wave, then the main one after the gap
  const DELAY = [0.3, 2.2]; // derived: 3–22 min one-way light time (mars-experiments.md §1) ÷ 10 min per second
  const DT = 0.25; // solver time step (s)
  const REPLAY_DT = 0.05; // time step of the plan replays used by validate
  const TASKS = ['antenna', 'filter', 'samples', 'weather', 'rover', 'greenhouse'];
  const dosePerS = r => (r * MIN_PER_S) / 1440; // derived: µGy/day × (10 min ÷ 1,440 min per day)

  // game-balance (plan §5.3). alert: when the first alert is sent; lead: alert → onset; window: width of the forecast
  // window; extra: work left after the main onset if the crew never stops; transit: walk between the work site and
  // the shelter; line: draw the shelter line on the chart; stars: gap to the best plan (points) for 2 and 3 stars.
  const LEVELS = {
    easy: { alert: [3, 5], lead: [6, 9], window: 3, extra: [7, 9], tasks: 3, transit: 0.8, line: true, mods: 0, stars: [15, 6] },
    normal: { alert: [3, 6], lead: [6, 10], window: 5, extra: [7, 9], tasks: 3, transit: 1, line: true, mods: 1, stars: [14, 6] },
    hard: { alert: [3, 6], lead: [5, 9], window: 7, extra: [7, 9], tasks: 4, transit: 1.2, line: false, mods: [1, 2], stars: [14, 5] },
  };
  // Modifiers with a real basis:
  //   twoWaves    the real 20 May 2024 RAD trace climbs again ~4.4 h after its peak (1,946 → 2,523 µGy/day at
  //               10:12–10:39 UTC): the particles do not always come in one wave → a small first wave, then the main one;
  //   lightDelay  a forecast made on Earth takes 3–22 min to reach Mars (mars-experiments.md §1) → the alerts arrive late.
  const MODS = ['twoWaves', 'lightDelay'];

  const INF = Number.POSITIVE_INFINITY; // local copy: global lookups are slow inside the validator's vm
  const r2 = x => Math.round(x * 100) / 100;
  const r3 = x => Math.round(x * 1000) / 1000;
  const stormAt = tau => {
    const x = tau - STORM_T0;
    if (x <= 0) return STORM[0];
    const i = Math.floor(x);
    if (i >= STORM.length - 1) return STORM[STORM.length - 1];
    return STORM[i] + (STORM[i + 1] - STORM[i]) * (x - i);
  };
  // Dose rate (µGy/day) at time t of play: quiet level with its real scatter, plus each wave of the storm.
  function rateAt(L, t) {
    let r = QUIET + L.noise.reduce((s, n) => s + n.a * Math.sin(2 * Math.PI * n.f * t + n.p), 0);
    for (const w of L.waves) { const tau = t - w.at; if (tau >= STORM_T0) r += w.scale * (stormAt(tau) - QUIET); }
    return Math.max(40, r);
  }
  const scoreOf = (L, work, dose) => (100 * Math.min(work, L.work)) / L.work - (DOSE_W * 100 * dose) / LIMIT;
  // Dose rate below which an extra second of work is worth its dose (derived from the score weights above).
  const breakEven = L => (1440 / MIN_PER_S) * (LIMIT / (DOSE_W * L.work));

  function generate(R, P, { mods }) {
    const first = r2(R.span(P.alert) + R.span(P.lead));
    const waves = mods.includes('twoWaves') ? [{ at: first, scale: SMALL.scale }, { at: r2(first + R.span(SMALL.gap)), scale: 1 }] : [{ at: first, scale: 1 }];
    const main = waves[waves.length - 1].at;
    const delay = mods.includes('lightDelay') ? r2(R.span(DELAY)) : 0;
    const alerts = waves.map((w, k) => {
      const before = R.float(0.25, 0.75) * P.window;
      const lead = R.span(P.lead), from = w.at - before;
      // received at least 0.8 s before its window opens, even with the light delay
      const sent = Math.min(k === 0 ? w.at - lead : Math.max(waves[0].at + 1.5, w.at - lead), from - 0.8 - delay);
      return { sent: r2(sent), at: r2(sent + delay), from: r2(from), to: r2(from + P.window) };
    });
    const work = r2(main + R.span(P.extra));
    const picks = R.sample(TASKS, P.tasks);
    const weights = picks.map(() => R.float(0.7, 1.3));
    const sum = weights.reduce((s, x) => s + x, 0);
    let acc = 0;
    const tasks = picks.map((id, i) => { acc += (work * weights[i]) / sum; return { id, until: i === picks.length - 1 ? work : r2(acc) }; });
    const noise = Array.from({ length: 3 }, (_, i) => ({ a: r2((QUIET_SD * 1.4) / (i + 1.6)), f: r3(R.float(0.15, 0.4) * (i + 1)), p: r3(R.float(0, Math.PI * 2)) }));
    return { length: r2(main + TAIL), transit: P.transit, work, tasks, waves, alerts, delay, noise };
  }

  // Exact best plan on a DT grid: modes out / in / walking in (k steps) / walking out (k steps) and work done so far;
  // the least dose for each state (the score is the final work minus the dose, so least dose per state is exact).
  function solve(L) {
    const k = Math.max(1, Math.round(L.transit / DT)), W = Math.round(L.work / DT), N = Math.round(L.length / DT), S = W + 1;
    const M = 2 + 2 * k; // 0 out, 1 in, 2..k+1 walking in (step m−1), k+2..2k+1 walking out (step m−k−1)
    let cur = new Float64Array(M * S).fill(INF), nxt = new Float64Array(M * S);
    cur[0] = 0;
    const inDone = k === 1 ? 1 : 3, outDone = k === 1 ? 0 : k + 3; // state after the first walking step
    for (let s = 0; s < N; s++) {
      nxt.fill(INF);
      const out = dosePerS(rateAt(L, (s + 0.5) * DT)) * DT, inside = out * SHELTER_K;
      for (let i = 0; i < cur.length; i++) if (cur[i] >= LIMIT) cur[i] = INF; // past the limit the attempt failed
      for (let w = 0; w <= W; w++) {
        let d = cur[w], i; // out
        if (d < INF) {
          if (w < W && d + out < nxt[i = w + 1]) nxt[i] = d + out;
          if (d + out < nxt[i = inDone * S + w]) nxt[i] = d + out;
        }
        d = cur[S + w]; // in
        if (d < INF) {
          if (d + inside < nxt[i = S + w]) nxt[i] = d + inside;
          if (w < W && d + out < nxt[i = outDone * S + w]) nxt[i] = d + out;
        }
        for (let m = 3; m < M; m++) {
          d = cur[m * S + w];
          if (d === INF) continue;
          const to = m === k + 1 ? 1 : m === 2 * k + 1 ? 0 : m + 1;
          if (d + out < nxt[i = to * S + w]) nxt[i] = d + out;
        }
      }
      [cur, nxt] = [nxt, cur];
    }
    let best = -INF, bestDose = 0;
    for (let m = 0; m < M; m++) for (let w = 0; w <= W; w++) {
      const d = cur[m * S + w];
      if (d < LIMIT) { const sc = scoreOf(L, (w / W) * L.work, d); if (sc > best) { best = sc; bestDose = d; } }
    }
    return { score: r2(best), dose: r2(bestDose) };
  }

  // Replays a plan (times when the shelter button is pressed) with the same rules as the game, for checks.
  function replay(L, presses) {
    let mode = 'out', walk = 0, work = 0, dose = 0, p = 0;
    for (let t = 0; t < L.length; t += REPLAY_DT) {
      while (p < presses.length && presses[p] <= t) { if (mode === 'out' && work < L.work) { mode = 'toIn'; walk = L.transit; } else if (mode === 'in' && work < L.work) { mode = 'toOut'; walk = L.transit; } p++; }
      const r = dosePerS(rateAt(L, t + REPLAY_DT / 2)) * REPLAY_DT;
      if (mode === 'in') dose += r * SHELTER_K; else dose += r;
      if (mode === 'out') { work += REPLAY_DT; if (work >= L.work) { mode = 'toIn'; walk = L.transit; } }
      else if (mode === 'toIn' || mode === 'toOut') { walk -= REPLAY_DT; if (walk <= 0) mode = mode === 'toIn' ? 'in' : 'out'; }
    }
    return { work, dose, score: scoreOf(L, work, dose) };
  }

  // A real decision: ignoring the storm breaks the dose limit, and hiding at the first alert is far from the best.
  function validate(L) {
    if (L.alerts.some(a => a.at >= a.from - 0.5)) return false;
    const best = solve(L).score;
    return replay(L, []).dose > LIMIT && best - replay(L, [L.alerts[0].at]).score >= 12 && best > 20;
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const best = solve(L).score, line = breakEven(L);
    let time = 0, mode = 'out', walk = 0, work = 0, dose = 0, over = false, failed = false, lastTasks = '';
    const trace = [{ t: 0, r: rateAt(L, 0), m: 'out' }];
    const seen = new Set();

    const css = getComputedStyle(document.documentElement);
    const v = (name, fb) => css.getPropertyValue(name).trim() || fb;
    const C = {
      space: v('--bg-viewport', '#17183B'), cream: v('--starlight-cream', '#FCE8A6'), amber: v('--solar-amber', '#F59E0B'),
      safe: v('--safe', '#7EDAC2'), crimson: v('--crimson-alert', '#8F241E'), coral: v('--coral-hover', '#EE7B57'), muted: v('--muted', '#B9B0CE'),
      amethyst: v('--amethyst', '#9B5DE5'), f3: v('--f3', '#24143a'),
    };

    const badge = ui.el('div', 'mg-badge');
    const readout = ui.readout(['clock', 'rate', 'crew']);
    const cv = ui.canvas((host.body.clientWidth || 600) < 480 ? 0.56 : 0.42, 'ms5-canvas'); // taller chart on phones
    const meters = ui.el('div', 'mg-meters ms5-meters');
    const mWork = ui.meter(''), mDose = ui.meter('');
    meters.append(mWork.node, mDose.node);
    const tasks = ui.el('div', 'ms5-tasks');
    const act = ui.button('', 'primary');
    const controls = ui.el('div', 'mg-controls');
    controls.append(act);
    host.body.append(badge, readout.node, cv.node, meters, tasks, controls);

    act.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); press(); } });
    act.addEventListener('click', e => { if (e.detail === 0) press(); });
    host.onKey((e, down) => {
      if (e.code !== 'Space') return false;
      if (down && !e.repeat) press();
      return true;
    });

    const clock = s => { const m = Math.round(8 * 60 + s * MIN_PER_S); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
    const done = () => work >= L.work - 1e-9;

    function press() {
      if (!host.active || over) return;
      if (mode === 'out' && !done()) { mode = 'toIn'; walk = L.transit; render(t('statusToShelter')); }
      else if (mode === 'in' && !done()) { mode = 'toOut'; walk = L.transit; render(t('statusToWork')); }
    }

    function step(h) {
      const r = rateAt(L, time + h / 2);
      dose += dosePerS(r) * h * (mode === 'in' ? SHELTER_K : 1);
      if (mode === 'out') {
        work = Math.min(L.work, work + h);
        if (done()) { mode = 'toIn'; walk = L.transit; host.status(t('statusTasksDone')); }
      } else if (mode !== 'in') {
        walk -= h;
        if (walk <= 0) { mode = mode === 'toIn' ? 'in' : 'out'; host.status(t(mode === 'in' ? 'statusSheltered' : 'statusWorking')); }
      }
      time += h;
      if (time - trace[trace.length - 1].t >= 0.1) trace.push({ t: time, r: rateAt(L, time), m: mode });
      L.alerts.forEach((a, i) => {
        if (seen.has(i) || time < a.at) return;
        seen.add(i);
        host.status(t(i === 0 ? 'alertFirst' : 'alertNext', { from: clock(a.from), to: clock(a.to) }) + (i > 0 ? ` ${t('event.twoWaves')}` : '')
          + (L.delay ? ` ${t('event.lightDelay', { min: Math.round(L.delay * MIN_PER_S) })}` : ''));
      });
    }

    function end() {
      over = true;
      const score = scoreOf(L, work, dose), gap = Math.max(0, best - score);
      const stars = gap <= P.stars[1] ? 3 : gap <= P.stars[0] ? 2 : 1;
      const pct = Math.round((100 * work) / L.work);
      render(t('statusDone', { pct, dose: U().number(dose) }));
      host.finish({ stars, summary: t('summary', { pct, dose: U().number(dose), gap: Math.round(gap) }), metrics: { score, best, gap, work: pct, dose } });
    }

    host.loop(dt => {
      if (over) return;
      let left = dt * (mode === 'in' ? LAPSE : 1); // time-lapse while the crew waits in the shelter
      while (left > 1e-9) {
        const h = Math.min(0.05, left);
        left -= h;
        step(h);
        if (dose >= LIMIT) {
          over = true; failed = true;
          render();
          host.status('');
          host.fail(t('failDose', { limit: U().number(LIMIT) }));
          return;
        }
        if (done() && mode === 'in') { // tasks done and the crew inside: the rest of the sol passes in the shelter
          for (let s = time; s < L.length; s += 0.05) dose += dosePerS(rateAt(L, s + 0.025)) * Math.min(0.05, L.length - s) * SHELTER_K;
          time = L.length;
          end();
          return;
        }
        if (time >= L.length) { end(); return; }
      }
      render();
    });

    function render(status) {
      const r = rateAt(L, time), ratio = r / QUIET;
      const alert = L.alerts.some((a, i) => seen.has(i) && time <= a.to + 4);
      let state = 'good', text = t('badgeWorking');
      if (failed) { state = 'danger'; text = t('badgeFail'); }
      else if (over) { state = done() ? 'good' : 'cold'; text = t('badgeDone'); }
      else if (mode === 'in') { state = 'cold'; text = t('badgeSheltered'); }
      else if (mode !== 'out') { state = 'warn'; text = t(mode === 'toIn' ? 'badgeToShelter' : 'badgeToWork'); }
      else if (ratio > 3) { state = 'danger'; text = t('badgeStorm'); }
      else if (alert) { state = 'warn'; text = t('badgeAlert'); }
      badge.className = `mg-badge is-${state}`;
      badge.textContent = text;
      readout.set('clock', t('clockReadout', { time: clock(time) }));
      readout.set('rate', t('rateReadout', { rate: U().number(r), x: U().decimal(ratio, ratio < 10 ? 1 : 0) }), ratio > 3 ? 'danger' : ratio > 1.5 ? 'warn' : '');
      readout.set('crew', t(`crew.${mode}`), mode === 'in' ? 'good' : mode === 'out' && ratio > 3 ? 'danger' : '');
      mWork.label(t('workLabel', { pct: Math.round((100 * work) / L.work) }));
      mWork.set(work / L.work, done() ? '' : 'warn');
      mDose.label(t('doseLabel', { dose: U().number(dose), limit: U().number(LIMIT) }));
      mDose.set(dose / LIMIT, dose > LIMIT * 0.6 ? 'danger' : 'info');
      const taskKey = `${Math.floor((100 * work) / L.work)}|${host.U.system}`;
      if (taskKey !== lastTasks) { lastTasks = taskKey; tasks.replaceChildren(...L.tasks.map((tk, i) => {
        const from = i ? L.tasks[i - 1].until : 0, share = clamp((work - from) / (tk.until - from), 0, 1);
        const chip = ui.el('span', `ms5-task${share >= 1 ? ' is-done' : share > 0 ? ' is-active' : ''}`);
        chip.append(ui.el('b', '', share >= 1 ? '✓' : `${Math.round(share * 100)}%`), document.createTextNode(` ${t(`tasks.${tk.id}`)}`));
        return chip;
      })); }
      const walking = mode === 'toIn' || mode === 'toOut';
      act.className = `button ${mode === 'in' ? 'amber' : 'primary'}`;
      act.textContent = walking ? t('walkingBtn') : mode === 'in' ? t('workBtn') : t('shelterBtn');
      act.disabled = !host.active || over || walking || done();
      Object.assign(cv.node.dataset, { rate: Math.round(r), quiet: QUIET, mode: mode === 'out' ? 'out' : mode === 'in' ? 'in' : 'walk', returnok: done() ? 0 : 1, breakeven: Math.round(line) });
      draw();
      if (status) host.status(status);
    }

    // Chart: RAD dose rate on a log scale over the sol, forecast windows, the shelter line and the crew strip.
    function draw() {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      const left = 42, right = w - 8, top = 16, bottom = h - 26, RMIN = 50, RMAX = 12000;
      const x = s => left + (s / L.length) * (right - left);
      const y = r => bottom - ((Math.log10(clamp(r, RMIN, RMAX)) - Math.log10(RMIN)) / (Math.log10(RMAX) - Math.log10(RMIN))) * (bottom - top);
      ctx.fillStyle = C.space; ctx.fillRect(0, 0, w, h);
      ctx.font = '600 9px "Chakra Petch", sans-serif'; ctx.textBaseline = 'middle';
      for (const g of [100, 1000, 10000]) {
        ctx.fillStyle = C.f3; ctx.fillRect(left, Math.round(y(g)), right - left, 1);
        ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(U().number(g), left - 4, y(g));
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = C.muted; ctx.fillText(t('axisUnit'), 4, 2);
      L.alerts.forEach((a, i) => {
        if (!seen.has(i)) return;
        const xa = x(a.from), xb = x(a.to);
        ctx.fillStyle = 'rgba(245,158,11,0.16)'; ctx.fillRect(xa, top, xb - xa, bottom - top);
        ctx.fillStyle = C.amber; ctx.fillRect(xa, top, 2, bottom - top); ctx.fillRect(xb - 2, top, 2, bottom - top);
        ctx.textAlign = 'center'; ctx.fillText(t('windowTag'), (xa + xb) / 2, top + 2);
      });
      if (P.line) {
        ctx.fillStyle = C.amber;
        for (let xx = left; xx < right; xx += 10) ctx.fillRect(xx, Math.round(y(line)), 6, 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(t('lineTag'), left + 4, y(line) - 2);
      }
      // Trace so far: a flat filled area under the readings and its edge.
      ctx.fillStyle = C.crimson;
      ctx.beginPath(); ctx.moveTo(x(0), bottom);
      for (const p of trace) ctx.lineTo(x(p.t), y(p.r));
      ctx.lineTo(x(trace[trace.length - 1].t), bottom); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.beginPath();
      trace.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.r)) : ctx.moveTo(x(p.t), y(p.r))));
      ctx.stroke();
      ctx.fillStyle = C.cream; ctx.fillRect(Math.round(x(time)) - 1, top, 2, bottom - top);
      // Crew strip: green working, amber walking, violet sheltered.
      const MC = { out: C.safe, in: C.amethyst, toIn: C.amber, toOut: C.amber };
      for (let i = 1; i < trace.length; i++) { ctx.fillStyle = MC[trace[i].m]; ctx.fillRect(x(trace[i - 1].t), bottom + 4, x(trace[i].t) - x(trace[i - 1].t) + 0.5, 7); }
      ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (let s = 0, k = 0; s <= L.length; s += 6, k++) {
        ctx.fillRect(x(s), bottom + 12, 1, 4);
        if (k % 2 === 0 && x(s) + 30 < right) ctx.fillText(clock(s), x(s) + 2, bottom + 13);
      }
    }

    const mass = U().system === 'imperial' ? `${U().decimal(RAD.kg * 2.20462262, 1)} lb` : `${U().decimal(RAD.kg, 2)} kg`;
    render(t('statusInitial', { limit: U().number(LIMIT), mass, watts: U().decimal(RAD.watts, 1) }) + (P.line ? ` ${t('lineHint')}` : ''));
    return { render: () => { lastTasks = ''; render(); } };
  }

  MG.register('M-S5', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 25, normal: 28, hard: 34 },
    generate, validate, solve, mount,
  });
})();
