// Dev Mode launcher (Shift+D, Menu "Dev Mode", or ?dev=1 / #dev): lets developers jump directly to any
// game phase/difficulty/landing site or play any of the 21 experiment minigames individually via ASTRO_RUN.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (key, vars) => window.ASTRO_I18N?.t(key, vars) ?? key;

  const dlg = $('dev-dialog');
  const expDlg = $('dev-exp-dialog');
  if (!dlg || !expDlg) return;

  const EXP = window.ASTRO_EXPERIMENTS;
  const MG = window.ASTRO_MINIGAMES;
  const RUN = window.ASTRO_RUN;

  const devState = {
    difficulty: window.ASTRO?.state?.difficulty || 'normal',
    site: window.ASTRO?.state?.site || 'jezero',
    seed: EXP ? EXP.random.newSeed() : 1234,
    crew: 'all',
    place: 'all',
    lastExp: null,
  };

  function syncControlsFromGame() {
    const ast = window.ASTRO;
    if (ast?.state) {
      devState.difficulty = ast.state.difficulty || devState.difficulty;
      devState.site = ast.state.site || devState.site;
    }
    const diffEl = $('dev-difficulty');
    const siteEl = $('dev-site');
    const seedEl = $('dev-seed');
    if (diffEl) diffEl.value = devState.difficulty;
    if (siteEl) siteEl.value = devState.site;
    if (seedEl) seedEl.value = String(devState.seed);
  }

  function applySettingsToGame() {
    const ast = window.ASTRO;
    if (!ast) return;
    if (typeof ast.setDifficulty === 'function') ast.setDifficulty(devState.difficulty);
    if (typeof ast.selectSite === 'function') ast.selectSite(devState.site, false);
  }

  function crewMeta(id) {
    return (window.ASTRO?.crew || []).find(c => c.id === id) || { id, name: id, color: 'var(--amethyst)' };
  }

  function renderExperiments() {
    const grid = $('dev-exp-grid');
    if (!grid || !EXP) return;
    const items = EXP.list.filter(e => (devState.crew === 'all' || e.crew === devState.crew) && (devState.place === 'all' || e.place === devState.place));
    grid.innerHTML = items.map(e => {
      const member = crewMeta(e.crew);
      const built = MG?.has(e.id);
      const title = t(`experiments.${e.id}.title`);
      const placeLabel = t(`experiments.places.${e.place}`);
      const mechLabel = t(`experiments.mechanics.${e.mechanic}`);
      return `<button type="button" class="dev-exp-card" data-dev-exp="${e.id}" style="--crew:${member.color}" ${built ? '' : 'disabled'}>
        <span class="dev-exp-head"><strong>${e.id}</strong><span class="dev-exp-crew">${member.name}</span></span>
        <span class="dev-exp-title">${title}</span>
        <span class="dev-exp-meta"><span class="tag">${placeLabel}</span><span class="tag">${mechLabel}</span></span>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-dev-exp]').forEach(btn => {
      btn.addEventListener('click', () => playExperiment(btn.dataset.devExp));
    });
  }

  function ensureCompletionCard() {
    const inner = expDlg.querySelector('.dialog-inner');
    if (!inner || !RUN) return;
    if (!inner.querySelector('.minigame-complete')) {
      const actions = inner.querySelector('.dev-exp-done-actions');
      inner.insertBefore(RUN.completionCard(), actions || null);
    }
  }

  function playExperiment(id) {
    if (!EXP || !RUN || !MG?.has(id)) return;
    applySettingsToGame();
    devState.lastExp = id;
    const e = EXP.byId(id);
    const member = crewMeta(e.crew);
    const run = RUN.create({ seed: devState.seed, difficulty: devState.difficulty });
    run.experiments = [id];
    ensureCompletionCard();
    if (dlg.open) dlg.close();
    RUN.play({
      dialog: expDlg,
      kicker: $('dev-exp-kicker'),
      title: $('dev-exp-title'),
      brief: $('dev-exp-brief'),
      summary: $('dev-exp-summary'),
      stage: $('dev-exp-stage'),
    }, {
      run,
      id,
      crewName: member.name,
    });
  }

  function jump(target) {
    const ast = window.ASTRO;
    if (!ast) return;
    applySettingsToGame();
    const legacyDlg = $('minigame-dialog');
    if (legacyDlg?.open) legacyDlg.close();
    if (expDlg.open) expDlg.close();
    if (dlg.open) dlg.close();

    if (target.startsWith('lobby-')) {
      const step = target.slice(6);
      ast.showScreen('lobby');
      ast.setLobbyStep?.(step);
      return;
    }
    if (target === 'planner') {
      ast.showScreen('planner');
      return;
    }
    if (target === 'launchpad') {
      const p = ast.launchPad?.();
      if (p && typeof p.then === 'function') p.then(() => ast.jumpCockpit?.(0));
      else ast.jumpCockpit?.(0);
      return;
    }
    if (target.startsWith('cockpit-')) {
      const step = Number(target.slice(8)) || 0;
      ast.jumpCockpit?.(step);
      return;
    }
    if (target === 'surface') {
      ast.land?.();
      return;
    }
    if (target === 'results') {
      ast.jumpResults?.();
    }
  }

  function open() {
    syncControlsFromGame();
    renderExperiments();
    if (!dlg.open) dlg.showModal();
  }

  function close() {
    if (dlg.open) dlg.close();
  }

  $('dev-button')?.addEventListener('click', open);
  $('dev-close')?.addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  $('dev-difficulty')?.addEventListener('change', e => {
    devState.difficulty = e.target.value;
    applySettingsToGame();
  });
  $('dev-site')?.addEventListener('change', e => {
    devState.site = e.target.value;
    applySettingsToGame();
  });
  $('dev-seed')?.addEventListener('change', e => {
    devState.seed = Math.max(0, Math.floor(+e.target.value || 0));
    e.target.value = String(devState.seed);
  });
  $('dev-seed-random')?.addEventListener('click', () => {
    devState.seed = EXP ? EXP.random.newSeed() : Math.floor(Math.random() * 1e6);
    const seedEl = $('dev-seed');
    if (seedEl) seedEl.value = String(devState.seed);
  });

  $('dev-filter-crew')?.addEventListener('change', e => {
    devState.crew = e.target.value;
    renderExperiments();
  });
  $('dev-filter-place')?.addEventListener('change', e => {
    devState.place = e.target.value;
    renderExperiments();
  });

  dlg.querySelectorAll('[data-dev-jump]').forEach(btn => {
    btn.addEventListener('click', () => jump(btn.dataset.devJump));
  });

  expDlg.addEventListener('close', () => { RUN?.close(); });
  $('dev-exp-close')?.addEventListener('click', () => { if (expDlg.open) expDlg.close(); });
  $('dev-exp-back')?.addEventListener('click', () => {
    if (expDlg.open) expDlg.close();
    open();
  });
  $('dev-exp-replay')?.addEventListener('click', () => {
    if (!devState.lastExp) return;
    devState.seed = EXP ? EXP.random.newSeed() : Math.floor(Math.random() * 1e6);
    const seedEl = $('dev-seed');
    if (seedEl) seedEl.value = String(devState.seed);
    playExperiment(devState.lastExp);
  });

  addEventListener('keydown', e => {
    if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.code !== 'KeyD') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
    e.preventDefault();
    if (dlg.open) close();
    else open();
  });

  for (const ev of ['astro:lang', 'astro:settings']) {
    addEventListener(ev, () => { if (dlg.open) renderExperiments(); });
  }

  window.ASTRO_DEV = Object.freeze({ open, close, playExperiment, jump, state: devState });

  const params = new URLSearchParams(location.search);
  if (params.get('dev') === '1' || location.hash === '#dev') {
    setTimeout(open, 80);
  }
})();
