// M-S1 · Biosignature hunter (Maya / PIXL + SHERLOC on Cheyava Falls) · pattern search. Plan: §5.2.
// Sweep 3×3 zones of the rock with SHERLOC (UV) to make suspects glow, then confirm real "leopard spots" with
// PIXL (1×1 X-ray) before time or energy runs out. Real/derived costs (references/experiments/minigames/
// m-s1-pixl-sherloc/README.md): SHERLOC 3×3 survey < 10 min at 48.8 W → 8.1 Wh; PIXL point 12.5 min at 25 W →
// 5.2 Wh. Each run draws clustered spots (the real spots on Cheyava Falls come in groups), decoys and a budget
// computed from the layout itself.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;

  const SHERLOC = { min: 10, wh: 8.1 }; // real/derived
  const PIXL = { min: 12.5, wh: 5.2 }; // real/derived
  const MIN_CELL_PX = 34; // below this the grid turns (columns become rows) so cells stay touchable

  // game-balance (plan §5.2). slack: budget above the reference strategy; halo: PIXL shows "spot nearby".
  // stars: share of the budget left for 1, 2 and 3 stars.
  const LEVELS = {
    easy: { cols: 8, rows: 6, spots: 5, need: 3, decoys: 2, slack: 0.4, halo: true, mods: 0, stars: [0, 0.12, 0.3] },
    normal: { cols: 10, rows: 7, spots: 5, need: 3, decoys: 3, slack: 0.2, halo: true, mods: 1, stars: [0, 0.1, 0.25] },
    hard: { cols: 12, rows: 8, spots: 6, need: 4, decoys: 5, slack: 0.05, halo: false, mods: 1, stars: [0, 0.08, 0.2] },
  };
  // Modifiers with a real basis:
  //   dust         rover targets are dusty, so the arm abrades a patch before proximity science: SHERLOC sweeps cost more time;
  //   fluorescent  many minerals glow under UV without any life: more decoys (the reason Cheyava Falls is only a
  //                "possible" biosignature until samples reach Earth).
  const MODS = ['dust', 'fluorescent'];
  const DUST_TIME = 1.3;

  const near4 = (i, cols, rows) => {
    const x = i % cols, y = (i / cols) | 0, out = [];
    if (x > 0) out.push(i - 1);
    if (x < cols - 1) out.push(i + 1);
    if (y > 0) out.push(i - cols);
    if (y < rows - 1) out.push(i + cols);
    return out;
  };

  function generate(R, P, { mods }) {
    const { cols, rows } = P;
    const taken = new Set(), spots = [];
    const centers = Array.from({ length: R.int(1, 2) }, () => [R.int(1, cols - 2), R.int(1, rows - 2)]);
    for (let k = 0, guard = 0; spots.length < P.spots && guard < 500; guard++, k++) {
      const [cx, cy] = centers[k % centers.length];
      const x = Math.min(cols - 1, Math.max(0, cx + R.int(-2, 2))), y = Math.min(rows - 1, Math.max(0, cy + R.int(-2, 2)));
      const i = y * cols + x;
      if (!taken.has(i)) { taken.add(i); spots.push(i); }
    }
    const nearSpot = new Set(spots.flatMap(i => near4(i, cols, rows)));
    const decoyN = P.decoys + (mods.includes('fluorescent') ? 2 : 0);
    const decoys = R.shuffle(Array.from({ length: cols * rows }, (_, i) => i).filter(i => !taken.has(i) && !nearSpot.has(i))).slice(0, decoyN);
    // Reference strategy: sweep the whole rock in 3×3 tiles, then test the needed spots and half of the decoys.
    const sweeps = Math.ceil(cols / 3) * Math.ceil(rows / 3);
    const dust = mods.includes('dust') ? DUST_TIME : 1;
    const tests = P.need + decoyN / 2;
    const refMin = sweeps * SHERLOC.min * dust + tests * PIXL.min;
    const refWh = sweeps * SHERLOC.wh + tests * PIXL.wh;
    return {
      cols, rows, spots, decoys, dust,
      minutes: Math.ceil(refMin * (1 + P.slack)), wh: Math.ceil(refWh * (1 + P.slack)),
    };
  }
  const validate = (L, P) => L.spots.length === P.spots && L.decoys.length >= P.decoys;
  const solve = L => ({ minutes: L.minutes });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const { cols, rows } = L;
    const kind = new Array(cols * rows).fill('empty');
    L.spots.forEach(i => { kind[i] = 'spot'; });
    L.decoys.forEach(i => { kind[i] = 'decoy'; });
    const near = new Set(L.spots.flatMap(i => near4(i, cols, rows)));
    const uv = new Uint8Array(cols * rows), xray = new Uint8Array(cols * rows);
    let tool = 'sherloc', timeLeft = L.minutes, whLeft = L.wh, found = 0, decoyTests = 0, hover = null, turned = null;
    const sweepCost = { min: SHERLOC.min * L.dust, wh: SHERLOC.wh };

    const readout = ui.readout(['found', 'time', 'energy']);
    const tools = ui.el('div', 'ms1-tools');
    const toolBtn = id => { const b = ui.el('button', 'ms1-tool'); b.type = 'button'; b.addEventListener('click', () => setTool(id)); tools.append(b); return b; };
    const bSher = toolBtn('sherloc'), bPixl = toolBtn('pixl');
    const board = ui.el('div', 'mg-grid ms1-board');
    board.setAttribute('role', 'grid');
    const cells = Array.from({ length: cols * rows }, (_, i) => {
      const c = ui.el('button', 'mg-cell ms1-cell');
      c.type = 'button';
      c.addEventListener('pointerenter', () => { hover = i; paintHover(); });
      c.addEventListener('focus', () => { hover = i; paintHover(); });
      c.addEventListener('click', () => scan(i));
      return c;
    });
    board.addEventListener('pointerleave', () => { hover = null; paintHover(); });
    const legend = ui.el('div', 'mg-legend');
    host.body.append(readout.node, tools, board, legend);

    // Turn the grid when it would be too narrow for touch (§5.1 rule 8).
    function arrange() {
      const width = host.body.clientWidth || 600;
      const turn = rows < cols && width < cols * MIN_CELL_PX;
      if (turn === turned) return;
      turned = turn;
      board.style.setProperty('--cols', turn ? rows : cols);
      const order = [];
      if (turn) for (let x = 0; x < cols; x++) for (let y = rows - 1; y >= 0; y--) order.push(y * cols + x);
      else for (let i = 0; i < cols * rows; i++) order.push(i);
      board.replaceChildren(...order.map(i => cells[i]));
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(arrange) : null;
    ro?.observe(host.body);
    host.onCleanup(() => ro?.disconnect());

    const canAfford = c => timeLeft + 1e-6 >= c.min && whLeft + 1e-6 >= c.wh;
    function setTool(next) { tool = next; render(); }
    const block = i => {
      const x = i % cols, y = (i / cols) | 0, out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) out.push(ny * cols + nx); }
      return out;
    };
    function paintHover() {
      const set = host.active && hover != null && tool === 'sherloc' ? new Set(block(hover)) : null;
      cells.forEach((c, i) => c.classList.toggle('is-hover', !!set?.has(i)));
    }

    function scan(i) {
      if (!host.active) return;
      if (tool === 'sherloc') {
        const area = block(i);
        if (area.every(j => uv[j])) { render(t('statusAlreadySwept')); return; }
        if (!canAfford(sweepCost)) { render(t('statusNoBudgetSherloc')); return; }
        timeLeft -= sweepCost.min; whLeft -= sweepCost.wh;
        let glow = 0;
        area.forEach(j => { if (!uv[j] && !xray[j] && kind[j] !== 'empty') glow++; uv[j] = 1; });
        settle(glow ? t('statusGlowFound', { count: glow }) : t('statusNoGlow'));
      } else {
        if (xray[i]) { render(t('statusAlreadyPixl')); return; }
        if (!canAfford(PIXL)) { render(t('statusNoBudgetPixl')); return; }
        timeLeft -= PIXL.min; whLeft -= PIXL.wh; xray[i] = 1;
        if (kind[i] === 'spot') { found++; settle(t('statusSpotConfirmed', { found, need: P.need })); }
        else if (kind[i] === 'decoy') { decoyTests++; settle(t('statusDecoy')); }
        else settle(P.halo && near.has(i) ? t('statusHalo') : t('statusEmpty'));
      }
    }

    function settle(msg) {
      if (found >= P.need) {
        const left = Math.min(timeLeft / L.minutes, whLeft / L.wh);
        const stars = Math.max(1, MG.lib.starsFrom(left, P.stars) - (decoyTests >= 3 ? 1 : 0));
        render(t('statusVerified', { need: P.need }));
        host.finish({ stars, summary: t('summary', { found, left: Math.round(left * 100), decoys: decoyTests }), metrics: { found, left, decoyTests } });
        return;
      }
      if (!canAfford(PIXL) && !canAfford(sweepCost)) { render(); host.fail(t('statusExhausted', { found, need: P.need })); return; }
      render(msg);
    }

    function render(status) {
      readout.set('found', t('found', { found, need: P.need }), found >= P.need ? 'good' : '');
      readout.set('time', t('timeMin', { min: U().decimal(timeLeft, 1) }), timeLeft < L.minutes * 0.15 ? 'danger' : '');
      readout.set('energy', `${U().decimal(whLeft, 1)} Wh`, whLeft < L.wh * 0.15 ? 'danger' : '');
      bSher.setAttribute('aria-pressed', String(tool === 'sherloc'));
      bPixl.setAttribute('aria-pressed', String(tool === 'pixl'));
      bSher.replaceChildren(ui.el('strong', '', t('sherlocTitle')), ui.el('span', '', t('sherlocSub', { min: U().decimal(sweepCost.min, 0), wh: U().decimal(SHERLOC.wh, 1) })));
      bPixl.replaceChildren(ui.el('strong', '', t('pixlTitle')), ui.el('span', '', t('pixlSub', { min: U().decimal(PIXL.min, 1), wh: U().decimal(PIXL.wh, 1) })));
      board.setAttribute('aria-label', t('boardAria'));
      cells.forEach((c, i) => {
        c.className = 'mg-cell ms1-cell';
        let mark = '', desc = 'descUnscanned';
        if (uv[i]) { if (kind[i] !== 'empty') { c.classList.add('is-glow'); mark = '✦'; desc = 'descSuspect'; } else { c.classList.add('is-uv'); mark = '·'; desc = 'descEmpty'; } }
        if (xray[i]) {
          c.classList.add('is-xray');
          if (kind[i] === 'spot') { c.classList.add('is-spot'); mark = '✓'; desc = 'descSpot'; }
          else if (kind[i] === 'decoy') { c.classList.add('is-decoy'); mark = '✕'; desc = 'descDecoy'; }
          else if (P.halo && near.has(i)) { c.classList.add('is-near'); mark = '↗'; desc = 'descNear'; }
          else { c.classList.add('is-empty'); mark = '—'; desc = 'descEmpty'; }
        }
        c.textContent = mark;
        c.disabled = !host.active;
        c.setAttribute('aria-label', t('cellAria', { row: ((i / cols) | 0) + 1, col: (i % cols) + 1, desc: t(desc) }));
      });
      legend.replaceChildren(...[['is-glow', 'legendSuspect'], ['is-spot', 'legendSpot'], ['is-decoy', 'legendDecoy'], ...(P.halo ? [['is-near', 'legendNear']] : [])]
        .map(([cls, key]) => { const s = ui.el('span'); s.append(ui.el('i', `ms1-swatch ${cls}`), document.createTextNode(t(key, { need: P.need }))); return s; }));
      paintHover();
      if (status) host.status(status);
    }

    host.onKey((e, down) => {
      if (e.code === 'Digit1' || e.code === 'KeyQ') { if (down) setTool('sherloc'); return true; }
      if (e.code === 'Digit2' || e.code === 'KeyE') { if (down) setTool('pixl'); return true; }
      return false;
    });

    arrange();
    render(t('statusInit', { need: P.need }) + (L.dust > 1 ? ` ${t('dustNote')}` : ''));
    return { render: () => render() };
  }

  MG.register('M-S1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 35, normal: 45, hard: 55 },
    generate, validate, solve, mount,
  });
})();
