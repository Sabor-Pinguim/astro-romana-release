// H-O1 · Aerobraking: hold a finger on the view at the height of the corridor's lower edge, so the spacecraft
// hugs the heat limit through every pass (most braking, no overheating) and gets ready for the next one in between.
// Game constants mirrored from web/minigames/h-o1.js.
const REF_KM = 105, SCALE_KM = 7, VIEW = [94, 127];
const ABOVE_KM = 0.35; // just above the heat limit: the best braking with a little margin
const LEAD_S = 0.12; // the spacecraft trails the finger by about this much (its trim rate and the input latency)
const SKIP_S = 0.9; // game seconds left out of the clip: the start of the coast before the first pass

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
  id: 'H-O1',
  level: 'easy',
  seed: 332,
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
    const { layout: L } = await p.lab();
    const lnDens = (i, tau) => {
      const ps = L.passes[i], norm = ps.parts.reduce((s, x) => s + x.a, 0);
      let ln = ps.ln + (ps.amp * ps.parts.reduce((s, x) => s + x.a * Math.sin(2 * Math.PI * x.f * tau + x.p), 0)) / norm;
      const st = L.storm;
      if (st && i > st.pass) ln += st.ln;
      else if (st && i === st.pass) ln += st.ln * Math.min(1, Math.max(0, (tau - st.at) / st.ramp));
      return ln;
    };
    const floorAt = t => { // the corridor floor now, or where the next pass starts while coasting
      let i = L.passes.findIndex(ps => t >= ps.start && t < ps.start + ps.dur);
      if (i >= 0) return REF_KM + SCALE_KM * lnDens(i, t - L.passes[i].start);
      i = L.passes.findIndex(ps => ps.start > t);
      if (i < 0) i = L.passes.length - 1;
      return REF_KM + SCALE_KM * lnDens(i, Math.max(0, Math.min(t - L.passes[i].start, L.passes[i].dur)));
    };
    const r = await p.rect('#lab-stage .ho1-view');
    const at = km => ({ x: r.x + r.width * 0.13, y: r.y + ((VIEW[1] - km) / (VIEW[1] - VIEW[0])) * r.height });
    const read = () => p.eval(() => ({ done: !!window.LAB.state.result, t: window.__clipT }));

    let s = await read();
    await p.move(at(floorAt(s.t + 0.5) + ABOVE_KM), { ms: 350 });
    await p.down();
    while (!(s = await read()).done) {
      await p.move(at(floorAt(s.t + LEAD_S) + ABOVE_KM), { ms: 0, steps: 1 });
      await p.wait(8);
    }
    await p.up();
    await p.wait(200);
  },
};
