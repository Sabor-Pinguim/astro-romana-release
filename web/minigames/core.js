// Shared core of the experiment minigames (plan: docs/experiments-implementation.md §4–5).
//
// Each minigame file (web/minigames/<id>.js) calls ASTRO_MINIGAMES.register(id, def) with:
//   levels    { easy, normal, hard }  numbers of each level; every one is game-balance unless its comment
//                                      cites a real source (references/experiments/...).
//   mods      ['key', ...]            optional modifier pool; a level picks `levels.<lv>.mods` of them (count
//                                      or [min, max]). Each one comes from a real case (docs/minigames.md, rule 4).
//   generate(R, P, info) → layout     PURE (no DOM): builds this run's layout from the seeded random helper R,
//                                      the level numbers P and info = { mods, ctx }. Must return plain data.
//   validate(layout, P) → bool        optional: false makes the core generate again (the layout must be solvable).
//   solve(layout, P) → object         optional, pure: the best possible result of this layout, so stars compare
//                                      the player with the optimum of their own layout (§5.1 rule 4).
//   botSeconds { easy, normal, hard } typical time a bot takes to do it (game-balance).
//   mount(host) → { stop?, render? }  builds the UI inside host.body and starts the game. Ends with
//                                      host.finish({ stars, summary }) or host.fail(reason).
//
// Rules shared by all 21 (§5.1): every random choice is seeded; "Restart" keeps the layout; each restart lowers
// the star cap by one (never below 1); the level is the run difficulty. No DOM access at load time: the
// validator loads this file in Node.
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const EXP = root.ASTRO_EXPERIMENTS;
  if (!EXP) throw new Error('web/experiments.js must load before web/minigames/core.js');
  const { rngFor } = EXP.random;
  const defs = new Map();

  // game-balance: bots do their experiments "on average, nothing amazing" (decided 2026-11-23): 1 or 2 stars.
  const BOT = { twoStarChance: 0.5, timeJitter: 0.2, defaultSeconds: 35 };
  const MAX_LAYOUT_TRIES = 60;

  // ---------------------------------------------------------------------------
  // Pure helpers (also used by generators and the validator)
  // ---------------------------------------------------------------------------
  function makeRandom(rng) {
    const R = {
      next: rng,
      float: (a = 0, b = 1) => a + (b - a) * rng(),
      int: (a, b) => a + Math.floor(rng() * (b - a + 1)),
      chance: p => rng() < p,
      pick: list => list[Math.floor(rng() * list.length)],
      shuffle: list => {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      },
      sample: (list, n) => R.shuffle(list).slice(0, Math.max(0, n)),
      // [a, b] → a value in the range (integer when both ends are integers); a number stays as it is.
      span: v => (Array.isArray(v) ? (Number.isInteger(v[0]) && Number.isInteger(v[1]) ? R.int(v[0], v[1]) : R.float(v[0], v[1])) : v),
    };
    return R;
  }

  // Smooth seeded noise in [-amp, amp]: a sum of sines with random phases and slightly random frequencies.
  // speedHz is the base frequency. Used by the "keep in range" drifts so no run repeats the same wave.
  function drift(R, { speedHz = 0.25, amp = 1, octaves = 3 } = {}) {
    const parts = Array.from({ length: octaves }, (_, i) => ({
      f: speedHz * (1 + i * 1.37) * R.float(0.8, 1.25),
      p: R.float(0, Math.PI * 2),
      a: 1 / (i + 1),
    }));
    const norm = parts.reduce((s, x) => s + x.a, 0);
    return t => (amp * parts.reduce((s, x) => s + x.a * Math.sin(2 * Math.PI * x.f * t + x.p), 0)) / norm;
  }

  // 0/1 knapsack, exact: the best total value of items { size, value } within capacity. size is discretised in
  // `step` units (0.1 by default), rounded up, so the answer never overflows the real capacity.
  function knapsack(items, capacity, step = 0.1) {
    const cap = Math.max(0, Math.floor(capacity / step + 1e-9));
    const w = items.map(it => Math.max(0, Math.ceil(it.size / step - 1e-9)));
    const best = new Float64Array(cap + 1);
    const keep = items.map(() => new Uint8Array(cap + 1));
    items.forEach((it, i) => {
      for (let c = cap; c >= w[i]; c--) {
        const v = best[c - w[i]] + it.value;
        if (v > best[c] + 1e-9) { best[c] = v; keep[i][c] = 1; }
      }
    });
    const picks = [];
    for (let i = items.length - 1, c = cap; i >= 0; i--) if (keep[i][c]) { picks.push(i); c -= w[i]; }
    return { value: best[cap], picks: picks.reverse() };
  }

  // Stars from a score and three ascending thresholds: one star per threshold reached.
  const starsFrom = (score, [one, two, three]) => (score >= three ? 3 : score >= two ? 2 : score >= one ? 1 : 0);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;

  const lib = Object.freeze({ makeRandom, drift, knapsack, starsFrom, clamp, lerp });

  // ---------------------------------------------------------------------------
  // Registration, levels, layouts and bots (pure)
  // ---------------------------------------------------------------------------
  function register(id, def) {
    if (!EXP.byId(id)) throw new Error(`Unknown experiment ${id}`);
    for (const lv of EXP.LEVELS) if (!def.levels?.[lv]) throw new Error(`${id}: missing level ${lv}`);
    if (typeof def.generate !== 'function' || typeof def.mount !== 'function') throw new Error(`${id}: generate and mount are required`);
    defs.set(id, Object.freeze({ mods: [], ...def }));
  }

  const params = (id, level) => defs.get(id)?.levels[EXP.levelOf(level)] ?? null;

  function pickMods(def, P, seed, id) {
    if (!def.mods.length || !P.mods) return [];
    const R = makeRandom(rngFor(seed, `${id}:mods`));
    return R.sample(def.mods, Math.min(def.mods.length, R.span(P.mods)));
  }

  // The layout of one experiment in one run: always the same for the same seed and level.
  function layout(id, seed, level, ctx = {}) {
    const def = defs.get(id);
    if (!def) throw new Error(`Minigame ${id} is not registered`);
    const P = params(id, level);
    const mods = pickMods(def, P, seed, id);
    let made = null;
    for (let k = 0; k < MAX_LAYOUT_TRIES; k++) {
      made = def.generate(makeRandom(rngFor(seed, `${id}:layout:${k}`)), P, { mods, ctx });
      if (!def.validate || def.validate(made, P)) return { layout: made, mods, tries: k + 1 };
    }
    return { layout: made, mods, tries: MAX_LAYOUT_TRIES, unsolved: true };
  }

  function botResult(id, seed, level) {
    const def = defs.get(id);
    const R = makeRandom(rngFor(seed, `${id}:bot`));
    const base = def?.botSeconds?.[EXP.levelOf(level)] ?? BOT.defaultSeconds;
    return { stars: R.chance(BOT.twoStarChance) ? 2 : 1, seconds: Math.round(base * R.float(1 - BOT.timeJitter, 1 + BOT.timeJitter)) };
  }

  // Each restart lowers the best possible result by one star, never below 1 (§5.1 rule 2).
  const starCap = attempt => Math.max(1, 3 - Math.max(0, (attempt || 1) - 1));

  // ---------------------------------------------------------------------------
  // DOM helpers (only called while a minigame is mounted)
  // ---------------------------------------------------------------------------
  const t = (key, vars) => root.ASTRO_I18N?.t(key, vars) ?? key;
  const units = () => root.ASTRO_UNITS || {
    number: n => String(Math.round(n)), decimal: (n, d = 1) => Number(n).toFixed(d),
    massGrams: (g, d = 1) => `${Number(g).toFixed(d)} g`, massKg: kg => `${Math.round(kg)} kg`,
    tempC: c => `${Math.round(c)} °C`, tempRangeC: (a, b) => `${a}–${b} °C`,
    distanceM: m => `${Math.round(m)} m`, distanceKm: (km, d = 0) => `${Number(km).toFixed(d)} km`,
    altitudeKm: km => `${Math.round(km)} km`, speedKmh: v => `${Math.round(v)} km/h`, velocityMs: v => `${Math.round(v)} m/s`,
  };
  // Stars: plain text '★ 2/3' for logs and toasts; HTML for the UI, where the missing stars are dimmed full stars
  // (the hollow ☆ glyph looks filled in bold Chakra Petch).
  const starsText = (n, of = 3) => `★ ${n}/${of}`;
  const starsHtml = (n, of = 3) => `<span class="mg-stars" role="img" aria-label="${n}/${of}">${'<b>★</b>'.repeat(n)}${'<i>★</i>'.repeat(Math.max(0, of - n))}</span>`;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  const ui = Object.freeze({
    el,
    button(label, kind = 'quiet', onClick) {
      const b = el('button', `button ${kind}`, label);
      b.type = 'button';
      if (onClick) b.addEventListener('click', onClick);
      return b;
    },
    // A row of live numbers: set(key, text, state) where state is '', 'good', 'warn' or 'danger'.
    readout(keys) {
      const node = el('div', 'mg-readout');
      const cells = Object.fromEntries(keys.map(k => { const s = el('span'); s.dataset.k = k; node.append(s); return [k, s]; }));
      return { node, set(k, text, state = '') { const c = cells[k]; if (!c) return; c.textContent = text; c.className = state ? `is-${state}` : ''; } };
    },
    // A labelled bar: set(fraction 0..1, state).
    meter(label, kind = '') {
      const node = el('div', `mg-meter ${kind}`.trim());
      const lab = el('span', 'mg-meter-label', label), track = el('div', 'mg-track'), fill = el('div', 'mg-fill');
      track.append(fill); node.append(lab, track);
      return {
        node,
        label(text) { lab.textContent = text; },
        set(f, state = '') { fill.style.width = `${(clamp(f, 0, 1) * 100).toFixed(1)}%`; fill.className = state ? `mg-fill is-${state}` : 'mg-fill'; },
      };
    },
    // Hold-to-act button (pointer and touch). onChange(true|false).
    hold(button, onChange) {
      let on = false;
      const set = v => { if (v !== on) { on = v; button.classList.toggle('is-held', v); onChange(v); } };
      button.addEventListener('pointerdown', e => { if (e.button !== 0 || button.disabled) return; set(true); try { button.setPointerCapture(e.pointerId); } catch { /* gone */ } e.preventDefault(); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, () => set(false));
      button.addEventListener('contextmenu', e => e.preventDefault());
      return { get on() { return on; }, release: () => set(false) };
    },
    // A canvas that follows its box size and the device pixel ratio. aspect = height / width, either a number or
    // a function (width, viewport { w, h }) → number, evaluated on every fit, so a phone turned mid-game gets
    // the right shape (e.g. taller on narrow portrait screens, flatter on short landscape ones).
    canvas(aspect = 0.5, cls = '') {
      const node = el('canvas', `mg-canvas ${cls}`.trim());
      const ctx = node.getContext('2d');
      const state = { w: 0, h: 0, dpr: 1 };
      const fit = () => {
        const w = Math.max(1, node.clientWidth || node.parentElement?.clientWidth || 300);
        const k = typeof aspect === 'function' ? aspect(w, { w: root.innerWidth || w, h: root.innerHeight || w }) : aspect;
        const h = Math.max(1, Math.round(w * k));
        const dpr = Math.min(2, root.devicePixelRatio || 1);
        if (w === state.w && h === state.h && dpr === state.dpr) return;
        Object.assign(state, { w, h, dpr });
        node.style.height = `${h}px`;
        node.width = Math.round(w * dpr); node.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      return { node, ctx, fit, get w() { return state.w; }, get h() { return state.h; } };
    },
    starsText,
    starsHtml,
  });

  // ---------------------------------------------------------------------------
  // Mounting
  // ---------------------------------------------------------------------------
  // open(id, { root, seed, level, attempt, ctx, onFinish, onRestart }) → controller { stop, restart, host }
  // onFinish(result): result = { id, level, seed, attempt, stars (capped), rawStars, summary, gaveUp, metrics }.
  function open(id, opts) {
    const def = defs.get(id);
    if (!def) throw new Error(`Minigame ${id} is not registered`);
    const level = EXP.levelOf(opts.level);
    const P = params(id, level);
    const made = layout(id, opts.seed, level, opts.ctx);
    let attempt = Math.max(1, opts.attempt || 1);
    let instance = null, host = null;
    const container = opts.root;

    function mount() {
      container.replaceChildren();
      const cap = starCap(attempt);
      const wrap = el('div', 'mg');
      wrap.dataset.exp = id; wrap.dataset.level = level;
      const head = el('div', 'mg-head');
      const body = el('div', 'mg-body');
      const status = el('p', 'mg-status');
      status.setAttribute('aria-live', 'polite');
      const foot = el('div', 'mg-foot');
      const failBox = el('div', 'mg-fail');
      failBox.hidden = true;
      wrap.append(head, body, status, foot, failBox);
      container.append(wrap);

      const loops = new Set(), timers = new Set(), keyHandlers = [], cleanups = [];
      const reduced = !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      host = {
        id, level, P, seed: opts.seed, attempt, cap, mods: made.mods, layout: made.layout,
        // Runtime randomness (gusts, arrivals...): seeded too, so a restart replays the same events.
        R: makeRandom(rngFor(opts.seed, `${id}:run`)),
        root: wrap, body, ui, lib, reduced, active: true,
        get U() { return units(); },
        t: (key, vars) => t(`experiments.${id}.${key}`, vars),
        tc: (key, vars) => t(`experiments.common.${key}`, vars),
        status(text) { status.textContent = text || ''; },
        loop(fn) {
          let raf = 0, last = 0, elapsed = 0, alive = true;
          const step = now => {
            if (!alive || !host.active) return;
            const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
            last = now; elapsed += dt;
            fn(dt, elapsed);
            if (alive && host.active) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
          const stop = () => { alive = false; cancelAnimationFrame(raf); loops.delete(stop); };
          loops.add(stop);
          return stop;
        },
        after(ms, fn) { const h = setTimeout(() => { timers.delete(h); if (host.active) fn(); }, ms); timers.add(h); return h; },
        // handler(event, down) → true when it used the key (the event then stops here, so the surface walk
        // and other shortcuts do not see it).
        onKey(handler) { keyHandlers.push(handler); },
        onCleanup(fn) { cleanups.push(fn); },
        finish(result) {
          if (!host.active) return;
          const raw = clamp(Math.round(result.stars ?? 0), 0, 3);
          end();
          opts.onFinish?.({ id, level, seed: opts.seed, attempt, stars: Math.min(raw, cap), rawStars: raw, summary: result.summary || '', metrics: result.metrics || {}, gaveUp: false });
        },
        // A failed attempt: show the reason (a real-case consequence) and offer Restart or ending with 0 stars.
        fail(reason) {
          if (!host.active) return;
          host.active = false;
          stopRuntime();
          failBox.replaceChildren(
            el('strong', 'mg-fail-title', host.tc('failTitle')),
            el('p', 'mg-fail-reason', reason || ''),
            Object.assign(el('div', 'mg-fail-actions'), {}),
          );
          const actions = failBox.lastChild;
          actions.append(
            Object.assign(ui.button('', 'primary', restart), { innerHTML: host.tc('restart', { stars: starsHtml(starCap(attempt + 1)) }) }),
            ui.button(host.tc('giveUp'), 'quiet', () => {
              end();
              opts.onFinish?.({ id, level, seed: opts.seed, attempt, stars: 0, rawStars: 0, summary: reason || '', metrics: {}, gaveUp: true });
            }),
          );
          failBox.hidden = false;
          foot.hidden = true;
        },
      };

      function onKey(e) {
        if (!host.active || !keyHandlers.length) return;
        if (e.target?.closest?.('input, textarea, select')) return;
        const down = e.type === 'keydown';
        for (const h of keyHandlers) if (h(e, down)) { e.preventDefault(); e.stopPropagation(); return; }
      }
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('keyup', onKey, true);
      const onLang = () => { labelChrome(); instance?.render?.(); };
      root.addEventListener('astro:lang', onLang);
      root.addEventListener('astro:units', onLang);

      function stopRuntime() {
        loops.forEach(stop => stop()); loops.clear();
        timers.forEach(h => clearTimeout(h)); timers.clear();
      }
      function end() {
        host.active = false;
        stopRuntime();
        restartBtn.disabled = true;
      }
      host.dispose = () => {
        end();
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('keyup', onKey, true);
        root.removeEventListener('astro:lang', onLang);
        root.removeEventListener('astro:units', onLang);
        cleanups.forEach(fn => { try { fn(); } catch { /* best effort */ } });
        instance?.stop?.();
      };

      const restartBtn = ui.button('', 'quiet', restart);
      restartBtn.classList.add('mg-restart');
      foot.append(restartBtn);
      function labelChrome() {
        head.replaceChildren(
          el('span', 'tag mg-level', host.tc(`level.${level}`)),
          Object.assign(el('span', 'tag mg-cap'), { innerHTML: host.tc('cap', { stars: starsHtml(cap) }) }),
          ...made.mods.map(m => el('span', 'tag mg-mod', host.t(`mods.${m}`))),
        );
        restartBtn.innerHTML = host.tc('restart', { stars: starsHtml(starCap(attempt + 1)) });
      }
      labelChrome();
      instance = def.mount(host) || {};
    }

    function restart() {
      host?.dispose();
      attempt += 1;
      opts.onRestart?.(attempt);
      mount();
    }

    mount();
    return {
      get host() { return host; },
      get attempt() { return attempt; },
      layout: made.layout, mods: made.mods,
      restart,
      stop() { host?.dispose(); },
    };
  }

  // The "Real fact" card text. def.factVars(U) fills unit-dependent numbers (km/mi, °C/°F...).
  const fact = id => t(`experiments.${id}.fact`, defs.get(id)?.factVars?.(units()));

  root.ASTRO_MINIGAMES = Object.freeze({
    register, open, layout, params, botResult, starCap, lib, BOT, fact, starsHtml, starsText,
    has: id => defs.has(id),
    def: id => defs.get(id) || null,
    ids: () => [...defs.keys()],
  });
})();
