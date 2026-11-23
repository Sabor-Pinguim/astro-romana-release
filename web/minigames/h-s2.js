// H-S2 · Precision landing (Helena / Terrain Relative Navigation) · choice under a limit. Plan:
// docs/experiments-implementation.md §5.3. Runs during the landing stage ("descent"): the Lander Vision System
// camera shows the terrain below and, in a few seconds, Helena picks a spot that is clear of boulder fields,
// craters and steep slopes, inside the divert range and as close as possible to the science target.
// Real numbers (references/experiments/mars-experiments.md: EN4, EN8 and the EDL row of §1): TRN decides in under
// 10 s; Perseverance could divert up to 600 m and landed ≤ 8.53 m from its target (requirement 60 m); AutoNav's
// record is 347.7 m in one sol. Each run draws the predicted landing point, the science target and the hazards
// around it; a ring search finds the closest safe spot (the optimum) and the stars compare the player with it.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const DIVERT_MAX_M = 600; // real (EN4): Perseverance could divert up to 600 m
  const SCATTER_M = 8.53; // real (EN4): touchdown error found in the post-landing analysis
  const SOL_DRIVE_M = 347.7; // real (EN8): AutoNav record distance in one sol
  const CLEAR_M = 40; // game-balance: radius that must be clear under the descent stage (the aim ring)
  const DAMAGE_CHANCE = 0.6; // game-balance: chance that a touchdown on a hazard damages the rover
  const VIEW_MARGIN_M = 60; // game-balance: terrain shown around the reachable circle
  const SEARCH_STEP_M = 4; // game-balance: resolution of the optimum search (m), far below the star tolerances
  const AIM_SPEED_MS = 260, NUDGE_M = 8; // game-balance: keyboard/pad aim speed (m/s) and single-press nudge (m)
  const WIDE = 0.56, NARROW = 0.86, SHORT = 0.46; // canvas aspect (height / width): wide, narrow and short screens
  const TAU = Math.PI * 2;

  // game-balance (plan §5.3). range: divert radius in m (scaled below the real 600 m so hazards stay readable on a
  // phone); time: decision seconds (≤ the real 10 s); craters/fields/slopes: hazard counts; shadows: low-sun
  // patches that hide a boulder field; assist: the aim ring warns over visible hazards; three/two: metres above
  // the best spot's distance that still give 3 and 2 stars.
  const LEVELS = {
    easy: { range: 500, time: 10, craters: [2, 3], fields: [3, 4], slopes: [1, 2], shadows: 0, assist: true, three: 45, two: 130, mods: 0 },
    normal: { range: 430, time: 9, craters: [3, 4], fields: [4, 6], slopes: [2, 3], shadows: 1, assist: false, three: 35, two: 110, mods: 1 },
    hard: { range: 360, time: 8, craters: [3, 4], fields: [5, 7], slopes: [2, 3], shadows: 2, assist: false, three: 25, two: 90, mods: [1, 2] },
  };
  // Modifiers with a real basis (EN4):
  //   scatter  Perseverance touched down up to 8.53 m from the chosen target: the touchdown lands off the aim, so a
  //            spot that only grazes a hazard is no longer safe (the optimum keeps that margin too);
  //   mapFix   TRN first matches the camera images with the onboard map and only then knows where the vehicle is:
  //            the reachable circle is an estimate until the fix arrives and then jumps to the true position.
  const MODS = ['scatter', 'mapFix'];

  const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
  const r1 = v => Math.round(v * 10) / 10;
  const polar = (d, a) => [d * Math.cos(a), d * Math.sin(a)];

  // ---------------------------------------------------------------------------
  // Geometry (pure)
  // ---------------------------------------------------------------------------
  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const k = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    const ex = ax + k * dx - px, ey = ay + k * dy - py;
    return ex * ex + ey * ey;
  }
  function circleHitsPoly(x, y, r, pts) {
    if (inPoly(x, y, pts)) return true;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (segDist2(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1]) < r * r) return true;
    return false;
  }
  // An irregular polygon around (x, y): rx/ry radii, rotation rot. Stays star-shaped, so it is a simple polygon.
  function blob(R, x, y, rx, ry, rot, n) {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU + R.float(-0.2, 0.2) * (TAU / n), k = R.float(0.72, 1);
      const ex = rx * k * Math.cos(a), ey = ry * k * Math.sin(a);
      return [r1(x + ex * Math.cos(rot) - ey * Math.sin(rot)), r1(y + ex * Math.sin(rot) + ey * Math.cos(rot))];
    });
  }

  // Which hazard a circle of radius `clear` at (x, y) touches, or null. fair = what the player can know: shadows
  // count as unsafe (their boulders are hidden), the hidden boulders themselves are skipped.
  function hazardAt(L, x, y, clear, fair) {
    for (const h of L.hazards) {
      if (fair && h.hidden) continue;
      const dx = x - h.x, dy = y - h.y, rr = h.r + clear;
      if (dx * dx + dy * dy >= rr * rr) continue;
      if (!h.pts || circleHitsPoly(x, y, clear, h.pts)) return h.k;
    }
    if (fair) {
      for (const s of L.shadows) {
        const dx = x - s.x, dy = y - s.y, rr = s.r + clear;
        if (dx * dx + dy * dy < rr * rr && circleHitsPoly(x, y, clear, s.pts)) return 'shadow';
      }
    }
    return null;
  }
  // The nearest hazard edge from the edge of the aim ring (m); negative when they overlap (circle approximation).
  function margin(L, x, y) {
    let m = Infinity;
    for (const h of L.hazards) {
      const d = Math.hypot(x - h.x, y - h.y) - h.r * (h.pts ? 0.86 : 1) - CLEAR_M;
      if (d < m) m = d;
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  // Layout, solver, validation (pure)
  // ---------------------------------------------------------------------------
  // Every size and offset below is game-balance, in metres (map fix: 70–120 m jump after 2–3.2 s).
  function generate(R, P, { mods }) {
    const range = P.range;
    const fixAt = mods.includes('mapFix') ? r1(R.float(2, 3.2)) : 0;
    const center = fixAt ? polar(R.float(70, 120), R.float(0, TAU)).map(r1) : [0, 0];
    const shift = Math.hypot(center[0], center[1]);
    const view = { cx: r1(center[0] / 2), cy: r1(center[1] / 2), half: Math.round(range + shift / 2 + VIEW_MARGIN_M) };
    const inCircle = (k = 1.05) => { const [dx, dy] = polar(range * k * Math.sqrt(R.next()), R.float(0, TAU)); return [center[0] + dx, center[1] + dy]; };

    const [tdx, tdy] = polar(R.float(0.35, 0.75) * range, R.float(0, TAU));
    const target = [r1(center[0] + tdx), r1(center[1] + tdy)];
    const hazards = [];
    const circle = (k, x, y, r, hidden) => hazards.push({ k, x: r1(x), y: r1(y), r: r1(r), ...(hidden ? { hidden: true } : {}) });
    const slope = (x, y, r) => {
      const rx = r, ry = r * R.float(0.4, 0.75);
      hazards.push({ k: 'slope', x: r1(x), y: r1(y), r: r1(rx), pts: blob(R, x, y, rx, ry, R.float(0, Math.PI), 7) });
    };

    // The science target sits on a crater rim and next to a boulder field: landing right on it is never safe.
    const side = R.float(0, TAU);
    const rc = R.float(70, 115);
    const [cdx, cdy] = polar(rc * R.float(0.55, 1.05), side);
    circle('crater', target[0] + cdx, target[1] + cdy, rc);
    const [fdx, fdy] = polar(R.float(45, 90), side + Math.PI + R.float(-0.9, 0.9));
    circle('rocks', target[0] + fdx, target[1] + fdy, R.float(35, 60));

    for (let i = R.span(P.craters) - 1; i > 0; i--) { const [x, y] = inCircle(); circle('crater', x, y, R.float(45, 130)); }
    for (let i = R.span(P.fields) - 1; i > 0; i--) { const [x, y] = inCircle(); circle('rocks', x, y, R.float(30, 70)); }
    for (let i = R.span(P.slopes); i > 0; i--) { const [x, y] = inCircle(); slope(x, y, R.float(70, 140)); }

    // Low sun: dark patches behind ridges hide a boulder field (the first one near the target, to tempt).
    const shadows = [];
    for (let i = 0; i < P.shadows; i++) {
      const [x, y] = i === 0 ? (([dx, dy]) => [target[0] + dx, target[1] + dy])(polar(R.float(90, 150), R.float(0, TAU))) : inCircle(0.9);
      const r = R.float(70, 105);
      shadows.push({ x: r1(x), y: r1(y), r: r1(r), pts: blob(R, x, y, r, r * R.float(0.6, 0.85), R.float(0, Math.PI), 8) });
      circle('rocks', x + R.float(-12, 12), y + R.float(-12, 12), r * R.float(0.45, 0.6), true);
    }
    return { range, center, fixAt, view, target, hazards, shadows, scatter: mods.includes('scatter'), deco: R.int(1, 2 ** 30) };
  }

  // The closest spot to the target that is safe (with the scatter margin when it applies) and reachable: rings of
  // growing radius around the target, SEARCH_STEP_M apart, the first safe point wins.
  function nearestSafe(L, limit) {
    const clear = CLEAR_M + (L.scatter ? SCATTER_M : 0);
    const [tx, ty] = L.target, [cx, cy] = L.center, r2 = L.range * L.range;
    const maxR = Math.min(limit, Math.hypot(tx - cx, ty - cy) + L.range);
    // Each hazard (shadows included: the player cannot see under them) only matters for the rings it can touch.
    const all = [...L.hazards.filter(h => !h.hidden), ...L.shadows.map(s => ({ ...s, k: 'shadow' }))]
      .map(h => ({ h, d: Math.hypot(h.x - tx, h.y - ty), reach: h.r + clear }));
    for (let r = 0, ring = 0; r <= maxR; r += SEARCH_STEP_M, ring++) {
      const near = all.filter(o => Math.abs(o.d - r) < o.reach).map(o => o.h);
      const n = r === 0 ? 1 : Math.ceil((TAU * r) / SEARCH_STEP_M);
      const off = (ring * 0.618) % 1;
      for (let k = 0; k < n; k++) {
        const a = ((k + off) / n) * TAU, x = tx + r * Math.cos(a), y = ty + r * Math.sin(a);
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        let hit = false;
        for (const h of near) {
          const dx = x - h.x, dy = y - h.y, rr = h.r + clear;
          if (dx * dx + dy * dy < rr * rr && (!h.pts || circleHitsPoly(x, y, clear, h.pts))) { hit = true; break; }
        }
        if (!hit) return { dist: r, x: r1(x), y: r1(y) };
      }
    }
    return { dist: Infinity, x: 0, y: 0 };
  }
  const solve = L => nearestSafe(L, Infinity);

  function validate(L) {
    if (!hazardAt(L, L.target[0], L.target[1], CLEAR_M, false)) return false; // a real decision: the target itself is unsafe
    // Enough clear ground to find in a few seconds: at least 30% of the reachable circle is safe (cheap, so first).
    let safe = 0, all = 0;
    const step = L.range / 7;
    for (let x = -L.range; x <= L.range; x += step) for (let y = -L.range; y <= L.range; y += step) {
      if (x * x + y * y > L.range * L.range) continue;
      all++;
      if (!hazardAt(L, L.center[0] + x, L.center[1] + y, CLEAR_M, true)) safe++;
    }
    if (safe / all < 0.3) return false;
    const best = nearestSafe(L, L.range * 0.8); // farther than that is not a fair layout: stop searching there
    return Number.isFinite(best.dist) && best.dist >= 25;
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  // Flat facet colours: RAMPS.ground / marsDark / rock of web/app.js (docs/visual-identity.md §2).
  const GROUND = ['#4a1420', '#5e1d22', '#6e1d1d', '#5e1d22', '#8F241E'];
  const ROCK = { lit: '#b3a196', mid: '#8e7c7c', dark: '#4d3d4c', patch: '#3a1424' };
  const CRATER = { rim: '#c4502e', rimDark: '#a8361f', wall: '#3a1424', floor: '#2a0c18' };
  const SLOPE = { fill: '#3a1424', hatch: '#2a0c18', edge: '#a8361f' };
  const SHADOW = 'rgba(17, 7, 31, 0.86)';

  function hashRand(seed, i, j) {
    const rng = window.ASTRO_EXPERIMENTS.random.mulberry32((seed ^ Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663)) >>> 0);
    return MG.lib.makeRandom(rng);
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const best = solve(L);
    const css = getComputedStyle(host.root);
    const tok = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const C = {
      amber: tok('--solar-amber', '#F59E0B'), cream: tok('--starlight-cream', '#FCE8A6'), coral: tok('--coral-hover', '#EE7B57'),
      safe: tok('--safe', '#7EDAC2'), amethyst: tok('--amethyst', '#9B5DE5'), muted: tok('--muted', '#B9B0CE'),
      void: tok('--bg-void', '#11071F'), viewport: tok('--bg-viewport', '#17183B'), f3: tok('--f3', '#24143a'),
      heading: tok('--heading', '"Chakra Petch", sans-serif'),
    };
    const narrow = (host.body.clientWidth || 600) < 520, short = (window.innerHeight || 800) < 520;
    const cv = ui.canvas(narrow ? NARROW : short ? SHORT : WIDE, 'hs2-canvas');
    cv.node.setAttribute('role', 'img');
    cv.node.tabIndex = 0;

    let phase = 'ready', time = 0, fixed = !L.fixAt, aim = null, landed = null, dragging = false, cache = null;
    const keys = new Map(); // code → seconds held
    const padHolds = [];

    const readout = ui.readout(['time', 'dist', 'range']);
    const mTime = ui.meter('');
    const legend = ui.el('div', 'mg-legend hs2-legend');
    const controls = ui.el('div', 'mg-controls hs2-controls');
    const pad = ui.el('div', 'mg-pad hs2-pad');
    const DIRS = [['←', -1, 0, 'moveLeft'], ['↑', 0, -1, 'moveUp'], ['↓', 0, 1, 'moveDown'], ['→', 1, 0, 'moveRight']];
    const padRow = ui.el('div');
    DIRS.forEach(([glyph, dx, dy, aria]) => {
      const b = ui.el('button', '', glyph);
      b.type = 'button'; b.dataset.aria = aria;
      padHolds.push({ dx, dy, hold: ui.hold(b, on => { if (on) startIfReady(); }) });
      padRow.append(b);
    });
    pad.append(padRow);
    const main = ui.button('', 'primary', () => (phase === 'ready' ? start() : land(false)));
    controls.append(pad, main);
    host.body.append(readout.node, cv.node, mTime.node, legend, controls);

    const circleCenter = () => (fixed ? L.center : [0, 0]);
    const distTo = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const view = () => { const s = cv.h / (2 * L.view.half); return { s, ox: cv.w / 2 - L.view.cx * s, oy: cv.h / 2 - L.view.cy * s }; };

    function clampAim(p) {
      const c = circleCenter(), d = distTo(p, c);
      return d <= L.range ? p : [c[0] + ((p[0] - c[0]) * L.range) / d, c[1] + ((p[1] - c[1]) * L.range) / d];
    }
    function setAim(p) { aim = clampAim(p); }
    const shown = { ...L, hazards: L.hazards.filter(x => !x.hidden) };
    const visibleHazard = p => hazardAt(shown, p[0], p[1], CLEAR_M, false);
    let warned = false;

    // -------------------------------------------------------------------------
    // Drawing (flat facets, hard edges)
    // -------------------------------------------------------------------------
    function poly(g, pts, T) {
      g.beginPath();
      pts.forEach(([x, y], i) => { const px = T.ox + x * T.s, py = T.oy + y * T.s; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.closePath();
    }
    function ring(x, y, r, n, R) {
      return Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU, k = R ? R.float(0.9, 1.05) : 1; return [x + r * k * Math.cos(a), y + r * k * Math.sin(a)]; });
    }

    function paintTerrain(g, T) {
      const w = cv.w, h = cv.h;
      // Ground: a jittered triangle grid anchored to map metres (same look on every screen).
      const cell = L.view.half / 4;
      const x0 = Math.floor((-T.ox / T.s) / cell) - 1, x1 = Math.ceil(((w - T.ox) / T.s) / cell) + 1;
      const y0 = Math.floor((-T.oy / T.s) / cell) - 1, y1 = Math.ceil(((h - T.oy) / T.s) / cell) + 1;
      const vtx = (i, j) => { const R = hashRand(L.deco, i, j); return [i * cell + R.float(-0.3, 0.3) * cell, j * cell + R.float(-0.3, 0.3) * cell]; };
      for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) {
        const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1);
        const R = hashRand(L.deco + 7, i, j);
        g.fillStyle = GROUND[R.int(0, GROUND.length - 1)]; poly(g, [a, b, c], T); g.fill();
        g.fillStyle = GROUND[R.int(0, GROUND.length - 1)]; poly(g, [a, c, d], T); g.fill();
      }
      L.hazards.forEach((hz, idx) => {
        const R = hashRand(L.deco + 13, idx, 0);
        if (hz.k === 'slope') {
          g.fillStyle = SLOPE.fill; poly(g, hz.pts, T); g.fill();
          g.save(); poly(g, hz.pts, T); g.clip();
          g.strokeStyle = SLOPE.hatch; g.lineWidth = Math.max(2, 7 * T.s);
          const cx = T.ox + hz.x * T.s, cy = T.oy + hz.y * T.s, rr = hz.r * T.s;
          for (let k = -rr; k <= rr; k += Math.max(5, 18 * T.s)) { g.beginPath(); g.moveTo(cx + k - rr, cy - rr); g.lineTo(cx + k + rr, cy + rr); g.stroke(); }
          g.restore();
          g.strokeStyle = SLOPE.edge; g.lineWidth = 1.5; poly(g, hz.pts, T); g.stroke();
        } else if (hz.k === 'crater') {
          g.fillStyle = CRATER.rim; poly(g, ring(hz.x, hz.y, hz.r * 1.1, 11, R), T); g.fill();
          g.fillStyle = CRATER.wall; poly(g, ring(hz.x, hz.y, hz.r * 0.92, 11, R), T); g.fill();
          g.fillStyle = CRATER.floor; poly(g, ring(hz.x + hz.r * 0.12, hz.y + hz.r * 0.12, hz.r * 0.66, 9, R), T); g.fill();
          g.fillStyle = CRATER.rimDark; poly(g, [[hz.x + hz.r * 1.1, hz.y], [hz.x + hz.r * 0.78, hz.y + hz.r * 0.78], [hz.x, hz.y + hz.r * 1.1], [hz.x + hz.r * 0.5, hz.y + hz.r * 0.62]], T); g.fill();
        } else {
          if (!hz.hidden) { g.fillStyle = ROCK.patch; poly(g, ring(hz.x, hz.y, hz.r * 0.95, 9, R), T); g.fill(); }
          const n = clamp(Math.round((hz.r / 13) ** 2 * 1.3), 6, 24);
          for (let k = 0; k < n; k++) {
            const [dx, dy] = polar(hz.r * 0.85 * Math.sqrt(R.next()), R.float(0, TAU));
            const rr = Math.max(2.4, R.float(5, 11) * T.s), px = T.ox + (hz.x + dx) * T.s, py = T.oy + (hz.y + dy) * T.s;
            const pts = Array.from({ length: 5 }, (_, q) => { const a = (q / 5) * TAU + R.float(-0.3, 0.3); return [px + rr * Math.cos(a), py + rr * Math.sin(a)]; });
            g.fillStyle = ROCK.dark; g.beginPath(); pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
            g.fillStyle = ROCK.lit; g.beginPath(); g.moveTo(pts[2][0], pts[2][1]); [pts[3], pts[4], pts[0]].forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill();
          }
        }
      });
      g.fillStyle = SHADOW;
      L.shadows.forEach(s => { poly(g, s.pts, T); g.fill(); });
    }

    function terrain(T) {
      const key = `${cv.w}x${cv.h}x${cv.node.width}`;
      if (cache?.key === key) return cache.canvas;
      const off = document.createElement('canvas');
      off.width = cv.node.width; off.height = cv.node.height;
      const g = off.getContext('2d');
      const dpr = cv.node.width / cv.w;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintTerrain(g, T);
      cache = { key, canvas: off };
      return off;
    }

    function diamond(g, x, y, r, fill, stroke) {
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
      g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = stroke; g.stroke();
    }

    function draw() {
      cv.fit();
      const g = cv.ctx, w = cv.w, h = cv.h;
      g.clearRect(0, 0, w, h);
      if (phase === 'ready') {
        g.fillStyle = C.viewport; g.fillRect(0, 0, w, h);
        g.fillStyle = C.f3;
        g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.35, h * 0.62); g.lineTo(w * 0.6, h * 0.78); g.lineTo(w, h * 0.55); g.lineTo(w, h); g.closePath(); g.fill();
        // Parachute (faceted canopy) and the descent vehicle.
        const px = w / 2, py = h * 0.3, pr = Math.min(w, h) * 0.16;
        g.fillStyle = C.coral; g.beginPath(); g.moveTo(px - pr, py); g.lineTo(px - pr * 0.5, py - pr * 0.55); g.lineTo(px, py - pr * 0.68); g.lineTo(px, py); g.closePath(); g.fill();
        g.fillStyle = C.cream; g.beginPath(); g.moveTo(px, py - pr * 0.68); g.lineTo(px + pr * 0.5, py - pr * 0.55); g.lineTo(px + pr, py); g.lineTo(px, py); g.closePath(); g.fill();
        g.strokeStyle = C.muted; g.lineWidth = 1;
        [-pr, -pr / 3, pr / 3, pr].forEach(dx => { g.beginPath(); g.moveTo(px + dx, py); g.lineTo(px, py + pr * 0.9); g.stroke(); });
        g.fillStyle = C.muted; g.fillRect(px - 7, py + pr * 0.9, 14, 9);
        g.fillStyle = C.cream; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 ${Math.round(clamp(w / 32, 11, 15))}px ${C.heading}`;
        g.fillText(t('cameraWaiting'), w / 2, h * 0.78);
        return;
      }
      const T = view();
      g.drawImage(terrain(T), 0, 0, w, h);
      const px = (p) => [T.ox + p[0] * T.s, T.oy + p[1] * T.s];

      // Reachable circle (dashed while the position is only an estimate) and the predicted landing point.
      const c = circleCenter(), [ccx, ccy] = px(c);
      g.lineWidth = 2; g.strokeStyle = fixed ? C.amber : C.muted;
      g.setLineDash(fixed ? [] : [8, 6]);
      g.beginPath(); g.arc(ccx, ccy, L.range * T.s, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = fixed ? C.amber : C.muted; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ccx - 7, ccy); g.lineTo(ccx + 7, ccy); g.moveTo(ccx, ccy - 7); g.lineTo(ccx, ccy + 7); g.stroke();

      // Science target.
      const [tx, ty] = px(L.target);
      diamond(g, tx, ty, 8, C.amethyst, C.cream);

      if (landed) {
        const [bx, by] = px([best.x, best.y]);
        g.strokeStyle = C.safe; g.lineWidth = 2; g.setLineDash([4, 4]);
        g.beginPath(); g.arc(bx, by, CLEAR_M * T.s, 0, TAU); g.stroke(); g.setLineDash([]);
        g.fillStyle = C.safe; g.font = `700 12px ${C.heading}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', bx, by);
      }
      if (aim) {
        const [ax, ay] = px(aim);
        const warn = P.assist && !landed && visibleHazard(aim);
        const col = landed ? (landed.hazard ? C.coral : C.cream) : warn ? C.coral : C.cream;
        g.strokeStyle = col; g.lineWidth = 1; g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
        g.lineWidth = 2.5; g.beginPath(); g.arc(ax, ay, CLEAR_M * T.s, 0, TAU); g.stroke();
        const k = CLEAR_M * T.s;
        g.lineWidth = 1.5; g.beginPath();
        g.moveTo(ax - k - 6, ay); g.lineTo(ax - k * 0.45, ay); g.moveTo(ax + k * 0.45, ay); g.lineTo(ax + k + 6, ay);
        g.moveTo(ax, ay - k - 6); g.lineTo(ax, ay - k * 0.45); g.moveTo(ax, ay + k * 0.45); g.lineTo(ax, ay + k + 6); g.stroke();
        if (landed) {
          const [dx, dy] = px(landed.at);
          g.fillStyle = landed.hazard ? C.coral : C.safe;
          g.beginPath(); g.moveTo(dx, dy - 5); g.lineTo(dx + 5, dy); g.lineTo(dx, dy + 5); g.lineTo(dx - 5, dy); g.closePath(); g.fill();
        }
      }
      if (!fixed && phase === 'live') {
        g.fillStyle = C.void; g.fillRect(0, 0, w, 24);
        g.fillStyle = C.muted; g.font = `700 11px ${C.heading}`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(t('fixPendingTag'), 8, 12);
      }
    }

    // -------------------------------------------------------------------------
    // Game flow
    // -------------------------------------------------------------------------
    function labels() {
      cv.node.setAttribute('aria-label', t('canvasAria'));
      legend.replaceChildren(...[['hs2-sw-target', 'legendTarget'], ['hs2-sw-range', 'legendRange'], ['hs2-sw-aim', 'legendAim'], ['hs2-sw-hazard', 'legendHazard'], ...(P.shadows ? [['hs2-sw-shadow', 'legendShadow']] : [])]
        .map(([cls, key]) => { const s = ui.el('span'); s.append(ui.el('i', cls), document.createTextNode(t(key, { clear: U().distanceM(CLEAR_M) }))); return s; }));
      pad.querySelectorAll('button').forEach(b => b.setAttribute('aria-label', t(b.dataset.aria)));
    }

    function render(status) {
      const left = Math.max(0, P.time - time);
      readout.set('time', t('timeLeft', { s: U().decimal(left, 1) }), phase === 'live' && left < 3 ? 'danger' : '');
      readout.set('dist', aim ? t('distRead', { dist: U().distanceM(distTo(aim, L.target)) }) : t('distNone'), '');
      readout.set('range', t('rangeRead', { range: U().distanceM(L.range) }));
      mTime.label(t('timeLabel', { s: P.time }));
      mTime.set(phase === 'ready' ? 1 : left / P.time, left < 3 ? 'danger' : 'warn');
      main.textContent = phase === 'ready' ? t('startBtn', { s: P.time }) : fixed ? t('landBtn') : t('waitFixBtn');
      main.disabled = !host.active || (phase === 'live' && (!fixed || !aim));
      pad.querySelectorAll('button').forEach(b => { b.disabled = !host.active || phase === 'done'; });
      if (status) host.status(status);
      draw();
    }

    function startIfReady() { if (phase === 'ready') start(); }
    function start() {
      if (phase !== 'ready' || !host.active) return;
      phase = 'live';
      render(fixed ? t('statusLive') : t('statusFixPending'));
      host.loop(tick);
    }

    function tick(dt) {
      if (phase !== 'live') return;
      time += dt;
      if (!fixed && time >= L.fixAt) {
        fixed = true;
        if (aim) setAim(aim);
        host.status(t('statusFixed'));
      }
      let mx = 0, my = 0;
      keys.forEach((held, code) => { keys.set(code, held + dt); if (held + dt > 0.16) { const d = KEYS[code]; mx += d[0]; my += d[1]; } });
      padHolds.forEach(p => { if (p.hold.on) { mx += p.dx; my += p.dy; } });
      if (mx || my) {
        const base = aim || circleCenter();
        const k = (AIM_SPEED_MS * dt) / Math.hypot(mx, my);
        setAim([base[0] + mx * k, base[1] + my * k]);
      }
      if (time >= P.time) {
        time = P.time;
        if (aim) { land(true); return; }
        phase = 'done';
        render();
        const far = distTo(circleCenter(), L.target);
        host.fail(t('failNoChoice', { dist: U().distanceM(far), sols: Math.max(1, Math.ceil(far / SOL_DRIVE_M)), record: U().distanceM(SOL_DRIVE_M, 1) }));
        render();
        return;
      }
      const warn = !!(P.assist && aim && visibleHazard(aim));
      render(warn !== warned ? (warn ? t('statusAssist') : t('statusLive')) : undefined);
      warned = warn;
    }

    function land(auto) {
      if (phase !== 'live' || !aim || !host.active) return;
      if (!fixed) { host.status(t('statusFixPending')); return; }
      phase = 'done';
      let at = aim;
      if (L.scatter) { const [dx, dy] = polar(SCATTER_M * host.R.float(0.5, 1), host.R.float(0, TAU)); at = [aim[0] + dx, aim[1] + dy]; }
      const hazard = hazardAt(L, at[0], at[1], CLEAR_M, false);
      landed = { at, hazard };
      const dist = distTo(at, L.target);
      const lead = auto ? `${t('statusAuto')} ` : '';
      if (hazard) {
        const damaged = host.R.chance(DAMAGE_CHANCE);
        render();
        if (damaged) host.fail(lead + t('failDamage', { hazard: t(`hazards.${hazard}`) }));
        else {
          host.status(lead + t('statusLucky', { hazard: t(`hazards.${hazard}`) }));
          host.finish({ stars: 1, summary: t('summaryLucky', { dist: U().distanceM(dist) }), metrics: { dist, best: best.dist, hazard } });
        }
        render();
        return;
      }
      const stars = dist <= best.dist + P.three ? 3 : dist <= best.dist + P.two ? 2 : 1;
      const room = Math.max(0, margin(L, at[0], at[1]));
      render(lead + t('statusLanded', { dist: U().distanceM(dist), best: U().distanceM(best.dist), margin: U().distanceM(room) }));
      host.finish({ stars, summary: t('summary', { dist: U().distanceM(dist), best: U().distanceM(best.dist), margin: U().distanceM(room) }), metrics: { dist, best: best.dist, margin: room } });
      render();
    }

    // Pointer: tap or drag on the image to aim.
    const toMap = e => {
      const rect = cv.node.getBoundingClientRect(), T = view();
      return [((e.clientX - rect.left) - T.ox) / T.s, ((e.clientY - rect.top) - T.oy) / T.s];
    };
    cv.node.addEventListener('pointerdown', e => {
      if (!host.active || e.button !== 0) return;
      e.preventDefault();
      if (phase === 'ready') { start(); return; }
      if (phase !== 'live') return;
      dragging = true;
      try { cv.node.setPointerCapture(e.pointerId); } catch { /* gone */ }
      setAim(toMap(e)); render();
    });
    cv.node.addEventListener('pointermove', e => { if (dragging && phase === 'live') { setAim(toMap(e)); render(); } });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.node.addEventListener(ev, () => { dragging = false; });

    host.onKey((e, down) => {
      if (KEYS[e.code]) {
        if (!down) { keys.delete(e.code); return true; }
        if (phase === 'ready') { start(); return true; }
        if (phase !== 'live' || keys.has(e.code)) return true;
        keys.set(e.code, 0);
        const base = aim || circleCenter(), d = KEYS[e.code];
        setAim(aim ? [base[0] + d[0] * NUDGE_M, base[1] + d[1] * NUDGE_M] : base);
        render();
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (down && !e.repeat) { if (phase === 'ready') start(); else land(false); }
        return true;
      }
      return false;
    });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
    ro?.observe(cv.node);
    host.onCleanup(() => ro?.disconnect());

    labels();
    render(t('statusReady', { s: P.time }) + (L.scatter ? ` ${t('scatterNote', { m: U().distanceM(SCATTER_M, 1) })}` : '') + (L.fixAt ? ` ${t('fixNote')}` : ''));
    return { render: () => { labels(); render(); } };
  }

  MG.register('H-S2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 14, normal: 13, hard: 12 }, // game-balance: reading + the decision window
    // real (EN4): ~5 m from the target, requirement 60 m, divert up to 600 m
    factVars: U => ({ landed: U.distanceM(5), req: U.distanceM(60), divert: U.distanceM(DIVERT_MAX_M) }),
    generate, validate, solve, mount,
  });
})();
