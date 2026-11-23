// O-O2 · Image compression (Oscar / Kepler + Galileo) · choice under a limit. Plan: docs/experiments-implementation.md
// §5.3. A heavy HiRISE photo from Maya does not fit in the downlink: Oscar keeps only the tiles that hold science
// targets (Kepler sent only the pixels around chosen stars, A2) and, on harder levels, sends some tiles with lossy
// compression (Galileo saved its mission with on-board compression after its main antenna failed, CD1). Lossy
// tiles cost half, but fine details (small hardware, thin tracks, gullies) lose most of their science.
// Real numbers (references/experiments/mars-experiments.md GE7, references/experiments/experiments.md A2, CD1): a
// HiRISE image is up to 28 Gb; ~78 min at 6 Mbit/s (calc.). Each run draws the photo size, the targets (kind,
// place, "value of the day") and the budget; an exact group knapsack finds the best science and the least data
// that keeps it, and the stars compare the player with both.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const IMAGE_GB = [12, 28]; // real (GE7): a single HiRISE image is up to 28 Gb; the lower end is game-balance
  const DOWNLINK_MBPS = 6; // real (GE7 calc.): 28 Gb take ~78 min at 6 Mbit/s
  const FINE_KEPT = 0.25; // game-balance: share of a fine-detail target's science that survives lossy compression
  const ANTENNA_BUDGET = 0.7; // game-balance: budget left with the antenna fault (Galileo, CD1)
  const WIDE = 0.55, NARROW = 0.72, SHORT = 0.46; // canvas aspect (height / width): wide, narrow and short screens

  // Science targets HiRISE images. w×h: tiles; value: base science points (game-balance, ×0.8–1.25 per run);
  // fine: small detail that lossy compression smears away.
  const KINDS = {
    dunes: { w: 2, h: 1, value: 30, fine: false },
    layers: { w: 1, h: 2, value: 40, fine: false },
    crater: { w: 1, h: 1, value: 45, fine: false },
    ice: { w: 1, h: 1, value: 60, fine: false },
    gully: { w: 1, h: 1, value: 50, fine: true },
    hardware: { w: 1, h: 1, value: 55, fine: true },
    tracks: { w: 2, h: 1, value: 35, fine: true },
  };

  // game-balance (plan §5.3). targets: how many in the photo; subtle: drawn faint (fine ones first); budget: share
  // of the data of all targets sent lossless; lossy: the compression tool exists; time: seconds before the pass;
  // goal: share of the best science; waste: tiles above the least data of the best crop still worth 3 stars.
  const LEVELS = {
    easy: { cols: 6, rows: 4, targets: 4, subtle: 0, budget: 0.75, lossy: false, time: 45, goal: 0.6, waste: 2, mods: 0 },
    normal: { cols: 7, rows: 4, targets: 5, subtle: 1, budget: 0.6, lossy: true, time: 45, goal: 0.75, waste: 1, mods: 1 },
    hard: { cols: 8, rows: 5, targets: 6, subtle: 2, budget: 0.5, lossy: true, time: 40, goal: 0.85, waste: 0, mods: [1, 2] },
  };
  // Modifiers with a real basis:
  //   antennaStuck  Galileo's 4.8 m high-gain antenna stuck half open and the planned 134.4 kbit/s link was lost (CD1):
  //                 a smaller downlink budget;
  //   dustHaze      a planet-wide dust storm (Jun 2018, the one that ended Opportunity, G6) veils the surface:
  //                 every target is drawn with less contrast.
  const MODS = ['antennaStuck', 'dustHaze'];

  // ---------------------------------------------------------------------------
  // Layout, solver, validation (pure)
  // ---------------------------------------------------------------------------
  function generate(R, P, { mods }) {
    const { cols, rows } = P;
    const owner = new Array(cols * rows).fill(-1);
    const free = (x, y, w, h, gap) => {
      for (let j = y - gap; j < y + h + gap; j++) for (let i = x - gap; i < x + w + gap; i++) {
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        if (owner[j * cols + i] >= 0) return false;
      }
      return true;
    };
    const kinds = R.sample(Object.keys(KINDS), P.targets);
    const targets = [];
    for (const kind of kinds) {
      const k = KINDS[kind];
      let spot = null;
      for (let tries = 0; tries < 80 && !spot; tries++) {
        const x = R.int(0, cols - k.w), y = R.int(0, rows - k.h);
        if (free(x, y, k.w, k.h, tries < 50 ? 1 : 0)) spot = [x, y];
      }
      if (!spot) continue;
      const [x, y] = spot, idx = targets.length;
      for (let j = y; j < y + k.h; j++) for (let i = x; i < x + k.w; i++) owner[j * cols + i] = idx;
      const value = Math.round(k.value * R.float(0.8, 1.25));
      targets.push({ kind, x, y, w: k.w, h: k.h, value, lossyValue: k.fine ? Math.round(value * FINE_KEPT) : value, fine: k.fine, subtle: false,
        u: Math.round(R.float(0.2, 0.8) * 100) / 100, v: Math.round(R.float(0.25, 0.75) * 100) / 100, turn: R.int(0, 3) });
    }
    // Subtle targets: fine details first, then any (Kepler's lesson: the faint ones are the precious ones).
    R.shuffle(targets.map((tg, i) => i)).sort((a, b) => Number(targets[b].fine) - Number(targets[a].fine))
      .slice(0, P.subtle).forEach(i => { targets[i].subtle = true; });
    const imageGb = Math.round(R.span(IMAGE_GB) * 10) / 10;
    const fullHalves = targets.reduce((s, tg) => s + 2 * tg.w * tg.h, 0);
    const budgetHalves = Math.max(2, Math.floor(fullHalves * P.budget * (mods.includes('antennaStuck') ? ANTENNA_BUDGET : 1)));
    return { cols, rows, imageGb, tileGb: imageGb / (cols * rows), budgetHalves, lossy: P.lossy, haze: mods.includes('dustHaze'), targets, deco: R.int(1, 2 ** 30) };
  }

  // Exact group knapsack in half-tile units: each target is dropped, sent lossless (2 per tile) or, when the tool
  // exists, compressed (1 per tile). dp[c] = best science with exactly c halves; the first c reaching the best value
  // is the least data that keeps it.
  function bestCrop(L, only) {
    const cap = L.budgetHalves;
    let dp = new Array(cap + 1).fill(-Infinity);
    dp[0] = 0;
    for (const tg of L.targets) {
      if (only && !only(tg)) continue;
      const tiles = tg.w * tg.h, opts = [[2 * tiles, tg.value]];
      if (L.lossy) opts.push([tiles, tg.lossyValue]);
      const next = dp.slice();
      for (let c = 0; c <= cap; c++) {
        if (dp[c] === -Infinity) continue;
        for (const [w, v] of opts) if (c + w <= cap && dp[c] + v > next[c + w]) next[c + w] = dp[c] + v;
      }
      dp = next;
    }
    const value = Math.max(...dp);
    return { value, halves: dp.indexOf(value) };
  }
  const solve = L => bestCrop(L);

  function validate(L, P) {
    if (L.targets.length !== P.targets) return false;
    const full = L.targets.reduce((s, tg) => s + 2 * tg.w * tg.h, 0);
    if (full <= L.budgetHalves) return false; // a real choice: not everything fits lossless
    const best = solve(L).value;
    if (best < 60) return false;
    // The faint targets must matter: without them the best crop is worse.
    return !P.subtle || bestCrop(L, tg => !tg.subtle).value < best;
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  // Flat facet colours: RAMPS.rock / ice / marsDark of web/app.js (docs/visual-identity.md §2).
  const GROUND = ['#4d3d4c', '#6b5a62', '#5e4a52', '#8e7c7c', '#6b5a62'];
  const INK = { dark: '#1a1022', shade: '#33263a', mid: '#6b5a62', lit: '#b3a196', bright: '#e9dccb', ice: '#fff6dc', rust: '#a8361f', cream: '#FCE8A6' };
  const HAZE = 'rgba(201, 184, 176, 0.42)'; // RAMPS.ice[1] as a flat veil

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const { cols, rows } = L;
    const sol = solve(L), best = sol.value;
    const goal = Math.ceil(best * P.goal);
    const owner = new Array(cols * rows).fill(-1);
    L.targets.forEach((tg, i) => { for (let j = tg.y; j < tg.y + tg.h; j++) for (let x = tg.x; x < tg.x + tg.w; x++) owner[j * cols + x] = i; });
    const state = new Uint8Array(cols * rows); // 0 cropped out, 1 lossless, 2 compressed
    const css = getComputedStyle(host.root);
    const tok = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const C = {
      amber: tok('--solar-amber', '#F59E0B'), cream: tok('--starlight-cream', '#FCE8A6'), coral: tok('--coral-hover', '#EE7B57'),
      safe: tok('--safe', '#7EDAC2'), amethyst: tok('--amethyst', '#9B5DE5'), void: tok('--bg-void', '#11071F'),
      heading: tok('--heading', '"Chakra Petch", sans-serif'),
    };
    let tool = 1, time = 0, cursor = null, painting = null, done = false, cache = null;

    const narrow = (host.body.clientWidth || 600) < 520, short = (window.innerHeight || 800) < 520;
    const cv = ui.canvas(narrow ? NARROW : short ? SHORT : WIDE, 'oo2-canvas');
    cv.node.setAttribute('role', 'img');
    const readout = ui.readout(['time', 'data', 'pts']);
    const tools = ui.el('div', 'oo2-tools');
    const toolBtn = id => { const b = ui.el('button', 'oo2-tool'); b.type = 'button'; b.addEventListener('click', () => setTool(id)); tools.append(b); return b; };
    const bFull = toolBtn(1), bLossy = toolBtn(2);
    tools.hidden = !L.lossy;
    const list = ui.el('div', 'oo2-list');
    const mData = ui.meter('');
    const send = ui.button('', 'primary');
    const controls = ui.el('div', 'mg-controls');
    controls.append(send);
    host.body.append(readout.node, tools, cv.node, list, mData.node, controls);

    // -------------------------------------------------------------------------
    // Scoring
    // -------------------------------------------------------------------------
    function tally() {
      let halves = 0;
      for (let i = 0; i < state.length; i++) halves += state[i] === 1 ? 2 : state[i] === 2 ? 1 : 0;
      let pts = 0, keptHalves = 0;
      const kept = L.targets.map(tg => {
        let all = true, lossy = false;
        for (let j = tg.y; j < tg.y + tg.h; j++) for (let x = tg.x; x < tg.x + tg.w; x++) { const s = state[j * cols + x]; if (!s) all = false; if (s === 2) lossy = true; }
        if (!all) return 0;
        pts += lossy ? tg.lossyValue : tg.value;
        keptHalves += (lossy ? 1 : 2) * tg.w * tg.h;
        return lossy ? 2 : 1;
      });
      return { halves, pts, kept, waste: halves - keptHalves };
    }
    const gb = halves => (halves * L.tileGb) / 2;
    const budgetGb = gb(L.budgetHalves);

    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------
    const geo = () => ({ tw: cv.w / cols, th: cv.h / rows });
    function rand(i, j) { return MG.lib.makeRandom(window.ASTRO_EXPERIMENTS.random.mulberry32((L.deco ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) >>> 0)); }
    function tri(g, a, b, c, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fill(); }
    function shape(g, pts, fill) { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }

    function paintTarget(g, tg, G) {
      const x0 = tg.x * G.tw, y0 = tg.y * G.th, w = tg.w * G.tw, h = tg.h * G.th;
      const cx = x0 + w * tg.u * 0.6 + w * 0.2, cy = y0 + h * tg.v * 0.6 + h * 0.2, s = Math.min(G.tw, G.th);
      const R = rand(tg.x + 40, tg.y + 40);
      g.save();
      g.globalAlpha = tg.subtle ? (L.haze ? 0.22 : 0.32) : L.haze ? 0.62 : 1;
      if (tg.kind === 'dunes') {
        // Barchans: dark crescents with a lit slip face.
        for (let k = 0; k < 4; k++) {
          const px = x0 + w * (0.15 + k * 0.23) + R.float(-3, 3), py = y0 + h * (0.38 + (k % 2) * 0.24), r = s * R.float(0.24, 0.3);
          shape(g, [[px - r, py + r * 0.35], [px - r * 0.35, py - r * 0.45], [px + r * 0.35, py - r * 0.45], [px + r, py + r * 0.35], [px + r * 0.45, py], [px - r * 0.45, py]], INK.dark);
          shape(g, [[px - r * 0.35, py - r * 0.45], [px + r * 0.35, py - r * 0.45], [px + r * 0.45, py], [px - r * 0.45, py]], INK.lit);
        }
      } else if (tg.kind === 'layers') {
        g.save(); g.beginPath(); g.rect(x0 + w * 0.12, y0 + h * 0.08, w * 0.76, h * 0.84); g.clip();
        for (let k = 0; k < 9; k++) {
          const y = y0 + h * (0.08 + k * 0.1), sk = w * 0.18;
          shape(g, [[x0, y + sk], [x0 + w, y], [x0 + w, y + h * 0.05], [x0, y + sk + h * 0.05]], k % 2 ? INK.lit : INK.shade);
        }
        g.restore();
      } else if (tg.kind === 'crater') {
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + R.float(-0.2, 0.2), r = s * R.float(0.32, 0.46);
          tri(g, [cx + Math.cos(a - 0.12) * s * 0.12, cy + Math.sin(a - 0.12) * s * 0.12], [cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx + Math.cos(a + 0.12) * s * 0.12, cy + Math.sin(a + 0.12) * s * 0.12], INK.bright);
        }
        shape(g, Array.from({ length: 8 }, (_, k) => [cx + Math.cos((k / 8) * Math.PI * 2) * s * 0.13, cy + Math.sin((k / 8) * Math.PI * 2) * s * 0.13]), INK.dark);
      } else if (tg.kind === 'ice') {
        shape(g, [[cx - s * 0.36, cy + s * 0.06], [cx - s * 0.1, cy - s * 0.18], [cx + s * 0.34, cy - s * 0.1], [cx + s * 0.3, cy + s * 0.05], [cx - s * 0.05, cy + s * 0.02]], INK.ice);
        shape(g, [[cx - s * 0.36, cy + s * 0.06], [cx - s * 0.05, cy + s * 0.02], [cx + s * 0.3, cy + s * 0.05], [cx + s * 0.1, cy + s * 0.2]], INK.mid);
      } else if (tg.kind === 'gully') {
        shape(g, [[x0 + w * 0.1, y0 + h * 0.1], [x0 + w * 0.9, y0 + h * 0.1], [x0 + w * 0.75, y0 + h * 0.6], [x0 + w * 0.25, y0 + h * 0.6]], INK.lit);
        g.strokeStyle = INK.dark; g.lineWidth = Math.max(1, s * 0.03);
        for (let k = 0; k < 4; k++) {
          const sx = x0 + w * (0.22 + k * 0.18);
          g.beginPath(); g.moveTo(sx, y0 + h * 0.14); g.lineTo(sx + R.float(-3, 3), y0 + h * 0.4); g.lineTo(x0 + w * 0.5 + R.float(-4, 4), y0 + h * 0.62); g.stroke();
        }
        shape(g, [[x0 + w * 0.3, y0 + h * 0.62], [x0 + w * 0.7, y0 + h * 0.62], [x0 + w * 0.5, y0 + h * 0.84]], INK.mid);
      } else if (tg.kind === 'hardware') {
        shape(g, Array.from({ length: 7 }, (_, k) => [cx + Math.cos((k / 7) * Math.PI * 2) * s * 0.2, cy + Math.sin((k / 7) * Math.PI * 2) * s * 0.16]), INK.shade);
        g.fillStyle = INK.bright; g.fillRect(cx - s * 0.05, cy - s * 0.035, s * 0.1, s * 0.07);
        g.fillStyle = INK.cream; g.fillRect(cx + s * 0.24, cy - s * 0.2, s * 0.06, s * 0.06);
      } else if (tg.kind === 'tracks') {
        g.strokeStyle = INK.dark; g.lineWidth = Math.max(1.5, s * 0.035);
        for (let k = 0; k < 3; k++) {
          const y = y0 + h * (0.25 + k * 0.25) + R.float(-3, 3);
          g.beginPath(); g.moveTo(x0 + w * 0.05, y); g.lineTo(x0 + w * 0.35, y - h * 0.12); g.lineTo(x0 + w * 0.65, y + h * 0.08); g.lineTo(x0 + w * 0.95, y - h * 0.06); g.stroke();
        }
      }
      g.restore();
    }

    function paintPhoto(g) {
      const G = geo(), n = 3, cw = G.tw / n, ch = G.th / n;
      const vtx = (i, j) => { const R = rand(i, j); const edge = i === 0 || j === 0 || i === cols * n || j === rows * n; return [i * cw + (edge ? 0 : R.float(-0.3, 0.3) * cw), j * ch + (edge ? 0 : R.float(-0.3, 0.3) * ch)]; };
      for (let i = 0; i < cols * n; i++) for (let j = 0; j < rows * n; j++) {
        const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1), R = rand(i + 500, j + 500);
        tri(g, a, b, c, GROUND[R.int(0, GROUND.length - 1)]);
        tri(g, a, c, d, GROUND[R.int(0, GROUND.length - 1)]);
      }
      L.targets.forEach(tg => paintTarget(g, tg, G));
      if (L.haze) { g.fillStyle = HAZE; g.fillRect(0, 0, cv.w, cv.h); }
    }
    function photo() {
      const key = `${cv.w}x${cv.h}x${cv.node.width}`;
      if (cache?.key === key) return cache.canvas;
      const off = document.createElement('canvas');
      off.width = cv.node.width; off.height = cv.node.height;
      const g = off.getContext('2d'), dpr = cv.node.width / cv.w;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintPhoto(g);
      cache = { key, canvas: off };
      return off;
    }

    function draw() {
      cv.fit();
      const g = cv.ctx, G = geo(), T = tally();
      g.clearRect(0, 0, cv.w, cv.h);
      g.drawImage(photo(), 0, 0, cv.w, cv.h);
      const any = T.halves > 0;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const s = state[j * cols + i], x = i * G.tw, y = j * G.th;
        if (!s && any) { g.fillStyle = 'rgba(17, 7, 31, 0.6)'; g.fillRect(x, y, G.tw, G.th); }
        if (s === 2) {
          g.save(); g.beginPath(); g.rect(x, y, G.tw, G.th); g.clip();
          g.strokeStyle = 'rgba(155, 93, 229, 0.55)'; g.lineWidth = 2;
          for (let k = -G.th; k < G.tw; k += 8) { g.beginPath(); g.moveTo(x + k, y + G.th); g.lineTo(x + k + G.th, y); g.stroke(); }
          g.restore();
        }
      }
      g.strokeStyle = 'rgba(17, 7, 31, 0.7)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < cols; i++) { g.moveTo(Math.round(i * G.tw) + 0.5, 0); g.lineTo(Math.round(i * G.tw) + 0.5, cv.h); }
      for (let j = 1; j < rows; j++) { g.moveTo(0, Math.round(j * G.th) + 0.5); g.lineTo(cv.w, Math.round(j * G.th) + 0.5); }
      g.stroke();
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const s = state[j * cols + i];
        if (!s) continue;
        g.strokeStyle = s === 1 ? C.amber : C.amethyst; g.lineWidth = 2;
        g.strokeRect(i * G.tw + 2, j * G.th + 2, G.tw - 4, G.th - 4);
      }
      g.font = `700 ${Math.round(clamp(G.th * 0.2, 10, 13))}px ${C.heading}`; g.textBaseline = 'top'; g.textAlign = 'left';
      L.targets.forEach((tg, i) => {
        const k = T.kept[i], x = tg.x * G.tw, y = tg.y * G.th;
        if (done) {
          g.strokeStyle = k === 1 ? C.safe : k === 2 ? C.amethyst : C.coral; g.lineWidth = 3;
          g.strokeRect(x + 4, y + 4, tg.w * G.tw - 8, tg.h * G.th - 8);
        }
        if (k || done) {
          const label = k ? `✓ ${k === 2 ? tg.lossyValue : tg.value}` : '✕';
          const tw = g.measureText(label).width + 8;
          g.fillStyle = C.void; g.fillRect(x + 5, y + 5, tw, 17);
          g.fillStyle = k === 1 ? C.safe : k === 2 ? C.amethyst : C.coral; g.fillText(label, x + 9, y + 7);
        }
      });
      if (cursor != null && !done) {
        const i = cursor % cols, j = (cursor / cols) | 0;
        g.strokeStyle = C.cream; g.lineWidth = 2; g.setLineDash([5, 4]);
        g.strokeRect(i * G.tw + 1, j * G.th + 1, G.tw - 2, G.th - 2); g.setLineDash([]);
      }
    }

    // -------------------------------------------------------------------------
    // Flow
    // -------------------------------------------------------------------------
    function setTool(next) { if (!L.lossy) return; tool = next; render(); }
    function labels() {
      cv.node.setAttribute('aria-label', t('canvasAria', { cols, rows }));
      bFull.replaceChildren(ui.el('strong', '', t('toolFull')), ui.el('span', '', t('toolFullSub', { gb: U().decimal(L.tileGb, 2) })));
      bLossy.replaceChildren(ui.el('strong', '', t('toolLossy')), ui.el('span', '', t('toolLossySub', { gb: U().decimal(L.tileGb / 2, 2) })));
      list.setAttribute('aria-label', t('listAria'));
    }

    function render(status) {
      const T = tally();
      const left = Math.max(0, P.time - time);
      readout.set('time', `${U().decimal(left, 1)} s`, left < 8 ? 'danger' : '');
      readout.set('data', `${U().decimal(gb(T.halves), 1)} / ${U().decimal(budgetGb, 1)} Gb`, T.halves > L.budgetHalves ? 'danger' : '');
      readout.set('pts', `${T.pts} / ${goal} pts`, T.pts >= goal ? 'good' : '');
      bFull.setAttribute('aria-pressed', String(tool === 1));
      bLossy.setAttribute('aria-pressed', String(tool === 2));
      bFull.disabled = bLossy.disabled = !host.active;
      mData.label(t('budgetLabel', { gb: U().decimal(budgetGb, 1), min: Math.round((budgetGb * 1000) / DOWNLINK_MBPS / 60), photo: U().decimal(L.imageGb, 1) }));
      mData.set(T.halves / L.budgetHalves, T.halves > L.budgetHalves ? 'danger' : 'warn');
      list.replaceChildren(...L.targets.map((tg, i) => {
        const k = T.kept[i];
        const chip = ui.el('span', `oo2-chip${k === 1 ? ' is-kept' : k === 2 ? ' is-lossy' : ''}${done && !k ? ' is-cut' : ''}`);
        chip.append(ui.el('b', '', k ? '✓' : done ? '✕' : '◇'), document.createTextNode(` ${t(`kinds.${tg.kind}`)} `),
          ui.el('small', '', L.lossy && tg.fine ? t('chipFine', { full: tg.value, lossy: tg.lossyValue }) : t('chipPts', { pts: tg.value })));
        return chip;
      }));
      const valid = T.halves <= L.budgetHalves && T.pts >= goal;
      send.disabled = !host.active;
      send.classList.toggle('is-ready', valid && host.active);
      send.textContent = T.halves > L.budgetHalves ? t('overBtn') : T.pts < goal ? t('needBtn', { pts: T.pts, goal }) : t('sendBtn', { gb: U().decimal(gb(T.halves), 1), pts: T.pts });
      if (status) host.status(status);
      draw();
    }

    function apply(i, to) {
      if (!host.active || i < 0 || i >= state.length || state[i] === to) return false;
      state[i] = to;
      return true;
    }
    function after() {
      const T = tally();
      render(T.halves > L.budgetHalves ? t('statusOver', { over: U().decimal(gb(T.halves - L.budgetHalves), 1) })
        : T.pts >= goal ? t('statusReady', { pts: T.pts, gb: U().decimal(gb(T.halves), 1) }) : t('statusCount', { pts: T.pts, goal }));
    }
    const tileAt = e => {
      const r = cv.node.getBoundingClientRect(), G = geo();
      const i = Math.floor((e.clientX - r.left) / G.tw), j = Math.floor((e.clientY - r.top) / G.th);
      return i >= 0 && j >= 0 && i < cols && j < rows ? j * cols + i : -1;
    };
    cv.node.addEventListener('pointerdown', e => {
      if (!host.active || e.button !== 0) return;
      const i = tileAt(e);
      if (i < 0) return;
      e.preventDefault();
      painting = state[i] === tool ? 0 : tool;
      try { cv.node.setPointerCapture(e.pointerId); } catch { /* gone */ }
      cursor = null;
      if (apply(i, painting)) after();
    });
    cv.node.addEventListener('pointermove', e => { if (painting != null && apply(tileAt(e), painting)) after(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.node.addEventListener(ev, () => { painting = null; });

    const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
    host.onKey((e, down) => {
      const m = KEYS[e.code];
      if (m) {
        if (down) {
          if (cursor == null) cursor = 0;
          else cursor = clamp(((cursor / cols) | 0) + m[1], 0, rows - 1) * cols + clamp((cursor % cols) + m[0], 0, cols - 1);
          render();
        }
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target?.closest?.('button')) return false; // let a focused button act on its own
        if (down && !e.repeat) {
          if (cursor == null) { cursor = 0; render(); } else if (apply(cursor, state[cursor] === tool ? 0 : tool)) after();
        }
        return true;
      }
      if (L.lossy && (e.code === 'Digit1' || e.code === 'Digit2')) { if (down) setTool(e.code === 'Digit1' ? 1 : 2); return true; }
      return false;
    });

    function transmit(auto) {
      const T = tally();
      done = true;
      const stars = T.pts >= best && T.halves <= sol.halves + 2 * P.waste ? 3 : T.pts >= goal + (best - goal) / 2 ? 2 : 1;
      render(t(auto ? 'statusAuto' : 'statusSent', { gb: U().decimal(gb(T.halves), 1), pts: T.pts, saved: Math.round((1 - gb(T.halves) / L.imageGb) * 100) }));
      host.finish({ stars, summary: t('summary', { pts: T.pts, best, gb: U().decimal(gb(T.halves), 1), least: U().decimal(gb(sol.halves), 1) }), metrics: { pts: T.pts, best, halves: T.halves, least: sol.halves } });
      render();
    }
    send.addEventListener('click', () => {
      if (!host.active) return;
      const T = tally();
      if (T.halves > L.budgetHalves) { render(t('statusOver', { over: U().decimal(gb(T.halves - L.budgetHalves), 1) })); return; }
      if (T.pts < goal) { render(t('statusNeed', { pts: T.pts, goal })); return; }
      transmit(false);
    });

    host.loop(dt => {
      time += dt;
      if (time >= P.time) {
        time = P.time;
        const T = tally();
        if (T.halves <= L.budgetHalves && T.pts >= goal) { transmit(true); return; }
        done = true;
        render();
        host.fail(T.halves > L.budgetHalves ? t('failOver', { gb: U().decimal(gb(T.halves), 1), budget: U().decimal(budgetGb, 1) })
          : t('failCut', { pts: T.pts, goal, cut: T.kept.filter(k => !k).length }));
        render();
        return;
      }
      const left = P.time - time;
      readout.set('time', `${U().decimal(left, 1)} s`, left < 8 ? 'danger' : '');
    });

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
    ro?.observe(cv.node);
    host.onCleanup(() => ro?.disconnect());

    labels();
    render(t('statusInit', { goal, gb: U().decimal(budgetGb, 1), photo: U().decimal(L.imageGb, 1) }) + (L.lossy ? ` ${t('lossyNote')}` : '') + (L.haze ? ` ${t('hazeNote')}` : ''));
    return { render: () => { labels(); render(); } };
  }

  MG.register('O-O2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 30, normal: 35, hard: 35 },
    generate, validate, solve, mount,
  });
})();
