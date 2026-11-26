// Cockpit orbital docking: hold the attitude marker centred through the approach to latch, then pump the propellant.
import { enterCockpit, holdInBand } from './cockpit-ascent.mjs';

const SKIP_S = 6; // game s of the 18 s approach flown before the recording starts

export default {
  id: 'cockpit-orbital-dock',
  fileId: 'cockpit-orbital-dock',
  maxSeconds: 32,
  speed: 2, // the 18 s approach plays faster
  async setup(p) {
    await enterCockpit(p, 2, 780);
    await holdInBand(p, 'docking', { stop: s => s.t > SKIP_S || s.docked });
  },
  async play(p) {
    await holdInBand(p, 'docking', { stop: s => s.docked || s.step !== 2 });
    await p.wait(500);
    const pump = '#cockpit-minigame [data-act="pump_fuel"]';
    const canPump = () => p.eval(sel => { const b = document.querySelector(sel); return !!b && !b.disabled; }, pump);
    while (await canPump()) await p.click(pump, { after: 350 });
    await p.move('#cockpit-minigame [data-act="complete_step"]', { ms: 400 });
    await p.wait(700);
  },
};
