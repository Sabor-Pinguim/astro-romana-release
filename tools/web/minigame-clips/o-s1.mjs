// O-S1 · Orbiter pass: pick the packets of the best selection (the game's own knapsack) as they arrive, then send
// once the points reach the goal.
export default {
  id: 'O-S1',
  seed: 7,
  maxSeconds: 30,
  speed: 1.6, // waiting for late packets is dull: the clip plays it faster
  async play(p) {
    const plan = await p.eval(() => {
      const { id, seed, level } = window.LAB.state, MG = window.ASTRO_MINIGAMES;
      const { layout: L } = MG.layout(id, seed, level);
      const optional = L.packets.map((pk, i) => ({ ...pk, i })).filter(pk => !pk.required);
      const room = L.capacity - L.packets.filter(pk => pk.required).reduce((s, pk) => s + pk.size, 0);
      const best = MG.lib.knapsack(optional, room);
      return best.picks.map(k => optional[k]).sort((a, b) => a.arrive - b.arrive).map(pk => pk.i);
    });
    await p.wait(500);
    for (const i of plan) {
      const sel = `#lab-stage .os1-packet:nth-of-type(${i + 1})`;
      await p.until(s => { const b = document.querySelector(s); return b && !b.hidden; }, { args: [sel], timeout: 40000 });
      await p.click(sel, { after: 350 });
    }
    await p.click('#lab-stage .mg-controls button', { after: 0 });
    await p.until(() => !window.LAB.state.ctrl || window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(400);
  },
};
