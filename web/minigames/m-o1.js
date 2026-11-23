// M-O1 · High-resolution photo (Maya / HiRISE on MRO) · timing. Plan: docs/experiments-implementation.md §5.3.
// The surface of Mars scrolls below the orbiter. Maya takes each photo when a target (crater, river delta, dune
// field) crosses the centre of the frame: the closer to the centre, the sharper the image. The recorder holds only
// a few images, and a dust storm can haze part of the pass.
// Real numbers (references/experiments/mars-experiments.md GE7): HiRISE weighs 65 kg, uses 60 W, resolves 30 cm
// and makes images of up to 28 Gb each. Each run draws the targets (kind, order, spacing, place in the frame),
// the ground and, with the modifier, where the dust storm sits.
(() => {
  'use strict';
  const MG = window.ASTRO_MINIGAMES;
  if (!MG) return;
  const { starsFrom } = MG.lib;

  const HIRISE = { kg: 65, watts: 60, gb: 28 }; // real (GE7)
  // game-balance
  const HAZE = 0.55; // share of the image quality left through dust
  const COOLDOWN_S = 0.55; // read-out of the detector between two photos
  const LEAD_S = 2.6; // time before the first target reaches the frame
  const TAIL_S = 1.4; // time after the last target crosses the frame
  const KINDS = ['crater', 'delta', 'dunes'];

  // game-balance (plan §5.3). speed: frame widths per second; tol: half-width of the frame (share of the view)
  // where a photo still holds the target; gap: seconds between targets; spare: extra images the recorder holds;
  // decor: unmarked small features; stars: share of the best total quality of the layout for 1, 2 and 3 stars.
  const LEVELS = {
    easy: { targets: 4, speed: 0.16, tol: 0.075, gap: [2.3, 4], spare: 3, decor: 7, mods: 0, stars: [0.35, 0.6, 0.85] },
    normal: { targets: 5, speed: 0.2, tol: 0.056, gap: [1.8, 3.4], spare: 2, decor: 10, mods: 1, stars: [0.35, 0.6, 0.82] },
    hard: { targets: 6, speed: 0.25, tol: 0.044, gap: [1.3, 2.8], spare: 1, decor: 14, mods: [1, 2], stars: [0.3, 0.55, 0.78] },
  };
  // Modifiers with a real basis:
  //   dustStorm     Mars dust storms can cover the planet; the 2018 one ended Opportunity (mars-experiments.md §1)
  //                 → part of the pass is hazy and photos there lose sharpness;
  //   fullRecorder  each HiRISE image can hold up to 28 Gb (GE7), so the recorder fills fast → one spare image fewer.
  const MODS = ['dustStorm', 'fullRecorder'];

  const r2 = x => Math.round(x * 100) / 100;
  const r3 = x => Math.round(x * 1000) / 1000;

  function generate(R, P, { mods }) {
    const kinds = R.shuffle([...KINDS, ...Array.from({ length: Math.max(0, P.targets - KINDS.length) }, () => R.pick(KINDS))]);
    let at = LEAD_S;
    const targets = kinds.map((kind, i) => {
      if (i) at += R.span(P.gap);
      return { kind, at: r2(at), y: r3(R.float(-0.2, 0.2)), size: r3(R.float(0.85, 1.15)), dust: false };
    });
    const end = r2(at + TAIL_S);
    let dust = null;
    if (mods.includes('dustStorm')) {
      const i = R.int(1, P.targets - 2), j = Math.min(P.targets - 2, i + R.int(0, 1));
      dust = { from: r2(targets[i].at - R.float(0.5, 0.9)), to: r2(targets[j].at + R.float(0.5, 0.9)) };
      targets.forEach(tg => { tg.dust = tg.at >= dust.from && tg.at <= dust.to; });
    }
    const decor = Array.from({ length: P.decor }, () => ({ at: r2(R.float(0.3, end + 2)), y: r3(R.float(-0.42, 0.42)), size: r3(R.float(0.25, 0.5)), kind: R.pick(['pit', 'rock']) }));
    const shots = P.targets + Math.max(0, P.spare - (mods.includes('fullRecorder') ? 1 : 0));
    return { speed: P.speed, tol: P.tol, targets, decor, dust, end, shots };
  }

  // Targets far enough apart for the read-out, the recorder holds them all, and the haze never covers most of them.
  const validate = (L, P) => L.targets.length === P.targets && L.shots >= L.targets.length
    && L.targets.every((tg, i) => !i || tg.at - L.targets[i - 1].at >= COOLDOWN_S + 0.5)
    && L.targets.filter(tg => tg.dust).length <= 2;
  // Best total quality: every target centred; dust caps the ones inside it.
  const solve = L => ({ quality: r3(L.targets.reduce((s, tg) => s + (tg.dust ? HAZE : 1), 0)), targets: L.targets.length });

  function mount(host) {
    const { P, layout: L, ui, t } = host;
    const U = () => host.U;
    const N = L.targets.length, best = solve(L).quality;
    const pace = host.reduced ? 0.8 : 1; // reduced motion: the ground scrolls more slowly
    const res = L.targets.map(() => null); // { q, hazy } | 'missed'
    let time = 0, shots = L.shots, cooldown = 0, flash = 0, wasted = 0, closing = -1, over = false, announced = false;
    const gSeed = host.R.float(0, 1000);

    const css = getComputedStyle(document.documentElement);
    const v = (name, fb) => css.getPropertyValue(name).trim() || fb;
    const C = {
      void: v('--bg-void', '#11071F'), cream: v('--starlight-cream', '#FCE8A6'), amber: v('--solar-amber', '#F59E0B'), safe: v('--safe', '#7EDAC2'),
      crimson: v('--crimson-alert', '#8F241E'), coral: v('--coral-hover', '#EE7B57'), muted: v('--muted', '#B9B0CE'),
    };
    const GALE = ['#24101f', '#3f1d24', '#6e3324', '#9c5129', '#c27a3a', '#e0a35a']; // shared "gale" ramp (web/app.js RAMPS)
    const GROUND = ['#6e3324', '#76382a', '#7f3e2b', '#86432c'];

    const readout = ui.readout(['photos', 'recorder', 'quality']);
    const cv = ui.canvas(0.45, 'mo1-canvas');
    const chips = ui.el('div', 'mo1-shots');
    const shoot = ui.button('', 'primary');
    const controls = ui.el('div', 'mg-controls');
    controls.append(shoot);
    host.body.append(readout.node, cv.node, chips, controls);

    const press = e => { if (e.button === 0) { e.preventDefault(); snap(); } };
    shoot.addEventListener('pointerdown', press);
    shoot.addEventListener('click', e => { if (e.detail === 0) snap(); });
    cv.node.addEventListener('pointerdown', press);
    host.onKey((e, down) => {
      if (e.code !== 'Space') return false;
      if (down && !e.repeat) snap();
      return true;
    });

    const dxOf = tg => (tg.at - time) * L.speed; // offset from the frame centre, in view widths
    const kindName = k => t(`kinds.${k}`);
    function nearest() {
      let idx = -1, dx = Infinity;
      L.targets.forEach((tg, i) => { if (res[i]) return; const d = dxOf(tg); if (Math.abs(d) < Math.abs(dx)) { dx = d; idx = i; } });
      return { idx, dx };
    }

    function snap() {
      if (!host.active || over) return;
      if (cooldown > 0) { render(t('statusReadout')); return; }
      if (shots <= 0) { render(t('statusFull')); return; }
      shots--; cooldown = COOLDOWN_S; flash = host.reduced ? 0 : 0.14;
      const { idx, dx } = nearest();
      if (idx >= 0 && Math.abs(dx) <= L.tol) {
        const tg = L.targets[idx], k = Math.abs(dx) / L.tol;
        const q = (1 - k * k) * (tg.dust ? HAZE : 1);
        res[idx] = { q, hazy: tg.dust };
        const pct = Math.round(q * 100);
        render(tg.dust ? t('statusHazy', { kind: kindName(tg.kind), pct }) : t(q >= 0.9 ? 'statusPerfect' : 'statusShot', { kind: kindName(tg.kind), pct }));
      } else {
        wasted++;
        render(t('statusEmpty', { gb: HIRISE.gb }));
      }
    }

    function end() {
      over = true;
      const got = res.filter(r => r && r !== 'missed');
      const total = got.reduce((s, r) => s + r.q, 0);
      const ratio = best > 0 ? total / best : 0;
      render();
      if (got.length < Math.ceil(N / 2)) {
        host.status('');
        host.fail(t('failBlur', { got: got.length, n: N, gb: HIRISE.gb }));
        return;
      }
      const stars = Math.max(1, starsFrom(ratio, P.stars));
      host.status(t('statusDone', { got: got.length, n: N }));
      host.finish({ stars, summary: t('summary', { got: got.length, n: N, pct: Math.round(ratio * 100), wasted }), metrics: { ratio, got: got.length, wasted } });
    }

    host.loop(dt => {
      time += dt * pace;
      cooldown = Math.max(0, cooldown - dt);
      flash = Math.max(0, flash - dt);
      L.targets.forEach((tg, i) => {
        if (!res[i] && dxOf(tg) < -L.tol - 0.01) { res[i] = 'missed'; render(t('statusMissed', { kind: kindName(tg.kind) })); }
      });
      if (L.dust && time >= L.dust.from - 2.2 && !announced) { announced = true; render(t('event.dustStorm')); }
      if (closing < 0 && res.every(Boolean)) closing = time + 0.6;
      if (time >= L.end || (closing >= 0 && time >= closing)) { end(); return; }
      render();
    });

    function render(status) {
      const got = res.filter(r => r && r !== 'missed');
      const avg = got.length ? got.reduce((s, r) => s + r.q, 0) / got.length : 0;
      readout.set('photos', t('photosReadout', { got: got.length, n: N }), got.length === N ? 'good' : '');
      readout.set('recorder', t('recorderReadout', { left: shots }), shots === 0 ? 'danger' : shots < res.filter(r => !r).length ? 'danger' : '');
      readout.set('quality', t('qualityReadout', { pct: Math.round(avg * 100) }), avg >= 0.85 ? 'good' : '');
      shoot.textContent = cooldown > 0 ? t('readoutBtn') : t('shootBtn');
      shoot.disabled = !host.active || over;
      const { idx, dx } = nearest();
      Object.assign(cv.node.dataset, { dx: idx >= 0 ? r3(dx) : '', next: idx >= 0 ? idx : '', tol: L.tol });
      renderChips();
      draw();
      if (status) host.status(status);
    }

    let chipKey = '';
    function renderChips(force) {
      const key = res.map(r => (!r ? '-' : r === 'missed' ? 'x' : Math.round(r.q * 100))).join();
      if (key === chipKey && !force) return; // rebuild only when a result changes
      chipKey = key;
      chips.replaceChildren(...L.targets.map((tg, i) => {
        const r = res[i];
        const state = !r ? 'is-wait' : r === 'missed' ? 'is-miss' : r.hazy ? 'is-hazy' : 'is-ok';
        const mark = !r ? '◇' : r === 'missed' ? '✕' : `${Math.round(r.q * 100)}%`;
        const chip = ui.el('span', `mo1-chip ${state}`);
        chip.append(ui.el('b', '', mark), document.createTextNode(` ${kindName(tg.kind)}`));
        return chip;
      }));
    }

    // Hash noise for the ground mesh: same seed, same ground on every redraw.
    const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + gSeed) * 43758.5453; return s - Math.floor(s); };

    function draw() {
      cv.fit();
      const { ctx } = cv, w = cv.w, h = cv.h;
      const cam = time * L.speed - 0.5; // ground coordinate (view widths) at the left edge
      const sx = g => (g - cam) * w;
      const colW = 0.09, rows = 4;
      const vx = (i, j) => sx(i * colW + (j > 0 && j < rows ? (hash(i, j) - 0.5) * colW * 0.6 : 0));
      const vy = (i, j) => (j / rows) * h + (j > 0 && j < rows ? (hash(j, i) - 0.5) * (h / rows) * 0.5 : 0);
      const i0 = Math.floor((cam - 0.1) / colW), i1 = Math.ceil((cam + 1.1) / colW);
      for (let i = i0; i < i1; i++) for (let j = 0; j < rows; j++) {
        const a = [vx(i, j), vy(i, j)], b = [vx(i + 1, j), vy(i + 1, j)], c = [vx(i + 1, j + 1), vy(i + 1, j + 1)], d = [vx(i, j + 1), vy(i, j + 1)];
        ctx.fillStyle = GROUND[Math.floor(hash(i + 7, j + 3) * GROUND.length)]; poly(ctx, [a, b, c]);
        ctx.fillStyle = GROUND[Math.floor(hash(i + 11, j + 5) * GROUND.length)]; poly(ctx, [a, c, d]);
      }
      const unit = Math.min(w, h * 2.2) * 0.05;
      for (const d of L.decor) {
        const x = sx(d.at * L.speed), y = h / 2 + d.y * h, s = d.size * unit;
        if (x < -40 || x > w + 40) continue;
        if (d.kind === 'pit') { ctx.fillStyle = GALE[4]; ngon(ctx, x, y, s, 6); ctx.fillStyle = GALE[1]; ngon(ctx, x + s * 0.1, y + s * 0.1, s * 0.7, 6); }
        else { ctx.fillStyle = GALE[4]; poly(ctx, [[x - s * 0.6, y + s * 0.4], [x, y - s * 0.5], [x + s * 0.6, y + s * 0.4]]); ctx.fillStyle = GALE[2]; poly(ctx, [[x, y - s * 0.5], [x + s * 0.6, y + s * 0.4], [x + s * 0.1, y + s * 0.4]]); }
      }
      const seen = L.targets.map(tg => ({ x: sx(tg.at * L.speed), y: h / 2 + tg.y * h, s: tg.size * unit * 1.9 }));
      L.targets.forEach((tg, i) => { const p = seen[i]; if (p.x > -p.s * 3 && p.x < w + p.s * 3) feature(ctx, tg.kind, p.x, p.y, p.s); });
      if (L.dust) { // the storm haze lies on the ground and scrolls with it
        const xa = sx(L.dust.from * L.speed), xb = sx(L.dust.to * L.speed);
        if (xb > 0 && xa < w) {
          ctx.fillStyle = 'rgba(224,163,90,0.42)'; ctx.fillRect(xa, 0, xb - xa, h);
          ctx.save(); ctx.beginPath(); ctx.rect(xa, 0, xb - xa, h); ctx.clip();
          ctx.fillStyle = 'rgba(224,163,90,0.3)';
          for (let x = xa - h; x < xb; x += 16) poly(ctx, [[x, h], [x + 8, h], [x + 8 + h, 0], [x + h, 0]]);
          ctx.restore();
        }
      }
      // Markers above the haze: a chevron and a label on a dark plate.
      ctx.font = '700 10px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      L.targets.forEach((tg, i) => {
        const { x, y, s } = seen[i];
        if (x < -s * 3 || x > w + s * 3) return;
        const r = res[i], my = Math.max(27, y - s * 1.35); // keep the label inside the view
        const label = !r ? kindName(tg.kind).toUpperCase() : r === 'missed' ? '✕' : `✓ ${Math.round(r.q * 100)}%`;
        const lw = ctx.measureText(label).width + 8;
        ctx.fillStyle = C.void; ctx.fillRect(x - lw / 2, my - 25, lw, 14);
        ctx.fillStyle = !r ? C.amber : r === 'missed' ? C.coral : r.hazy ? C.amber : C.safe;
        poly(ctx, [[x - 7, my - 9], [x + 7, my - 9], [x, my]]);
        ctx.fillText(label, x, my - 17.5);
      });
      // Frame: the part of the view where a photo still holds the target, with its centre line.
      const fx = w / 2, fw = L.tol * w, ft = h * 0.08, fb = h * 0.92, arm = Math.min(16, fw * 0.6);
      if (flash > 0) { ctx.fillStyle = 'rgba(252,232,166,0.3)'; ctx.fillRect(fx - fw, ft, fw * 2, fb - ft); }
      ctx.fillStyle = cooldown > 0 ? C.muted : C.cream;
      for (const [x, y, dx, dy] of [[fx - fw, ft, 1, 1], [fx + fw, ft, -1, 1], [fx - fw, fb, 1, -1], [fx + fw, fb, -1, -1]]) {
        ctx.fillRect(dx > 0 ? x : x - 3, dy > 0 ? y : y - arm, 3, arm);
        ctx.fillRect(dx > 0 ? x : x - arm, dy > 0 ? y : y - 3, arm, 3);
      }
      ctx.fillStyle = C.amber;
      for (let y = ft + 6; y < fb - 6; y += 10) ctx.fillRect(fx - 1, y, 2, 5);
      ctx.fillStyle = C.void; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, h - 3, w, 3);
    }

    function feature(ctx, kind, x, y, s) {
      if (kind === 'crater') {
        ctx.fillStyle = GALE[5]; ngon(ctx, x, y, s, 8);
        ctx.fillStyle = GALE[1]; ngon(ctx, x + s * 0.08, y + s * 0.08, s * 0.76, 8);
        ctx.fillStyle = GALE[0]; poly(ctx, [[x + s * 0.08, y + s * 0.08], [x - s * 0.62, y - s * 0.2], [x - s * 0.3, y - s * 0.62]]);
        ctx.fillStyle = GALE[3]; ngon(ctx, x + s * 0.15, y + s * 0.15, s * 0.18, 5);
      } else if (kind === 'delta') {
        ctx.fillStyle = GALE[0]; poly(ctx, [[x - s * 2.2, y - s * 0.55], [x - s * 0.8, y - s * 0.1], [x - s * 0.8, y + s * 0.02], [x - s * 2.2, y - s * 0.42]]);
        const apex = [x - s * 0.85, y - s * 0.05];
        for (let k = 0; k < 5; k++) {
          const a0 = -0.9 + k * 0.36, a1 = a0 + 0.36, rr = s * (1.35 + (k % 2) * 0.2);
          ctx.fillStyle = k % 2 ? GALE[4] : GALE[5];
          poly(ctx, [apex, [apex[0] + rr * Math.cos(a0), apex[1] + rr * Math.sin(a0)], [apex[0] + rr * Math.cos(a1), apex[1] + rr * Math.sin(a1)]]);
        }
        ctx.fillStyle = GALE[1];
        for (const a of [-0.45, 0, 0.45]) poly(ctx, [apex, [apex[0] + s * 1.2 * Math.cos(a - 0.04), apex[1] + s * 1.2 * Math.sin(a - 0.04)], [apex[0] + s * 1.2 * Math.cos(a + 0.04), apex[1] + s * 1.2 * Math.sin(a + 0.04)]]);
      } else {
        for (const [ox, oy] of [[-0.55, -0.45], [0.35, -0.35], [-0.35, 0.4], [0.55, 0.45], [0, 0]]) {
          const cx = x + ox * s, cy = y + oy * s, d = s * 0.42;
          ctx.fillStyle = GALE[5]; poly(ctx, [[cx - d, cy - d * 0.75], [cx + d * 0.15, cy], [cx - d, cy + d * 0.75], [cx - d * 0.55, cy]]);
          ctx.fillStyle = GALE[1]; poly(ctx, [[cx - d * 0.55, cy], [cx + d * 0.15, cy], [cx - d, cy + d * 0.75]]);
        }
      }
    }
    function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath(); ctx.fill(); }
    function ngon(ctx, x, y, r, n) { poly(ctx, Array.from({ length: n }, (_, k) => [x + r * Math.cos((k / n) * Math.PI * 2 + 0.3), y + r * Math.sin((k / n) * Math.PI * 2 + 0.3)])); }

    render(t('statusInitial', { n: N, shots: L.shots, kg: U().massKg(HIRISE.kg), watts: HIRISE.watts, gb: HIRISE.gb }) + (L.shots - N < P.spare ? ` ${t('event.fullRecorder')}` : ''));
    return { render: () => { renderChips(true); render(); } };
  }

  MG.register('M-O1', {
    levels: LEVELS, mods: MODS,
    botSeconds: { easy: 20, normal: 25, hard: 28 },
    factVars: U => ({ detail: U.system === 'imperial' ? `${U.number(30 / 2.54)} in` : '30 cm' }), // real (GE7): 30 cm per pixel
    generate, validate, solve, mount,
  });
})();
