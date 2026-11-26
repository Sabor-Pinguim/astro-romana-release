// L-O2 · Keep the detector cold: drag the power split toward the cooler before and during each observation (never
// past the reserve line), ease off between them.
// Game constants mirrored from web/minigames/l-o2.js (the reference play of its solve()).
const T0 = 28, K_LOAD = 80, K_COOL = 70, LAG_S = 1.4, COOLER_MAX_W = 30, RESERVE_W = 22, LEAD_S = 2.5, STORM_DROP = 5;
const SKIP_S = 2; // game seconds left out of the clip: the quiet lead-in before the first observation

// Restarts the mounted run together with a page clock that adds the same frame steps as the minigame loop (core.js
// host.loop), so window.__clipT is the game's own time.
const restartWithClock = p => p.eval(() => {
  let last = 0;
  window.__clipT = 0;
  const step = now => { window.__clipT += last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; requestAnimationFrame(step); };
  requestAnimationFrame(step);
  window.LAB.open();
});

export default {
  id: 'L-O2',
  level: 'easy',
  seed: 155,
  maxSeconds: 40,
  speed: 2,
  async setup(p) {
    await p.navigate(`${p.baseUrl}/tools/minigame-lab/index.html#${this.id}/${this.level}/${this.seed}`);
    await p.until(() => window.LAB?.state?.ctrl && document.querySelector('#lab-stage')?.childElementCount > 0, { timeout: 15000 });
    await p.labClean();
    await p.frame('#lab-stage', 0, 12);
    await restartWithClock(p);
    await p.until(t => window.__clipT >= t, { args: [SKIP_S] });
  },
  async play(p) {
    const { layout: L, P } = await p.lab();
    const loadAt = t => {
      const norm = L.parts.reduce((s, x) => s + x.a, 0);
      return L.mid + (L.amp * L.parts.reduce((s, x) => s + x.a * Math.sin(2 * Math.PI * x.f * t + x.p), 0)) / norm;
    };
    const windowAt = t => L.windows.find(w => t >= w.start && t < w.start + w.dur) || null;
    const nextWindow = t => L.windows.find(w => w.start > t) || null;
    const bandAt = t => [P.band[0], P.band[1] - (L.storm && t >= L.storm.at && t < L.storm.at + L.storm.dur ? STORM_DROP : 0)];
    const cap = (L.budget - RESERVE_W) / COOLER_MAX_W, eff = L.worn ? 0.88 : 1;
    // The same reference play as the game's solve(): cool to the warm side of the band shortly before and during each
    // observation (anticipating the load), and let the detector warm between them.
    const share = (t, temp) => {
      const w = windowAt(t), next = nextWindow(t), [lo, hi] = bandAt(t + 0.5);
      const busy = w || (next && next.start - t < LEAD_S);
      const target = busy ? lo + (hi - lo) * 0.55 : hi + 6;
      const c = (T0 + K_LOAD * loadAt(t + LAG_S * 0.6) - target) / (K_COOL * eff) + 0.04 * (temp - target);
      const limit = w || (next && next.start - t < 0.2) ? cap - 0.01 : 1; // past the reserve the data is lost
      return Math.min(Math.max(c, 0), limit);
    };
    const r = await p.rect('#lab-stage .lo2-split');
    const at = c => ({ x: r.x + ((c * COOLER_MAX_W) / L.budget) * r.width, y: r.y + r.height / 2 });
    const read = () => p.eval(() => ({
      done: !!window.LAB.state.result,
      t: window.__clipT,
      temp: 12 + parseFloat(document.querySelector('#lab-stage .mg-needle').style.left) * 0.6,
    }));

    let s = await read();
    await p.move(at(0), { ms: 350 });
    await p.down();
    while (!(s = await read()).done) {
      await p.move(at(share(s.t, s.temp)), { ms: 0, steps: 1 });
      await p.wait(10);
    }
    await p.up();
    await p.wait(200);
  },
};
