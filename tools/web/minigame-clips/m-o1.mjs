// M-O1 · High-resolution photo: wait on the shutter and press it the moment each target crosses the centre line of
// the frame, one sharp photo per target.
const ID = 'M-O1', LEVEL = 'normal', SEED = 369; // the shortest normal pass: 5 targets in 8 s

export default {
  id: ID,
  level: LEVEL,
  seed: SEED,
  maxSeconds: 16,
  speed: 2, // the ground scrolls slowly between targets
  fps: 8, width: 360, // the whole ground moves every frame: fewer, smaller frames keep the GIF light
  // The scrolling ground makes every frame heavy: start recording when the first target is already in view.
  async setup(p) {
    await p.navigate(`${p.baseUrl}/tools/minigame-lab/index.html#${ID}/${LEVEL}/${SEED}`); // language: the recorder's
    await p.until(() => window.LAB?.state?.ctrl && document.querySelector('#lab-stage')?.childElementCount > 0, { timeout: 15000 });
    await p.labClean();
    await p.frame('#lab-stage', 0, 12);
    await p.until(() => Number(document.querySelector('#lab-stage .mo1-canvas')?.dataset.dx) < 0.4, { timeout: 8000 });
  },
  async play(p) {
    const { layout: L } = await p.lab();
    const shutter = '#lab-stage .mg-controls button';
    const nearest = () => p.eval(() => {
      const d = document.querySelector('#lab-stage .mo1-canvas')?.dataset;
      return { dx: d?.dx === '' ? null : Number(d?.dx), done: !!window.LAB.state.result || !window.LAB.state.ctrl?.host.active };
    });
    await p.move(shutter, { ms: 500 });
    for (;;) {
      let s = await nearest();
      if (s.done || s.dx == null) break;
      if (s.dx / L.speed > 0.4) { await p.wait(Math.min(250, (s.dx / L.speed - 0.35) * 1000)); continue; }
      await p.move(shutter, { ms: 60 }); // the result chips can wrap and push the button down
      // Watch the target in and press a hair before the centre line: the press lands a frame or two later.
      do { await p.wait(5); s = await nearest(); } while (!s.done && s.dx > 0.04 * L.speed);
      if (s.done || s.dx == null) break;
      await p.down(); await p.wait(90); await p.up();
      await p.wait(200);
    }
    await p.until(() => window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(300);
  },
};
