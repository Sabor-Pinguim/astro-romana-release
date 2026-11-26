// O-O2 · Image compression: keep only the tiles of the best crop (fine details lossless, the rest with the lossy tool)
// and send, inside the downlink budget.
// The best crop: the def's group knapsack (drop / lossless / lossy per target), with the choices kept.
function bestCrop(L) {
  const cap = L.budgetHalves;
  let dp = new Array(cap + 1).fill(-Infinity);
  dp[0] = 0;
  const picks = [];
  for (const tg of L.targets) {
    const tiles = tg.w * tg.h, opts = [[2 * tiles, tg.value, 1]];
    if (L.lossy) opts.push([tiles, tg.lossyValue, 2]);
    const next = dp.slice(), pick = new Array(cap + 1).fill(0);
    for (let c = 0; c <= cap; c++) {
      if (dp[c] === -Infinity) continue;
      for (const [w, v, k] of opts) if (c + w <= cap && dp[c] + v > next[c + w]) { next[c + w] = dp[c] + v; pick[c + w] = k; }
    }
    picks.push(pick);
    dp = next;
  }
  let c = dp.indexOf(Math.max(...dp));
  const modes = L.targets.map(() => 0);
  for (let i = L.targets.length - 1; i >= 0; i--) {
    modes[i] = picks[i][c];
    if (modes[i]) c -= (modes[i] === 1 ? 2 : 1) * L.targets[i].w * L.targets[i].h;
  }
  return modes; // 0 dropped, 1 lossless, 2 lossy
}

export default {
  id: 'O-O2',
  seed: 25,
  maxSeconds: 20,
  speed: 1.2,
  async play(p) {
    const { layout: L } = await p.lab();
    const modes = bestCrop(L);
    const box = await p.rect('#lab-stage .oo2-canvas');
    const tile = (i, j) => ({ x: box.x + ((i + 0.5) * box.width) / L.cols, y: box.y + ((j + 0.5) * box.height) / L.rows });
    const paint = async tg => {
      const a = tile(tg.x, tg.y), b = tile(tg.x + tg.w - 1, tg.y + tg.h - 1);
      if (tg.w * tg.h === 1) await p.click(a, { moveMs: 400, after: 350 });
      else { await p.drag(a, b, { moveMs: 400, ms: 380 }); await p.wait(350); }
    };
    await p.wait(700);
    for (const mode of [1, 2]) {
      const todo = L.targets.filter((tg, i) => modes[i] === mode);
      if (!todo.length) continue;
      if (mode === 2) await p.click('#lab-stage .oo2-tools button:nth-child(2)', { after: 350 }); // lossy tool
      for (const tg of todo) await paint(tg);
    }
    await p.click('#lab-stage .mg-controls button', { after: 0 });
    await p.until(() => window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(500);
  },
};
