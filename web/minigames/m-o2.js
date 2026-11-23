// M-O2 · Ice radar (Maya / SHARAD on MRO) · pattern search on a chart. Plan: docs/experiments-implementation.md §5.3.
// "Read the radargram": a chart of radar echoes (distance along the track × echo delay, drawn as flat faceted
// cells of intensity). Under the bright surface echo, Maya traces the faint line of buried ice. Side echoes from
// hills beside the track (clutter, ∩-shaped arcs) and noise are misleading; marking them reports ice where there is
// none (a false positive, the failure of docs/minigames.md).
// Real numbers (references/experiments/mars-experiments.md, PH7): SHARAD 15 kg, 10 W, 40–90 Gb/day (capped at
// 15% of MRO's data), sounds ~1 km deep with ~15 m vertical resolution. Each run draws the surface, the depth and
// extent of the ice, the clutter arcs and the noise.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const SHARAD_DEPTH_M = 1000; // real (PH7): SHARAD sounds ~1 km deep; the chart spans that depth
  const SHARAD_W = 10; // real (PH7): 10 W transmit
  const SHARAD_GB_DAY = [40, 90]; // real (PH7): 40–90 Gb/day
  const DATA_CAP_SHARE = 15; // real (PH7): SHARAD may use at most 15% of MRO's data
  const SIM_SECONDS = 4; // game-balance: how long one clutter simulation stays on the chart
  const ICE = 3, FAINT = 2, SURFACE = 4, TAIL = 2; // game-balance: echo intensity levels (0..4) of each feature

  // game-balance. cols × rows: the radargram; extent: ice columns; depth: rows between the surface and the ice;
  // clutter: side-echo arcs; curv: their curvature (flatter arcs look more like a buried layer); patchy: chance
  // that an ice cell echoes weakly; noise: chance of a speckle per cell (noise2: chance of a bright speckle);
  // time: s before the downlink; peeks: clutter simulations; maxFalse: false marks tolerated; tol: rows of slack;
  // stars: share of the ice traced for 1, 2 and 3 stars (3 also needs zero false marks).
  const LEVELS = {
    easy: { cols: 14, rows: 12, extent: [7, 9], depth: [3, 5], clutter: [1, 2], curv: [0.4, 0.5], patchy: 0, noise: 0.1, noise2: 0, time: 45, peeks: 3, maxFalse: 2, tol: 1, mods: 0, stars: [0.3, 0.6, 0.85] },
    normal: { cols: 18, rows: 14, extent: [8, 12], depth: [3, 6], clutter: [2, 3], curv: [0.3, 0.4, 0.5], patchy: 0.1, noise: 0.15, noise2: 0.025, time: 40, peeks: 2, maxFalse: 1, tol: 1, mods: 1, stars: [0.3, 0.6, 0.85] },
    hard: { cols: 22, rows: 16, extent: [9, 14], depth: [3, 7], clutter: [3, 4], curv: [0.2, 0.3, 0.4], patchy: 0.2, noise: 0.2, noise2: 0.045, time: 36, peeks: 1, maxFalse: 1, tol: 0, mods: [1, 2], stars: [0.3, 0.6, 0.85] },
  };
  // Modifiers with a real basis (PH7):
  //   rugged     hills beside the track send side echoes ("side echoes from the relief are misleading",
  //              docs/minigames.md): two more clutter arcs;
  //   faintEcho  in 2025 SHARAD rolled 120° to look at the 2018 polar "lake" and saw only a faint echo: part of
  //              the ice line is weak;
  //   dataCap    SHARAD may use only 15% of MRO's data, so this track came down with fewer echoes summed: noisier.
  const MODS = ['rugged', 'faintEcho', 'dataCap'];
  const DATA_CAP_NOISE = 1.5; // game-balance

  const round2 = x => Math.round(x * 100) / 100;

  function generate(R, P, { mods }) {
    const { cols, rows } = P;
    const rugged = mods.includes('rugged'), faint = mods.includes('faintEcho'), capped = mods.includes('dataCap');
    // Smooth surface echo (row index), gently sloping.
    const base = [];
    let s = R.int(1, 2);
    for (let c = 0; c < cols; c++) { if (R.chance(0.2)) s = clamp(s + R.pick([-1, 1]), 1, 3); base.push(s); }
    const surface = base.slice();

    // Buried ice: one continuous deposit, parallel to the plain with at most one step.
    const n = R.span(P.extent);
    const start = R.int(1, Math.max(1, cols - n - 1));
    const depth = R.span(P.depth);
    const stepAt = R.chance(0.5) ? R.int(start + 2, start + n - 2) : -1, stepDir = R.pick([-1, 1]);
    // A continuous line: it never jumps more than one row between neighbouring columns.
    const ice = new Array(cols).fill(null);
    for (let c = start; c < start + n; c++) {
      const want = base[c] + depth + (stepAt >= 0 && c >= stepAt ? stepDir : 0);
      const prev = c > start ? ice[c - 1] : want;
      ice[c] = clamp(clamp(want, prev - 1, prev + 1), base[c] + 3, rows - 2);
    }
    const iceLevel = ice.map(() => (R.chance(P.patchy) ? FAINT : ICE));
    if (faint) { const f0 = R.int(start, start + n - 3), len = R.int(3, 4); for (let c = f0; c < f0 + len && c < start + n; c++) iceLevel[c] = FAINT; }

    // Clutter: ∩ arcs (the delay grows away from the closest point to an off-track hill); each one sits under a bump.
    const arcs = [];
    const k = R.span(P.clutter) + (rugged ? 2 : 0);
    for (let i = 0; i < k; i++) {
      const apex = R.int(0, cols - 1);
      surface[apex] = Math.max(1, base[apex] - 1);
      if (apex > 0 && R.chance(0.5)) surface[apex - 1] = Math.max(1, base[apex - 1] - 1);
      arcs.push({ apex, half: R.int(2, 3), row: base[apex] + R.int(2, rows - base[apex] - 4), curv: R.pick(P.curv), bright: R.chance(0.6) });
    }

    const noise = P.noise * (capped ? DATA_CAP_NOISE : 1), noise2 = P.noise2 * (capped ? DATA_CAP_NOISE : 1) + (capped ? 0.02 : 0);
    const cells = new Array(cols * rows).fill(0);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const below = r > surface[c] + 1;
      if (!below) { if (r < surface[c] && R.chance(noise / 3)) cells[r * cols + c] = 1; continue; }
      cells[r * cols + c] = R.chance(noise2) ? 2 : R.chance(noise) ? 1 : 0;
    }
    for (let c = 0; c < cols; c++) { cells[surface[c] * cols + c] = SURFACE; if (surface[c] + 1 < rows) cells[(surface[c] + 1) * cols + c] = TAIL; }
    const clutter = new Set();
    for (const a of arcs) {
      for (let c = a.apex - a.half; c <= a.apex + a.half; c++) {
        if (c < 0 || c >= cols) continue;
        const d = Math.abs(c - a.apex), r1 = a.row + Math.round(a.curv * d * d);
        // Continuous outline: a steep flank fills the rows between this column and the one nearer the apex.
        const r0 = d ? Math.min(r1, a.row + Math.round(a.curv * (d - 1) * (d - 1)) + 1) : r1;
        for (let r = r0; r <= r1; r++) {
          if (r <= surface[c] + 1 || r >= rows) continue;
          const i = r * cols + c;
          cells[i] = Math.max(cells[i], c === a.apex || a.bright ? 3 : 2);
          clutter.add(i);
        }
      }
    }
    // The ice: nothing within 2 rows of it in its column is as bright as it (so a tap near the line snaps onto it).
    for (let c = 0; c < cols; c++) {
      if (ice[c] == null) continue;
      for (let r = ice[c] - 2; r <= ice[c] + 2; r++) {
        if (r <= surface[c] + 1 || r >= rows || r === ice[c]) continue;
        const i = r * cols + c;
        if (cells[i] >= iceLevel[c]) cells[i] = iceLevel[c] - 1;
      }
      cells[ice[c] * cols + c] = iceLevel[c];
      clutter.delete(ice[c] * cols + c);
    }
    return { cols, rows, surface, ice, cells, clutter: [...clutter].sort((a, b) => a - b), noise: round2(noise) };
  }

  const iceCols = L => L.ice.map((r, c) => (r == null ? -1 : c)).filter(c => c >= 0);

  function validate(L, P) {
    const cols = iceCols(L);
    if (cols.length < P.extent[0] || cols.length > P.extent[1]) return false;
    for (const c of cols) {
      const r = L.ice[c], lv = L.cells[r * L.cols + c];
      if (r < L.surface[c] + 3 || r >= L.rows || lv < FAINT) return false;
      if (L.ice[c - 1] != null && Math.abs(L.ice[c - 1] - r) > 1) return false;
      for (let rr = r - 2; rr <= r + 2; rr++) {
        if (rr === r || rr <= L.surface[c] + 1 || rr >= L.rows) continue;
        if (L.cells[rr * L.cols + c] >= lv) return false;
      }
    }
    // A real trap: clutter echoes in columns without ice.
    return L.clutter.filter(i => L.ice[i % L.cols] == null).length >= 3;
  }
  // The best result of a layout: every ice column traced, no false mark.
  const solve = L => ({ hits: iceCols(L).length, coverage: 1 });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const { cols, rows } = L;
    const total = iceCols(L).length;
    const perRow = SHARAD_DEPTH_M / (rows - 3); // derived: ~1 km of sounding over the rows below the surface
    const marks = new Array(cols).fill(null);
    const clutterSet = new Set(L.clutter);
    let timeLeft = P.time, peeks = P.peeks, simLeft = 0, cursor = null, keyMode = null, drag = null, reveal = null, lastSec = -1;

    const css = getComputedStyle(host.root);
    const C = name => css.getPropertyValue(name).trim();
    const COL = {
      bg: C('--bg-viewport') || '#17183B', void: C('--bg-void') || '#11071F', amber: C('--solar-amber') || '#F59E0B',
      coral: C('--coral-hover') || '#EE7B57', safe: C('--safe') || '#7EDAC2', muted: C('--muted') || '#B9B0CE', cream: C('--starlight-cream') || '#FCE8A6',
    };
    // Faceted tones of each echo level: [light facet, dark facet] (flat, hard edges).
    const RAMP = [['#1c1d47', '#17183b'], ['#2e2c66', '#272558'], ['#4c4190', '#43397f'], ['#a283e6', '#9070d8'], ['#fce8a6', '#efd88f']];

    const readout = ui.readout(['marks', 'time', 'sim', 'depth']);
    const tall = (window.innerHeight || 800) >= 640 && (host.body.clientWidth || 600) < 480;
    const cv = ui.canvas(tall ? 0.8 : 0.5, 'mo2-chart');
    cv.node.setAttribute('role', 'img');
    const legend = ui.el('div', 'mg-legend');
    const controls = ui.el('div', 'mg-controls');
    const bSim = ui.button('', 'quiet', peek), bClear = ui.button('', 'quiet', clearAll), bSend = ui.button('', 'primary', () => submit(false));
    controls.append(bSim, bClear, bSend);
    host.body.append(readout.node, cv.node, legend, controls);

    const geo = () => {
      const padL = 15, padR = 2, padT = 2, padB = 15;
      const pw = Math.max(1, cv.w - padL - padR), ph = Math.max(1, cv.h - padT - padB);
      return { padL, padT, pw, ph, cw: pw / cols, rh: ph / rows };
    };
    const cellAt = (e, clampIt) => {
      const rect = cv.node.getBoundingClientRect(), g = geo();
      const x = e.clientX - rect.left - g.padL, y = e.clientY - rect.top - g.padT;
      if (!clampIt && (x < 0 || y < 0 || x > g.pw || y > g.ph)) return null;
      return { c: clamp(Math.floor(x / g.cw), 0, cols - 1), r: clamp(Math.floor(y / g.rh), 0, rows - 1) };
    };
    // A mark snaps to the brightest echo within one row of the pointer (never above the surface).
    function snap(c, r) {
      const top = L.surface[c];
      let best = clamp(r, top, rows - 1), bestV = -1, bestD = 9;
      for (let rr = r - 1; rr <= r + 1; rr++) {
        if (rr < top || rr >= rows) continue;
        const v = L.cells[rr * cols + c], d = Math.abs(rr - r);
        if (v > bestV || (v === bestV && d <= bestD)) { best = rr; bestV = v; bestD = d; }
      }
      return best;
    }
    function apply(c, r, mode) {
      if (mode === 'erase') marks[c] = null;
      else marks[c] = snap(c, r);
      return marks[c];
    }
    const markedCount = () => marks.filter(m => m != null).length;

    // ------------------------------------------------------------------ drawing
    function draw() {
      cv.fit();
      const { ctx } = cv, g = geo();
      ctx.fillStyle = COL.void; ctx.fillRect(0, 0, cv.w, cv.h);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const lv = L.cells[r * cols + c], [a, b] = RAMP[lv];
        const x0 = g.padL + c * g.cw, y0 = g.padT + r * g.rh, x1 = x0 + g.cw, y1 = y0 + g.rh;
        ctx.fillStyle = a; ctx.fillRect(x0, y0, g.cw + 0.5, g.rh + 0.5);
        ctx.fillStyle = b; ctx.beginPath();
        if ((r + c) % 2) { ctx.moveTo(x1 + 0.5, y0); ctx.lineTo(x1 + 0.5, y1 + 0.5); ctx.lineTo(x0, y1 + 0.5); }
        else { ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.5, y1 + 0.5); ctx.lineTo(x0, y1 + 0.5); }
        ctx.closePath(); ctx.fill();
      }
      const cx = c => g.padL + (c + 0.5) * g.cw, cy = r => g.padT + (r + 0.5) * g.rh;
      const box = (i, color, w = 2) => {
        const r = (i / cols) | 0, c = i % cols;
        ctx.strokeStyle = color; ctx.lineWidth = w;
        ctx.strokeRect(g.padL + c * g.cw + w / 2 + 0.5, g.padT + r * g.rh + w / 2 + 0.5, g.cw - w - 1, g.rh - w - 1);
      };
      if (simLeft > 0 || reveal) L.clutter.forEach(i => box(i, COL.coral, 1.5));
      if (reveal) L.ice.forEach((r, c) => { if (r != null) box(r * cols + c, COL.safe, 2); });

      // The traced line: amber segments between neighbouring marks, a diamond on each mark.
      ctx.strokeStyle = COL.amber; ctx.lineWidth = 2;
      for (let c = 0; c + 1 < cols; c++) {
        if (marks[c] == null || marks[c + 1] == null) continue;
        ctx.beginPath(); ctx.moveTo(cx(c), cy(marks[c])); ctx.lineTo(cx(c + 1), cy(marks[c + 1])); ctx.stroke();
      }
      const d = Math.max(4, Math.min(g.cw, g.rh) * 0.42);
      marks.forEach((r, c) => {
        if (r == null) return;
        const ok = reveal ? reveal.hit[c] : null;
        ctx.fillStyle = ok == null ? COL.amber : ok ? COL.safe : COL.coral;
        ctx.strokeStyle = COL.void; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx(c), cy(r) - d); ctx.lineTo(cx(c) + d, cy(r)); ctx.lineTo(cx(c), cy(r) + d); ctx.lineTo(cx(c) - d, cy(r)); ctx.closePath();
        ctx.fill(); ctx.stroke();
        if (ok === false) {
          ctx.strokeStyle = COL.void; ctx.lineWidth = 1.5; const q = d * 0.45;
          ctx.beginPath(); ctx.moveTo(cx(c) - q, cy(r) - q); ctx.lineTo(cx(c) + q, cy(r) + q); ctx.moveTo(cx(c) + q, cy(r) - q); ctx.lineTo(cx(c) - q, cy(r) + q); ctx.stroke();
        }
      });
      if (cursor && host.active) {
        ctx.strokeStyle = COL.amber; ctx.lineWidth = 2;
        ctx.strokeRect(g.padL + cursor.c * g.cw + 1, g.padT + cursor.r * g.rh + 1, g.cw - 2, g.rh - 2);
        ctx.fillStyle = COL.amber; ctx.fillRect(g.padL + cursor.c * g.cw, g.padT + g.ph + 2, g.cw, 3);
      }
      // Axes: along-track below, echo delay (depth) on the left.
      ctx.fillStyle = COL.muted; ctx.font = '600 9px "Chakra Petch", sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left'; ctx.fillText(t('axisTrack'), g.padL, cv.h - 3);
      ctx.textAlign = 'right'; ctx.fillText(t('axisScale', { depth: U().distanceKm(SHARAD_DEPTH_M / 1000, 0) }), cv.w - 2, cv.h - 3);
      ctx.save(); ctx.translate(10, g.padT + 2); ctx.rotate(Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText(t('axisDelay'), 0, 0); ctx.restore();
      if (simLeft > 0) {
        ctx.fillStyle = COL.coral; ctx.font = '700 10px "Chakra Petch", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(t('simTag'), cv.w - 6, g.padT + 4);
      }
      cv.node.setAttribute('aria-label', t('chartAria', { marked: markedCount(), cols }));
    }
    let raf = 0;
    const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
    ro?.observe(cv.node);
    host.onCleanup(() => { ro?.disconnect(); if (raf) cancelAnimationFrame(raf); });

    // ------------------------------------------------------------------ texts
    function labels() {
      bSim.textContent = t('simBtn', { n: peeks });
      bSim.disabled = !host.active || peeks <= 0 || simLeft > 0;
      bClear.textContent = t('clearBtn');
      bClear.disabled = !host.active || !markedCount();
      bSend.textContent = t('sendBtn', { n: markedCount() });
      bSend.disabled = !host.active;
      legend.replaceChildren(...[['mo2-sw-surface', 'legendSurface'], ['mo2-sw-echo', 'legendEcho'], ['mo2-sw-mark', 'legendMark'], ['mo2-sw-sim', 'legendSim'], ...(reveal ? [['mo2-sw-ice', 'legendIce']] : [])]
        .map(([cls, key]) => { const s = ui.el('span'); s.append(ui.el('i', `mo2-swatch ${cls}`), document.createTextNode(t(key))); return s; }));
    }
    function readouts() {
      readout.set('marks', t('marksReadout', { n: markedCount(), cols }));
      readout.set('time', t('timeReadout', { s: Math.max(0, Math.ceil(timeLeft)) }), timeLeft < 8 ? 'danger' : '');
      readout.set('sim', t('simReadout', { n: peeks }), simLeft > 0 ? 'warn' : '');
      const r = cursor ? cursor.r - L.surface[cursor.c] : null;
      readout.set('depth', r == null || r < 0 ? t('depthNone') : t('depthReadout', { depth: U().distanceM(Math.round((r * perRow) / 10) * 10) }));
    }
    function render(status) { labels(); readouts(); draw(); if (status) host.status(status); }

    // ------------------------------------------------------------------ actions
    function peek() {
      if (!host.active || peeks <= 0 || simLeft > 0) return;
      peeks--; simLeft = SIM_SECONDS;
      render(t('statusSim'));
    }
    function clearAll() {
      if (!host.active) return;
      marks.fill(null);
      render(t('statusCleared'));
    }
    function traced(status) {
      labels(); readouts(); redraw();
      if (status) host.status(status);
    }

    cv.node.addEventListener('pointerdown', e => {
      if (!host.active || (e.button != null && e.button > 0)) return;
      const hit = cellAt(e);
      if (!hit) return;
      e.preventDefault();
      try { cv.node.setPointerCapture(e.pointerId); } catch { /* gone */ }
      const m = marks[hit.c];
      drag = { mode: m != null && Math.abs(m - hit.r) <= 1 ? 'erase' : 'paint', c: hit.c, r: hit.r };
      cursor = hit; keyMode = null;
      apply(hit.c, hit.r, drag.mode);
      traced(drag.mode === 'erase' ? t('statusErased') : t('statusMarked', { depth: depthText(hit.c) }));
    });
    cv.node.addEventListener('pointermove', e => {
      const hit = cellAt(e, !!drag);
      if (!hit) { if (cursor && !drag) { cursor = null; traced(); } return; }
      const moved = !cursor || cursor.c !== hit.c || cursor.r !== hit.r;
      cursor = hit;
      if (drag && host.active) {
        // Fill every column crossed since the last event (fast drags skip columns), rows interpolated.
        const step = hit.c > drag.c ? 1 : -1;
        if (hit.c === drag.c) { if (drag.mode === 'paint' && hit.r !== drag.r) apply(hit.c, hit.r, 'paint'); }
        else for (let c = drag.c + step; step > 0 ? c <= hit.c : c >= hit.c; c += step) {
          const k = (c - drag.c) / (hit.c - drag.c);
          apply(c, Math.round(drag.r + (hit.r - drag.r) * k), drag.mode);
        }
        drag.c = hit.c; drag.r = hit.r;
      }
      if (moved || drag) traced();
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.node.addEventListener(ev, () => { drag = null; });
    cv.node.addEventListener('pointerleave', () => { if (!drag && cursor) { cursor = null; traced(); } });

    const depthText = c => (marks[c] == null ? '' : U().distanceM(Math.round(((marks[c] - L.surface[c]) * perRow) / 10) * 10));
    function keyMove(dc, dr) {
      if (!cursor) cursor = { c: 0, r: clamp(L.surface[0] + 3, 0, rows - 1) };
      else cursor = { c: clamp(cursor.c + dc, 0, cols - 1), r: clamp(cursor.r + dr, 0, rows - 1) };
      if (keyMode && dc) { const r = apply(cursor.c, cursor.r, keyMode); if (keyMode === 'paint') cursor.r = r; }
      traced();
    }
    host.onKey((e, down) => {
      const moves = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
      if (moves[e.code]) { if (down) keyMove(...moves[e.code]); return true; }
      if (e.code === 'Space') {
        if (!down) { keyMode = null; return true; }
        if (e.repeat) return true;
        if (!cursor) { keyMove(0, 0); return true; }
        const m = marks[cursor.c];
        keyMode = m != null && Math.abs(m - cursor.r) <= 1 ? 'erase' : 'paint';
        const r = apply(cursor.c, cursor.r, keyMode);
        if (keyMode === 'paint') cursor.r = r;
        traced(keyMode === 'erase' ? t('statusErased') : t('statusMarked', { depth: depthText(cursor.c) }));
        return true;
      }
      if (['Delete', 'Backspace', 'KeyX'].includes(e.code)) { if (down && cursor) { marks[cursor.c] = null; traced(t('statusErased')); } return true; }
      if (e.code === 'KeyC') { if (down && !e.repeat) peek(); return true; }
      if (e.code === 'Enter' && !e.target?.closest?.('button')) { if (down && !e.repeat) submit(false); return true; }
      return false;
    });

    // ------------------------------------------------------------------ result
    function evaluate() {
      const hit = marks.map((m, c) => (m == null ? null : L.ice[c] != null && Math.abs(m - L.ice[c]) <= P.tol));
      const hits = hit.filter(h => h === true).length, falses = hit.filter(h => h === false).length;
      const iceDepth = iceCols(L).reduce((s, c) => s + (L.ice[c] - L.surface[c]), 0) / Math.max(1, total);
      return { hit, hits, falses, coverage: hits / Math.max(1, total), depthM: Math.round((iceDepth * perRow) / 10) * 10 };
    }
    function submit(auto) {
      if (!host.active) return;
      const res = evaluate();
      reveal = res;
      const pct = Math.round(res.coverage * 100);
      if (!markedCount()) { host.fail(t('failEmpty')); render(); return; }
      if (res.falses > P.maxFalse) { host.fail(t('failFalse', { falses: res.falses, max: P.maxFalse })); render(); return; }
      if (res.coverage < P.stars[0]) { host.fail(t('failThin', { pct })); render(); return; }
      const stars = res.coverage >= P.stars[2] && res.falses === 0 ? 3 : res.coverage >= P.stars[1] ? 2 : 1;
      const depth = U().distanceM(res.depthM);
      host.finish({
        stars, summary: t('summary', { hits: res.hits, total, falses: res.falses, depth }),
        metrics: { hits: res.hits, total, falses: res.falses, coverage: res.coverage, auto },
      });
      render(t(auto ? 'statusAuto' : 'statusSent', { hits: res.hits, total, falses: res.falses, depth }));
    }

    host.loop(dt => {
      timeLeft -= dt;
      if (simLeft > 0) { simLeft -= dt; if (simLeft <= 0) { simLeft = 0; render(t('statusSimOff')); } }
      const sec = Math.ceil(timeLeft);
      if (sec !== lastSec) { lastSec = sec; readouts(); }
      if (timeLeft <= 0) submit(true);
    });

    const notes = host.mods.map(m => t(`event.${m}`)).join(' ');
    render(t('statusInit', { watts: SHARAD_W, gb: `${SHARAD_GB_DAY[0]}–${SHARAD_GB_DAY[1]}`, share: DATA_CAP_SHARE }) + (notes ? ` ${notes}` : ''));
    return { render: () => render() };
  }

  MG.register('M-O2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 32, normal: 36, hard: 34 },
    generate, validate, solve, mount,
  });
})();
