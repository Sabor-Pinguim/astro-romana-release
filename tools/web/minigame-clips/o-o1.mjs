// O-O1 · Laser to Earth: grab the reticle and drag it onto the ground station, then keep it in the lock ring against the
// vibration (and through a passing cloud) until the onboard memory is empty.
export default {
  id: 'O-O1',
  seed: 251,
  maxSeconds: 24,
  speed: 2, // holding a steady beam is slow to watch
  async play(p) {
    const probe = () => p.eval(() => ({ ...document.querySelector('#lab-stage .mg').mgProbe(), over: !window.LAB.state.ctrl?.host.active }));
    const box = await p.rect('#lab-stage .oo1-view');
    const at = v => ({ x: box.x + v.x * box.width, y: box.y + v.y * box.width }); // view widths → viewport px
    await p.wait(500);
    let s = await probe(), pos = at(s.beam);
    await p.move(pos, { ms: 450 });
    await p.down();
    for (let first = true; ; first = false) {
      s = await probe();
      if (s.over) break;
      // The drag moves the beam 1:1: move the pointer by the beam's miss.
      pos = { x: pos.x + (s.station.x - s.beam.x) * box.width, y: pos.y + (s.station.y - s.beam.y) * box.width };
      await p.move(pos, first ? { ms: 500 } : { ms: 35, steps: 1 });
    }
    await p.up();
    await p.until(() => window.LAB.state.result, { timeout: 5000 }).catch(() => {});
    await p.wait(500);
  },
};
