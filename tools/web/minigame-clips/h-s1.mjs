// H-S1 · Escort route: drag one unbroken trail from O through Si, Fe and Mg to Ca along the shortest legal route,
// around the sand (and the smooth sand it uncovers on the way).

// Shortest legal trail of the layout, with its cells (the game's solve() only returns the length): IDA* over the
// grid, visiting the waypoints in order, never revisiting a cell or stepping on sand.
function route(L) {
  const n = L.size, K = L.waypoints.length;
  const near = i => { const x = i % n, y = (i / n) | 0, o = []; if (x > 0) o.push(i - 1); if (x < n - 1) o.push(i + 1); if (y > 0) o.push(i - n); if (y < n - 1) o.push(i + n); return o; };
  const blocked = new Set([...L.sand, ...L.hidden]);
  const wpAt = new Map(L.waypoints.map((c, i) => [c, i]));
  const bfs = from => {
    const d = new Array(n * n).fill(Infinity), q = [from];
    d[from] = 0;
    for (let h = 0; h < q.length; h++) for (const m of near(q[h])) if (!blocked.has(m) && d[m] === Infinity) { d[m] = d[q[h]] + 1; q.push(m); }
    return d;
  };
  const dist = L.waypoints.map(bfs), rest = new Array(K + 1).fill(0);
  for (let j = K - 2; j >= 1; j--) rest[j] = dist[j + 1][L.waypoints[j]] + rest[j + 1];
  const path = [L.waypoints[0]], seen = new Set(path);
  const search = (pos, k, bound) => {
    const f = path.length - 1 + dist[k][pos] + rest[k];
    if (f > bound) return f;
    let min = Infinity;
    for (const m of near(pos)) {
      const w = wpAt.has(m) ? wpAt.get(m) : -1;
      if (blocked.has(m) || seen.has(m) || (w >= 0 && w !== k) || dist[k][m] === Infinity) continue;
      path.push(m); seen.add(m);
      const r = w === K - 1 ? true : search(m, w === k ? k + 1 : k, bound);
      if (r === true) return true;
      path.pop(); seen.delete(m);
      min = Math.min(min, r);
    }
    return min;
  };
  for (let bound = dist[1][L.waypoints[0]] + rest[1]; ;) {
    const r = search(L.waypoints[0], 1, bound);
    if (r === true) return path;
    if (r === Infinity) return null;
    bound = r;
  }
}

export default {
  id: 'H-S1',
  seed: 16,
  maxSeconds: 20,
  speed: 1.3,
  async play(p) {
    const { layout: L } = await p.lab();
    const cell = i => `#lab-stage .hs1-tile[data-i="${i}"]`;
    const [start, ...trail] = route(L);
    await p.wait(400);
    await p.move(cell(start), { ms: 600 });
    await p.down();
    await p.wait(250);
    for (const i of trail) { await p.move(cell(i), { ms: 280 }); await p.wait(120); }
    await p.up();
    await p.until(() => window.LAB.state.result, { timeout: 3000 });
    await p.wait(900);
  },
};
