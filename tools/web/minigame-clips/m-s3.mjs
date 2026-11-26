// M-S3 · Listening for marsquakes: tap each marsquake (a small P wave, then a bigger S wave and a fading coda) once it
// shows on the trace and let the wind gusts (short jagged bursts) pass. The trace runs for 46 s, so the clip starts
// at dawn with the earlier quakes already marked off camera, and ends on the result at 10:00.
const START_S = 37.2; // trace seconds played before the recording starts
const LOOK_S = 0.9; // tap once the S wave has been on screen this long

let marked = new Set();

// Taps every quake on the trace whose S wave is in, until the trace reaches stopAt (s) or the run ends.
async function listen(p, stopAt = Infinity) {
  const { layout: L } = await p.lab();
  const quakes = L.events.filter(e => e.kind === 'quake');
  for (;;) {
    const st = await p.eval(() => {
      const cv = document.querySelector('#lab-stage .ms3-chart'), r = cv.getBoundingClientRect();
      return { now: Number(cv.dataset.now), x: r.x, y: r.y, w: r.width, h: r.height, over: !window.LAB.state.ctrl?.host?.active };
    });
    if (st.over || st.now >= stopAt) return;
    const q = quakes.find(e => !marked.has(e.ts) && st.now >= e.ts + e.gap + LOOK_S);
    if (!q) { await p.wait(50); continue; }
    marked.add(q.ts);
    // Where the S wave will be when the cursor gets there (the trace scrolls left; chart padding 4 px each side).
    const at = st.now + 0.35, pw = st.w - 8;
    const x = st.x + 4 + ((q.ts + q.gap + 0.2 - (at - L.view)) / L.view) * pw;
    await p.click({ x, y: st.y + st.h * 0.55 }, { moveMs: 300, after: 0 });
  }
}

export default {
  id: 'M-S3',
  level: 'easy',
  seed: 21, // a gust and a marked quake on screen at the start, then another gust and the last quake
  maxSeconds: 20,
  speed: 1.5,
  fps: 7, // the whole trace scrolls every frame: fewer, smaller frames keep the GIF light
  width: 370,
  async setup(p) {
    marked = new Set();
    await p.navigate(`${p.baseUrl}/tools/minigame-lab/index.html#${this.id}/${this.level}/${this.seed}`);
    await p.until(() => window.LAB?.state?.ctrl && document.querySelector('#lab-stage')?.childElementCount > 0, { timeout: 15000 });
    await p.labClean();
    await p.frame('#lab-stage', 0, 12);
    await listen(p, START_S);
  },
  async play(p) {
    await listen(p);
    await p.wait(800);
  },
};
