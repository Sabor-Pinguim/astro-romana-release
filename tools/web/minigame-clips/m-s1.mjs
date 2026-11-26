// M-S1 · Biosignature hunter: one SHERLOC sweep where the spots cluster makes the suspects glow, then PIXL confirms
// them one by one (a fluorescent decoy among them shows ✕) until the needed leopard spots are verified.
export default {
  id: 'M-S1',
  seed: 13, // one 3×3 sweep holds three spots and a decoy
  maxSeconds: 20,
  speed: 1.2,
  async play(p) {
    const { layout: L, P } = await p.lab();
    const { cols, rows } = L, spots = new Set(L.spots), decoys = new Set(L.decoys);
    // The sweep centre that lights the most spots (then a decoy, so the clip shows one ✕).
    let best = null;
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      const area = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => (y + dy) * cols + x + dx));
      const s = area.filter(i => spots.has(i)), d = area.filter(i => decoys.has(i));
      if (!best || s.length * 10 + d.length > best.score) best = { i: y * cols + x, s, d, score: s.length * 10 + d.length };
    }
    const tests = [best.s[0], ...best.d.slice(0, 1), ...best.s.slice(1, P.need)];
    // Centre of cell i on screen (the board turns its columns into rows on narrow screens).
    const cell = i => p.eval((i, cols, rows) => {
      const board = document.querySelector('#lab-stage .ms1-board');
      const turned = Number(board.style.getPropertyValue('--cols')) !== cols;
      const x = i % cols, y = (i / cols) | 0;
      const r = board.children[turned ? x * rows + (rows - 1 - y) : i].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, i, cols, rows);
    await p.wait(600);
    await p.click(await cell(best.i), { moveMs: 600, holdMs: 120, after: 900 });
    await p.click('#lab-stage .ms1-tool:nth-child(2)', { moveMs: 450, after: 350 });
    for (const i of tests) await p.click(await cell(i), { moveMs: 420, after: 650 });
    await p.until(() => window.LAB.state.result, { timeout: 3000 }).catch(() => {});
    await p.wait(500);
  },
};
