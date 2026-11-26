// M-S4 · Choosing samples: weigh every clue (rock, texture, chemistry hint, the dusty-coating tell), fill the tubes
// with the best cores and seal them to reveal the hidden values.
export default {
  id: 'M-S4',
  seed: 7, // on this layout the cores the clues rank highest are the game's own best picks
  maxSeconds: 20,
  async play(p) {
    const { picks } = await p.solve();
    await p.wait(700);
    for (const i of [...picks].sort((a, b) => a - b)) await p.click(`#lab-stage .ms4-card[data-i="${i}"]`, { moveMs: 420, after: 450 });
    await p.click('#lab-stage .mg-controls .button', { moveMs: 420, after: 0 });
    await p.until(() => window.LAB.state.result, { timeout: 3000 }).catch(() => {});
    await p.wait(600);
  },
};
