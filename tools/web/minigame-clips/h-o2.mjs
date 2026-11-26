// H-O2 · Roll for the radar: the fewest pulses toward the requested angle, coast, the same pulses the other way to
// stop on it, then hold steady while the site passes under the radar.
const PULSE = 4; // °/s added by one pulse (web/minigames/h-o2.js)

export default {
  id: 'H-O2',
  seed: 372,
  maxSeconds: 30,
  speed: 2,
  async play(p) {
    const { layout: L } = await p.lab();
    const dir = Math.sign(L.angle), A = Math.abs(L.angle);
    const n = Math.ceil(A / L.tOpen / PULSE); // enough speed to arrive before the site does
    const push = `#lab-stage .ho2-pad .button:nth-child(${dir > 0 ? 4 : 1})`;
    const brake = `#lab-stage .ho2-pad .button:nth-child(${dir > 0 ? 1 : 4})`;
    const probe = () => p.eval(() => { const m = document.querySelector('#lab-stage .mg'); return { ...m.mgProbe(), done: !!window.LAB.state.result }; });

    await p.wait(300);
    await p.move(push, { ms: 420 });
    for (let i = 0; i < n; i++) { await p.down(); await p.wait(70); await p.up(); await p.wait(60); }
    await p.move(brake, { ms: 600 });
    // Stop on the target: the brake pulses go out just before the needle reaches it.
    await p.until((a, lead) => Math.abs(document.querySelector('#lab-stage .mg').mgProbe().theta) >= a - lead, { args: [A, 0.4], timeout: 30000, every: 10 });
    for (let i = 0; i < n; i++) { await p.down(); await p.wait(60); await p.up(); await p.wait(40); }
    const b = await p.rect(brake);
    await p.move({ x: b.x + b.width / 2, y: b.y + b.height + 40 }, { ms: 500 }); // off the buttons while it holds
    while (!(await probe()).done) await p.wait(100);
    await p.wait(500);
  },
};
