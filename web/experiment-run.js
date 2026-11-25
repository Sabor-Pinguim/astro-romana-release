// Glue between the game and the experiment minigames (plan: docs/experiments-implementation.md §3–4).
// A run holds the seed, the level, the 8 drawn experiments and their results. This file builds the run, opens a
// minigame inside #minigame-dialog, schedules the bots and turns stars into points. The rules (who may play,
// when a phase ends, syncing a room) stay in web/app.js; this file only offers the pieces.
(() => {
  'use strict';
  const EXP = window.ASTRO_EXPERIMENTS, MG = window.ASTRO_MINIGAMES;
  if (!EXP || !MG) return;
  const t = (key, vars) => window.ASTRO_I18N?.t(key, vars) ?? key;
  // '★ 2/3' for logs and toasts; HTML (dimmed full stars) for the UI: the hollow ☆ looks filled in bold Chakra Petch.
  const stars = (n, of = 3) => `★ ${n}/${of}`;
  const starsHtml = (n, of = 3) => `<span class="mg-stars" role="img" aria-label="${n}/${of}">${'<b>★</b>'.repeat(n)}${'<i>★</i>'.repeat(Math.max(0, of - n))}</span>`;

  // game-balance (plan §4.6): points per star (2 experiments per crew member → up to 6 stars, 150 points, close to
  // the 130–145 a single experiment was worth before the draw) and the score multiplier of each difficulty.
  const STAR_POINTS = 25;
  const SCORE_MULTIPLIER = { easy: 0.75, normal: 1, hard: 1.5 };

  // A new run: decided by the host (or solo) when the mission starts; guests receive it as plain data.
  // Consequences of the rocket design (docs/rocket-consequences.md), kept in the run so a room shares them:
  // maxStars caps every result (no antenna: the data comes home in part); cut drops that many ground experiments,
  // picked by the seed (over budget: the program review). The solar storm adds irradiated later (web/app.js).
  function create({ seed = EXP.random.newSeed(), difficulty = 'normal', maxStars = 3, cut = 0 } = {}) {
    let experiments = EXP.draw(seed);
    const dropped = [];
    if (cut > 0) {
      const rng = EXP.random.rngFor(seed, 'budget-cut');
      for (let i = 0; i < cut; i++) {
        const ground = experiments.filter(id => EXP.byId(id)?.place !== 'orbit');
        if (!ground.length) break;
        const id = ground[Math.floor(rng() * ground.length)];
        dropped.push(id);
        experiments = experiments.filter(x => x !== id);
      }
    }
    return { seed, level: EXP.levelOf(difficulty), experiments, results: {}, attempts: {},
      consequences: { maxStars: Math.max(1, Math.min(3, maxStars)), dropped, irradiated: null } };
  }
  const maxStarsOf = run => run?.consequences?.maxStars ?? 3;
  const ofPlace = (run, place) => (run?.experiments || []).map(EXP.byId).filter(e => e && (place === 'ground' ? e.place !== 'orbit' : e.place === place));
  const ownedBy = (run, crew, place) => ofPlace(run, place).find(e => e.crew === crew) || null;

  // Task objects in the shape the surface code already uses (id, crew and localized getters).
  function task(id) {
    const e = EXP.byId(id);
    return {
      id, crew: e.crew, place: e.place,
      get title() { return t(`experiments.${id}.title`); },
      get minigame() { return t(`experiments.${id}.minigame`); },
      get mechanic() { return t(`experiments.mechanics.${e.mechanic}`); },
      get basis() { return t(`experiments.${id}.basis`); },
      get desc() { return t(`experiments.${id}.desc`); },
      get fact() { return MG.fact(id); },
    };
  }
  const tasks = (run, place) => ofPlace(run, place).map(e => task(e.id));

  function record(run, id, result) {
    if (!run || run.results[id]) return false;
    run.results[id] = { stars: Math.max(0, Math.min(maxStarsOf(run), result.stars | 0)), by: result.by ?? null, bot: !!result.bot };
    return true;
  }

  // Bots (decided 2026-11-23): an AI crew member does its experiment on average, never brilliantly (1–2 stars),
  // after the typical time of that minigame. take() cancels the bot when a human takes over.
  function bots(run, onDone) {
    const timers = new Map();
    let paused = false;
    return {
      start(id, delayS = 0) {
        if (!run || run.results[id] || timers.has(id) || !MG.has(id)) return;
        const plan = MG.botResult(id, run.seed, run.level);
        timers.set(id, { left: plan.seconds + delayS, total: plan.seconds + delayS, stars: plan.stars });
      },
      take(id) { timers.delete(id); },
      has: id => timers.has(id),
      progress: id => { const b = timers.get(id); return b ? 1 - b.left / b.total : null; },
      pause(v) { paused = v; },
      tick(dt) {
        if (paused) return;
        for (const [id, b] of timers) {
          b.left -= dt;
          if (b.left > 0) continue;
          timers.delete(id);
          if (record(run, id, { stars: b.stars, by: 'bot', bot: true })) onDone?.(id, run.results[id]);
        }
      },
      clear() { timers.clear(); },
    };
  }

  // Scoring: stars of each crew member's experiments → points; the multiplier applies to the mission total.
  function crewPoints(run, crew) {
    return (run?.experiments || []).filter(id => EXP.byId(id)?.crew === crew).reduce((s, id) => s + (run.results[id]?.stars || 0) * STAR_POINTS, 0);
  }
  const multiplier = difficulty => SCORE_MULTIPLIER[EXP.levelOf(difficulty)];
  const summary = run => (run?.experiments || []).map(id => ({ id, stars: run.results[id]?.stars ?? 0, bot: !!run.results[id]?.bot, done: !!run.results[id] }));

  // ---------------------------------------------------------------------------
  // Playing one experiment inside #minigame-dialog. Re-opening an experiment that was left unfinished counts as
  // a restart (the star cap goes down), so closing the dialog is never a free retry.
  // els: { dialog, kicker, title, brief, summary, stage } · opts: { run, id, crewName, onFinish(result), onClose }
  // ---------------------------------------------------------------------------
  let current = null;
  function play(els, { run, id, crewName, onFinish, onClose }) {
    close();
    const e = EXP.byId(id), info = task(id);
    run.attempts[id] = (run.attempts[id] || 0) + 1;
    els.kicker.textContent = t('minigames.kicker', { id, name: crewName });
    els.title.textContent = info.title;
    els.brief.textContent = info.desc;
    els.summary.innerHTML = [[t('minigames.summaryMinigame'), info.minigame], [t('minigames.summaryMechanic'), info.mechanic], [t('minigames.summaryBasis'), info.basis]]
      .map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
    els.dialog.dataset.exp = id;
    els.dialog.classList.remove('is-complete');
    const done = els.dialog.querySelector('.minigame-complete');
    const controller = MG.open(id, {
      root: els.stage, seed: run.seed, level: run.level, attempt: run.attempts[id],
      onRestart: attempt => { run.attempts[id] = attempt; },
      onFinish(raw) {
        current = { ...current, finished: true };
        // No antenna on board: the result keeps at most maxStars (the rest of the data never reaches home).
        const cap = maxStarsOf(run), result = raw.stars > cap ? { ...raw, stars: cap } : raw;
        if (done) {
          const set = (sel, text) => { const node = done.querySelector(sel); if (node) node.textContent = text; };
          const starsNode = done.querySelector('[data-stars]');
          if (starsNode) starsNode.innerHTML = starsHtml(result.stars);
          set('[data-line]', raw.stars > cap ? `${raw.summary} · ${t('experiments.common.partialData', { from: stars(raw.stars), to: stars(cap) })}` : raw.summary);
          set('[data-fact]', info.fact);
        }
        els.dialog.classList.add('is-complete');
        onFinish?.(result);
      },
    });
    current = { els, controller, finished: false, onClose, id, mechanic: e.mechanic };
    if (!els.dialog.open) els.dialog.showModal();
    return controller;
  }
  function close() {
    if (!current) return;
    const c = current;
    current = null;
    c.controller.stop();
    c.els.stage.replaceChildren();
    c.onClose?.(c.finished);
  }

  // The completion card inside the dialog (stars, the result line and the "Real fact").
  function completionCard() {
    const card = document.createElement('div');
    card.className = 'minigame-complete';
    card.setAttribute('role', 'status');
    card.innerHTML = '<span class="minigame-check" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 24 L19 34 L40 12"/></svg></span>'
      + `<strong>${t('minigames.completeBanner')}</strong><span class="minigame-stars" data-stars></span><p class="minigame-line" data-line></p><p class="minigame-fact" data-fact></p>`;
    return card;
  }

  // The game's own #minigame-dialog (surface, Mars orbit, descent). Adds the stage and the completion card the
  // first time, closes by itself a few seconds after the result and stops the minigame when the dialog closes.
  const COMPLETE_DELAY_MS = 3400; // game-balance: time to read the result and the "Real fact"
  let autoClose = 0, dialogWired = false;
  function playInDialog({ run, id, crewName, onFinish, onClose }) {
    const $ = name => document.getElementById(name);
    const dialog = $('minigame-dialog');
    if (!dialog || !run || !MG.has(id)) return null;
    const inner = dialog.querySelector('.dialog-inner'), actions = inner.querySelector('.dialog-actions');
    let stage = $('minigame-stage');
    if (!stage) { stage = document.createElement('div'); stage.id = 'minigame-stage'; inner.insertBefore(stage, actions); }
    if (!inner.querySelector('.minigame-complete')) inner.insertBefore(completionCard(), actions);
    if (!dialogWired) {
      dialogWired = true;
      // The close event arrives a moment after dialog.close(). If another experiment opened the dialog in the
      // meantime (orbit window closing straight into the H-S2 descent), it is not the one to stop: play() already
      // closed the previous minigame.
      dialog.addEventListener('close', () => {
        if (dialog.open) return;
        clearTimeout(autoClose); close(); dialog.classList.remove('is-complete');
      });
    }
    clearTimeout(autoClose);
    return play({ dialog, kicker: $('minigame-kicker'), title: $('minigame-title'), brief: $('minigame-brief'), summary: $('minigame-summary'), stage }, {
      run, id, crewName, onClose,
      onFinish(result) {
        onFinish?.(result);
        autoClose = setTimeout(() => { if (dialog.open) dialog.close(); }, COMPLETE_DELAY_MS);
      },
    });
  }

  window.ASTRO_RUN = Object.freeze({
    STAR_POINTS, SCORE_MULTIPLIER, create, maxStarsOf, ofPlace, ownedBy, task, tasks, record, bots, crewPoints, multiplier, summary,
    play, playInDialog, close, completionCard, stars, starsHtml,
    get playing() { return current?.id ?? null; },
  });
})();
