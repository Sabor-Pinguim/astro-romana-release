// L-S1 · Oxygen oven (Lucas / MOXIE) · keep in range. Plan: docs/experiments-implementation.md §5.2.
// Hold the heater so the SOXE stack stays in the green band around 800 °C until the O₂ goal is reached.
// Real numbers (references/experiments/minigames/l-s1-moxie/README.md): operating temperature 800 °C, 300 W,
// 6 g/h required, 12 g/h peak, 5.4–9.8 g per real run, intake 631–768 Pa, cells degrade each thermal cycle.
// Every run draws its own temperature wave (seeded noise), start temperature and modifier timings.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp } = MG.lib;

  const TARGET_C = 800; // real: SOXE operating temperature
  const POWER_W = 300; // real: MOXIE electrical power
  // game-balance: zoomed gauge, heater/cooling rates (°C/s of play), O₂ rates compressed so a run lasts ~15–30 s.
  const GAUGE = [720, 860];
  const HEAT_CS = 82, COOL_CS = 36, DAMAGE_PS = 22, CUTOUT_LOSS_G = 1;
  const PEAK_GS = 0.55, EDGE_GS = 0.25;

  // game-balance (plan §5.2). band: green zone (°C); margin: warm margin outside the band before cold/hot;
  // wave: amplitude (°C/s) and base frequency (Hz) of the seeded drift; goal: O₂ grams (inside the real
  // 5.4–9.8 g per run); battery: % drained per second of heating (null = unlimited).
  const LEVELS = {
    easy: { band: [770, 830], margin: 10, wave: [5, 0.22], goal: 5.5, mods: 0, battery: null, stars: [0, 0.5, 0.72] },
    normal: { band: [780, 820], margin: 10, wave: [8, 0.3], goal: 6, mods: 1, battery: null, stars: [0, 0.5, 0.72] },
    hard: { band: [790, 810], margin: 10, wave: [12, 0.42], goal: 8, mods: 2, battery: 3.6, stars: [0, 0.45, 0.66] },
  };
  // Modifiers, each from a real MOXIE fact (README above):
  //   thinAir    intake pressure varied 631–768 Pa between runs → less O₂ for a few seconds;
  //   powerShare MOXIE uses the payload power budget of a sol → weaker heater for a few seconds;
  //   wornCell   cell resistance grows each heat/cool cycle → the run starts with a worn stack.
  const MODS = ['thinAir', 'powerShare', 'wornCell'];

  function generate(R, P, { mods }) {
    const [amp, hz] = P.wave;
    const parts = Array.from({ length: 3 }, (_, i) => ({ f: hz * (1 + i * 1.37) * R.float(0.8, 1.25), p: R.float(0, Math.PI * 2), a: 1 / (i + 1) }));
    const events = mods.filter(m => m !== 'wornCell').map(m => ({ type: m, at: Math.round(R.float(4, 11) * 10) / 10, dur: m === 'thinAir' ? 5 : 4 }));
    return { start: Math.round(R.float(738, 765)), amp, parts, events, worn: mods.includes('wornCell') };
  }
  const waveOf = L => {
    const norm = L.parts.reduce((s, x) => s + x.a, 0);
    return t => (L.amp * L.parts.reduce((s, x) => s + x.a * Math.sin(2 * Math.PI * x.f * t + x.p), 0)) / norm;
  };

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const [gMin, gMax] = P.band, cold = gMin - P.margin, hot = gMax + P.margin;
    const wave = waveOf(L);
    let temp = L.start, o2 = 0, health = L.worn ? 80 : 100, battery = 100, cutouts = 0;
    let time = 0, greenTime = 0, heldKey = false;

    const badge = ui.el('div', 'mg-badge');
    const readout = ui.readout(['temp', 'target', 'o2']);
    const labels = ui.el('div', 'mg-gauge-labels');
    const gauge = ui.el('div', 'mg-gauge');
    const pct = c => ((clamp(c, GAUGE[0], GAUGE[1]) - GAUGE[0]) / (GAUGE[1] - GAUGE[0])) * 100;
    const zone = (cls, a, b) => { const z = ui.el('div', `mg-gauge-zone ${cls}`); z.style.left = `${pct(a)}%`; z.style.width = `${pct(b) - pct(a)}%`; gauge.append(z); return z; };
    const zCold = zone('is-cold', GAUGE[0], cold), zGood = zone('is-good', gMin, gMax), zHot = zone('is-hot', hot, GAUGE[1]);
    const needle = ui.el('div', 'mg-needle');
    gauge.append(needle);
    const meters = ui.el('div', 'mg-meters');
    const mO2 = ui.meter(''), mCell = ui.meter(''), mBat = P.battery ? ui.meter('', 'is-battery') : null;
    meters.append(mO2.node, mCell.node, ...(mBat ? [mBat.node] : []));
    const heat = ui.button('', 'primary');
    heat.classList.add('ls1-heat');
    const hold = ui.hold(heat, () => {});
    const controls = ui.el('div', 'mg-controls');
    controls.append(heat);
    host.body.append(badge, readout.node, labels, gauge, meters, controls);
    host.onKey((e, down) => {
      if (!['Space', 'ArrowUp', 'KeyW'].includes(e.code)) return false;
      heldKey = down; heat.classList.toggle('is-held', down || hold.on);
      return true;
    });

    const active = type => L.events.find(ev => ev.type === type && time >= ev.at && time < ev.at + ev.dur);
    const announced = new Set();

    function labelsText() {
      labels.replaceChildren(ui.el('span', '', t('zoneCold', { cold: U().tempC(cold) })), ui.el('span', '', t('zoneTarget', { range: U().tempRangeC(gMin, gMax) })), ui.el('span', '', t('zoneHot', { hot: U().tempC(hot) })));
      zGood.textContent = `✓ ${U().tempC(TARGET_C)}`;
      zCold.textContent = t('coldTag'); zHot.textContent = t('hotTag');
      mO2.label(t('o2Label', { goal: U().massGrams(P.goal, 1) }));
      mCell.label(t('cellLabel', { pct: Math.round(health) }));
      mBat?.label(t('batteryLabel', { pct: Math.round(battery) }));
      heat.textContent = t('heatBtn', { watts: POWER_W });
    }

    function render(status) {
      const inGreen = temp >= gMin && temp <= gMax, isHot = temp > hot, isCold = temp < cold;
      const state = inGreen ? 'good' : isHot ? 'danger' : isCold ? 'cold' : 'warn';
      badge.className = `mg-badge is-${state}`;
      badge.textContent = inGreen ? t('badgeGood', { target: U().tempC(TARGET_C) }) : isHot ? t('badgeHot', { hot: U().tempC(hot) })
        : isCold ? t('badgeCold', { cold: U().tempC(cold) }) : t('badgeWarm', { range: U().tempRangeC(gMin, gMax) });
      needle.style.left = `${pct(temp).toFixed(2)}%`;
      needle.className = `mg-needle${inGreen ? ' is-good' : isHot ? ' is-hot' : isCold ? ' is-cold' : ''}`;
      readout.set('temp', U().tempC(Math.round(temp)), inGreen ? 'good' : isHot ? 'danger' : '');
      readout.set('target', t('targetReadout', { range: U().tempRangeC(gMin, gMax), watts: POWER_W }));
      readout.set('o2', `${U().massGrams(o2, 1)} / ${U().massGrams(P.goal, 1)} O₂`, o2 >= P.goal ? 'good' : '');
      mO2.set(o2 / P.goal);
      mCell.set(health / 100, health < 40 ? 'danger' : '');
      mBat?.set(battery / 100, battery < 25 ? 'danger' : 'warn');
      mCell.label(t('cellLabel', { pct: Math.round(health) }));
      mBat?.label(t('batteryLabel', { pct: Math.round(battery) }));
      if (status) host.status(status);
    }

    host.loop(dt => {
      time += dt;
      const heating = hold.on || heldKey;
      const share = active('powerShare'), thin = active('thinAir');
      for (const ev of L.events) if (time >= ev.at && !announced.has(ev.type)) { announced.add(ev.type); host.status(t(`event.${ev.type}`)); }
      const heatRate = HEAT_CS * (L.worn ? 0.85 : 1) * (share ? 0.55 : 1);
      temp = clamp(temp + ((heating ? heatRate : 0) - COOL_CS + wave(time)) * dt, GAUGE[0], GAUGE[1]);
      if (P.battery && heating) battery = Math.max(0, battery - P.battery * dt);
      const eff = Math.max(0.35, health / 100) * (thin ? 0.55 : 1);
      let status = '';
      if (temp >= gMin && temp <= gMax) { o2 += PEAK_GS * eff * dt; greenTime += dt; status = t('statusGood', { target: U().tempC(TARGET_C) }); }
      else if (temp >= cold && temp <= hot) { o2 += EDGE_GS * eff * dt; status = temp < gMin ? t('statusWarmLow', { range: U().tempRangeC(gMin, gMax) }) : t('statusWarmHigh'); }
      else if (temp < cold) status = t('statusCold', { cold: U().tempC(cold) });
      else { health = Math.max(0, health - DAMAGE_PS * dt); status = t('statusHot', { hot: U().tempC(hot) }); }
      if (share || thin) status = t(`event.${share ? 'powerShare' : 'thinAir'}`);

      if (health <= 0) {
        cutouts++;
        o2 = Math.max(0, o2 - CUTOUT_LOSS_G); temp = L.start; health = 70;
        render(t('statusCutout', { loss: U().massGrams(CUTOUT_LOSS_G, 1) }));
        return;
      }
      if (P.battery && battery <= 0 && o2 < P.goal) {
        render();
        host.fail(t('failBattery', { got: U().massGrams(o2, 1), goal: U().massGrams(P.goal, 1) }));
        return;
      }
      if (o2 >= P.goal) {
        o2 = P.goal;
        const greenShare = greenTime / Math.max(0.001, time);
        const stars = Math.max(1, MG.lib.starsFrom(greenShare, P.stars) - cutouts);
        render(t('statusDone', { goal: U().massGrams(P.goal, 1), target: U().tempC(TARGET_C) }));
        heat.disabled = true;
        host.finish({ stars, summary: t('summary', { pct: Math.round(greenShare * 100), cutouts }), metrics: { greenShare, cutouts } });
        return;
      }
      render(status);
    });

    labelsText();
    render(t('statusInitial', { goal: U().massGrams(P.goal, 1) }) + (L.worn ? ` ${t('event.wornCell')}` : ''));
    return { render: () => { labelsText(); render(); } };
  }

  MG.register('L-S1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 25, normal: 30, hard: 40 },
    factVars: U => ({ total: U.massGrams(122, 0), target: U.tempC(TARGET_C) }), // real: 122 g in 16 runs (EN1)
    generate, mount,
  });
})();
