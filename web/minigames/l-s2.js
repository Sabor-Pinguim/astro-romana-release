// L-S2 · Drilling (Lucas / Curiosity drill + InSight HP3) · timing (rhythm). Plan: docs/experiments-implementation.md §5.3.
// The percussion drill strokes at a steady beat; each stroke the blow force climbs. Lucas pushes the bit when the
// force is in the green band: too little does not advance, too much (late, or a second push in the same stroke)
// stresses the bit until it breaks. Each rock layer has its own beat. On loose soil the bit bounces with no
// friction, like InSight's mole, until Lucas presses down with the arm, which changes the rhythm again.
// Real numbers (references/experiments/mars-experiments.md GE6; experiments.md G9): Curiosity drills holes 1.6 cm wide
// and up to 5 cm deep and carries 2 spare bits; InSight's mole was defeated by soil with no friction. Each run draws
// the layers (rock, thickness, beat, band) and where the loose soil sits.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { clamp, starsFrom } = MG.lib;

  const SPARES = 2; // real (GE6): Curiosity carries 2 spare bits
  const HOLE_MM = 16; // real (GE6): holes 1.6 cm wide
  // game-balance: advance per good blow (mm), beat factor and band factor of each rock.
  const ROCKS = {
    crust: { adv: 2.6, tempo: 0.9, win: 1.1 },
    sandstone: { adv: 2.1, tempo: 1, win: 1 },
    mudstone: { adv: 1.8, tempo: 1.08, win: 0.95 },
    bedrock: { adv: 1.4, tempo: 1.18, win: 0.85 },
  };
  const LOOSE = { adv: 1.6, armTempo: 1.35 }; // game-balance: loose soil with the arm pressing down
  const SWAP_S = 1.6; // game-balance: seconds to fit a spare bit

  // game-balance (plan §5.3) except goal: depth in mm (real maximum 50 mm, GE6); period: seconds per stroke;
  // window: width of the green band (share of the stroke); damage: bit stress per overload; slack: strokes allowed
  // over the best possible count; stars: efficiency (best strokes / strokes used) for 1, 2 and 3 stars.
  const LEVELS = {
    easy: { goal: 30, layers: 2, period: 1.15, window: 0.24, damage: 0.34, slack: 2, mods: 0, stars: [0, 0.5, 0.75] },
    normal: { goal: 40, layers: 3, period: 1, window: 0.17, damage: 0.5, slack: 1.7, mods: 1, stars: [0, 0.5, 0.75] },
    hard: { goal: 50, layers: [3, 4], period: 0.88, window: 0.13, damage: 0.5, slack: 1.5, mods: [1, 2], stars: [0, 0.5, 0.72] },
  };
  // Modifiers with a real basis:
  //   looseSoil  InSight's HP3 mole met soil that gave it no friction and stalled; the team pressed on it with the
  //              robotic arm (G9; docs/minigames.md) → a loose layer where blows bounce until the arm presses down;
  //   usedSpare  Curiosity has only 2 spare bits for all its holes (GE6, 42+ holes so far) → one spare already used.
  const MODS = ['looseSoil', 'usedSpare'];

  const r3 = x => Math.round(x * 1000) / 1000;
  const half = x => Math.round(x * 2) / 2;
  const layerAt = (L, mm) => L.layers.find(l => mm < l.bottom - 1e-9) || L.layers[L.layers.length - 1];

  // Fewest strokes that reach the goal: one good blow per stroke, arm pressing on loose soil.
  function bestStrokes(L) {
    let depth = 0, n = 0;
    while (depth < L.goal - 1e-9 && n < 1000) { const l = layerAt(L, depth); depth += l.loose ? l.armAdv : l.adv; n++; }
    return n;
  }

  function generate(R, P, { mods }) {
    const n = R.span(P.layers);
    const kinds = ['crust', ...R.sample(['sandstone', 'mudstone', 'bedrock'], n - 1)];
    const weights = kinds.map((_, i) => (i === 0 ? R.float(0.45, 0.75) : R.float(0.8, 1.4)));
    const sum = weights.reduce((s, x) => s + x, 0);
    let top = 0;
    const layers = kinds.map((kind, i) => {
      const bottom = i === n - 1 ? P.goal : Math.max(top + 5, half(top + (P.goal * weights[i]) / sum));
      const rock = ROCKS[kind], win = r3(P.window * rock.win);
      const layer = { kind, top, bottom, adv: rock.adv, period: r3(P.period * rock.tempo * R.float(0.93, 1.07)), mid: r3(R.float(Math.max(0.55, 0.32 + win / 2), 0.86 - win / 2)), win };
      top = bottom;
      return layer;
    });
    if (mods.includes('looseSoil')) {
      const l = layers[R.int(1, n - 1)];
      Object.assign(l, { kind: 'loose', loose: true, adv: 0, armAdv: LOOSE.adv, armPeriod: r3(l.period * LOOSE.armTempo), armMid: r3(R.float(0.48, 0.68)) });
    }
    const L = { goal: P.goal, layers, spares: SPARES - (mods.includes('usedSpare') ? 1 : 0) };
    L.budget = Math.ceil(bestStrokes(L) * P.slack);
    return L;
  }

  // Layers stack without gaps down to the goal, each one thick enough to feel, and every band fits in the stroke.
  const validate = (L, P) => L.layers.length >= 2 && L.layers[L.layers.length - 1].bottom === P.goal
    && L.layers.every((l, i) => l.bottom - l.top >= 4 && (i === 0 || l.top === L.layers[i - 1].bottom)
      && l.mid - l.win / 2 >= 0.3 && l.mid + l.win / 2 <= 0.93 && (!l.loose || (l.armMid - l.win / 2 >= 0.3 && l.armMid + l.win / 2 <= 0.93)));
  const solve = L => ({ strokes: bestStrokes(L) });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const len = mm => (U().system === 'imperial' ? `${U().decimal(mm / 25.4, 2)} in` : `${U().decimal(mm / 10, 1)} cm`);
    const best = bestStrokes(L);
    const pace = host.reduced ? 1.2 : 1; // reduced motion: a slower beat
    let depth = 0, phase = 0, stroke = 0, used = 0, tapped = null, stress = 0, spares = L.spares, broken = 0;
    let swap = 0, arm = false, misses = 0, ended = false;
    const history = []; // last results for the rhythm strip
    let layer = layerAt(L, 0);

    const css = getComputedStyle(document.documentElement);
    const v = (name, fb) => css.getPropertyValue(name).trim() || fb;
    const C = {
      space: v('--bg-viewport', '#17183B'), void: v('--bg-void', '#11071F'), cream: v('--starlight-cream', '#FCE8A6'), amber: v('--solar-amber', '#F59E0B'),
      safe: v('--safe', '#7EDAC2'), crimson: v('--crimson-alert', '#8F241E'), coral: v('--coral-hover', '#EE7B57'), muted: v('--muted', '#B9B0CE'),
      indigo: v('--bg-indigo', '#281147'), f3: v('--f3', '#24143a'), cold: '#95B8F6', coldBg: '#2b2752', goodBg: '#1e6357',
    };
    // Rock colours from the shared "gale" and "rock" ramps (web/app.js RAMPS): [base, facet].
    const ROCK_C = { crust: ['#c27a3a', '#9c5129'], sandstone: ['#9c5129', '#6e3324'], mudstone: ['#6e3324', '#3f1d24'], bedrock: ['#4d3d4c', '#33263a'], loose: ['#e0a35a', '#c27a3a'] };

    const badge = ui.el('div', 'mg-badge');
    const readout = ui.readout(['depth', 'bit', 'spares', 'strokes']);
    const cv = ui.canvas(0.5, 'ls2-canvas');
    const strike = ui.button('', 'primary');
    const armBtn = ui.button('', 'quiet');
    armBtn.classList.add('ls2-arm');
    armBtn.hidden = true;
    const controls = ui.el('div', 'mg-controls');
    controls.append(armBtn, strike);
    host.body.append(badge, readout.node, cv.node, controls);

    strike.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); hit(); } });
    strike.addEventListener('click', e => { if (e.detail === 0) hit(); });
    armBtn.addEventListener('click', () => toggleArm());
    cv.node.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); hit(); } });
    host.onKey((e, down) => {
      if (e.code === 'Space') { if (down && !e.repeat) hit(); return true; }
      if (e.code === 'KeyA' || e.code === 'ArrowDown' || e.code === 'KeyS') { if (down && !e.repeat) toggleArm(); return true; }
      return false;
    });

    const period = () => (layer.loose && arm ? layer.armPeriod : layer.period) * pace;
    const band = () => { const mid = layer.loose && arm ? layer.armMid : layer.mid; return [mid - layer.win / 2, mid + layer.win / 2]; };
    const push = r => { history.push(r); if (history.length > 10) history.shift(); };

    function toggleArm() {
      if (!host.active || !layer.loose || swap > 0) return;
      arm = !arm;
      render(t(arm ? 'statusArmOn' : 'statusArmOff'));
    }

    function hit() {
      if (!host.active || swap > 0 || ended) return;
      if (tapped) { overload(t('statusDouble')); return; }
      const [lo, hi] = band();
      if (phase < lo) { tapped = 'weak'; push('weak'); render(t('statusWeak')); return; }
      if (phase > hi) { overload(t('statusLate')); return; }
      if (layer.loose && !arm) { tapped = 'bounce'; push('bounce'); render(t('statusBounce')); return; }
      tapped = 'good'; push('good');
      depth = Math.min(L.goal, depth + (layer.loose ? layer.armAdv : layer.adv));
      if (depth >= L.goal - 1e-9) { done(); return; }
      const next = layerAt(L, depth);
      if (next !== layer) enter(next);
      else render(t('statusGood', { depth: len(depth) }));
    }

    function enter(next) {
      const wasLoose = layer.loose;
      layer = next;
      if (wasLoose && arm) arm = false;
      render(next.loose ? t('event.looseSoil') : t('statusLayer', { rock: t(`rocks.${next.kind}`) }) + (wasLoose ? ` ${t('statusArmBack')}` : ''));
    }

    function overload(msg) {
      tapped = 'over'; push('over');
      stress += P.damage;
      if (stress < 1 - 1e-9) { render(`${msg} ${t('statusStress', { pct: Math.round((1 - stress) * 100) })}`); return; }
      broken++; stress = 0;
      if (spares <= 0) {
        ended = true;
        render();
        host.status('');
        host.fail(t('failBit', { depth: len(depth), goal: len(L.goal) }));
        return;
      }
      spares--; swap = SWAP_S;
      render(t('statusBroken', { left: spares }));
    }

    function done() {
      ended = true;
      used++; // the stroke of the last blow
      const eff = Math.min(1, best / used);
      const stars = Math.max(1, starsFrom(eff, P.stars) - broken);
      render(t('statusDone', { depth: len(L.goal) }));
      host.finish({ stars, summary: t('summary', { pct: Math.round(eff * 100), broken }), metrics: { eff, used, best, broken, misses } });
    }

    host.loop(dt => {
      if (swap > 0) {
        swap -= dt;
        if (swap <= 0) { swap = 0; tapped = null; phase = 0; render(t('statusSwapped')); return; }
        render();
        return;
      }
      phase += dt / period();
      if (phase >= 1) {
        phase -= 1;
        used++; stroke++;
        if (!tapped) { push('miss'); misses++; }
        tapped = null;
        if (used >= L.budget) {
          ended = true;
          render();
          host.status('');
          host.fail(t('failShallow', { depth: len(depth), goal: len(L.goal) }));
          return;
        }
      }
      render();
    });

    function render(status) {
      const [lo, hi] = band();
      const inBand = phase >= lo && phase <= hi;
      let state = 'cold', text = t('badgeBuild');
      if (swap > 0) { state = 'danger'; text = t('badgeSwap'); }
      else if (ended && depth >= L.goal - 1e-9) { state = 'good'; text = t('badgeDone'); }
      else if (layer.loose && !arm) { state = 'warn'; text = t('badgeLoose'); }
      else if (tapped) { state = tapped === 'good' ? 'good' : tapped === 'over' ? 'danger' : 'warn'; text = t(`badge.${tapped}`); }
      else if (inBand) { state = 'good'; text = t('badgeNow'); }
      else if (phase > hi) { state = 'danger'; text = t('badgeLate'); }
      badge.className = `mg-badge is-${state}`;
      badge.textContent = text;
      readout.set('depth', t('depthReadout', { depth: len(depth), goal: len(L.goal) }), depth >= L.goal - 1e-9 ? 'good' : '');
      readout.set('bit', t('bitReadout', { pct: Math.round((1 - stress) * 100) }), stress >= 0.5 ? 'danger' : '');
      readout.set('spares', t('sparesReadout', { left: spares }), spares === 0 ? 'danger' : '');
      readout.set('strokes', t('strokesReadout', { left: Math.max(0, L.budget - used) }), L.budget - used <= 5 ? 'danger' : '');
      strike.textContent = t('strikeBtn');
      strike.disabled = !host.active || swap > 0;
      armBtn.hidden = !layer.loose;
      armBtn.className = `button ${arm ? 'amber' : 'quiet'} ls2-arm`;
      armBtn.textContent = t(arm ? 'armOnBtn' : 'armOffBtn');
      armBtn.setAttribute('aria-pressed', String(arm));
      armBtn.disabled = !host.active;
      Object.assign(cv.node.dataset, { phase: r3(phase), lo: r3(lo), hi: r3(hi), stroke, loose: layer.loose ? 1 : 0, arm: arm ? 1 : 0, swap: swap > 0 ? 1 : 0 });
      draw(lo, hi);
      if (status) host.status(status);
    }

    // Canvas: a cross-section of the ground with the hole and the bit (left) and the stroke gauge (right).
    function draw(lo, hi) {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      const y0 = h * 0.24, px = (h * 0.86 - y0) / L.goal, hx = w * 0.32, hw = Math.max(10, w * 0.034) * (HOLE_MM / 16);
      ctx.fillStyle = C.space; ctx.fillRect(0, 0, w, h);
      // Layers, each a band with a row of facets; below the goal the bedrock continues.
      const bandW = Math.max(18, w * 0.05), sectionW = w * 0.64;
      const drawBand = (yTop, yBot, col) => {
        ctx.fillStyle = col[0]; ctx.fillRect(0, yTop, sectionW, yBot - yTop);
        ctx.fillStyle = col[1];
        for (let x = 0, k = 0; x < sectionW; x += bandW, k++) {
          ctx.beginPath();
          if (k % 2) { ctx.moveTo(x, yTop); ctx.lineTo(x + bandW, yTop); ctx.lineTo(x + bandW / 2, yBot); }
          else { ctx.moveTo(x, yBot); ctx.lineTo(x + bandW, yBot); ctx.lineTo(x + bandW / 2, yTop + (yBot - yTop) * 0.35); }
          ctx.closePath(); ctx.fill();
        }
      };
      for (const l of L.layers) drawBand(y0 + l.top * px, y0 + l.bottom * px, ROCK_C[l.kind]);
      drawBand(y0 + L.goal * px, h, ROCK_C.bedrock);
      // Rock names on the bands that are tall enough to hold them.
      ctx.font = '700 10px "Chakra Petch", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const l of L.layers) {
        const yt = y0 + l.top * px, yb = y0 + l.bottom * px;
        if (yb - yt < 15) continue;
        const name = t(`rocks.${l.kind}`).toUpperCase(), tw = ctx.measureText(name).width;
        ctx.fillStyle = C.void; ctx.fillRect(4, (yt + yb) / 2 - 7, tw + 8, 14);
        ctx.fillStyle = l === layer ? C.cream : C.muted; ctx.fillText(name, 8, (yt + yb) / 2 + 0.5);
      }
      // Goal line and depth ticks every centimetre.
      ctx.fillStyle = C.amber;
      for (let x = 0; x < sectionW; x += 12) ctx.fillRect(x, y0 + L.goal * px - 1, 7, 2);
      ctx.font = '700 10px "Chakra Petch", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(len(L.goal), sectionW - 12, y0 + L.goal * px + 3);
      ctx.fillStyle = C.cream;
      for (let mm = 10; mm < L.goal; mm += 10) ctx.fillRect(sectionW - 8, y0 + mm * px, 8, 1);
      // Hole and bit; the bit taps down with the stroke unless motion is reduced.
      const bottom = y0 + depth * px;
      ctx.fillStyle = C.void; ctx.fillRect(hx - hw / 2, y0, hw, Math.max(0, bottom - y0));
      const kick = host.reduced || swap > 0 ? 0 : Math.max(0, Math.sin(phase * Math.PI)) * 3;
      const tipY = bottom + kick - 1, bitTop = tipY - 22;
      ctx.fillStyle = '#8e7c7c'; ctx.fillRect(hx - 3, y0 - h * 0.1, 6, bitTop - (y0 - h * 0.1));
      ctx.fillStyle = swap > 0 ? C.crimson : '#b3a196';
      ctx.beginPath(); ctx.moveTo(hx - hw / 2 + 2, bitTop); ctx.lineTo(hx + hw / 2 - 2, bitTop); ctx.lineTo(hx + hw / 2 - 2, tipY - 7); ctx.lineTo(hx, tipY); ctx.lineTo(hx - hw / 2 + 2, tipY - 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b5a62'; ctx.beginPath(); ctx.moveTo(hx, bitTop); ctx.lineTo(hx + hw / 2 - 2, bitTop); ctx.lineTo(hx + hw / 2 - 2, tipY - 7); ctx.lineTo(hx, tipY); ctx.closePath(); ctx.fill();
      // Drill turret above the ground, with the arm pressing when it is on.
      const tw = w * 0.11, th = h * 0.12, ty = y0 - h * 0.1 - th;
      ctx.fillStyle = C.indigo; ctx.fillRect(hx - tw / 2, ty, tw, th);
      ctx.fillStyle = '#3a2470'; ctx.beginPath(); ctx.moveTo(hx - tw / 2, ty); ctx.lineTo(hx + tw / 2, ty); ctx.lineTo(hx - tw / 2, ty + th); ctx.closePath(); ctx.fill();
      ctx.fillStyle = arm ? C.amber : C.muted;
      ctx.beginPath(); ctx.moveTo(hx - tw / 2, ty + th * 0.4); ctx.lineTo(w * 0.04, h * 0.02); ctx.lineTo(w * 0.04 + 6, h * 0.02); ctx.lineTo(hx - tw / 2, ty + th * 0.4 + 6); ctx.closePath(); ctx.fill();
      if (arm) {
        ctx.fillStyle = C.amber;
        ctx.beginPath(); ctx.moveTo(hx + tw / 2 + 8, ty + 2); ctx.lineTo(hx + tw / 2 + 20, ty + 2); ctx.lineTo(hx + tw / 2 + 14, ty + th - 2); ctx.closePath(); ctx.fill();
      }
      // Stroke gauge: force climbs from the bottom; weak, green band, too much.
      const gx = w * 0.72, gw = w * 0.13, gt = h * 0.08, gb = h * 0.92, gy = f => gb - f * (gb - gt);
      ctx.fillStyle = C.coldBg; ctx.fillRect(gx, gy(lo), gw, gy(0) - gy(lo));
      ctx.fillStyle = C.goodBg; ctx.fillRect(gx, gy(hi), gw, gy(lo) - gy(hi));
      ctx.fillStyle = C.safe; ctx.fillRect(gx, gy(hi), gw, 2); ctx.fillRect(gx, gy(lo) - 2, gw, 2);
      ctx.fillStyle = C.crimson; ctx.fillRect(gx, gy(1), gw, gy(hi) - gy(1));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 10px "Chakra Petch", sans-serif';
      ctx.fillStyle = C.cold; ctx.fillText(t('gaugeWeak'), gx + gw / 2, (gy(0) + gy(lo)) / 2);
      ctx.fillStyle = C.cream; if (gy(hi) - gy(1) > 14) ctx.fillText(t('gaugeOver'), gx + gw / 2, (gy(1) + gy(hi)) / 2);
      ctx.fillStyle = C.safe; ctx.fillText('✓', gx - 9, (gy(lo) + gy(hi)) / 2);
      const active = swap === 0 && !ended;
      const ny = gy(clamp(phase, 0, 1));
      ctx.fillStyle = !active ? C.muted : tapped ? C.muted : phase >= lo && phase <= hi ? C.safe : phase > hi ? C.coral : C.cream;
      ctx.fillRect(gx - 4, ny - 3, gw + 8, 6);
      // Rhythm strip: the last strokes, newest at the top.
      const RC = { good: C.safe, weak: C.cold, over: C.coral, miss: '#3a2470', bounce: C.amber };
      const sx = gx + gw + 8, sz = Math.max(6, Math.min(10, w * 0.016));
      history.slice().reverse().forEach((r, i) => {
        const cy = gt + 4 + i * (sz + 5);
        ctx.fillStyle = RC[r];
        ctx.beginPath(); ctx.moveTo(sx + sz / 2, cy); ctx.lineTo(sx + sz, cy + sz / 2); ctx.lineTo(sx + sz / 2, cy + sz); ctx.lineTo(sx, cy + sz / 2); ctx.closePath(); ctx.fill();
      });
    }

    render(t('statusInitial', { goal: len(L.goal), spares: L.spares }) + (L.spares < SPARES ? ` ${t('event.usedSpare')}` : ''));
    return { render: () => render() };
  }

  MG.register('L-S2', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 25, normal: 32, hard: 40 },
    factVars: U => ({
      // real (docs/minigames.md, G9): the mole had to reach 3–5 m and stopped at ~37 cm
      need: `${U.number(U.system === 'imperial' ? 3 * 3.2808399 : 3)}–${U.distanceM(5)}`,
      stop: U.system === 'imperial' ? `~${U.number(37 / 2.54)} in` : '~37 cm',
    }),
    generate, validate, solve, mount,
  });
})();
