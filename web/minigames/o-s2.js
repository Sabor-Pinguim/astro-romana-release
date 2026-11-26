// O-S2 · Radio geodesy (Oscar / RISE on InSight) · keep in range. Plan: docs/experiments-implementation.md §5.3.
// A radio tone from the lander slides slowly across the receiver (Mars's rotation shifts its Doppler) and wobbles a
// little; Oscar turns the tuner (a dial, ◀ ▶ or ← →) to keep the tone inside the lock window. Holding it there for
// a moment locks the signal; locked time adds up over the session. Each run draws its own slide (start, size,
// period, phase), wobble and tuner start, so no two sessions are the same.
// Real numbers (references/experiments/mars-experiments.md PH3; docs/minigames.md O-S2): RISE weighed 7.3 kg and
// drew 78 W for up to 1 h a day, needed a direct X-band link to Earth, and after ~900 sols of tracking gave Mars's
// core radius, 1,835 ± 55 km. The frequency axis is a game scale (no real Doppler values are shown).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;
  const TAU = Math.PI * 2;
  const { sin, abs, min, max } = Math; // local aliases: fast in the validator's vm context too
  const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;

  const RISE_W = 78; // real (PH3): RISE power
  const SESSION_MIN = 60; // real (PH3): up to 1 h of tracking per day
  const SOLS_NEEDED = 900; // real (PH3): ~900 sols for the core result
  const CORE_KM = 1835; // real (PH3): core radius 1,835 ± 55 km
  const TUNE_RATE = 0.32; // game-balance: tuner speed (share of the band per s) while ◀ ▶ is held
  const DIAL_SPAN = 0.5; // game-balance: one full turn of the dial moves the tuner across half the band
  const MAX_SPEED = TUNE_RATE * 0.75; // game-balance: the tone never slides faster than a held tuner can follow
  const GRACE_S = 0.2; // game-balance: a lock survives this long outside the window
  const LINK_S = 3.5; // game-balance: length of the earthSet link loss
  const COLS = 56, ROWS = 34, ROW_S = 0.09; // waterfall grid and row period (s)

  // game-balance (plan §5.3). session: s of play for the 60-min session; window: half width of the lock window
  // (share of the band); slide: [amplitude, period range s] of the slow Doppler slide; wobble: [amplitude, base Hz];
  // acquire: s inside the window before the lock holds; stars: share of the best lockable time for 1, 2, 3 stars.
  const LEVELS = {
    easy: { session: 24, window: 0.07, slide: [0.22, [34, 50]], wobble: [0.025, 0.25], acquire: 0.4, mods: 0, stars: [0.5, 0.7, 0.85] },
    normal: { session: 30, window: 0.055, slide: [0.28, [28, 44]], wobble: [0.032, 0.27], acquire: 0.5, mods: 1, stars: [0.5, 0.72, 0.86] },
    hard: { session: 36, window: 0.046, slide: [0.32, [24, 38]], wobble: [0.036, 0.29], acquire: 0.6, mods: [1, 2], stars: [0.55, 0.74, 0.87] },
  };
  // Modifiers with a real basis:
  //   earthSet     RISE needs a direct link to Earth (PH3) and a lander has no line of sight to Earth ~12 h a day
  //                (mars-experiments.md §1 "Data relay"): Earth sinks low and the link drops for a few seconds;
  //   conjunction  near solar conjunction the Sun sits close to the line to Earth and blocks contact for weeks
  //                (mars-experiments.md §1): the tone jitters (the size of the jitter is game-balance);
  //   dustyPanels  dust on the solar panels ended InSight in Dec 2022 (experiments.md G9): less power, a fainter tone.
  const MODS = ['earthSet', 'conjunction', 'dustyPanels'];

  function generate(R, P, { mods }) {
    const [amp, [p0, p1]] = P.slide, [wa, whz] = P.wobble;
    const wobble = [
      { f: r3(whz * R.float(0.8, 1.25)), p: r3(R.float(0, TAU)), a: 1 },
      { f: r3(whz * 2.1 * R.float(0.85, 1.2)), p: r3(R.float(0, TAU)), a: 0.45 },
    ];
    const jitter = mods.includes('conjunction')
      ? [{ f: r3(R.float(1.1, 1.5)), p: r3(R.float(0, TAU)), a: 1 }, { f: r3(R.float(2.1, 2.9)), p: r3(R.float(0, TAU)), a: 0.6 }] : [];
    const tone = { c: r3(R.float(0.45, 0.55)), amp: r3(amp * R.float(0.85, 1.1) * (R.chance(0.5) ? 1 : -1)), period: r2(R.float(p0, p1)), phase: r3(R.float(0, TAU)), wa, wobble, ja: jitter.length ? r3(R.float(0.012, 0.018)) : 0, jitter };
    const f0 = smoothAt({ tone }, 0);
    const side = f0 > 0.5 ? -1 : 1;
    const link = mods.includes('earthSet') ? { at: r2(R.float(P.session * 0.35, P.session * 0.65)), dur: LINK_S } : null;
    return { tone, link, faint: mods.includes('dustyPanels'), tuner0: r3(clamp(f0 + side * R.float(0.16, 0.28), 0.06, 0.94)), sol: R.int(2, SOLS_NEEDED - 10), session: P.session };
  }

  // Tone position on the receiver (0–1): slow slide + wobble (smooth part) + conjunction jitter.
  function smoothAt(L, t) {
    const T = L.tone, wn = T.wobble.reduce((s, x) => s + x.a, 0);
    return T.c + T.amp * sin((TAU * t) / T.period + T.phase) + (T.wa * T.wobble.reduce((s, x) => s + x.a * sin(TAU * x.f * t + x.p), 0)) / wn;
  }
  function toneAt(L, t) {
    const T = L.tone;
    if (!T.ja) return smoothAt(L, t);
    const jn = T.jitter.reduce((s, x) => s + x.a, 0);
    return smoothAt(L, t) + (T.ja * T.jitter.reduce((s, x) => s + x.a * sin(TAU * x.f * t + x.p), 0)) / jn;
  }
  const linkDown = (L, t) => !!L.link && t >= L.link.at && t < L.link.at + L.link.dur;

  // Best locked time of this layout: a tuner that heads for the tone at full speed and follows it exactly (even
  // through a link loss, as if it guessed the slide); every new lock still needs the acquisition time.
  function solve(L, P) {
    const dt = 0.02;
    let x = L.tuner0, inside = 0, outside = 0, locked = false, total = 0;
    for (let t = 0; t < L.session; t += dt) {
      const f = toneAt(L, t);
      x += clamp(f - x, -TUNE_RATE * dt, TUNE_RATE * dt);
      if (linkDown(L, t)) { locked = false; inside = 0; continue; }
      if (abs(f - x) <= P.window) { inside += dt; outside = 0; if (inside >= P.acquire) locked = true; } else { inside = 0; outside += dt; if (outside > GRACE_S) locked = false; }
      if (locked) total += dt;
    }
    return { locked: r2(total) };
  }

  // Solvable: the tone stays on the receiver and its smooth part never slides faster than a held tuner (the
  // conjunction jitter is smaller than the lock window and is not meant to be followed).
  function validate(L, P) {
    let prev = smoothAt(L, 0);
    for (let t = 0.02; t <= L.session; t += 0.02) {
      const f = smoothAt(L, t);
      if (f < 0.07 || f > 0.93 || abs(f - prev) / 0.02 > MAX_SPEED) return false;
      prev = f;
    }
    return solve(L, P).locked >= L.session * 0.6;
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const best = solve(L, P).locked;
    const need = best * P.stars[0];
    const minutes = s => Math.round((s / L.session) * SESSION_MIN); // session seconds → minutes of the real hour
    const css = (name, fb) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
    const C = {
      ramp: [css('--f0', '#0c0517'), '#1b1240', '#2e1f5e', css('--amethyst', '#9B5DE5'), css('--solar-amber', '#F59E0B'), css('--starlight-cream', '#FCE8A6')],
      safe: css('--safe', '#7EDAC2'), amber: css('--solar-amber', '#F59E0B'), muted: css('--muted', '#B9B0CE'), coral: css('--coral-hover', '#EE7B57'),
      cream: css('--starlight-cream', '#FCE8A6'), heading: css('--heading', 'sans-serif'), viewport: css('--bg-viewport', '#17183B'),
    };
    const noiseAmp = (L.faint ? 0.5 : 0.36) * (host.reduced ? 0.6 : 1);
    const toneAmp = L.faint ? 0.5 : 0.95;
    const fixedNoise = Array.from({ length: COLS }, () => host.R.float(0, 1));

    let time = 0, tuner = L.tuner0, locked = false, inside = 0, outside = 0, lockedTime = 0, keyDir = 0, rowClock = 0;
    // lastState starts at 'searching' (where every run starts), so the first frame keeps the intro instead of
    // saying "lock lost" before there ever was a lock.
    let dialAngle = 0, dialLast = null, lastState = 'searching', told = { link: false, back: false };
    const rows = [];

    const readout = ui.readout(['lock', 'time', 'power']);
    const cv = ui.canvas(window.matchMedia?.('(max-width: 640px)').matches ? 0.66 : 0.44, 'os2-view');
    const meters = ui.el('div', 'mg-meters');
    const mLock = ui.meter(''), mSig = ui.meter('');
    meters.append(mLock.node, mSig.node);
    const left = ui.button('◀', ''), right = ui.button('▶', '');
    left.classList.add('os2-step'); right.classList.add('os2-step');
    const holdL = ui.hold(left, () => {}), holdR = ui.hold(right, () => {});
    const dial = ui.el('div', 'os2-dial');
    const mark = ui.el('i', 'os2-dial-mark');
    dial.append(mark);
    dial.tabIndex = 0;
    dial.setAttribute('role', 'slider');
    dial.setAttribute('aria-valuemin', '0'); dial.setAttribute('aria-valuemax', '100');
    const tuneBox = ui.el('div', 'os2-tune');
    const dialLabel = ui.el('span', 'os2-dial-label');
    tuneBox.append(left, ui.el('div', 'os2-dial-wrap'), right);
    tuneBox.children[1].append(dial, dialLabel);
    host.body.append(readout.node, cv.node, tuneBox, meters);

    host.onKey((e, down) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) { keyDir = down ? -1 : keyDir === -1 ? 0 : keyDir; left.classList.toggle('is-held', down || holdL.on); return true; }
      if (['ArrowRight', 'KeyD'].includes(e.code)) { keyDir = down ? 1 : keyDir === 1 ? 0 : keyDir; right.classList.toggle('is-held', down || holdR.on); return true; }
      return false;
    });
    const angleOf = e => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    dial.addEventListener('pointerdown', e => {
      if (!host.active || e.button !== 0) return;
      dialLast = angleOf(e);
      try { dial.setPointerCapture(e.pointerId); } catch { /* gone */ }
      e.preventDefault();
    });
    dial.addEventListener('pointermove', e => {
      if (dialLast == null || !host.active) return;
      const a = angleOf(e);
      let d = a - dialLast;
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      dialLast = a;
      tuner = clamp(tuner + (d / TAU) * DIAL_SPAN, 0.02, 0.98);
      dialAngle += d;
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) dial.addEventListener(ev, () => { dialLast = null; });

    function pushRow(at) {
      const row = new Float32Array(COLS);
      const live = !linkDown(L, at), f = toneAt(L, at);
      for (let i = 0; i < COLS; i++) {
        row[i] = noiseAmp * (host.reduced ? fixedNoise[i] * 0.7 + host.R.float(0, 0.3) : host.R.float(0, 1));
        if (live) row[i] += toneAmp * max(0, 1 - abs(i + 0.5 - f * COLS) / 1.3);
      }
      rows.unshift(row);
      if (rows.length > ROWS) rows.pop();
    }
    for (let k = ROWS - 1; k >= 0; k--) pushRow(-k * ROW_S);

    function labelsText() {
      mLock.label(t('lockLabel', { need: minutes(need), max: SESSION_MIN }));
      dialLabel.textContent = t('dialLabel');
      left.setAttribute('aria-label', t('tuneDown')); right.setAttribute('aria-label', t('tuneUp'));
      dial.setAttribute('aria-label', t('dialLabel'));
      readout.set('power', t('powerReadout', { watts: RISE_W }));
    }

    function stateNow() {
      if (linkDown(L, time)) return 'nolink';
      if (locked) return 'locked';
      if (inside > 0) return 'acquiring';
      return 'searching';
    }

    function render(status) {
      const st = stateNow();
      const tag = { locked: 'good', acquiring: 'warn', nolink: 'danger', searching: '' }[st];
      readout.set('lock', t(`state.${st}`), tag);
      readout.set('time', t('timeReadout', { got: minutes(lockedTime), max: SESSION_MIN, left: max(0, Math.ceil(L.session - time)) }), lockedTime >= need ? 'good' : '');
      mLock.set(lockedTime / max(0.01, best), lockedTime >= need ? '' : 'info');
      const sig = linkDown(L, time) ? 0 : max(0, 1 - abs(toneAt(L, time) - tuner) / (P.window * 2.5));
      mSig.set(sig, st === 'locked' ? '' : st === 'acquiring' ? 'warn' : 'danger');
      mSig.label(t('signalLabel', { pct: Math.round(sig * 100) }));
      mark.style.transform = `rotate(${dialAngle.toFixed(3)}rad)`;
      dial.setAttribute('aria-valuenow', String(Math.round(tuner * 100)));
      if (status) host.status(status);
      draw(st);
    }

    function draw(st) {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      if (w < 2 || h < 2) return;
      const scaleH = 16, gh = h - scaleH, cw = w / COLS, rh = gh / ROWS;
      ctx.fillStyle = C.ramp[0]; ctx.fillRect(0, 0, w, h);
      rows.forEach((row, r) => {
        for (let i = 0; i < COLS; i++) {
          const k = min(C.ramp.length - 1, Math.floor(row[i] * C.ramp.length * 0.999));
          if (!k) continue;
          ctx.fillStyle = C.ramp[k];
          ctx.fillRect(Math.floor(i * cw), Math.floor(r * rh), Math.ceil(cw), Math.ceil(rh));
        }
      });
      // Lock window of the tuner: a column with hard edges.
      const xa = (tuner - P.window) * w, xb = (tuner + P.window) * w;
      const col = st === 'locked' ? C.safe : st === 'acquiring' ? C.amber : st === 'nolink' ? C.coral : C.muted;
      ctx.fillStyle = 'rgba(126,218,194,0.12)'; ctx.fillRect(xa, 0, xb - xa, gh);
      ctx.fillStyle = col;
      ctx.fillRect(xa - 1, 0, 2, gh); ctx.fillRect(xb - 1, 0, 2, gh);
      ctx.beginPath(); ctx.moveTo(tuner * w - 7, 0); ctx.lineTo(tuner * w + 7, 0); ctx.lineTo(tuner * w, 9); ctx.fill();
      // Scale under the waterfall.
      ctx.fillStyle = C.viewport; ctx.fillRect(0, gh, w, scaleH);
      ctx.fillStyle = C.muted;
      for (let k = 0; k <= 20; k++) ctx.fillRect(Math.round((k / 20) * (w - 1)), gh, 1, k % 5 ? 4 : 8);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(tuner * w, gh + 2); ctx.lineTo(tuner * w + 6, h); ctx.lineTo(tuner * w - 6, h); ctx.fill();
      ctx.font = `700 10px ${C.heading}`; ctx.textAlign = 'left'; ctx.fillStyle = C.cream;
      ctx.fillText(t('canvasSol', { sol: L.sol, total: SOLS_NEEDED }), 6, 14);
      ctx.textAlign = 'right'; ctx.fillStyle = C.muted;
      ctx.fillText(t('canvasAxis'), w - 6, 14);
      if (st === 'nolink') {
        ctx.textAlign = 'center'; ctx.fillStyle = C.coral; ctx.font = `700 12px ${C.heading}`;
        ctx.fillText(t('canvasNoLink'), w / 2, gh / 2);
      }
    }

    function finishRun() {
      left.disabled = right.disabled = true;
      const score = min(1, lockedTime / max(0.01, best));
      if (lockedTime < need) {
        render();
        host.fail(t('failLost', { got: minutes(lockedTime), need: minutes(need), sols: SOLS_NEEDED }));
        return;
      }
      const stars = MG.lib.starsFrom(score, P.stars);
      render(t('statusDone', { got: minutes(lockedTime) }));
      host.finish({
        stars,
        summary: t('summary', { got: minutes(lockedTime), max: SESSION_MIN, pct: Math.round(score * 100) }),
        metrics: { lockedS: r2(lockedTime), best, score: r3(score) },
      });
    }

    host.loop(dt => {
      time += dt;
      const dir = keyDir || (holdR.on ? 1 : 0) - (holdL.on ? 1 : 0);
      if (dir) { tuner = clamp(tuner + dir * TUNE_RATE * dt, 0.02, 0.98); dialAngle += (dir * TUNE_RATE * dt * TAU) / DIAL_SPAN; }
      const down = linkDown(L, time);
      if (down) { locked = false; inside = 0; outside = 0; }
      else if (abs(toneAt(L, time) - tuner) <= P.window) { inside += dt; outside = 0; if (inside >= P.acquire) locked = true; }
      else { inside = 0; outside += dt; if (outside > GRACE_S) locked = false; }
      if (locked) lockedTime += dt;
      rowClock += dt;
      while (rowClock >= ROW_S) { rowClock -= ROW_S; pushRow(time); }
      let status = '';
      const st = stateNow();
      if (down && !told.link) { told.link = true; status = t('event.earthSet'); }
      else if (!down && told.link && !told.back) { told.back = true; status = t('statusBack'); }
      else if (st !== lastState && !down) status = t(`status.${st}`);
      lastState = st;
      if (time >= L.session) { finishRun(); return; }
      render(status);
    });

    labelsText();
    const intro = [t('statusInitial', { need: minutes(need), max: SESSION_MIN })];
    if (L.faint) intro.push(t('event.dustyPanels'));
    if (L.tone.ja) intro.push(t('event.conjunction'));
    render(intro.join(' '));
    return { render: () => { labelsText(); render(); } };
  }

  MG.register('O-S2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 24, normal: 30, hard: 36 },
    factVars: U => ({ core: U.distanceKm(CORE_KM, 0), sols: U.number(SOLS_NEEDED) }),
    generate, validate, solve, mount,
  });
})();
