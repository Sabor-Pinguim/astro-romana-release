// L-O1 · Roll-out solar array (Lucas / ROSA–iROSA) · timing. Plan: docs/experiments-implementation.md §5.3.
// The array unrolls in steps. In each step the boom tension climbs with a wobble; Lucas releases the next
// segment while the tension is inside the green zone: too early (slack) jams the roll, too late (over-tension)
// rolls it out crooked. A jam leaves the array on partial power until an EVA repair frees it.
// Real numbers: ROSA / iROSA (references/experiments/experiments.md E5), DART flew 6.6 kW of ROSA at 1 AU (E10),
// Mars gets 43% of Earth's sunlight (references/experiments/mars-experiments.md §1). Each run draws the zone, the
// climb and the wobble of every step, and which steps a modifier hits.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp, starsFrom } = MG.lib;

  const FULL_W = Math.round(6600 * 0.43); // derived: DART's ROSA 6.6 kW at 1 AU (E10) × 43% sunlight at Mars = 2,838 W
  // game-balance
  const CROOKED_SHARE = 0.55; // a crooked segment gives 55% of its power
  const JAM_PENALTY = 0.15; // score lost for each jam (each EVA repair)
  const REPAIR_S = 1.4; // seconds of holding for one EVA repair
  const UNROLL_S = 0.7; // animation of one segment
  const FIRST_ENTRY_S = 0.5; // the zone is never reached in the first half second of a step
  const MAX_STEP_S = 14; // a step never lasts longer than this before the tension tops out
  const SAMPLE_S = 0.01; // time step used to check the windows
  const STEP_TRIES = 12; // redraws of one step before the whole layout is drawn again

  // game-balance (plan §5.3). zone: width of the green zone (share of the gauge); ramp: tension climb per second;
  // wobble/hz: boom oscillation; repairs: EVA repairs available; minWin: shortest usable stay in the zone (s);
  // stars: score (power share − 0.15 per jam) for 1, 2 and 3 stars (3 stars allow one crooked segment).
  const LEVELS = {
    easy: { steps: 4, zone: 0.2, ramp: [0.12, 0.16], wobble: [0.05, 0.08], hz: [0.55, 0.85], repairs: 3, minWin: 0.32, mods: 0, stars: [0.4, 0.7, 0.88] },
    normal: { steps: 5, zone: 0.14, ramp: [0.14, 0.19], wobble: [0.07, 0.1], hz: [0.75, 1.1], repairs: 2, minWin: 0.2, mods: 1, stars: [0.4, 0.7, 0.9] },
    hard: { steps: 6, zone: 0.1, ramp: [0.17, 0.23], wobble: [0.08, 0.12], hz: [0.95, 1.35], repairs: 1, minWin: 0.13, mods: [1, 2], stars: [0.4, 0.72, 0.92] },
  };
  // Modifiers with a real basis:
  //   snag        ROSA's 2017 test array on the ISS would not retract (E5 ⚠): a boom mechanism that misbehaves in
  //               orbit → 1–2 steps whose tension jumps harder and climbs faster;
  //   hardRepair  AMS-02 was never meant to be serviced and needed 4 spacewalks with 29 purpose-built tools (P8) →
  //               one EVA repair fewer (never below 1) and each repair takes longer.
  const MODS = ['snag', 'hardRepair'];
  const SNAG = { ramp: 1.2, amp: 1.7 }; // game-balance
  const HARD_REPAIR_TIME = 1.6; // game-balance

  const r3 = x => Math.round(x * 1000) / 1000;
  const tensionAt = (S, t) => S.s0 + S.ramp * t + S.amp * (Math.sin(2 * Math.PI * S.hz * t + S.phase) - Math.sin(S.phase));

  // Windows of one step: when the tension first enters the zone, its longest stay and when it tops out.
  function windows(S) {
    let first = null, run = 0, best = 0, end = null;
    for (let t = 0; t <= MAX_STEP_S; t += SAMPLE_S) {
      const v = tensionAt(S, t);
      if (v >= 1) { end = t; break; }
      if (v >= S.lo && v <= S.hi) { if (first == null) first = t; run += SAMPLE_S; best = Math.max(best, run); } else run = 0;
    }
    return { first, best, end };
  }

  function generate(R, P, { mods }) {
    const snagN = mods.includes('snag') ? R.int(1, 2) : 0;
    const snagSteps = new Set(R.sample(Array.from({ length: P.steps - 1 }, (_, i) => i + 1), snagN)); // never the first
    // Each step is drawn again (a few times at most) until its window is fair, so whole layouts rarely fail.
    const makeStep = snag => {
      const zone = P.zone * R.float(0.9, 1.1);
      const mid = R.float(0.3 + zone / 2, 0.86 - zone / 2);
      return {
        s0: r3(R.float(0.03, 0.1)), ramp: r3(R.span(P.ramp) * (snag ? SNAG.ramp : 1)), amp: r3(R.span(P.wobble) * (snag ? SNAG.amp : 1)),
        hz: r3(R.span(P.hz)), phase: r3(R.float(0, Math.PI * 2)), lo: r3(mid - zone / 2), hi: r3(mid + zone / 2), snag,
      };
    };
    const steps = Array.from({ length: P.steps }, (_, i) => {
      let S = makeStep(snagSteps.has(i));
      for (let k = 0; k < STEP_TRIES && !fair(S, P); k++) S = makeStep(S.snag);
      return S;
    });
    const hard = mods.includes('hardRepair');
    return { steps, repairs: Math.max(1, P.repairs - (hard ? 1 : 0)), repairS: r3(REPAIR_S * (hard ? HARD_REPAIR_TIME : 1)) };
  }

  // Every step must have a fair window: reachable after a moment, long enough to hit, before the tension tops out.
  function fair(S, P) {
    const w = windows(S);
    return w.end != null && w.first != null && w.first >= FIRST_ENTRY_S && w.best >= P.minWin;
  }
  const validate = (L, P) => L.steps.every(S => fair(S, P));
  // The best result is always the full array: every step can be released cleanly.
  const solve = L => ({ power: FULL_W, steps: L.steps.length });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const N = L.steps.length, segW = FULL_W / N;
    const pace = host.reduced ? 0.75 : 1; // reduced motion: the tension moves more slowly
    let step = 0, local = 0, phase = 'tension', anim = 0, partial = 0;
    let repairsLeft = L.repairs, jams = 0, repairHeld = 0, keyRepair = false;
    const results = []; // per step: 'clean' | 'crooked'
    let lastAcc = 0;

    const css = getComputedStyle(document.documentElement);
    const v = (name, fb) => css.getPropertyValue(name).trim() || fb;
    const C = {
      space: v('--bg-viewport', '#17183B'), void: v('--bg-void', '#11071F'), cream: v('--starlight-cream', '#FCE8A6'),
      amber: v('--solar-amber', '#F59E0B'), safe: v('--safe', '#7EDAC2'), crimson: v('--crimson-alert', '#8F241E'),
      coral: v('--coral-hover', '#EE7B57'), amethyst: v('--amethyst', '#9B5DE5'), indigo: v('--bg-indigo', '#281147'), muted: v('--muted', '#B9B0CE'),
      cold: '#95B8F6',
    };
    const MARS = ['#3a0f1c', '#8F241E', '#b8391f', '#E04F26', '#EE7B57', '#f6a07f']; // shared "mars" ramp (web/app.js RAMPS)
    const stars = Array.from({ length: 26 }, () => [host.R.float(0, 1), host.R.float(0, 0.75), host.R.chance(0.3) ? 2 : 1]);

    const badge = ui.el('div', 'mg-badge');
    const readout = ui.readout(['step', 'power', 'repairs']);
    const cv = ui.canvas(0.36, 'lo1-canvas');
    const labels = ui.el('div', 'mg-gauge-labels');
    const gauge = ui.el('div', 'mg-gauge lo1-gauge');
    const zone = cls => { const z = ui.el('div', `mg-gauge-zone ${cls}`); gauge.append(z); return z; };
    const zSlack = zone('is-cold'), zGood = zone('is-good'), zOver = zone('is-hot');
    const needle = ui.el('div', 'mg-needle');
    gauge.append(needle);
    const mRepair = ui.meter('', 'lo1-repair');
    mRepair.node.hidden = true;
    const release = ui.button('', 'primary');
    const repair = ui.button('', 'amber');
    repair.hidden = true;
    const controls = ui.el('div', 'mg-controls');
    controls.append(release, repair);
    host.body.append(badge, readout.node, cv.node, labels, gauge, mRepair.node, controls);

    // Press = pointerdown (no click delay) or Space; a keyboard "click" on the focused button also counts.
    release.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); press(); } });
    release.addEventListener('click', e => { if (e.detail === 0) press(); });
    const repairHold = ui.hold(repair, () => {});
    host.onKey((e, down) => {
      if (e.code !== 'Space') return false;
      if (phase === 'jam') { if (down && !e.repeat) keyRepair = true; if (!down) keyRepair = false; repair.classList.toggle('is-held', keyRepair || repairHold.on); }
      else if (down && !e.repeat) press();
      return true;
    });

    const S = () => L.steps[step];
    const tension = () => tensionAt(S(), local * pace);
    const power = () => results.reduce((s, r) => s + segW * (r === 'clean' ? 1 : CROOKED_SHARE), 0);

    function press() {
      if (!host.active || phase !== 'tension') return;
      const val = tension(), s = S();
      if (val < s.lo) jam(val);
      else if (val > s.hi) settle('crooked', t('statusCrooked', { lost: U().number(segW * (1 - CROOKED_SHARE)) }));
      else {
        const mid = (s.lo + s.hi) / 2;
        lastAcc = 1 - Math.abs(val - mid) / ((s.hi - s.lo) / 2);
        settle('clean', t(lastAcc >= 0.8 ? 'statusPerfect' : 'statusClean', { watts: U().number(segW) }));
      }
    }

    function settle(kind, msg) {
      results.push(kind);
      phase = 'unroll'; anim = 0;
      render(msg);
    }

    function jam(val) {
      jams++;
      partial = clamp(0.25 + val, 0.25, 0.6);
      if (repairsLeft <= 0) {
        phase = 'failed';
        render();
        host.status('');
        host.fail(t('failJam', { pct: Math.round(((step + partial) / N) * 100), watts: U().number(power()), full: U().number(FULL_W) }));
        return;
      }
      phase = 'jam'; repairHeld = 0; keyRepair = false;
      render(t('statusJam', { watts: U().number(power()), left: repairsLeft }));
    }

    function nextStep() {
      step++; local = 0; partial = 0;
      if (step >= N) { done(); return; }
      phase = 'tension';
      render(S().snag ? t('event.snag') : t('statusStep', { step: step + 1, steps: N }));
    }

    function done() {
      phase = 'done';
      const share = power() / FULL_W;
      const score = share - JAM_PENALTY * jams;
      const stars = Math.max(1, starsFrom(score, P.stars));
      const crooked = results.filter(r => r === 'crooked').length;
      render(t('statusDone', { watts: U().number(power()), full: U().number(FULL_W) }));
      host.finish({ stars, summary: t('summary', { pct: Math.round(share * 100), crooked, jams }), metrics: { share, jams, crooked } });
    }

    host.loop(dt => {
      if (phase === 'tension') {
        local += dt;
        if (tension() >= 1) settle('crooked', t('statusOverrun', { lost: U().number(segW * (1 - CROOKED_SHARE)) }));
      } else if (phase === 'unroll') {
        anim += dt / (UNROLL_S / pace);
        if (anim >= 1) { nextStep(); return; }
      } else if (phase === 'jam') {
        if (repairHold.on || keyRepair) {
          repairHeld += dt;
          if (repairHeld >= L.repairS) {
            repairsLeft--; phase = 'tension'; local = 0; partial = 0; keyRepair = false;
            repairHold.release();
            render(t('statusRepaired', { left: repairsLeft }));
            return;
          }
        }
      }
      render();
    });

    function labelsText() {
      labels.replaceChildren(ui.el('span', '', t('zoneSlack')), ui.el('span', '', t('zoneGood')), ui.el('span', '', t('zoneOver')));
      zSlack.textContent = t('slackTag'); zGood.textContent = t('goodTag'); zOver.textContent = t('overTag');
      release.textContent = t('releaseBtn');
      repair.textContent = t('repairBtn');
      mRepair.label(t('repairLabel'));
      gauge.setAttribute('aria-label', t('gaugeAria'));
    }

    function render(status) {
      const s = S() || L.steps[N - 1];
      const pct = x => `${(clamp(x, 0, 1) * 100).toFixed(2)}%`;
      zSlack.style.left = '0%'; zSlack.style.width = pct(s.lo);
      zGood.style.left = pct(s.lo); zGood.style.width = pct(s.hi - s.lo);
      zOver.style.left = pct(s.hi); zOver.style.width = pct(1 - s.hi);
      const jammed = phase === 'jam' || phase === 'failed';
      const val = phase === 'tension' ? tension() : jammed ? s.lo * 0.5 : s.hi;
      const inZone = val >= s.lo && val <= s.hi;
      needle.style.left = pct(val);
      needle.className = `mg-needle${phase !== 'tension' ? '' : inZone ? ' is-good' : val > s.hi ? ' is-hot' : ' is-cold'}`;
      gauge.dataset.v = r3(val); gauge.dataset.lo = s.lo; gauge.dataset.hi = s.hi; gauge.dataset.phase = phase;
      let state = 'cold', text = t('badgeSlack');
      if (jammed) { state = 'danger'; text = t('badgeJam'); }
      else if (phase === 'done') { state = 'good'; text = t('badgeDone'); }
      else if (phase === 'unroll') { state = results[results.length - 1] === 'crooked' ? 'warn' : 'good'; text = t(state === 'warn' ? 'badgeCrooked' : 'badgeUnrolling'); }
      else if (inZone) { state = 'good'; text = t('badgeGood'); }
      else if (val > s.hi) { state = 'danger'; text = t('badgeOver'); }
      badge.className = `mg-badge is-${state}`;
      badge.textContent = text;
      readout.set('step', t('stepReadout', { step: Math.min(step + 1, N), steps: N }));
      readout.set('power', `${U().number(power())} / ${U().number(FULL_W)} W`, results.length === N ? 'good' : '');
      readout.set('repairs', t('repairsReadout', { left: repairsLeft }), repairsLeft === 0 ? 'danger' : '');
      release.hidden = phase === 'jam';
      release.disabled = !host.active || phase !== 'tension';
      repair.hidden = phase !== 'jam';
      mRepair.node.hidden = phase !== 'jam';
      mRepair.set(repairHeld / L.repairS, 'warn');
      draw(val);
      if (status) host.status(status);
    }

    // Canvas: the spacecraft, the blanket unrolling to the right in N segments and Mars below.
    function draw(val) {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      ctx.fillStyle = C.space; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = C.cream;
      for (const [x, y, s] of stars) ctx.fillRect(Math.round(x * w), Math.round(y * h), s, s);
      // Mars limb: a faceted fan below the frame.
      const cx = w * 0.72, cy = h * 2.35, rad = h * 1.75;
      for (let i = 0; i < 9; i++) {
        const a0 = Math.PI * (1.28 + i * 0.05), a1 = a0 + Math.PI * 0.05;
        ctx.fillStyle = MARS[1 + ((i * 3) % 4)];
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + rad * Math.cos(a0), cy + rad * Math.sin(a0)); ctx.lineTo(cx + rad * Math.cos(a1), cy + rad * Math.sin(a1)); ctx.closePath(); ctx.fill();
      }
      const yc = h * 0.44, hh = h * 0.2, x0 = w * 0.17, len = w * 0.79, seg = len / N;
      // Bus with a dish.
      ctx.fillStyle = C.indigo; ctx.fillRect(w * 0.05, yc - h * 0.15, w * 0.11, h * 0.3);
      ctx.fillStyle = '#3a2470'; ctx.beginPath(); ctx.moveTo(w * 0.05, yc - h * 0.15); ctx.lineTo(w * 0.16, yc - h * 0.15); ctx.lineTo(w * 0.05, yc + h * 0.15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.muted; ctx.beginPath(); ctx.moveTo(w * 0.07, yc - h * 0.15); ctx.lineTo(w * 0.105, yc - h * 0.27); ctx.lineTo(w * 0.14, yc - h * 0.15); ctx.closePath(); ctx.fill();
      // Segments: done ones, the one unrolling now, and the partial one of a jam.
      const segs = results.map((r, i) => ({ i, kind: r, k: 1 }));
      if (phase === 'unroll' && segs.length) segs[segs.length - 1].k = clamp(anim, 0.05, 1);
      if (phase === 'jam' || phase === 'failed') segs.push({ i: step, kind: 'jam', k: partial });
      let tip = x0;
      for (const sg of segs) {
        const xa = x0 + sg.i * seg, xb = xa + seg * sg.k, skew = sg.kind === 'crooked' ? hh * 0.32 * sg.k : 0;
        cellBlock(ctx, xa, xb, yc, hh, skew, sg.kind);
        tip = xb;
      }
      // Booms coloured by the tension state, and the roll at the tip.
      const boom = phase === 'jam' || phase === 'failed' ? C.coral : phase !== 'tension' ? C.muted : val > S().hi ? C.coral : val >= S().lo ? C.safe : C.cold;
      ctx.fillStyle = boom;
      ctx.fillRect(x0, yc - hh - 3, tip - x0 + 2, 3); ctx.fillRect(x0, yc + hh, tip - x0 + 2, 3);
      const rw = Math.max(8, w * 0.022);
      ctx.fillStyle = '#3a2470'; ctx.fillRect(tip, yc - hh - 6, rw, 2 * hh + 12);
      ctx.fillStyle = C.amethyst; ctx.fillRect(tip, yc - hh - 6, rw * 0.45, 2 * hh + 12);
      if (phase === 'jam' || phase === 'failed') {
        ctx.fillStyle = C.crimson; ctx.beginPath(); ctx.moveTo(tip + rw / 2, yc - hh - 22); ctx.lineTo(tip + rw / 2 + 11, yc - hh - 8); ctx.lineTo(tip + rw / 2 - 11, yc - hh - 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.cream; ctx.font = '700 11px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', tip + rw / 2, yc - hh - 10);
      }
      // Step ticks along the top.
      for (let i = 0; i < N; i++) {
        const r = results[i];
        ctx.fillStyle = r === 'clean' ? C.safe : r === 'crooked' ? C.amber : i === step && phase !== 'done' ? C.cream : '#3a2470';
        ctx.fillRect(x0 + i * seg + 2, h * 0.08, seg - 4, 4);
      }
    }

    function cellBlock(ctx, xa, xb, yc, hh, skew, kind) {
      const cols = 3, rows = 2, cw = (xb - xa) / cols, ch = (2 * hh) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = xa + c * cw, y = yc - hh + r * ch, sk0 = (skew * c) / cols, sk1 = (skew * (c + 1)) / cols;
        const p = [[x + 1, y + 1 + sk0], [x + cw - 1, y + 1 + sk1], [x + cw - 1, y + ch - 1 + sk1], [x + 1, y + ch - 1 + sk0]];
        ctx.fillStyle = kind === 'jam' ? '#4a1a3a' : '#2c1a5c';
        tri(ctx, p[0], p[1], p[2]);
        ctx.fillStyle = kind === 'jam' ? '#5e2040' : kind === 'crooked' ? '#4a2a5e' : '#3d2a7a';
        tri(ctx, p[0], p[2], p[3]);
      }
      if (kind === 'crooked') { ctx.fillStyle = C.amber; ctx.fillRect(xb - 4, yc - hh + skew, 3, 2 * hh); }
    }
    function tri(ctx, a, b, c) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill(); }

    labelsText();
    render(t('statusInitial', { steps: N, full: U().number(FULL_W) }) + (L.repairS > REPAIR_S ? ` ${t('event.hardRepair')}` : ''));
    return { render: () => { labelsText(); render(); } };
  }

  MG.register('L-O1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 30, normal: 35, hard: 40 },
    generate, validate, solve, mount,
  });
})();
