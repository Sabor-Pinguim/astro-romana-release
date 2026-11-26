// M-S2 · Laser on rocks: keep the reticle on a spot while the mast sways and fire burst after burst (the first hits
// blow the dust off, the next read the chemistry), then move to the next cheapest spot.
export default {
  id: 'M-S2',
  level: 'easy', // big, close spots and a gentle sway: the aim reads clearly at GIF size
  seed: 29,
  maxSeconds: 20,
  async play(p) {
    const probe = () => p.eval(() => document.querySelector('#lab-stage .mg').mgProbe());
    const view = await p.rect('#lab-stage .ms2-view');
    const { P } = await p.lab();
    // Where spot s sits on screen now: the rock moves under the fixed reticle by the mast sway.
    const at = (s, pr) => ({ x: view.x + (s.x + pr.sway.x) * view.width, y: view.y + (s.y + pr.sway.y) * view.width });
    let pr = await probe();
    // The cheapest spots to read, visited nearest first.
    const left = pr.spots.map((s, i) => ({ ...s, i, cost: s.dustLeft + s.read })).sort((a, b) => a.cost - b.cost).slice(0, P.need);
    const route = [];
    for (let from = pr.aim; left.length;) {
      left.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y));
      route.push(from = left.shift());
    }
    await p.move(at(pr.aim, { sway: { x: 0, y: 0 } }), { ms: 100, steps: 1 });
    await p.wait(500);
    for (const { i } of route) {
      await p.move(at(pr.spots[i], pr), { ms: 450 });
      while (!(pr = await probe()).spots[i].done) {
        await p.move(at(pr.spots[i], pr), { ms: 0, steps: 1 }); // follow the spot as the mast sways
        if (pr.cooldown > 0) { await p.wait(30); continue; }
        await p.down(); await p.wait(50); await p.up();
        await p.wait(60);
      }
      await p.wait(250);
    }
    await p.until(() => window.LAB.state.result, { timeout: 3000 }).catch(() => {});
    await p.wait(600);
  },
};
