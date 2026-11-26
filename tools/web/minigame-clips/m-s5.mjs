// M-S5 · Radiation alert: keep the crew working through the alert, get ready on the shelter button and send them in
// as soon as the dose rate starts to climb inside the forecast window; the storm tail passes in the shelter.
const RISE = 200; // µGy/day read on the chart that calls the shelter: about twice the quiet level (~93)

export default {
  id: 'M-S5',
  seed: 3, // the storm hits early in the sol, so the run is short
  maxSeconds: 24,
  speed: 2, // the crew works and waits: long stretches with nothing to do
  async play(p) {
    const button = '#lab-stage .mg-controls .button';
    await p.until(() => document.querySelector('#lab-stage .mg-badge.is-warn'), { timeout: 15000 }); // the alert
    await p.wait(500);
    await p.move(button, { ms: 700 });
    // Wait on the button (it shifts when the task chips rewrap, so the cursor follows it) for the rise.
    while (Number(await p.eval(() => document.querySelector('#lab-stage .ms5-canvas').dataset.rate)) < RISE) {
      await p.move(button, { ms: 0, steps: 1 });
      await p.wait(30);
    }
    await p.move(button, { ms: 0, steps: 1 });
    await p.down(); await p.wait(90); await p.up();
    await p.until(() => window.LAB.state.result, { timeout: 15000 }).catch(() => {});
    await p.wait(900);
  },
};
