// M-O3 · Methane hunter: lay the methane fingerprint over the spectrum (only some lines hit a dip: not there), then
// the gas whose every line falls on a dip, claim it and send.
const GASES = ['ch4', 'h2o', 'hcl', 'co']; // card order in the minigame
const card = g => `#lab-stage .mo3-gas:nth-child(${GASES.indexOf(g) + 1})`;

export default {
  id: 'M-O3',
  seed: 5,
  maxSeconds: 16,
  speed: 1.3,
  async play(p) {
    const { layout: L } = await p.lab();
    await p.wait(900);
    await p.click(card('ch4'), { after: 1800 }); // a partial match: the trap
    for (const g of L.present) {
      await p.click(card(g), { after: 1100 }); // every line on a dip
      await p.click('#lab-stage .mg-controls button:nth-child(1)', { after: 500 });
    }
    await p.click('#lab-stage .mg-controls button:nth-child(2)', { after: 0 });
    await p.until(() => window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(400);
  },
};
