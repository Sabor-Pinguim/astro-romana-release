// M-O3 · Methane hunter (Maya / NOMAD + ACS on the Trace Gas Orbiter) · pattern search on a spectrum.
// Plan: docs/experiments-implementation.md §5.3. "Gas fingerprint": only at orbital sunrise or sunset does sunlight
// cross the atmosphere on its way to the spectrometer (solar occultation, BI3). In that short window Maya lays the
// fingerprint of each candidate gas over the spectrum: a gas is there only if every one of its lines falls on a dark
// absorption dip. CO₂, the main gas of the air (95.1%, references/experiments/mars-experiments.md), always leaves
// its own deep lines as a distractor.
// Real result (BI3): TGO finds no methane above 0.05 ppbv from orbit while Curiosity measures 0.2–0.7 ppbv on the
// ground, and nobody knows yet who is right. So in this game the methane lines are never in the orbital spectrum:
// its fingerprint only ever matches some of the dips (a partial match is the trap). Each run draws which other gases
// are present, the spectral window (line positions), line strengths, noise and the length of the window.
// The line patterns are stylised for the game (game-balance), not real wavenumbers.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp, lerp } = MG.lib;

  const TGO_CH4_PPB = 0.05; // real (BI3): methane upper limit from orbit (ppbv)
  const CURIOSITY_CH4_PPB = [0.2, 0.7]; // real (BI3): methane measured on the ground (ppbv)
  const GASES = ['ch4', 'h2o', 'hcl', 'co']; // candidates: methane, water and HCl (docs/minigames.md) plus CO
  const OTHERS = ['h2o', 'hcl', 'co'];
  // game-balance: lines per fingerprint, spectrum bins, line half-width, minimum spacing of distinct lines,
  // CO₂ lines and their strength, scan cadence (s), when the haze phase starts (share of the window).
  const LINES = { ch4: 4, h2o: 4, hcl: 3, co: 3 };
  const BINS = 160, LINE_W = 0.0075, MIN_SEP = 0.035, SPAN = [0.05, 0.95];
  const CO2_LINES = [2, 3], CO2_STRENGTH = 1.25;
  const SCAN_S = 0.45, SCAN_S_REDUCED = 1.4;
  const HAZE_AT = 0.72, DUST_HAZE_AT = 0.55, DUST_WINDOW = 0.8, WARM_NOISE = 1.6;
  const Y_LOW = 0.42, Y_TOP = 1.1; // game-balance: transmittance range shown on the chart

  // game-balance. present: gases in the air besides CO₂; depth: line depth at full path; noise: per-bin noise;
  // window: s of occultation; overlap: methane lines that sit on another gas's line (other absent gases get one
  // fewer); maxFalse: false claims tolerated (each costs a star).
  const LEVELS = {
    easy: { present: 1, depth: 0.34, noise: 0.016, window: 40, overlap: 1, maxFalse: 1, mods: 0 },
    normal: { present: [1, 2], depth: 0.26, noise: 0.022, window: 32, overlap: 1, maxFalse: 0, mods: 1 },
    hard: { present: [2, 3], depth: 0.2, noise: 0.03, window: 26, overlap: 2, maxFalse: 0, mods: [1, 2] },
  };
  // Modifiers with a real basis:
  //   rumor         "Conflicting data" (BI3): Curiosity reports 0.2–0.7 ppbv of methane on the ground mid-window,
  //                 and the methane fingerprint shares one more line with the gases that are there;
  //   dust          dust storms fill the air (global storms ~every 3 Mars years; the 2018 one ended Opportunity):
  //                 the haze hides the Sun sooner, so the clean window is shorter;
  //   warmDetector  infrared detectors must be kept cold; CRISM's cooler wore out in 2017 (GE8): a noisier spectrum.
  const MODS = ['rumor', 'dust', 'warmDetector'];

  const round3 = x => Math.round(x * 1000) / 1000;

  function generate(R, P, { mods }) {
    const rumor = mods.includes('rumor'), dust = mods.includes('dust'), warm = mods.includes('warmDetector');
    const present = R.sample(OTHERS, R.span(P.present)).sort();
    const taken = [];
    const place = (n, list) => {
      for (let k = 0, guard = 0; k < n && guard < 400; guard++) {
        const x = round3(R.float(SPAN[0], SPAN[1]));
        if (taken.every(y => Math.abs(x - y) >= MIN_SEP)) { taken.push(x); list.push(x); k++; }
      }
    };
    const co2 = [];
    place(R.span(CO2_LINES), co2);
    const lines = { ch4: [], h2o: [], hcl: [], co: [] };
    const strength = { ch4: [], h2o: [], hcl: [], co: [] };
    for (const g of present) { place(LINES[g], lines[g]); strength[g] = lines[g].map(() => round3(R.float(0.55, 1))); }
    const shared = present.flatMap(g => lines[g]);
    for (const g of GASES.filter(x => !present.includes(x))) {
      const want = g === 'ch4' ? P.overlap + (rumor ? 1 : 0) : Math.max(0, P.overlap - 1);
      const picks = R.sample(shared, Math.min(want, LINES[g] - 2, shared.length));
      lines[g].push(...picks);
      place(LINES[g] - picks.length, lines[g]);
    }
    for (const g of GASES) {
      const order = lines[g].map((x, i) => i).sort((a, b) => lines[g][a] - lines[g][b]);
      lines[g] = order.map(i => lines[g][i]);
      if (strength[g].length) strength[g] = order.map(i => strength[g][i]);
    }
    return {
      present, lines, strength, co2: co2.sort((a, b) => a - b),
      depth: P.depth, noise: round3(P.noise * (warm ? WARM_NOISE : 1)),
      window: Math.round(P.window * (dust ? DUST_WINDOW : 1)), hazeAt: dust ? DUST_HAZE_AT : HAZE_AT,
      rumorAt: rumor ? round3(R.float(0.25, 0.45)) : null, tilt: round3(R.float(-0.06, 0.06)),
    };
  }

  // Lines that really absorb (CO₂ and the present gases).
  const absorbers = L => [...L.co2, ...L.present.flatMap(g => L.lines[g])];
  function validate(L) {
    const real = absorbers(L);
    if (L.present.some(g => L.lines[g].length !== LINES[g])) return false;
    // Every absent gas (methane always) keeps at least two lines on clean continuum, so a careful look rules it out.
    for (const g of GASES.filter(x => !L.present.includes(x))) {
      if (L.lines[g].length !== LINES[g]) return false;
      if (L.lines[g].filter(x => real.every(y => Math.abs(x - y) >= MIN_SEP)).length < 2) return false;
    }
    return !L.present.includes('ch4') && L.present.length >= 1;
  }
  // The best result: every gas that is in the air identified, no false claim.
  const solve = L => ({ gases: L.present.length });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const css = getComputedStyle(host.root);
    const C = (name, fb) => css.getPropertyValue(name).trim() || fb;
    const COL = {
      bg: C('--bg-viewport', '#17183B'), void: C('--bg-void', '#11071F'), amber: C('--solar-amber', '#F59E0B'), orange: C('--mars-orange', '#E04F26'),
      coral: C('--coral-hover', '#EE7B57'), safe: C('--safe', '#7EDAC2'), muted: C('--muted', '#B9B0CE'), cream: C('--starlight-cream', '#FCE8A6'), amethyst: C('--amethyst', '#9B5DE5'),
    };
    const claims = new Set();
    let selected = null, elapsed = 0, scanClock = 0, reveal = null, rumorSaid = false, hazeSaid = false, lastSec = -1;

    // Static absorption profile (CO₂ + present gases) on the bins.
    const xs = Array.from({ length: BINS }, (_, b) => (b + 0.5) / BINS);
    const absorb = xs.map(x => {
      let a = 0;
      for (const c of L.co2) a += L.depth * CO2_STRENGTH * Math.exp(-(((x - c) / LINE_W) ** 2));
      for (const g of L.present) L.lines[g].forEach((c, i) => { a += L.depth * L.strength[g][i] * Math.exp(-(((x - c) / LINE_W) ** 2)); });
      return a;
    });
    const phase = u => ({
      depthK: 0.3 + 0.7 * Math.min(1, u / 0.5),
      signal: u < L.hazeAt ? 1 : Math.max(0.15, 1 - (0.85 * (u - L.hazeAt)) / (1 - L.hazeAt)),
      sigma: L.noise * (u < L.hazeAt ? 1 : 1 + (3 * (u - L.hazeAt)) / (1 - L.hazeAt)),
    });
    const spectrum = new Float32Array(BINS);
    function scan() {
      const { depthK, signal, sigma } = phase(clamp(elapsed / L.window, 0, 1));
      for (let b = 0; b < BINS; b++) {
        const n = (host.R.next() + host.R.next() + host.R.next() - 1.5) * 1.41; // ~unit noise, seeded
        spectrum[b] = signal * (1 + L.tilt * (xs[b] - 0.5) - depthK * absorb[b]) + sigma * n;
      }
    }

    const readout = ui.readout(['window', 'sun', 'claims']);
    const tall = (window.innerHeight || 800) >= 640 && (host.body.clientWidth || 600) < 480;
    const cv = ui.canvas(tall ? 0.72 : 0.46, 'mo3-chart');
    cv.node.setAttribute('role', 'img');
    const cards = ui.el('div', 'mo3-gases');
    const cardEls = GASES.map(g => {
      const b = ui.el('button', 'mo3-gas');
      b.type = 'button';
      b.addEventListener('click', () => pick(g));
      cards.append(b);
      return b;
    });
    const controls = ui.el('div', 'mg-controls');
    const bClaim = ui.button('', 'amber', () => toggleClaim()), bSend = ui.button('', 'primary', () => send(false));
    controls.append(bClaim, bSend);
    host.body.append(readout.node, cv.node, cards, controls);

    const name = g => t(`gas.${g}.formula`);
    const groundPpb = () => `${host.U.decimal(CURIOSITY_CH4_PPB[0], 1)}–${host.U.decimal(CURIOSITY_CH4_PPB[1], 1)}`;

    // ------------------------------------------------------------------ drawing
    function draw() {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      const padL = 4, padR = 4, padT = 16, padB = 14, pw = w - padL - padR, ph = h - padT - padB;
      const X = x => padL + x * pw, Y = v => padT + ((Y_TOP - clamp(v, Y_LOW, Y_TOP)) / (Y_TOP - Y_LOW)) * ph;
      const u = clamp(elapsed / L.window, 0, 1), dark = u >= 1;
      ctx.fillStyle = COL.void; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COL.bg; ctx.fillRect(padL, padT, pw, ph);
      // Faceted fill under the spectrum: groups of bins in two flat tones; the occultation sketch sits under it.
      for (let b = 0; b < BINS - 1; b++) {
        ctx.fillStyle = ((b / 8) | 0) % 2 ? '#2a1b47' : '#23163d';
        ctx.beginPath();
        ctx.moveTo(X(xs[b]), Y(spectrum[b])); ctx.lineTo(X(xs[b + 1]) + 0.5, Y(spectrum[b + 1]));
        ctx.lineTo(X(xs[b + 1]) + 0.5, padT + ph); ctx.lineTo(X(xs[b]), padT + ph); ctx.closePath(); ctx.fill();
      }
      sunDiagram(ctx, padL + pw - 70, padT + ph - 40, 66, 38, u);
      // CO₂ labels (always in the air, never a choice).
      ctx.font = '600 9px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (const c of L.co2) { ctx.fillStyle = COL.muted; ctx.fillText('CO₂', X(c), padT - 4); }
      // Fingerprint overlay of the selected gas.
      const over = selected || null;
      if (over) {
        ctx.strokeStyle = claims.has(over) ? COL.amber : COL.cream; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5;
        for (const c of L.lines[over]) {
          ctx.beginPath(); ctx.moveTo(X(c), padT); ctx.lineTo(X(c), padT + ph); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X(c) - 5, padT); ctx.lineTo(X(c) + 5, padT); ctx.lineTo(X(c), padT + 7); ctx.closePath(); ctx.fill();
        }
        ctx.textAlign = 'left'; ctx.font = '700 10px "Chakra Petch", sans-serif';
        ctx.fillText(t('overlayTag', { gas: name(over) }), padL + 4, padT + ph - 6);
      }
      if (reveal) {
        ctx.fillStyle = COL.safe;
        for (const g of L.present) for (const c of L.lines[g]) ctx.fillRect(X(c) - 3, padT + ph - 4, 6, 4);
      }
      // The spectrum itself.
      ctx.strokeStyle = dark ? COL.muted : COL.cream; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let b = 0; b < BINS; b++) { const px = X(xs[b]), py = Y(spectrum[b]); if (b) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      ctx.fillStyle = COL.muted; ctx.font = '600 9px "Chakra Petch", sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(t('axisWave'), padL, h - 3);
      ctx.textAlign = 'right'; ctx.fillText(t('axisLight'), w - padR, h - 3);
      cv.node.setAttribute('aria-label', t('chartAria', { gas: over ? name(over) : '—' }));
    }
    // Solar occultation sketch: the orbiter (left) looks at the Sun as it sinks behind the limb of Mars.
    function sunDiagram(ctx, x, y, w, h, u) {
      ctx.fillStyle = COL.void; ctx.fillRect(x, y, w, h);
      const limbY = y + h - 12;
      ctx.fillStyle = COL.amethyst; ctx.fillRect(x + 18, limbY - 6, w - 18, 6); // atmosphere
      ctx.fillStyle = COL.orange; ctx.beginPath(); ctx.moveTo(x + 18, limbY); ctx.lineTo(x + w, limbY - 4); ctx.lineTo(x + w, y + h); ctx.lineTo(x + 18, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b53d1d'; ctx.beginPath(); ctx.moveTo(x + 18, limbY); ctx.lineTo(x + w, y + h); ctx.lineTo(x + 18, y + h); ctx.closePath(); ctx.fill();
      const sy = lerp(y + 8, limbY + 8, u), sx = x + w - 12, r = 6;
      if (u < 1) {
        ctx.strokeStyle = COL.amber; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x + 6, y + 14); ctx.stroke();
        ctx.fillStyle = COL.amber; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; ctx.lineTo(sx + r * Math.cos(a), sy + r * Math.sin(a)); }
        ctx.closePath(); ctx.fill();
        // Redraw the limb over the sinking Sun so it hides behind Mars.
        ctx.fillStyle = COL.orange; ctx.beginPath(); ctx.moveTo(x + 18, limbY); ctx.lineTo(x + w, limbY - 4); ctx.lineTo(x + w, y + h); ctx.lineTo(x + 18, y + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b53d1d'; ctx.beginPath(); ctx.moveTo(x + 18, limbY); ctx.lineTo(x + w, y + h); ctx.lineTo(x + 18, y + h); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = COL.cream; ctx.beginPath(); ctx.moveTo(x + 6, y + 9); ctx.lineTo(x + 11, y + 14); ctx.lineTo(x + 6, y + 19); ctx.lineTo(x + 1, y + 14); ctx.closePath(); ctx.fill();
    }
    let raf = 0;
    const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
    ro?.observe(cv.node);
    host.onCleanup(() => { ro?.disconnect(); if (raf) cancelAnimationFrame(raf); });

    // ------------------------------------------------------------------ texts
    function labels() {
      cardEls.forEach((b, i) => {
        const g = GASES[i];
        const head = ui.el('span', 'mo3-gas-head');
        head.append(ui.el('strong', '', name(g)), ui.el('small', '', t(`gas.${g}.name`)));
        let state = claims.has(g) ? t('stateClaimed') : '';
        b.className = 'mo3-gas';
        if (claims.has(g)) b.classList.add('is-claimed');
        if (reveal) {
          const there = L.present.includes(g);
          b.classList.add(there ? (claims.has(g) ? 'is-right' : 'is-missed') : claims.has(g) ? 'is-wrong' : 'is-absent');
          state = there ? (claims.has(g) ? t('stateRight') : t('stateMissed')) : claims.has(g) ? t('stateWrong') : t('stateAbsent');
        }
        head.append(ui.el('em', 'mo3-state', state));
        const print = ui.el('span', 'mo3-print');
        for (const x of L.lines[g]) { const bar = ui.el('i'); bar.style.left = `${(x * 100).toFixed(1)}%`; print.append(bar); }
        b.replaceChildren(ui.el('span', 'mo3-key', String(i + 1)), head, print);
        b.setAttribute('aria-pressed', String(selected === g));
        b.setAttribute('aria-label', t('cardAria', { gas: t(`gas.${g}.name`), n: L.lines[g].length, state: state || t('stateOpen') }));
        b.disabled = !host.active;
      });
      bClaim.disabled = !host.active || !selected;
      bClaim.textContent = !selected ? t('claimPick') : claims.has(selected) ? t('claimRemove', { gas: name(selected) }) : t('claimAdd', { gas: name(selected) });
      bSend.disabled = !host.active || !claims.size;
      bSend.textContent = claims.size ? t('sendBtn', { list: [...claims].map(name).join(' + ') }) : t('sendNone');
    }
    function readouts() {
      const u = clamp(elapsed / L.window, 0, 1), left = Math.max(0, L.window - elapsed);
      readout.set('window', t('windowReadout', { s: Math.ceil(left) }), left < 8 ? 'danger' : '');
      readout.set('sun', t('sunReadout', { pct: u >= 1 ? 0 : Math.round(phase(u).signal * 100) }), u >= 1 ? 'danger' : u >= L.hazeAt ? 'warn' : '');
      readout.set('claims', t('claimsReadout', { n: claims.size }), claims.size ? 'good' : '');
    }
    function render(status) { labels(); readouts(); draw(); if (status) host.status(status); }

    // ------------------------------------------------------------------ actions
    function pick(g) {
      if (!host.active) return;
      selected = g;
      render(t('statusCompare', { gas: name(g), n: L.lines[g].length }));
    }
    function toggleClaim() {
      if (!host.active || !selected) return;
      if (claims.has(selected)) { claims.delete(selected); render(t('statusUnclaimed', { gas: name(selected) })); }
      else { claims.add(selected); render(t('statusClaimed', { gas: name(selected) })); }
    }
    function send(auto) {
      if (!host.active) return;
      const right = [...claims].filter(g => L.present.includes(g)), wrong = [...claims].filter(g => !L.present.includes(g));
      reveal = { right, wrong };
      if (!claims.size) { host.fail(t('failSunset')); render(); return; }
      if (wrong.length > P.maxFalse || !right.length) {
        host.fail(wrong.includes('ch4')
          ? t('failMethane', { orbit: host.U.decimal(TGO_CH4_PPB, 2), ground: groundPpb() })
          : t('failFalse', { gas: name(wrong[0] || [...claims][0]) }));
        render();
        return;
      }
      const share = right.length / L.present.length;
      const stars = Math.max(1, (share >= 1 ? 3 : share >= 0.5 ? 2 : 1) - wrong.length);
      const list = right.map(name).join(' + ');
      host.finish({
        stars, summary: t('summary', { right: right.length, total: L.present.length, list, wrong: wrong.length }),
        metrics: { right: right.length, total: L.present.length, wrong: wrong.length, auto, seconds: Math.round(elapsed) },
      });
      render(t(auto ? 'statusAuto' : 'statusSent', { right: right.length, total: L.present.length, list }));
    }

    host.onKey((e, down) => {
      const digit = /^(Digit|Numpad)([1-4])$/.exec(e.code);
      if (digit) { if (down) pick(GASES[Number(digit[2]) - 1]); return true; }
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        if (down) { const k = selected ? GASES.indexOf(selected) : -1, d = /Left|KeyA/.test(e.code) ? -1 : 1; pick(GASES[(k + d + GASES.length) % GASES.length]); }
        return true;
      }
      if (e.code === 'Space') { if (down && !e.repeat) toggleClaim(); return true; }
      if (e.code === 'Enter' && !e.target?.closest?.('button')) { if (down && !e.repeat && claims.size) send(false); return true; }
      return false;
    });

    const cadence = host.reduced ? SCAN_S_REDUCED : SCAN_S;
    host.loop(dt => {
      elapsed += dt; scanClock += dt;
      const u = elapsed / L.window;
      let status = '';
      if (L.rumorAt != null && !rumorSaid && u >= L.rumorAt) { rumorSaid = true; status = t('event.rumor', { ground: groundPpb() }); }
      if (!hazeSaid && u >= L.hazeAt) { hazeSaid = true; status = t('statusHaze'); }
      if (u >= 1) {
        elapsed = L.window;
        spectrum.fill(0.05);
        readouts();
        if (claims.size) send(true); else { reveal = { right: [], wrong: [] }; host.fail(t('failSunset')); render(); }
        return;
      }
      if (scanClock >= cadence) { scanClock = 0; scan(); draw(); }
      const sec = Math.ceil(L.window - elapsed);
      if (sec !== lastSec) { lastSec = sec; readouts(); }
      if (status) host.status(status);
    });

    scan();
    const notes = host.mods.filter(m => m !== 'rumor').map(m => t(`event.${m}`)).join(' ');
    render(t('statusInit') + (notes ? ` ${notes}` : ''));
    return { render: () => render() };
  }

  MG.register('M-O3', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 28, normal: 26, hard: 22 },
    generate, validate, solve, mount,
  });
})();
