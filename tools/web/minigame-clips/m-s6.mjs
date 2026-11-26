// M-S6 · Martian greenhouse: tap Water before the soil leaves its band and step the LEDs up at sunset and down at
// sunrise, so water and light stay in their bands to the harvest. The run lasts 33 s: its first half plays off camera.
const LED_STEP = 13; // light added by one LED level (LED_LIGHT in web/minigames/m-s6.js)
const LOOK_S = 0.6; // how far ahead the sunlight trend is read
const SKIP_S = 15; // seconds of the run played before the recording starts (the clip ends on the harvest)
const btn = n => `#lab-stage .ms6-controls .button:nth-child(${n})`; // 1 LED −, 2 Water, 3 LED +

let ctl = null;

// Reads the gauges (both on a 0–100 scale, so the needle position is the value) and taps what they need.
async function grow(p, stopAt = Infinity) {
  const { layout: L, P } = await p.lab();
  ctl ??= { led: L.led0, sun: null, slope: 0, t: 0, waterAt: 0 };
  const mid = (P.light[0] + P.light[1]) / 2;
  const tap = async n => { await p.move(btn(n), { ms: 200, steps: 4 }); await p.down(); await p.wait(60); await p.up(); };
  for (;;) {
    const st = await p.eval(() => {
      const n = document.querySelectorAll('#lab-stage .ms6-gauge .mg-needle');
      return { water: parseFloat(n[0].style.left), light: parseFloat(n[1].style.left), t: performance.now() / 1000, over: !window.LAB.state.ctrl?.host?.active };
    });
    if (st.over || st.t >= stopAt) return;
    const sun = st.light - ctl.led * LED_STEP;
    if (ctl.sun != null && st.t > ctl.t) ctl.slope = 0.8 * ctl.slope + 0.2 * (sun - ctl.sun) / (st.t - ctl.t);
    ctl.sun = sun; ctl.t = st.t;
    const want = Math.max(0, Math.min(5, Math.round((mid - (sun + ctl.slope * LOOK_S)) / LED_STEP)));
    if (st.water < L.water[0] + 6 && st.t >= ctl.waterAt) { ctl.waterAt = st.t + 0.9; await tap(2); } // a pulse soaks in over ~0.7 s
    else if (want > ctl.led) { ctl.led++; await tap(3); }
    else if (want < ctl.led) { ctl.led--; await tap(1); }
    else await p.wait(40);
  }
}

export default {
  id: 'M-S6',
  level: 'easy',
  seed: 12,
  maxSeconds: 30,
  speed: 2,
  async setup(p) {
    ctl = null;
    await p.navigate(`${p.baseUrl}/tools/minigame-lab/index.html#${this.id}/${this.level}/${this.seed}`);
    await p.until(() => window.LAB?.state?.ctrl && document.querySelector('#lab-stage')?.childElementCount > 0, { timeout: 15000 });
    await p.labClean();
    await p.frame('#lab-stage', 0, 12);
    const t0 = await p.eval(() => performance.now() / 1000);
    await grow(p, t0 + SKIP_S);
  },
  async play(p) {
    await grow(p);
    await p.wait(700);
  },
};
