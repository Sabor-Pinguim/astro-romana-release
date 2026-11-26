// L-S2 · Drilling: one push of Strike per stroke, while the climbing force is in the green band, down to the goal.
export default {
  id: 'L-S2',
  level: 'easy',
  seed: 193,
  maxSeconds: 25,
  speed: 1.5,
  async play(p) {
    await p.move('#lab-stage .mg-controls .button.primary', { ms: 450 });
    await p.eval(() => window.LAB.open()); // the lab mounted the run before recording: start it again with the clip
    let last = -1;
    for (;;) {
      const s = await p.eval(() => {
        const d = document.querySelector('#lab-stage .ls2-canvas').dataset;
        return { done: !!window.LAB.state.result, phase: +d.phase, lo: +d.lo, hi: +d.hi, stroke: +d.stroke };
      });
      if (s.done) break;
      // Aim just before the middle of the band: the push lands a few milliseconds later.
      if (s.stroke !== last && s.phase >= (s.lo + s.hi) / 2 - 0.04 && s.phase < s.hi - 0.02) {
        last = s.stroke;
        await p.down(); await p.wait(70); await p.up();
      }
      await p.wait(8);
    }
    await p.wait(700);
  },
};
