// H-O2 · Roll for the radar (Helena / MRO and SHARAD) · piloting. Plan: docs/experiments-implementation.md §4.3, §5.3.
// "Precise turn": roll the spacecraft to the requested angle with as few thruster pulses as possible, then hold it
// steady while the "lake" site passes under the radar. Each pulse adds angular speed and the spin keeps going until
// an opposite pulse brakes it (attitude physics: no friction in orbit), so overshooting costs fuel to correct.
// Real basis (references/experiments/mars-experiments.md PH7; docs/minigames.md H-O2): in 2025 MRO rolled 120° so
// SHARAD could look at the supposed lake under the south polar ice, and saw only a faint echo. Each run draws the
// requested angle around that 120°, the roll direction, the time until the site arrives and the disturbances; the
// stars compare the fuel used with the least fuel that does this roll (solve) and the echo recorded in the window.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const ROLL_REAL = 120; // real (PH7): MRO's roll for SHARAD in 2025, degrees
  const PULSE = 4; // game-balance: angular speed added by one thruster pulse (°/s of play)
  const TAP = 1; // game-balance: angular speed added by a short tap
  const TAP_COST = TAP / PULSE; // derived: fuel is proportional to the impulse, so a tap costs ¼ of a pulse
  const GRACE_S = 3; // game-balance: the clock starts at the first pulse or after this many seconds
  const WEAK = 0.6; // game-balance: share of the push left on the leaky side
  const LOW_FUEL = 0.8; // game-balance: fuel left when the tank is low
  const SUN_ALPHA = [0.08, 0.14]; // game-balance: steady torque of sunlight pressure (°/s², either way)
  const MAX_RATE = 16; // game-balance: the slowest roll that still arrives in time must stay below this (°/s)
  const GAUGE_DEG = 20; // fine gauge half-range around the target (°)
  const DATA = [0.5, 0.75, 0.92]; // game-balance: share of the window with a steady echo for 1, 2 and 3 stars
  const ASPECT = 0.5; // canvas height / width
  // Body ramps of the identity guide (docs/visual-identity.md §2; RAMPS in web/app.js), dark to light.
  const MARS = ['#3a0f1c', '#8F241E', '#b8391f', '#E04F26', '#EE7B57', '#f6a07f'];
  const ICE = ['#8a7a86', '#c9b8b0', '#e9dccb', '#FCE8A6', '#fff6dc', '#ffffff'];

  // game-balance (plan §5.3). angle: requested roll (° either way, around the real 120°); tol: band around it (°);
  // holdRate: the most spin that still counts as steady (°/s); open: seconds until the site arrives; hold: seconds of
  // the measurement window; fuel: tank as a multiple of the least fuel (solve); three / two: fuel used, as a multiple
  // of that least fuel (+½ unit), for 3 and 2 stars.
  const LEVELS = {
    easy: { angle: [105, 135], tol: 4, holdRate: 1.2, open: [16, 19], hold: 5, fuel: 3, three: 1.6, two: 2.5, mods: 0 },
    normal: { angle: [95, 145], tol: 3, holdRate: 1, open: [13.5, 16], hold: 6, fuel: 2.5, three: 1.45, two: 2.2, mods: 1 },
    hard: { angle: [85, 155], tol: 2, holdRate: 0.8, open: [12, 14], hold: 7, fuel: 2.3, three: 1.35, two: 1.9, mods: [1, 2] },
  };
  // Modifiers with a real basis (references/experiments/experiments.md):
  //   sunPressure    after a reaction-wheel failure Kepler was balanced against the pressure of sunlight (E18): a
  //                  small steady torque turns the spacecraft all the time;
  //   leakyThruster  Hayabusa lost contact after a thruster leak, and a MarCO CubeSat had a leaking thruster (G4,
  //                  E12): the thrusters on one side push only part of the way;
  //   lowFuel        Dawn pointed with hydrazine after its wheels failed and ended when it ran out; Kepler retired
  //                  out of fuel (E8, E18): an old orbiter has less fuel for this roll.
  const MODS = ['sunPressure', 'leakyThruster', 'lowFuel'];

  const quarter = x => Math.round(x * 4) / 4;
  const r2 = x => Math.round(x * 100) / 100;

  // Least fuel for this layout (fuel units; 1 = one full pulse). Impulsive plan: one burn at the start sized to
  // arrive by the time the window opens, one burn to stop on the target, then the impulse that cancels the steady
  // torque for the rest of the window (a free arc inside the band covers part of it). Burns come in taps.
  function minFuel(L) {
    const s = Math.sign(L.angle) || 1, A = Math.abs(L.angle), a = L.alpha * s;
    const eff = dir => (dir === L.weakSide ? WEAK : 1);
    const step = TAP * eff(s), T = L.tOpen, end = T + L.hold;
    const need = Math.max(step, (A - 0.5 * a * T * T) / T);
    const u0 = Math.ceil(need / step - 1e-9) * step;
    let arrive = Math.abs(a) < 1e-9 ? A / u0 : u0 * u0 + 2 * a * A >= 0 ? (-u0 + Math.sqrt(u0 * u0 + 2 * a * A)) / a : T;
    arrive = clamp(arrive, 0.5, T);
    const v = Math.max(0, u0 + a * arrive);
    // A free arc inside the band: enter at one edge at speed v0 against the torque, turn back at the other edge.
    const v0 = Math.min(Math.sqrt(4 * L.tol * Math.abs(a)), L.holdRate);
    const arc = Math.abs(a) > 1e-9 ? (2 * v0) / Math.abs(a) : Infinity;
    const holdImpulse = Math.abs(L.alpha) * Math.max(0, end - arrive - arc);
    const fuel = u0 / (PULSE * eff(s)) + v / (PULSE * eff(-s)) + (holdImpulse ? holdImpulse / (PULSE * eff(-Math.sign(L.alpha))) : 0);
    return { fuel: r2(fuel), rate: r2(need) };
  }

  function generate(R, P, { mods }) {
    const side = R.chance(0.5) ? 1 : -1;
    const L = {
      angle: side * R.int(P.angle[0], P.angle[1]), tol: P.tol, holdRate: P.holdRate,
      tOpen: Math.round(R.float(P.open[0], P.open[1]) * 10) / 10, hold: P.hold,
      alpha: mods.includes('sunPressure') ? (R.chance(0.5) ? 1 : -1) * Math.round(R.float(SUN_ALPHA[0], SUN_ALPHA[1]) * 1000) / 1000 : 0,
      weakSide: mods.includes('leakyThruster') ? (R.chance(0.5) ? 1 : -1) : 0,
      ground: Array.from({ length: 9 }, () => Math.round(R.float(0, 1) * 100) / 100), // shades of the ground track (art)
    };
    const best = minFuel(L);
    L.fuelMin = best.fuel;
    L.rateMin = best.rate;
    L.fuel = Math.max(3, quarter(best.fuel * P.fuel * (mods.includes('lowFuel') ? LOW_FUEL : 1) + 1.5));
    return L;
  }
  const validate = L => L.rateMin <= MAX_RATE && L.fuel >= L.fuelMin * 1.4 + 0.5;
  const solve = L => ({ fuel: L.fuelMin, rate: L.rateMin });

  function palette(node) {
    const cs = getComputedStyle(node);
    const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    return {
      view: v('--bg-viewport', '#17183B'), f0: v('--f0', '#0c0517'), f3: v('--f3', '#24143a'), f4: v('--f4', '#281147'),
      amber: v('--solar-amber', '#F59E0B'), orange: v('--mars-orange', '#E04F26'), coral: v('--coral-hover', '#EE7B57'),
      safe: v('--safe', '#7EDAC2'), cream: v('--starlight-cream', '#FCE8A6'), muted: v('--muted', '#B9B0CE'),
      amethyst: v('--amethyst', '#9B5DE5'), void: v('--bg-void', '#11071F'), heading: v('--heading', 'sans-serif'),
    };
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const C = palette(host.root);
    const end = L.tOpen + L.hold;
    const sky = Array.from({ length: 36 }, () => ({ x: host.R.float(0, 1), y: host.R.float(0, 0.8), s: host.R.pick([1, 1, 2]) }));

    const readout = ui.readout(['roll', 'rate', 'time']);
    const view = ui.canvas(ASPECT, 'ho2-view');
    view.node.setAttribute('role', 'img');
    const labelsRow = ui.el('div', 'mg-gauge-labels');
    const gauge = ui.el('div', 'mg-gauge ho2-gauge');
    const pct = deg => ((clamp(deg - L.angle, -GAUGE_DEG, GAUGE_DEG) + GAUGE_DEG) / (2 * GAUGE_DEG)) * 100;
    const zone = ui.el('div', 'mg-gauge-zone is-good');
    zone.style.left = `${pct(L.angle - L.tol)}%`; zone.style.width = `${pct(L.angle + L.tol) - pct(L.angle - L.tol)}%`;
    const needle = ui.el('div', 'mg-needle');
    gauge.append(zone, needle);
    const meters = ui.el('div', 'mg-meters');
    const mFuel = ui.meter(''), mEcho = ui.meter('');
    meters.append(mFuel.node, mEcho.node);
    const pad = ui.el('div', 'mg-controls ho2-pad');
    const thruster = (dir, tap) => {
      const b = ui.button('', tap ? 'quiet' : '', () => fire(dir, tap));
      b.classList.add(tap ? 'ho2-tap' : 'ho2-pulse');
      pad.append(b);
      return b;
    };
    const buttons = { pulseNeg: thruster(-1, false), tapNeg: thruster(-1, true), tapPos: thruster(1, true), pulsePos: thruster(1, false) };
    const hint = ui.el('p', 'mg-hint');
    host.body.append(readout.node, view.node, labelsRow, gauge, meters, pad, hint);

    let theta = 0, omega = 0, time = 0, vt = 0, started = false, ended = false;
    let fuel = L.fuel, used = 0, pulses = 0, echo = 0, puff = null, lastStatus = '', holdUntil = -1;
    const announced = new Set();

    function say(text, hold = 0) {
      if (hold) holdUntil = vt + hold; else if (vt < holdUntil) return;
      if (text !== lastStatus) { lastStatus = text; host.status(text); }
    }
    const deg = (x, d = 1) => `${x < -0.05 ? '−' : x > 0.05 ? '+' : ''}${U().decimal(Math.abs(x), d)}°`;
    const dirName = d => t(d > 0 ? 'dirCw' : 'dirCcw');
    const begin = () => { if (!started && !ended) { started = true; say(t('statusGo', { time: Math.round(L.tOpen) }), 2.5); } };

    function fire(dir, tap) {
      if (!host.active || ended) return;
      const cost = tap ? TAP_COST : 1;
      if (fuel + 1e-9 < cost) { say(t('statusNoFuel'), 2); return; }
      begin();
      fuel -= cost; used += cost; pulses++;
      omega += dir * (tap ? TAP : PULSE) * (dir === L.weakSide ? WEAK : 1);
      puff = { dir, tap, until: vt + 0.3 };
      hud();
    }
    const KEYS = { ArrowLeft: [-1, false], KeyA: [-1, false], ArrowRight: [1, false], KeyD: [1, false], KeyQ: [-1, true], KeyE: [1, true] };
    host.onKey((e, down) => {
      const k = KEYS[e.code];
      if (!k) return false;
      if (down && !e.repeat) fire(k[0], k[1] || e.shiftKey);
      return true;
    });

    function labels() {
      buttons.pulseNeg.textContent = t('pulseNeg'); buttons.tapNeg.textContent = t('tapNeg');
      buttons.tapPos.textContent = t('tapPos'); buttons.pulsePos.textContent = t('pulsePos');
      buttons.pulseNeg.setAttribute('aria-label', t('ariaPulse', { dir: dirName(-1), rate: PULSE }));
      buttons.pulsePos.setAttribute('aria-label', t('ariaPulse', { dir: dirName(1), rate: PULSE }));
      buttons.tapNeg.setAttribute('aria-label', t('ariaTap', { dir: dirName(-1), rate: TAP }));
      buttons.tapPos.setAttribute('aria-label', t('ariaTap', { dir: dirName(1), rate: TAP }));
      labelsRow.replaceChildren(ui.el('span', '', `−${GAUGE_DEG}°`), ui.el('span', '', t('gaugeTarget', { target: deg(L.angle, 0), tol: L.tol })), ui.el('span', '', `+${GAUGE_DEG}°`));
      hint.textContent = t('hint', { pulse: PULSE, tap: TAP });
      view.node.setAttribute('aria-label', t('viewAria'));
    }

    function hud() {
      const err = theta - L.angle, inBand = Math.abs(err) <= L.tol, steady = inBand && Math.abs(omega) <= L.holdRate;
      readout.set('roll', t('rollReadout', { roll: deg(theta), target: deg(L.angle, 0) }), steady ? 'good' : inBand ? 'warn' : '');
      readout.set('rate', t('rateReadout', { rate: deg(omega) }), Math.abs(omega) <= L.holdRate ? 'good' : '');
      const toOpen = L.tOpen - time;
      readout.set('time', !started ? t('timeReady') : toOpen > 0 ? t('timeSite', { s: Math.ceil(toOpen) }) : time < end ? t('timeMeasure', { s: Math.ceil(end - time) }) : t('timeOver'), toOpen > 0 && toOpen < 5 ? 'danger' : '');
      needle.style.left = `${pct(theta).toFixed(2)}%`;
      needle.className = `mg-needle${steady ? ' is-good' : Math.abs(err) > GAUGE_DEG ? ' is-cold' : ''}`;
      mFuel.label(t('fuelLabel', { left: U().decimal(fuel, 2), total: U().decimal(L.fuel, 2) }));
      mFuel.set(fuel / L.fuel, fuel < L.fuel * 0.25 ? 'danger' : 'warn');
      mEcho.label(t('echoLabel', { pct: Math.round((echo / L.hold) * 100) }));
      mEcho.set(echo / L.hold, echo / L.hold >= DATA[1] ? '' : 'info');
      for (const [key, b] of Object.entries(buttons)) b.disabled = ended || fuel + 1e-9 < (key.startsWith('tap') ? TAP_COST : 1);
    }

    function draw() {
      view.fit();
      const ctx = view.ctx, w = view.w, H = view.h;
      if (!w) return;
      ctx.fillStyle = C.view; ctx.fillRect(0, 0, w, H);
      ctx.fillStyle = C.muted;
      for (const p of sky) ctx.fillRect(Math.round(p.x * w), Math.round(p.y * H), p.s, p.s);
      // Ground track strip: Mars below, the "lake" site sliding toward the nadir bracket.
      const gy = H * 0.84, cx = w / 2, speed = (w * 0.42) / L.tOpen;
      for (let i = 0; i < L.ground.length; i++) {
        const x0 = (i / L.ground.length) * w - ((time * speed) % (w / L.ground.length)), x1 = x0 + w / L.ground.length;
        ctx.fillStyle = MARS[1 + Math.round(L.ground[(i + Math.floor((time * speed) / (w / L.ground.length))) % L.ground.length] * 2)];
        ctx.beginPath(); ctx.moveTo(x0, gy + 3); ctx.lineTo(x1 + 1, gy); ctx.lineTo(x1 + 1, H); ctx.lineTo(x0, H); ctx.closePath(); ctx.fill();
      }
      const lakeX = cx + (L.tOpen + L.hold / 2 - time) * speed, half = (L.hold / 2) * speed;
      ctx.fillStyle = ICE[3];
      ctx.beginPath(); ctx.moveTo(lakeX - half * 0.8, H - 4); ctx.lineTo(lakeX - half * 0.5, gy + 5); ctx.lineTo(lakeX + half * 0.6, gy + 6); ctx.lineTo(lakeX + half * 0.8, H - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ICE[5];
      ctx.beginPath(); ctx.moveTo(lakeX - half * 0.5, gy + 5); ctx.lineTo(lakeX + half * 0.6, gy + 6); ctx.lineTo(lakeX, H - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.amber;
      for (const x of [cx - half, cx + half]) ctx.fillRect(x - 1, gy - 6, 2, H - gy + 6);
      // Dial: ticks every 10°, target marker, needle at the current roll. 0° = radar pointing straight down.
      const dy = H * 0.43, R = H * 0.36, dir = a => [-Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
      for (let a = -180; a < 180; a += 10) {
        const [ux, uy] = dir(a), major = a % 30 === 0;
        ctx.strokeStyle = major ? C.muted : C.f4; ctx.lineWidth = major ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(cx + ux * R, dy + uy * R); ctx.lineTo(cx + ux * (R - (major ? 7 : 4)), dy + uy * (R - (major ? 7 : 4))); ctx.stroke();
      }
      const steady = Math.abs(theta - L.angle) <= L.tol && Math.abs(omega) <= L.holdRate;
      ctx.fillStyle = C.safe;
      ctx.beginPath(); ctx.moveTo(cx, dy);
      for (let a = L.angle - L.tol; a <= L.angle + L.tol + 1e-6; a += L.tol / 4) { const [ux, uy] = dir(a); ctx.lineTo(cx + ux * R, dy + uy * R); }
      ctx.closePath(); ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
      const [tx, ty] = dir(L.angle), [px, py] = [-ty, tx];
      ctx.fillStyle = C.safe;
      ctx.beginPath(); ctx.moveTo(cx + tx * (R + 1), dy + ty * (R + 1)); ctx.lineTo(cx + tx * (R + 10) + px * 6, dy + ty * (R + 10) + py * 6); ctx.lineTo(cx + tx * (R + 10) - px * 6, dy + ty * (R + 10) - py * 6); ctx.closePath(); ctx.fill();
      ctx.font = `700 ${Math.max(10, Math.round(H * 0.05))}px ${C.heading}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(deg(L.angle, 0), cx + tx * (R + 26), dy + ty * (R + 22));
      ctx.fillStyle = C.muted; ctx.fillText('0°', cx, dy + R + 10);
      // Spacecraft (seen along its path): bus, solar wings, dish on top, radar antenna below. Rolls with theta.
      const k = R * 0.5;
      ctx.save(); ctx.translate(cx, dy); ctx.rotate((theta * Math.PI) / 180);
      const quad = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * k, y * k)); ctx.closePath(); ctx.fill(); };
      quad([[-1.55, -0.14], [-0.42, -0.14], [-0.42, 0], [-1.55, 0]], C.amethyst);
      quad([[-1.55, 0], [-0.42, 0], [-0.42, 0.14], [-1.55, 0.14]], C.f4);
      quad([[0.42, -0.14], [1.55, -0.14], [1.55, 0], [0.42, 0]], C.amethyst);
      quad([[0.42, 0], [1.55, 0], [1.55, 0.14], [0.42, 0.14]], C.f4);
      quad([[-0.6, -0.95], [0.6, -0.95], [0.32, -0.55], [-0.32, -0.55]], C.cream);
      quad([[-0.6, -0.95], [0, -0.95], [0, -0.55], [-0.32, -0.55]], ICE[2]);
      quad([[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]], C.amber);
      quad([[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4]], C.orange);
      ctx.strokeStyle = C.cream; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0.4 * k); ctx.lineTo(0, 1.25 * k); ctx.moveTo(-0.5 * k, 1.25 * k); ctx.lineTo(0.5 * k, 1.25 * k); ctx.stroke();
      if (steady && time >= L.tOpen && time < end) {
        ctx.strokeStyle = C.safe; ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-0.25 * i * k, (1.3 + 0.28 * i) * k); ctx.lineTo(0, (1.42 + 0.28 * i) * k); ctx.lineTo(0.25 * i * k, (1.3 + 0.28 * i) * k); ctx.stroke(); }
      }
      if (puff && vt < puff.until) {
        // The plume leaves the top corner opposite to the push: a push to the right on top rolls clockwise.
        const x = -0.4 * puff.dir * k, y = -0.3 * k, len = (puff.tap ? 0.3 : 0.6) * k, wid = (puff.tap ? 0.07 : 0.13) * k;
        ctx.fillStyle = puff.tap ? C.cream : C.coral;
        ctx.beginPath(); ctx.moveTo(x, y - wid); ctx.lineTo(x - puff.dir * len, y); ctx.lineTo(x, y + wid); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // Needle on the dial.
      const [nx, ny] = dir(theta);
      ctx.strokeStyle = steady ? C.safe : C.amber; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + nx * (R - 14), dy + ny * (R - 14)); ctx.lineTo(cx + nx * (R + 4), dy + ny * (R + 4)); ctx.stroke();
    }

    host.loop((dt, elapsed) => {
      vt = elapsed;
      if (!started && elapsed >= GRACE_S) begin();
      if (started && !ended) {
        time += dt;
        omega += L.alpha * dt;
        theta += omega * dt;
        const steady = Math.abs(theta - L.angle) <= L.tol && Math.abs(omega) <= L.holdRate;
        if (time >= L.tOpen && time < end && steady) echo = Math.min(L.hold, echo + dt);
        if (L.alpha && !announced.has('sun') && time > 1) { announced.add('sun'); say(t('event.sunPressure', { dir: dirName(Math.sign(L.alpha)) }), 3); }
        if (time >= L.tOpen && !announced.has('open')) { announced.add('open'); say(t('statusOpen'), 2.5); }
        const err = theta - L.angle;
        if (time < L.tOpen) say(Math.abs(err) <= L.tol ? (Math.abs(omega) <= L.holdRate ? t('statusWaiting') : t('statusBrake')) : Math.abs(omega) < 0.05 ? t('statusTurn', { dir: dirName(Math.sign(-err)) }) : Math.sign(omega) === Math.sign(-err) ? t('statusCoast') : t('statusWrongWay'));
        else say(Math.abs(err) <= L.tol && Math.abs(omega) <= L.holdRate ? t('statusEcho') : t('statusLost'));
        if (fuel + 1e-9 < TAP_COST && Math.abs(omega) > L.holdRate + Math.abs(L.alpha) * (end - time) && time < end) {
          ended = true; hud(); draw();
          host.fail(t('failFuel'));
          return;
        }
        if (time >= end) return finishRun();
      }
      hud();
      draw();
    });

    function finishRun() {
      ended = true;
      hud(); draw();
      const share = echo / L.hold;
      const dataStars = share >= DATA[2] ? 3 : share >= DATA[1] ? 2 : share >= DATA[0] ? 1 : 0;
      if (!dataStars) { host.fail(fuel + 1e-9 < TAP_COST ? t('failFuel') : t('failWindow', { pct: Math.round(share * 100) })); return; }
      const fuelStars = used <= L.fuelMin * P.three + 0.5 ? 3 : used <= L.fuelMin * P.two + 0.5 ? 2 : 1;
      const stars = Math.min(dataStars, fuelStars);
      host.status(t('statusDone', { pct: Math.round(share * 100) }));
      host.finish({
        stars,
        summary: t('summary', { pct: Math.round(share * 100), used: U().decimal(used, 2), best: U().decimal(L.fuelMin, 2), pulses }),
        metrics: { echoShare: Math.round(share * 100) / 100, fuelUsed: used, fuelMin: L.fuelMin, pulses },
      });
    }

    // Read-only snapshot for scripted tests (tools/minigame-lab); holds no game logic.
    host.root.mgProbe = () => ({ theta, omega, time, started, target: L.angle, tol: L.tol, holdRate: L.holdRate, tOpen: L.tOpen, end, fuel, used, echo, alpha: L.alpha, weakSide: L.weakSide, fuelMin: L.fuelMin });

    labels();
    hud();
    draw();
    const intro = [t('statusInitial', { target: deg(L.angle, 0), dir: dirName(Math.sign(L.angle)), real: ROLL_REAL, s: GRACE_S })];
    if (L.weakSide) intro.push(t('event.leakyThruster', { dir: dirName(L.weakSide), pct: Math.round(WEAK * 100) }));
    if (host.mods.includes('lowFuel')) intro.push(t('event.lowFuel'));
    host.status(intro.join(' '));
    lastStatus = '';
    holdUntil = GRACE_S;
    return { render: () => { labels(); hud(); draw(); } };
  }

  MG.register('H-O2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 26, normal: 24, hard: 22 },
    factVars: () => ({ roll: ROLL_REAL }),
    generate, validate, solve, mount,
  });
})();
