// Cockpit cabin docking: centre the port in the ring with the arrows first, then hold Close in (W) until the latch.
import { enterCockpit } from './cockpit-ascent.mjs';

const readDock = () => { const d = window.ASTRO_SIM.flight.portDock; return { x: d.x, y: d.y }; };
const AIM = 0.03; // m: close enough to the axis (the capture radius is 0.18 m)

export default {
  id: 'cockpit-cabin-dock',
  fileId: 'cockpit-cabin-dock',
  maxSeconds: 24,
  speed: 1.5, // the 8 s glide in to the port plays faster
  async setup(p) {
    await enterCockpit(p, 1, 780);
  },
  async play(p) {
    await p.wait(700);
    // Align X/Y: the arrow that moves the offset toward 0 on each axis, released once on the axis.
    const held = new Map([['x', null], ['y', null]]);
    for (;;) {
      const d = await p.eval(readDock);
      for (const [axis, keys] of [['x', ['ArrowLeft', 'ArrowRight']], ['y', ['ArrowDown', 'ArrowUp']]]) {
        const want = Math.abs(d[axis]) <= AIM ? null : keys[d[axis] > 0 ? 0 : 1];
        if (want === held.get(axis)) continue;
        if (held.get(axis)) await p.keyUp(held.get(axis));
        if (want) await p.keyDown(want);
        held.set(axis, want);
      }
      if (![...held.values()].some(Boolean)) break;
      await p.wait(25);
    }
    await p.wait(300);
    // Close in until the hatch latches.
    await p.keyDown('KeyW');
    await p.until(() => window.ASTRO_SIM.flight.portDock.status !== 'approach', { timeout: 15000, every: 30 });
    await p.keyUp('KeyW');
    await p.wait(850); // "Docking complete"; the next step opens 1.4 s after the latch
  },
};
