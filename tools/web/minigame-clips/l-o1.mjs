// L-O1 · Roll-out solar array: press Release each time the boom tension needle is inside the green zone, so every
// segment unrolls clean.
export default {
  id: 'L-O1',
  seed: 303,
  maxSeconds: 25,
  speed: 1.6,
  async play(p) {
    await p.move('#lab-stage .mg-controls .button.primary', { ms: 450 });
    await p.eval(() => window.LAB.open()); // the lab mounted the run before recording: start it again with the clip
    for (;;) {
      const s = await p.eval(() => {
        const d = document.querySelector('#lab-stage .lo1-gauge').dataset;
        return { done: !!window.LAB.state.result, phase: d.phase, v: +d.v, lo: +d.lo, hi: +d.hi };
      });
      if (s.done) break;
      const w = s.hi - s.lo;
      if (s.phase === 'tension' && s.v >= s.lo + 0.3 * w && s.v <= s.hi - 0.3 * w) {
        await p.down(); await p.wait(70); await p.up();
        await p.until(() => document.querySelector('#lab-stage .lo1-gauge').dataset.phase !== 'tension', { timeout: 2000 });
      }
      await p.wait(8);
    }
    await p.wait(700);
  },
};
