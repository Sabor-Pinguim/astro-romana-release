// Cockpit Mars landing: hold the descent burn in the green band and deploy the EDL parachute on the way to touchdown.
import { END_BEFORE_S, enterCockpit, holdInBand } from './cockpit-ascent.mjs';

export default {
  id: 'cockpit-landing',
  fileId: 'cockpit-landing',
  maxSeconds: 26,
  speed: 2, // the 15 s burn plays faster
  async setup(p) {
    await enterCockpit(p, 3, 660);
  },
  async play(p) {
    // The parachute by hand, before it opens on its own at 57% of the burn (E+240 s, 11 km: EDL_CHUTE, web/app.js).
    const chute = (async () => {
      await p.until(() => window.ASTRO_SIM.flight.marsBurn.t / window.ASTRO_SIM.flight.marsBurn.duration > 0.38, { timeout: 15000 });
      await p.click('#cockpit-minigame [data-act="edl_arm"]', { moveMs: 450 });
      await p.wait(900);
      await p.hideCursor();
    })();
    // Ends just before touchdown: the surface replaces the cockpit at touchdown itself.
    await holdInBand(p, 'marsBurn', { stop: s => s.step !== 3 || s.done || s.left < END_BEFORE_S });
    await chute;
  },
};
