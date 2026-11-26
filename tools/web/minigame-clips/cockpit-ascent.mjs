// Cockpit liftoff & Max-Q: Space throttles up to lift off, then the arrows hold the ascent marker in the band to MECO.

// --- shared by the cockpit-*.mjs clips -------------------------------------------------------------------------

const GUIDES_SEEN = ['cockpit-ascent', 'cockpit-cabin-dock', 'cockpit-orbital-dock', 'cockpit-landing', 'H-S2'];
const MARK_GUIDES_SEEN = `try { localStorage.setItem('astro-romana-minigame-guides-seen', '${JSON.stringify(GUIDES_SEEN)}'); } catch {}`;

// Opens the cockpit on a flight step in the phone layout (420 px wide: the deck reads at full size) and frames the
// deck: telemetry, the step's goal and its minigame card. height: viewport px, sized so the card fits.
export async function enterCockpit(p, step, height) {
  await p.send('Emulation.setDeviceMetricsOverride', { width: 420, height, deviceScaleFactor: 1, mobile: false });
  // The "How to solve" popup opens once per stage and pauses it: mark the guides seen before the page loads.
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: MARK_GUIDES_SEEN });
  await p.navigate(`${p.baseUrl}/index.html`);
  await p.until(() => document.querySelector('#menu.active') && window.ASTRO?.data?.(), { timeout: 15000 });
  await p.eval(s => window.ASTRO.jumpCockpit(s), step); // the default rocket flies on Normal
  // Step 3 may open Helena's precision landing (H-S2) first: leave it as the Back button does.
  await p.until(s => {
    const f = window.ASTRO_SIM.flight, dlg = document.querySelector('#minigame-dialog');
    if (dlg?.open) dlg.close();
    return f.active && f.step === s && !f.descentHold && !!document.querySelector('#cockpit.active');
  }, { args: [step], timeout: 8000 });
  await p.wait(700); // the phase transition fade
  await p.frame('.cockpit-deck');
}

const readGauge = name => {
  const f = window.ASTRO_SIM.flight, g = f[name];
  return { step: f.step, docked: f.docked, value: g?.value, rate: g?.rate, band: g?.band,
    done: !g || g.done, t: g?.t ?? 0, left: g ? g.duration - g.t : 0 };
};

// Keeps a keep-in-range reticle (flight.liftoff, .docking or .marsBurn) centred with the arrow keys, like a player:
// each axis holds the arrow that pushes the marker back once its error, looking `lead` s ahead, leaves a dead zone
// (a share of the band); a key stays down or up for at least minHoldMs. Returns when stop(state) is true.
export async function holdInBand(p, gauge, { stop, lead = 0.6, dead = 0.3, minHoldMs = 160 } = {}) {
  const AXES = [['ArrowDown', 'ArrowUp'], ['ArrowLeft', 'ArrowRight']]; // [pitch, yaw]: [lowers it, raises it]
  const push = [0, 0], since = [0, 0];
  try {
    for (;;) {
      const s = await p.eval(readGauge, gauge);
      if (stop(s)) return s;
      for (let k = 0; k < 2; k++) {
        if (Date.now() - since[k] < minHoldMs) continue;
        const err = (s.value[k] + s.rate[k] * lead) / s.band;
        const want = err > dead ? -1 : err < -dead ? 1 : 0;
        if (want === push[k]) continue;
        if (push[k]) await p.keyUp(AXES[k][push[k] < 0 ? 0 : 1]);
        if (want) await p.keyDown(AXES[k][want < 0 ? 0 : 1]);
        push[k] = want; since[k] = Date.now();
      }
      await p.wait(30);
    }
  } finally {
    for (let k = 0; k < 2; k++) if (push[k]) await p.keyUp(AXES[k][push[k] < 0 ? 0 : 1]);
  }
}

// Game seconds before the end of a keep-in-range step at which the ascent and landing clips stop.
export const END_BEFORE_S = 0.75;

// --- this clip ---------------------------------------------------------------------------------------------------
export default {
  id: 'cockpit-ascent',
  fileId: 'cockpit-ascent',
  maxSeconds: 24,
  speed: 1.8, // the 12 s climb plays faster
  async setup(p) {
    await enterCockpit(p, 0, 600);
  },
  async play(p) {
    await p.wait(600);
    await p.press('Space', 180, 0); // throttle 35% → 70%: liftoff
    await p.until(() => window.ASTRO_SIM.flight.liftoff, { timeout: 3000 });
    // Ends just before MECO (the recorder keeps a few frames after play): at MECO the next step's card replaces this
    // one and the header shrinks, so the frame would slip.
    await holdInBand(p, 'liftoff', { stop: s => s.step !== 0 || s.done || s.left < END_BEFORE_S });
  },
};
