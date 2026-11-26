// O-S2 · Radio geodesy: hold ▶ / ◀ to bring the lock window onto the radio tone, then nudge it along as Mars's rotation
// slides the tone across the receiver, so the signal stays locked for the whole session.
const ID = 'O-S2', LEVEL = 'easy', SEED = 29; // the shortest session (24 s); the tone slides right, then left

export default {
  id: ID,
  level: LEVEL,
  seed: SEED,
  maxSeconds: 32,
  speed: 2, // the session always runs its full length
  fps: 8, width: 360, // the whole waterfall moves every frame: fewer, smaller frames keep the GIF light
  // Reduced motion: the game's calmer waterfall noise (a fixed pattern plus a little speckle). The full noise changes
  // every pixel of every frame and makes the GIF several MB.
  async setup(p) {
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await p.navigate(`${p.baseUrl}/tools/minigame-lab/index.html#${ID}/${LEVEL}/${SEED}`); // language: the recorder's
    await p.until(() => window.LAB?.state?.ctrl && document.querySelector('#lab-stage')?.childElementCount > 0, { timeout: 15000 });
    await p.labClean();
    await p.frame('#lab-stage', 0, 12);
  },
  async play(p) {
    // The game clock, from the readout: `left` (whole seconds) and when it last changed.
    await p.eval(() => {
      const span = document.querySelector('#lab-stage .mg-readout [data-k="time"]'), clock = { left: null, at: 0 };
      window.__clipClock = clock;
      new MutationObserver(() => {
        const m = /(\d+)\D*$/.exec(span.textContent), left = m ? Number(m[1]) : null;
        if (left !== clock.left) { clock.left = left; clock.at = performance.now(); }
      }).observe(span, { childList: true, characterData: true, subtree: true });
    });
    // Tone minus tuner (share of the band): the tone from the layout at the game time (the def's smoothAt), its
    // distance refined by the signal meter; the tuner from the dial.
    const miss = () => p.eval(() => {
      const { id, seed, level } = window.LAB.state, MG = window.ASTRO_MINIGAMES, P = MG.params(id, level);
      const L = MG.layout(id, seed, level).layout, T = L.tone, c = window.__clipClock, TAU = Math.PI * 2;
      const time = c.left == null ? 0.5 : L.session - c.left + (performance.now() - c.at) / 1000;
      const wn = T.wobble.reduce((s, x) => s + x.a, 0);
      const tone = T.c + T.amp * Math.sin((TAU * time) / T.period + T.phase) + (T.wa * T.wobble.reduce((s, x) => s + x.a * Math.sin(TAU * x.f * time + x.p), 0)) / wn;
      const tuner = Number(document.querySelector('#lab-stage .os2-dial').getAttribute('aria-valuenow')) / 100;
      const sig = parseFloat(document.querySelectorAll('#lab-stage .mg-meters .mg-fill')[1]?.style.width) / 100;
      let d = tone - tuner;
      if (sig > 0.02) d = Math.sign(d) * (1 - sig) * P.window * 2.5;
      return { d, over: !window.LAB.state.ctrl?.host.active };
    });
    const button = dir => `#lab-stage .os2-tune > button:${dir < 0 ? 'first' : 'last'}-child`;
    await p.wait(300);
    let held = 0;
    for (;;) {
      const s = await miss();
      if (s.over) break;
      const want = Math.abs(s.d) > 0.03 ? Math.sign(s.d) : Math.abs(s.d) < 0.008 ? 0 : held;
      if (want !== held) {
        if (held) await p.up();
        if (want) { await p.move(button(want), { ms: 200 }); await p.down(); }
        held = want;
      }
      await p.wait(30);
    }
    if (held) await p.up();
    await p.until(() => window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(500);
  },
};
