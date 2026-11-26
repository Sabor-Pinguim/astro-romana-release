// L-S1 · Oxygen oven: hold Heat while the stack is under 800 °C and let go above it, so the needle stays in the
// green band until the O₂ goal is reached.
export default {
  id: 'L-S1',
  seed: 14,
  maxSeconds: 25,
  speed: 1.5,
  async play(p) {
    await p.move('#lab-stage .ls1-heat', { ms: 450 });
    await p.eval(() => window.LAB.open()); // the lab mounted the run before recording: start it again with the clip
    let held = false;
    for (;;) {
      const s = await p.eval(() => {
        const needle = document.querySelector('#lab-stage .mg-needle');
        return { done: !!window.LAB.state.result, temp: 720 + parseFloat(needle.style.left) * 1.4 };
      });
      if (s.done) break;
      if (!held && s.temp < 797) { await p.down(); held = true; }
      else if (held && s.temp > 803) { await p.up(); held = false; }
      await p.wait(15);
    }
    if (held) await p.up();
    await p.wait(700);
  },
};
