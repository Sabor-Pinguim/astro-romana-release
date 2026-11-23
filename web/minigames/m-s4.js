// M-S4 · Choosing samples (Maya / Perseverance's sample tubes) · choice under a limit. Plan:
// docs/experiments-implementation.md §5.3. A handful of single-use tubes and more candidate cores than tubes: each
// core shows clues (rock type, texture, the PIXL/SHERLOC chemistry hint and its strength, a dusty coating) and hides
// its real science value, which only shows after the tubes are sealed. Clues follow the value, but noisily; some
// hints are decoys (a coating or a fluorescent mineral that fakes a signal).
// Real numbers (references/experiments/mars-experiments.md GE6; experiments.md G8, B14): 43 single-use tubes; cores
// ~13 × 60 mm, 10–15 g; 27 rock cores by Sep 2025; a 10-tube backup depot at "Three Forks"; Mars Sample Return
// cancelled in the FY2026 budget. The solver is exact (the sum of the best true values, one per tube) and the
// stars compare the player's tubes with it.
// Chains (plan §3 rule 6): generate accepts info.ctx, optional; without it the cores come from the outcrop.
//   ctx.biosignature  truthy (e.g. the M-S1 result { stars }): adds the leopard-spot core from M-S1;
//   ctx.samples       array of cores drilled in L-S2: { rock?: 'mudstone' | 'sandstone' | 'bedrock' | 'crust' | any
//                     key of ROCKS, quality?: 0..1 } (quality < 0.5 = a partial core, worth less).
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;

  const CORE_G = [10, 15]; // real (GE6): cores ~13 × 60 mm, 10–15 g each
  // Science value of the clues (game-balance). Rock: lake mudstone and carbonates keep traces of life best
  // (organics in 3-billion-year-old mudstone, BI2; siderite in sulfate layers, a carbon cycle, GE4); the other rocks
  // are worth less and loose regolith the least. Chemistry hint: points per strength level (1–3).
  const ROCKS = { mudstone: 30, carbonate: 26, sulfate: 20, sandstone: 18, igneous: 16, regolith: 6 };
  const TEXTURES = { laminated: 14, veined: 10, conglomerate: 8, vesicular: 4, massive: 0, loose: 0 };
  const FITS = {
    mudstone: ['laminated', 'veined', 'massive'], carbonate: ['laminated', 'veined', 'massive'], sulfate: ['veined', 'laminated', 'massive'],
    sandstone: ['laminated', 'conglomerate', 'massive'], igneous: ['vesicular', 'massive'], regolith: ['loose'],
  };
  const CHEM = { spots: 15, organics: 12, hydrated: 6, none: 0 };
  const CHEM_ODDS = [['none', 0.34], ['hydrated', 0.3], ['organics', 0.26], ['spots', 0.1]]; // game-balance
  const ALIAS = { bedrock: 'igneous', crust: 'regolith', loose: 'regolith' }; // L-S2 layer names
  const PARTIAL = 0.6; // game-balance: value kept by a crumbled, partial core
  const NAMES = 'ABCDEFGHJKLMN';

  // game-balance (plan §5.3). noise: chance a hint strength is off by one; jitter: ± hidden value points; tell:
  // chance a decoy shows its dusty-coating tell; falseTell: chance a real core shows that tell; trap: the naive
  // "strongest hint" pick must miss 3 stars; stars: share of the best possible value for 1, 2 and 3 stars.
  const LEVELS = {
    easy: { cores: 8, tubes: 4, decoys: 1, noise: 0.1, jitter: 5, tell: 1, falseTell: 0, time: 60, trap: false, mods: 0, stars: [0.55, 0.75, 0.9] },
    normal: { cores: 10, tubes: 3, decoys: 2, noise: 0.22, jitter: 8, tell: 0.8, falseTell: 0, time: 60, trap: true, mods: 1, stars: [0.55, 0.78, 0.92] },
    hard: { cores: 12, tubes: 3, decoys: 3, noise: 0.32, jitter: 11, tell: 0.65, falseTell: 0.12, time: 55, trap: true, mods: [1, 2], stars: [0.6, 0.8, 0.93] },
  };
  // Modifiers with a real basis:
  //   depot        Perseverance left 10 of its tubes as a backup depot at "Three Forks" (GE6, G8): one tube fewer;
  //   fluorescent  many minerals glow without life, which is why Cheyava Falls is only a "potential" biosignature
  //                (B14): two more decoys;
  //   dust         rover targets are dusty and the arm abrades a patch before proximity science (M-S1 spec [13]):
  //                the hint strengths are noisier.
  const MODS = ['depot', 'fluorescent', 'dust'];

  // ---------------------------------------------------------------------------
  // Layout, solver, validation (pure)
  // ---------------------------------------------------------------------------
  const estimate = c => ROCKS[c.rock] + TEXTURES[c.texture] + CHEM[c.chem] * (c.tell ? 0 : c.shown) * (c.partial ? PARTIAL : 1);
  const topSum = (cores, k, key) => cores.map((c, i) => ({ i, k: key(c) })).sort((a, b) => b.k - a.k || a.i - b.i).slice(0, k).reduce((s, x) => s + cores[x.i].value, 0);

  function pickChem(R) {
    let x = R.next();
    for (const [chem, p] of CHEM_ODDS) { if (x < p) return chem; x -= p; }
    return 'none';
  }

  function generate(R, P, { mods, ctx }) {
    const noise = P.noise + (mods.includes('dust') ? 0.2 : 0);
    const tubes = Math.max(2, P.tubes - (mods.includes('depot') ? 1 : 0));
    const decoys = P.decoys + (mods.includes('fluorescent') ? 2 : 0);
    const make = (rock, origin, extra = {}) => {
      const texture = extra.texture || R.pick(FITS[rock]);
      const chem = extra.chem || pickChem(R);
      const strength = chem === 'none' ? 0 : extra.strength || R.int(1, 3);
      const shown = chem === 'none' ? 0 : Math.min(3, Math.max(1, strength + (R.chance(noise) ? R.pick([-1, 1]) : 0)));
      return { rock, texture, chem, strength, shown, tell: R.chance(P.falseTell), decoy: false, partial: !!extra.partial, origin,
        grams: Math.round(R.span(CORE_G) * 10) / 10, jitter: R.float(-P.jitter, P.jitter) };
    };
    const cores = [];
    if (ctx?.biosignature) cores.push(make('mudstone', 'biosig', { texture: 'veined', chem: 'spots', strength: 3 }));
    if (Array.isArray(ctx?.samples)) {
      for (const s of ctx.samples.slice(0, Math.max(0, P.cores - cores.length - 2))) {
        const rock = ROCKS[ALIAS[s?.rock] || s?.rock] != null ? ALIAS[s?.rock] || s?.rock : R.pick(Object.keys(ROCKS));
        cores.push(make(rock, 'drill', { partial: typeof s?.quality === 'number' && s.quality < 0.5 }));
      }
    }
    while (cores.length < P.cores) cores.push(make(R.pick(Object.keys(ROCKS)), 'outcrop'));
    // Decoys: a strong hint with nothing real behind it (coating or fluorescence); usually a coating tell shows.
    R.sample(cores.map((c, i) => i).filter(i => cores[i].origin === 'outcrop'), decoys).forEach(i => {
      Object.assign(cores[i], { chem: R.pick(['organics', 'spots']), strength: 0, shown: R.int(2, 3), decoy: true, tell: R.chance(P.tell) });
    });
    const order = R.shuffle(cores.map((c, i) => i));
    const out = order.map((i, n) => {
      const c = cores[i];
      const raw = ROCKS[c.rock] + TEXTURES[c.texture] + CHEM[c.chem] * c.strength + c.jitter;
      const value = Math.max(2, Math.round(raw * (c.partial ? PARTIAL : 1)));
      const { jitter, ...rest } = c;
      return { ...rest, name: NAMES[n], value };
    });
    return { tubes, cores: out };
  }

  function solve(L) {
    const ranked = L.cores.map((c, i) => i).sort((a, b) => L.cores[b].value - L.cores[a].value || a - b);
    const picks = ranked.slice(0, L.tubes);
    return { value: picks.reduce((s, i) => s + L.cores[i].value, 0), picks };
  }

  // Solvable with a careful reading: picking by all the clues reaches 3 stars. A real decision: on normal and hard
  // the one-clue picks (strongest chemistry hint first, or best rock first) do not.
  function validate(L, P) {
    if (L.cores.length < L.tubes + 3) return false;
    const best = solve(L).value;
    if (topSum(L.cores, L.tubes, estimate) < best * P.stars[2]) return false;
    if (!P.trap) return true;
    // Reading only one kind of clue is not enough: neither the strongest hints nor the best rocks alone give 3 stars.
    return topSum(L.cores, L.tubes, c => CHEM[c.chem] * c.shown * 10 + ROCKS[c.rock] / 10) < best * P.stars[2]
      && topSum(L.cores, L.tubes, c => ROCKS[c.rock] + TEXTURES[c.texture]) < best * P.stars[2];
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  // Swatch colours: RAMPS.rock / gale / ice / mars of web/app.js (docs/visual-identity.md §2).
  const SWATCH = { mudstone: '#6b5a62', carbonate: '#c9b8b0', sulfate: '#e9dccb', sandstone: '#c27a3a', igneous: '#33263a', regolith: '#b8391f' };

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const sol = solve(L), best = sol.value, top = new Set(sol.picks);
    const maxValue = Math.max(...L.cores.map(c => c.value));
    const picked = [];
    let time = 0, sealed = false;

    const readout = ui.readout(['time', 'tubes', 'note']);
    const notes = ui.el('p', 'mg-hint ms4-notes');
    const list = ui.el('div', 'mg-list ms4-list');
    list.setAttribute('role', 'group');
    const seal = ui.button('', 'primary');
    const controls = ui.el('div', 'mg-controls');
    controls.append(seal);
    host.body.append(readout.node, notes, list, controls);

    const cards = L.cores.map((c, i) => {
      const b = ui.el('button', 'mg-item ms4-card');
      b.type = 'button';
      b.dataset.i = i;
      b.addEventListener('click', () => toggle(i));
      list.append(b);
      return b;
    });

    function toggle(i) {
      if (!host.active || sealed) return;
      const at = picked.indexOf(i);
      if (at >= 0) { picked.splice(at, 1); render(t('statusFreed', { name: L.cores[i].name })); return; }
      if (picked.length >= L.tubes) { render(t('statusFull', { tubes: L.tubes })); return; }
      picked.push(i);
      render(picked.length === L.tubes ? t('statusAllPicked', { tubes: L.tubes }) : t('statusPicked', { name: L.cores[i].name, left: L.tubes - picked.length }));
    }

    const dots = n => '●'.repeat(n) + '○'.repeat(3 - n);
    function cardContent(c, i) {
      const b = cards[i];
      b.replaceChildren();
      const sw = ui.el('span', `ms4-swatch is-${c.texture}`);
      sw.style.setProperty('--rock', SWATCH[c.rock]);
      const main = ui.el('span', 'ms4-main');
      const head = ui.el('span', 'ms4-head');
      head.append(ui.el('strong', '', t('coreName', { name: c.name })), ui.el('small', '', U().massGrams(c.grams, 1)));
      if (c.origin !== 'outcrop') head.append(ui.el('span', 'ms4-origin', t(`origin.${c.origin}`)));
      const chips = ui.el('span', 'ms4-chips');
      chips.append(ui.el('span', '', t(`rocks.${c.rock}`)), ui.el('span', '', t(`textures.${c.texture}`)));
      chips.append(ui.el('span', `ms4-chem${c.chem === 'none' ? ' is-none' : ''}`, c.chem === 'none' ? t('chem.none') : `${t(`chem.${c.chem}`)} ${dots(c.shown)}`));
      if (c.tell) chips.append(ui.el('span', 'ms4-tell', t('tell')));
      if (c.partial) chips.append(ui.el('span', 'ms4-tell', t('partial')));
      main.append(head, chips);
      b.append(sw, main);
      const at = picked.indexOf(i);
      const side = ui.el('span', 'ms4-side');
      if (at >= 0) side.append(ui.el('span', 'ms4-tube', t('tubeTag', { n: at + 1 })));
      if (sealed) {
        const bar = ui.el('span', 'ms4-bar'), fill = ui.el('span');
        fill.style.width = `${((c.value / maxValue) * 100).toFixed(0)}%`;
        bar.append(fill);
        side.append(ui.el('span', 'ms4-value', t('valueTag', { v: c.value })), bar);
        if (top.has(i)) side.append(ui.el('span', 'ms4-best', t('bestTag')));
        if (c.decoy) side.append(ui.el('span', 'ms4-decoy', t('decoyTag')));
      }
      b.append(side);
      b.classList.toggle('is-top', sealed && top.has(i));
      b.classList.toggle('is-decoy', sealed && c.decoy);
      b.setAttribute('aria-pressed', String(at >= 0));
      b.disabled = !host.active || sealed;
      b.setAttribute('aria-label', t('cardAria', { name: c.name, rock: t(`rocks.${c.rock}`), texture: t(`textures.${c.texture}`),
        chem: c.chem === 'none' ? t('chem.none') : `${t(`chem.${c.chem}`)} ${c.shown}/3`, tell: c.tell ? t('tell') : '' }));
    }

    function render(status) {
      const left = Math.max(0, P.time - time);
      readout.set('time', `${U().decimal(left, 1)} s`, !sealed && left < 10 ? 'danger' : '');
      readout.set('tubes', t('tubesRead', { used: picked.length, tubes: L.tubes }), picked.length === L.tubes ? 'good' : '');
      readout.set('note', t('coresRead', { n: L.cores.length }));
      notes.textContent = t('notes');
      list.setAttribute('aria-label', t('listAria'));
      L.cores.forEach((c, i) => cardContent(c, i));
      seal.disabled = !host.active || sealed;
      seal.classList.toggle('is-ready', picked.length === L.tubes && !sealed);
      seal.textContent = sealed ? t('sealedBtn') : picked.length ? t('sealBtn', { n: picked.length, tubes: L.tubes }) : t('pickBtn', { tubes: L.tubes });
      if (status) host.status(status);
    }

    function sealTubes(auto) {
      if (sealed || !host.active) return;
      if (!picked.length) { if (!auto) render(t('statusNone')); return; }
      sealed = true;
      const value = picked.reduce((s, i) => s + L.cores[i].value, 0);
      const hits = picked.filter(i => top.has(i)).length;
      const ratio = value / best;
      const bestPick = picked.reduce((a, i) => (L.cores[i].value > L.cores[a].value ? i : a), picked[0]);
      const fooled = picked.filter(i => L.cores[i].decoy).length;
      const lead = auto ? `${t('statusAuto')} ` : '';
      render(lead + t('statusReveal', { value, best, hits, tubes: L.tubes, name: L.cores[bestPick].name, v: L.cores[bestPick].value })
        + (fooled ? ` ${t('statusFooled', { n: fooled })}` : ''));
      const stars = MG.lib.starsFrom(ratio, P.stars);
      const metrics = { value, best, ratio, hits, fooled };
      if (!stars) host.fail(t('failOrdinary', { value, best }));
      else host.finish({ stars, summary: t('summary', { value, best, hits, tubes: L.tubes }), metrics });
      render();
    }
    seal.addEventListener('click', () => sealTubes(false));

    host.onKey((e, down) => {
      if (sealed) return false;
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
      if (digit) {
        const n = Number(digit[2]) || 10;
        if (n > L.cores.length) return false;
        if (down && !e.repeat) toggle(n - 1);
        return true;
      }
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.code];
      if (step) {
        if (down) {
          const at = cards.indexOf(document.activeElement);
          const next = at < 0 ? 0 : Math.min(cards.length - 1, Math.max(0, at + step));
          cards[next].focus();
          cards[next].scrollIntoView?.({ block: 'nearest' });
        }
        return true;
      }
      return false;
    });

    host.loop(dt => {
      if (sealed) return;
      time += dt;
      if (time >= P.time) {
        time = P.time;
        if (picked.length) { sealTubes(true); return; }
        host.fail(t('failTimeout'));
        render();
        return;
      }
      const left = P.time - time;
      readout.set('time', `${U().decimal(left, 1)} s`, left < 10 ? 'danger' : '');
    });

    render(t('statusInit', { tubes: L.tubes, n: L.cores.length }));
    return { render: () => render() };
  }

  MG.register('M-S4', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 30, normal: 35, hard: 40 },
    generate, validate, solve, mount,
  });
})();
