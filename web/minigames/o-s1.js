// O-S1 · Orbiter pass (Oscar / Electra UHF relay) · choice under a limit. Plan: docs/experiments-implementation.md §5.2.
// An orbiter flies over for a short window; pick the science packets that fit the pass and reach the goal.
// Real numbers (references/experiments/minigames/o-s1-uhf-relay/README.md): 100–250 Mb per pass (Curiosity era),
// up to 2 Mbps; packet sizes Mastcam-Z ~148 Mb (a sol), SHERLOC 79.7 Mb, RIMFAX 40–80 Mb, SEIS 38 Mb a day,
// PIXL ~16 Mb, SuperCam 15.5 Mb. The rover-health packet (5 Mb) is game-balance. Each run draws the packet set,
// the pass capacity, the value of each packet ("priority of the day") and the arrival times; the goal is a share
// of the best possible selection (exact 0/1 knapsack).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { knapsack, clamp } = MG.lib;

  // Real sizes (Mb). value: base science points (game-balance), scaled ±30% per run.
  const KINDS = {
    sherloc: { size: 79.7, value: 85 },
    rimfax: { size: [40, 80], value: 55 },
    seis: { size: 38, value: 45 },
    pixl: { size: 16, value: 40 },
    supercam: { size: 15.5, value: 35 },
    mastcam: { size: 148, value: 60 },
  };
  const TELEMETRY = { kind: 'telemetry', size: 5, value: 20, required: true }; // game-balance
  const RATE_MAX_MBPS = 2; // real: Electra rover → MRO/TGO

  // game-balance (plan §5.2). optional: packets besides the telemetry; capacity: Mb (inside the real 100–250);
  // window: s of play; atStart: packets already queued when the pass begins; goal: share of the best selection.
  const LEVELS = {
    easy: { optional: 5, capacity: [220, 250], window: 45, atStart: 5, goal: 0.7, mods: 0 },
    normal: { optional: 7, capacity: [150, 220], window: 40, atStart: 4, goal: 0.85, mods: 1 },
    hard: { optional: 9, capacity: [100, 150], window: 30, atStart: 3, goal: 0.95, mods: [1, 2] },
  };
  // Modifiers with a real basis (README above):
  //   orbiterLost  MAVEN was lost in Dec 2025, so the fleet relays less: a lower pass, near the real 100 Mb floor;
  //   lowPass      above 20° elevation a pass lasts ~5 min instead of ~8 min: a shorter window;
  //   quake        SEIS records a marsquake (a 38 Mb seismic day) that arrives mid-pass with high value.
  const MODS = ['orbiterLost', 'lowPass', 'quake'];

  function generate(R, P, { mods }) {
    const base = R.shuffle(Object.keys(KINDS));
    const kinds = base.slice(0, Math.min(P.optional, base.length));
    const extras = R.shuffle(['pixl', 'supercam', 'seis', 'rimfax']);
    while (kinds.length < P.optional) kinds.push(extras.pop());
    let capacity = R.span(P.capacity);
    if (mods.includes('orbiterLost')) capacity = Math.max(100, Math.round(capacity * 0.7));
    const window = Math.round(P.window * (mods.includes('lowPass') ? 0.7 : 1));
    const order = R.shuffle(kinds.map((_, i) => i));
    const packets = kinds.map((kind, i) => {
      const k = KINDS[kind];
      const queued = order.indexOf(i) < P.atStart;
      return {
        kind, size: Math.round(R.span(k.size) * 10) / 10, value: Math.round(k.value * R.float(0.7, 1.3)),
        arrive: queued ? 0 : Math.round(R.float(0.1, 0.55) * window * 10) / 10,
      };
    });
    if (mods.includes('quake')) packets.push({ kind: 'quake', size: KINDS.seis.size, value: Math.round(KINDS.seis.value * 2.2), arrive: Math.round(R.float(0.3, 0.5) * window * 10) / 10 });
    packets.sort((a, b) => a.arrive - b.arrive);
    return { capacity, window, packets: [{ ...TELEMETRY, arrive: 0 }, ...packets] };
  }

  function solve(L) {
    const optional = L.packets.filter(p => !p.required);
    const forced = L.packets.filter(p => p.required);
    const room = L.capacity - forced.reduce((s, p) => s + p.size, 0);
    const best = knapsack(optional, room);
    return { value: best.value + forced.reduce((s, p) => s + p.value, 0) };
  }

  // There must be a real choice: not everything fits, and the best selection is worth something.
  const validate = L => L.packets.reduce((s, p) => s + p.size, 0) > L.capacity * 1.15 && solve(L).value > 60;

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const best = solve(L).value;
    const goal = Math.ceil(best * P.goal);
    const selected = new Set(L.packets.map((p, i) => (p.required ? i : -1)).filter(i => i >= 0));
    let time = 0;
    const shown = new Set();

    const readout = ui.readout(['time', 'rate', 'used', 'pts']);
    const meters = ui.el('div', 'mg-meters');
    const mPass = ui.meter(''), mCap = ui.meter('');
    meters.append(mPass.node, mCap.node);
    const list = ui.el('div', 'mg-list os1-list');
    list.setAttribute('role', 'group');
    const send = ui.button('', 'primary');
    const controls = ui.el('div', 'mg-controls');
    controls.append(send);
    host.body.append(readout.node, meters, list, controls);

    const totals = () => [...selected].reduce((s, i) => ({ mb: s.mb + L.packets[i].size, pts: s.pts + L.packets[i].value }), { mb: 0, pts: 0 });
    const valid = () => { const { mb, pts } = totals(); return mb <= L.capacity + 1e-9 && pts >= goal; };

    const rows = L.packets.map((p, i) => {
      const b = ui.el('button', 'mg-item os1-packet');
      b.type = 'button';
      b.hidden = true;
      if (p.required) { b.disabled = true; b.classList.add('is-locked'); }
      b.addEventListener('click', () => {
        if (!host.active || p.required) return;
        if (selected.has(i)) selected.delete(i); else selected.add(i);
        const { mb, pts } = totals();
        render(mb > L.capacity ? t('bufferFull', { over: U().decimal(mb - L.capacity, 1) })
          : pts >= goal ? t('readyStatus', { mb: U().decimal(mb, 1), pts }) : t('selectedStatus', { count: selected.size, mb: U().decimal(mb, 1), pts, goal }));
      });
      list.append(b);
      return b;
    });

    function rowText() {
      rows.forEach((b, i) => {
        const p = L.packets[i];
        b.replaceChildren();
        const row = ui.el('span', 'mg-item-row'), name = ui.el('span', 'mg-item-name'), meta = ui.el('span', 'mg-item-meta');
        name.append(ui.el('strong', '', t(`packets.${p.kind}.name`)), ui.el('small', '', p.required ? t('required') : t(`packets.${p.kind}.what`)));
        meta.append(ui.el('span', '', `${U().decimal(p.size, 1)} Mb`), ui.el('small', '', `+${p.value} pts`));
        row.append(name, meta);
        const share = ui.el('span', 'mg-share'), fill = ui.el('span');
        fill.style.width = `${Math.min(100, (p.size / L.capacity) * 100).toFixed(1)}%`;
        share.append(fill);
        b.append(row, share);
      });
    }

    function render(status) {
      const { mb, pts } = totals();
      const progress = clamp(time / L.window, 0, 1);
      readout.set('time', `${U().decimal(Math.max(0, L.window - time), 1)} s`, L.window - time < 8 ? 'danger' : '');
      readout.set('rate', `${U().decimal(RATE_MAX_MBPS * (0.12 + 0.88 * Math.sin(Math.PI * progress)), 2)} Mbps`);
      readout.set('used', `${U().decimal(mb, 1)} / ${L.capacity} Mb`, mb > L.capacity ? 'danger' : '');
      readout.set('pts', `${pts} / ${goal} pts`, pts >= goal ? 'good' : '');
      mPass.label(t('passLabel')); mPass.set(progress, 'warn');
      mCap.label(t('capLabel', { cap: L.capacity })); mCap.set(mb / L.capacity, mb > L.capacity ? 'danger' : 'warn');
      rows.forEach((b, i) => {
        b.setAttribute('aria-pressed', String(selected.has(i)));
        if (!host.active && !L.packets[i].required) b.disabled = true;
      });
      send.disabled = !host.active;
      send.classList.toggle('is-ready', valid());
      send.textContent = mb > L.capacity ? t('overLimitBtn', { cap: L.capacity }) : pts < goal ? t('needMoreBtn', { pts, goal }) : t('transmitBtn', { mb: U().decimal(mb, 1), pts });
      list.setAttribute('aria-label', t('listAria'));
      if (status) host.status(status);
    }

    function transmit(auto) {
      const { mb, pts } = totals();
      const stars = pts >= best - 1e-6 ? 3 : pts >= goal + (best - goal) / 2 ? 2 : 1;
      render(t(auto ? 'autoTransmitted' : 'relayedStatus', { mb: U().decimal(mb, 1), pts }));
      host.finish({ stars, summary: t('summary', { pts, best, mb: U().decimal(mb, 1) }), metrics: { pts, best, goal, mb } });
    }

    send.addEventListener('click', () => {
      if (!host.active) return;
      const { mb, pts } = totals();
      if (mb > L.capacity) { render(t('overLimitErr', { over: U().decimal(mb - L.capacity, 1) })); return; }
      if (pts < goal) { render(t('needPtsErr', { goal, pts })); return; }
      transmit(false);
    });

    host.loop(dt => {
      time += dt;
      L.packets.forEach((p, i) => {
        if (time >= p.arrive && !shown.has(i)) {
          shown.add(i); rows[i].hidden = false;
          if (p.arrive > 0) { rows[i].classList.add('is-new'); host.status(t(p.kind === 'quake' ? 'quakeArrived' : 'packetArrived', { name: t(`packets.${p.kind}.name`) })); }
        }
      });
      if (time >= L.window) {
        time = L.window;
        if (valid()) transmit(true);
        else { render(); host.fail(t('missedStatus', { goal })); }
        return;
      }
      render();
    });

    rowText();
    L.packets.forEach((p, i) => { if (p.arrive === 0) { shown.add(i); rows[i].hidden = false; } });
    render(t('initialStatus', { goal, cap: L.capacity }));
    return { render: () => { rowText(); render(); } };
  }

  MG.register('O-S1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 25, normal: 30, hard: 30 },
    generate, validate, solve, mount,
  });
})();
