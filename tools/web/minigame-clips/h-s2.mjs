// H-S2 · Precision landing: start the camera, drag the aim ring from the science target to the closest clear ground
// (off craters, boulders and slopes) and land there.
const CLEAR_M = 40, SCATTER_M = 8.53; // web/minigames/h-s2.js
const MARGIN_M = 10; // keep the ring this far off every hazard: a pixel of aim is a few metres on the map

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
  const k = l2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return (ax + k * dx - px) ** 2 + (ay + k * dy - py) ** 2;
}
function hits(h, x, y, clear) {
  if ((x - h.x) ** 2 + (y - h.y) ** 2 >= (h.r + clear) ** 2) return false;
  if (!h.pts || inPoly(x, y, h.pts)) return true;
  return h.pts.some((q, i) => segDist2(x, y, ...h.pts[(i || h.pts.length) - 1], ...q) < clear * clear);
}
// The closest point to the target whose ring clears every hazard (hidden boulders and shadows too) with a margin.
function spot(L) {
  const clear = CLEAR_M + MARGIN_M + (L.scatter ? SCATTER_M : 0), [tx, ty] = L.target, [cx, cy] = L.center;
  const all = [...L.hazards, ...L.shadows];
  for (let r = 0; r < 2 * L.range; r += 2) {
    const n = Math.max(1, Math.ceil((2 * Math.PI * r) / 2));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI, x = tx + r * Math.cos(a), y = ty + r * Math.sin(a);
      if (Math.hypot(x - cx, y - cy) <= L.range - 4 && !all.some(h => hits(h, x, y, clear))) return [x, y];
    }
  }
  return null;
}

export default {
  id: 'H-S2',
  level: 'easy',
  seed: 11,
  maxSeconds: 20,
  speed: 1.3,
  async play(p) {
    const { layout: L } = await p.lab();
    const main = '#lab-stage .hs2-controls > .button';
    await p.wait(400);
    await p.click(main, { moveMs: 500, after: 700 });
    const r = await p.rect('#lab-stage .hs2-canvas');
    const s = r.height / (2 * L.view.half);
    const px = ([x, y]) => ({ x: r.x + r.width / 2 + (x - L.view.cx) * s, y: r.y + r.height / 2 + (y - L.view.cy) * s });
    await p.move(px(L.target), { ms: 550 });
    await p.down();
    await p.wait(450); // the ring over the target turns red: it sits on a hazard
    await p.move(px(spot(L)), { ms: 1100 });
    await p.wait(300);
    await p.up();
    await p.wait(300);
    await p.click(main, { moveMs: 550 });
    await p.until(() => window.LAB.state.result, { timeout: 3000 });
    await p.wait(1000);
  },
};
