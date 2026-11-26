// M-O2 · Ice radar: run the clutter simulation to see the side echoes (∩ arcs), then trace the faint buried-ice line
// under the surface in one drag, from its first column to its last, and send.
export default {
  id: 'M-O2',
  seed: 6,
  maxSeconds: 16,
  speed: 1.2,
  async play(p) {
    const { layout: L } = await p.lab();
    const box = await p.rect('#lab-stage .mo2-chart');
    // Cell centres in viewport px: the chart's padding and grid (mount → geo()).
    const pad = { l: 15, r: 2, t: 2, b: 15 };
    const cw = (box.width - pad.l - pad.r) / L.cols, rh = (box.height - pad.t - pad.b) / L.rows;
    const at = (c, r) => ({ x: box.x + pad.l + (c + 0.5) * cw, y: box.y + pad.t + (r + 0.5) * rh });
    const ice = L.ice.map((r, c) => (r == null ? null : at(c, r))).filter(Boolean);

    await p.wait(500);
    await p.click('#lab-stage .mg-controls button:nth-child(1)', { after: 1400 }); // clutter simulation
    await p.move(ice[0], { ms: 450 });
    await p.down();
    for (const pt of ice.slice(1)) await p.move(pt, { ms: 150 });
    await p.up();
    await p.wait(500);
    await p.click('#lab-stage .mg-controls button:nth-child(3)', { after: 0 });
    await p.until(() => window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(600);
  },
};
