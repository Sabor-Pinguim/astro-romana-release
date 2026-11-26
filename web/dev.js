// Dev Mode launcher (hidden by default; hover Mars on the menu and type 13136767 to unlock):
// lets developers jump directly to any game phase/difficulty/landing site or play any of the 21 experiment minigames individually.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (key, vars) => window.ASTRO_I18N?.t(key, vars) ?? key;

  const dlg = $('dev-dialog');
  const expDlg = $('dev-exp-dialog');
  const devBtn = $('dev-button');
  if (!dlg || !expDlg) return;

  const UNLOCK_KEY = 'astro-romana-dev-unlocked';
  const SECRET_CODE = '13136767';
  const EXP = window.ASTRO_EXPERIMENTS;
  const MG = window.ASTRO_MINIGAMES;
  const RUN = window.ASTRO_RUN;

  let memUnlocked = false;
  function isUnlocked() {
    try {
      return localStorage.getItem(UNLOCK_KEY) === '1';
    } catch {
      return memUnlocked;
    }
  }

  function setUnlocked(val) {
    memUnlocked = Boolean(val);
    try {
      if (val) localStorage.setItem(UNLOCK_KEY, '1');
      else localStorage.removeItem(UNLOCK_KEY);
    } catch {
      /* ignore storage errors */
    }
    if (devBtn) devBtn.hidden = !val;
  }

  setUnlocked(isUnlocked());

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
    if (target.startsWith('orbital-')) {
      window.ASTRO_SIM?.previewOrbital(target.slice('orbital-'.length));
      return;
    }
    if (target === 'cockpit-orbit') {
      ast.jumpMarsOrbit?.(Number(devState.seed));
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
  $('dev-hide-btn')?.addEventListener('click', () => {
    setUnlocked(false);
    close();
  });
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

  let lastPointer = { x: -1, y: -1 };
  let codeBuf = '';
  let codeTimer = null;
  let eggPlaying = false;

  addEventListener('pointermove', e => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
  }, { passive: true });

  function isPointerOverMars() {
    if (window.ASTRO_MENU_MARS) return window.ASTRO_MENU_MARS.isHovered();
    const marsEl = document.querySelector('#menu .mars');
    if (!marsEl || lastPointer.x < 0) return false;
    const r = marsEl.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return Math.hypot(lastPointer.x - cx, lastPointer.y - cy) <= Math.min(r.width, r.height) * .36;
  }

  function getTargetRect() {
    if (!devBtn) return { left: window.innerWidth * .18, top: window.innerHeight * .7, width: 180, height: 36 };
    const wasHidden = devBtn.hidden;
    const prevVis = devBtn.style.visibility;
    if (wasHidden) {
      devBtn.style.visibility = 'hidden';
      devBtn.hidden = false;
    }
    const rect = devBtn.getBoundingClientRect();
    if (wasHidden) {
      devBtn.hidden = true;
      devBtn.style.visibility = prevVis;
    }
    return rect;
  }

  function spawnImpactExplosion(rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const layer = document.createElement('div');
    layer.className = 'sabobor-impact-layer';
    layer.setAttribute('aria-hidden', 'true');

    const wave = document.createElement('div');
    wave.className = 'sabobor-shockwave';
    wave.style.left = `${cx}px`;
    wave.style.top = `${cy}px`;
    layer.appendChild(wave);

    const emojis = ['🔥', '💥', '🐧', '✨', '⚡', '🔥', '💥'];
    const total = 32;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2 + (Math.random() - .5) * .35;
      const dist = 65 + Math.random() * 190;
      const node = document.createElement('span');
      const isEmoji = i % 2 === 0;
      node.className = isEmoji ? 'sabobor-emoji' : 'sabobor-spark';
      if (isEmoji) node.textContent = emojis[i % emojis.length];
      node.style.left = `${cx}px`;
      node.style.top = `${cy}px`;
      node.style.setProperty('--tx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      node.style.setProperty('--ty', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      node.style.setProperty('--rot', `${Math.round((Math.random() - .5) * 540)}deg`);
      node.style.setProperty('--dur', `${(.55 + Math.random() * .45).toFixed(2)}s`);
      node.style.setProperty('--delay', `${(Math.random() * .07).toFixed(2)}s`);
      layer.appendChild(node);
    }

    document.body.appendChild(layer);
    const menu = $('menu');
    if (menu) {
      menu.classList.remove('is-shaking');
      void menu.offsetWidth;
      menu.classList.add('is-shaking');
      setTimeout(() => menu.classList.remove('is-shaking'), 300);
    }
    setTimeout(() => layer.remove(), 1200);
  }

  function runEasterEgg() {
    if (eggPlaying) return;
    eggPlaying = true;
    window.ASTRO_OVERDRIVE_MARS?.();
    try {
      const audio = new Audio('assets/audio/sabobor-pinguim.mp3');
      audio.volume = .85;
      audio.play().catch(() => {});
    } catch {
      /* ignore audio errors */
    }

    const onImpact = () => {
      setUnlocked(true);
      const rect = getTargetRect();
      spawnImpactExplosion(rect);
      if (devBtn) {
        devBtn.classList.remove('is-popping');
        void devBtn.offsetWidth;
        devBtn.classList.add('is-popping');
        setTimeout(() => devBtn.classList.remove('is-popping'), 520);
      }
    };
    const onDone = () => { eggPlaying = false; };

    if (window.ASTRO_MENU_MARS?.triggerPenguin) {
      window.ASTRO_MENU_MARS.triggerPenguin({ getTargetRect, onImpact, onDone });
    } else {
      setTimeout(() => { onImpact(); onDone(); }, 250);
    }
  }

  addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;

    if (!e.ctrlKey && !e.altKey && !e.metaKey && /^[0-9]$/.test(e.key)) {
      if ($('menu')?.classList.contains('active') && isPointerOverMars()) {
        codeBuf = (codeBuf + e.key).slice(-SECRET_CODE.length);
        clearTimeout(codeTimer);
        codeTimer = setTimeout(() => { codeBuf = ''; }, 3500);
        if (codeBuf === SECRET_CODE) {
          codeBuf = '';
          clearTimeout(codeTimer);
          runEasterEgg();
        }
        return;
      }
      codeBuf = '';
    }

    if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.code !== 'KeyD') return;
    if (!isUnlocked()) return;
    e.preventDefault();
    if (dlg.open) close();
    else open();
  });

  for (const ev of ['astro:lang', 'astro:settings']) {
    addEventListener(ev, () => { if (dlg.open) renderExperiments(); });
  }

  window.ASTRO_DEV = Object.freeze({
    open,
    close,
    playExperiment,
    jump,
    isUnlocked,
    lock: () => setUnlocked(false),
    triggerEasterEgg: runEasterEgg,
    state: devState,
  });

  const params = new URLSearchParams(location.search);
  if (isUnlocked() && (params.get('dev') === '1' || location.hash === '#dev')) {
    setTimeout(open, 80);
  }
})();
