// H-S1 · Escort route (Helena) · route planning. Plan: docs/experiments-implementation.md §5.2.
// Draw one continuous trail through the crust elements in order (O → Si → Fe → Mg → Ca) without crossing it or
// stepping on sand. Real basis: Ingenuity scouting (EN9); its flight 72 ended over featureless sand, which is
// the "hidden sand" of the higher levels (it only shows when the escort stands next to it).
// The layout is a seeded grid built around a random self-avoiding walk, so it always has a solution; an IDA*
// search finds the shortest legal trail and the stars compare the player with it.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;

  // Real: the most abundant elements of the Martian crust by weight, in order (docs/minigames.md, H-S1).
  const ELEMENTS = ['O', 'Si', 'Fe', 'Mg', 'Ca'];

  // game-balance (plan §5.2). sand/hidden: [min, max] cells. limit: steps allowed above the best trail
  // (null = no limit). three/two: steps above the best trail for 3 and 2 stars.
  const LEVELS = {
    easy: { size: 5, waypoints: 4, sand: [3, 4], hidden: [0, 0], limit: null, three: 1, two: 4 },
    normal: { size: 6, waypoints: 5, sand: [6, 8], hidden: [1, 2], limit: 6, three: 1, two: 6 },
    hard: { size: 7, waypoints: 5, sand: [9, 12], hidden: [3, 4], limit: 3, three: 0, two: 3 },
  };
  const SEARCH_BUDGET = 400000; // IDA* nodes before falling back to the generated walk (an upper bound)

  const neighbors = (i, n) => {
    const x = i % n, y = (i / n) | 0, out = [];
    if (x > 0) out.push(i - 1);
    if (x < n - 1) out.push(i + 1);
    if (y > 0) out.push(i - n);
    if (y < n - 1) out.push(i + n);
    return out;
  };

  // Random self-avoiding walk of `target` cells (depth first with backtracking).
  function walk(R, n, target) {
    const start = R.int(0, n * n - 1);
    const seen = new Uint8Array(n * n);
    const path = [start], stack = [R.shuffle(neighbors(start, n))];
    seen[start] = 1;
    while (path.length < target && stack.length) {
      const options = stack[stack.length - 1];
      const next = options.pop();
      if (next === undefined) { seen[path.pop()] = 0; stack.pop(); continue; }
      if (seen[next]) continue;
      seen[next] = 1; path.push(next); stack.push(R.shuffle(neighbors(next, n)));
    }
    return path;
  }

  function generate(R, P) {
    const n = P.size, cells = n * n;
    const trail = walk(R, n, R.int(Math.round(cells * 0.45), Math.round(cells * 0.62)));
    const k = P.waypoints;
    const waypoints = Array.from({ length: k }, (_, j) => trail[Math.round((j * (trail.length - 1)) / (k - 1))]);
    const onTrail = new Set(trail);
    // Sand goes off the generated trail (so it stays solvable), preferring the obvious shortcuts: cells inside
    // the box between two consecutive waypoints.
    const box = (i, a, b) => {
      const x = i % n, y = (i / n) | 0, ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0;
      return x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by);
    };
    const free = [];
    for (let i = 0; i < cells; i++) {
      if (onTrail.has(i)) continue;
      let score = R.float(0, 1.2);
      for (let j = 1; j < k; j++) if (box(i, waypoints[j - 1], waypoints[j])) score += 1;
      free.push({ i, score });
    }
    free.sort((a, b) => b.score - a.score);
    const sandN = R.span(P.sand), hiddenN = R.span(P.hidden);
    const chosen = R.shuffle(free.slice(0, Math.min(free.length, sandN + hiddenN)).map(c => c.i));
    return { size: n, waypoints, sand: chosen.slice(0, sandN), hidden: chosen.slice(sandN), trailSteps: trail.length - 1 };
  }

  // Shortest legal trail: visit the waypoints in order, never revisit a cell, never step on sand or on a waypoint
  // out of order. IDA* with the sum of plain grid distances as the (admissible) heuristic.
  function solve(L) {
    const n = L.size, cells = n * n, K = L.waypoints.length;
    const blocked = new Uint8Array(cells);
    for (const c of [...L.sand, ...L.hidden]) blocked[c] = 1;
    const wpAt = new Int8Array(cells).fill(-1);
    L.waypoints.forEach((c, i) => { wpAt[c] = i; });
    const bfs = from => {
      const d = new Array(cells).fill(Infinity); d[from] = 0;
      const q = [from];
      for (let h = 0; h < q.length; h++) for (const nb of neighbors(q[h], n)) if (!blocked[nb] && d[nb] === Infinity) { d[nb] = d[q[h]] + 1; q.push(nb); }
      return d;
    };
    const dist = L.waypoints.map(bfs);
    const rest = new Array(K + 1).fill(0);
    for (let j = K - 2; j >= 1; j--) rest[j] = dist[j + 1][L.waypoints[j]] + rest[j + 1];
    const h = (pos, k) => dist[k][pos] + rest[k];
    const visited = new Uint8Array(cells);
    const start = L.waypoints[0];
    visited[start] = 1;
    let nodes = 0, found = -1;
    const FOUND = -1, ABORT = -2;
    function search(pos, g, k, bound) {
      const f = g + h(pos, k);
      if (f > bound) return f;
      if (++nodes > SEARCH_BUDGET) return ABORT;
      let min = Infinity;
      for (const nb of neighbors(pos, n)) {
        if (blocked[nb] || visited[nb]) continue;
        const w = wpAt[nb];
        if (w >= 0 && w !== k) continue;
        if (dist[k][nb] === Infinity) continue;
        visited[nb] = 1;
        let r;
        if (w === k && k === K - 1) { found = g + 1; r = FOUND; } else r = search(nb, g + 1, w === k ? k + 1 : k, bound);
        visited[nb] = 0;
        if (r === FOUND || r === ABORT) return r;
        if (r < min) min = r;
      }
      return min;
    }
    let bound = h(start, 1);
    if (bound === Infinity) return { steps: Infinity, exact: true };
    for (;;) {
      const r = search(start, 0, 1, bound);
      if (r === FOUND) return { steps: found, exact: true };
      if (r === ABORT) return { steps: L.trailSteps, exact: false };
      if (r === Infinity) return { steps: Infinity, exact: true };
      bound = r;
    }
  }

  function validate(L) {
    const n = L.size;
    for (let j = 1; j < L.waypoints.length; j++) {
      const a = L.waypoints[j - 1], b = L.waypoints[j];
      if (Math.abs((a % n) - (b % n)) + Math.abs(((a / n) | 0) - ((b / n) | 0)) < 2) return false;
    }
    const best = solve(L).steps;
    return Number.isFinite(best) && best >= Math.round(n * 1.3);
  }

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const n = L.size, best = solve(L).steps;
    const maxSteps = P.limit == null ? Infinity : best + P.limit;
    const sand = new Set(L.sand), hidden = new Set(L.hidden), revealed = new Set();
    const wpAt = new Map(L.waypoints.map((c, i) => [c, i]));
    const symbol = i => ELEMENTS[i];
    const label = i => `${ELEMENTS[i]} (${t(`elements.${ELEMENTS[i]}`)})`;
    let path = [L.waypoints[0]], drawing = false;

    const readout = ui.readout(['wp', 'steps']);
    const order = ui.el('div', 'hs1-order');
    const board = ui.el('div', 'mg-grid hs1-board');
    board.style.setProperty('--cols', n);
    board.setAttribute('role', 'group');
    const cells = Array.from({ length: n * n }, (_, i) => {
      const b = ui.el('button', 'mg-cell hs1-tile');
      b.type = 'button'; b.tabIndex = -1; b.dataset.i = i;
      b.addEventListener('click', () => moveTo(i, false));
      board.append(b);
      return b;
    });
    const pad = ui.el('div', 'mg-pad');
    const arrow = (txt, dx, dy, key) => { const b = ui.button(txt, '', () => step(dx, dy)); b.className = ''; b.dataset.aria = key; return b; };
    const padRow = ui.el('div');
    padRow.append(arrow('←', -1, 0, 'moveLeft'), arrow('↓', 0, 1, 'moveDown'), arrow('→', 1, 0, 'moveRight'));
    pad.append(arrow('↑', 0, -1, 'moveUp'), padRow);
    host.body.append(readout.node, order, board, pad);

    const reached = () => path.filter(c => wpAt.has(c)).length;
    const blockedAt = i => sand.has(i) || revealed.has(i);
    function reveal() {
      let found = 0;
      for (const c of path) for (const nb of neighbors(c, n)) if (hidden.has(nb) && !revealed.has(nb)) { revealed.add(nb); found++; }
      return found;
    }

    function render() {
      const r = reached(), head = path[path.length - 1];
      const index = new Map(path.map((c, i) => [c, i]));
      board.setAttribute('aria-label', t('boardAria'));
      cells.forEach((cell, i) => {
        cell.className = 'mg-cell hs1-tile';
        cell.style.cssText = '';
        const wp = wpAt.get(i);
        cell.textContent = wp != null ? symbol(wp) : '';
        cell.disabled = !host.active;
        if (sand.has(i) || revealed.has(i)) {
          cell.classList.add(sand.has(i) ? 'is-sand' : 'is-smooth');
          cell.textContent = sand.has(i) ? '⚠' : '≈';
          cell.disabled = true;
          cell.setAttribute('aria-label', t('tileSandAria', { row: ((i / n) | 0) + 1, col: (i % n) + 1 }));
          return;
        }
        const at = index.get(i);
        if (at !== undefined) {
          cell.classList.add('is-trail');
          if (at === path.length - 1) cell.classList.add('is-head');
          for (const other of [path[at - 1], path[at + 1]]) {
            if (other === undefined) continue;
            if (other === i - 1) cell.classList.add('to-left');
            if (other === i + 1) cell.classList.add('to-right');
            if (other === i - n) cell.classList.add('to-up');
            if (other === i + n) cell.classList.add('to-down');
          }
        } else if (host.active && neighbors(head, n).includes(i) && (wp == null || wp === r)) cell.classList.add('can-step');
        if (host.active && wp === r) cell.classList.add('is-next');
        cell.setAttribute('aria-label', t('tileAria', {
          row: ((i / n) | 0) + 1, col: (i % n) + 1,
          el: wp != null ? t('tileEl', { el: label(wp) }) : '', onRoute: at !== undefined ? t('tileOnRoute') : '',
        }));
      });
      order.replaceChildren(ui.el('span', 'hs1-order-label', t('orderLabel')), ...L.waypoints.flatMap((_, i) => {
        const chip = ui.el('span', `hs1-chip${i < r ? ' is-done' : i === r ? ' is-next' : ''}`, symbol(i));
        chip.title = t(`elements.${symbol(i)}`);
        return i ? [ui.el('span', 'hs1-arrow', '→'), chip] : [chip];
      }));
      const steps = path.length - 1;
      readout.set('wp', t('waypoint', { reached: r, total: L.waypoints.length }), r === L.waypoints.length ? 'good' : '');
      readout.set('steps', Number.isFinite(maxSteps) ? t('stepsLimit', { steps, max: maxSteps }) : t('steps', { steps }), steps > maxSteps - 2 ? 'danger' : '');
      pad.querySelectorAll('button').forEach(b => { b.setAttribute('aria-label', t(b.dataset.aria)); b.disabled = !host.active; });
    }

    function moveTo(i, fromDrag) {
      if (!host.active || i < 0 || i >= n * n || blockedAt(i)) return;
      const prior = path.indexOf(i);
      if (prior >= 0) {
        if (!fromDrag && prior < path.length - 1) {
          path = path.slice(0, prior + 1);
          host.status(t('rewound', { el: label(reached()) }));
          render();
        } else if (fromDrag && prior === path.length - 2) { path.pop(); render(); }
        return;
      }
      const head = path[path.length - 1];
      if (!neighbors(head, n).includes(i)) { if (!fromDrag) host.status(t('adjacentHint')); return; }
      const wp = wpAt.get(i), r = reached();
      if (wp != null && wp !== r) { host.status(t('orderHint', { el: label(r) })); return; }
      if (path.length > maxSteps) { host.status(t('limitHint', { max: maxSteps })); return; }
      path.push(i);
      const spotted = reveal();
      if (wp === L.waypoints.length - 1) {
        const steps = path.length - 1;
        const stars = steps <= best + P.three ? 3 : steps <= best + P.two ? 2 : 1;
        host.status(t('doneStatus', { steps, best }));
        render();
        host.finish({ stars, summary: t('summary', { steps, best }), metrics: { steps, best } });
        return;
      }
      host.status(spotted ? t('smoothSpotted') : t('headingTo', { el: label(reached()) }));
      render();
    }
    const step = (dx, dy) => {
      const head = path[path.length - 1], x = (head % n) + dx, y = ((head / n) | 0) + dy;
      if (x >= 0 && x < n && y >= 0 && y < n) moveTo(y * n + x, false);
    };

    board.addEventListener('pointerdown', e => {
      if (!host.active || e.button !== 0) return;
      const cell = e.target.closest('.hs1-tile');
      if (!cell || cell.disabled) return;
      drawing = true;
      try { board.setPointerCapture(e.pointerId); } catch { /* gone */ }
      moveTo(Number(cell.dataset.i), false);
      e.preventDefault();
    });
    board.addEventListener('pointermove', e => {
      if (!drawing) return;
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.hs1-tile');
      if (cell && board.contains(cell)) moveTo(Number(cell.dataset.i), true);
    });
    for (const ev of ['pointerup', 'pointercancel']) board.addEventListener(ev, () => { drawing = false; });
    const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
    host.onKey((e, down) => { const m = KEYS[e.code]; if (!m) return false; if (down) step(...m); return true; });

    host.status(t('startStatus', { order: L.waypoints.map((_, i) => symbol(i)).join(' → ') }) + (hidden.size ? ` ${t('smoothHint')}` : ''));
    render();
    return { render };
  }

  MG.register('H-S1', {
    levels: LEVELS,
    botSeconds: { easy: 30, normal: 40, hard: 50 },
    factVars: U => ({ dist: U.distanceKm(17, 0) }), // real: Ingenuity flew 17 km in 72 flights (EN9)
    generate, validate, solve, mount,
  });
})();
