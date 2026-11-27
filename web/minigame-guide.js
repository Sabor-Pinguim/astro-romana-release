// "How to solve" tutorial popup for all 21 science experiments and 4 cockpit flight stages.
// Auto-opens once per minigame (persisted in localStorage), toggles via "?", and pauses task/mission timers while open.
// Shows the clip recorded from the real game in the player's language, assets/minigames/<lang>/<id>.gif (npm run
// web:clips; English when that language has none), at its own aspect
// ratio; with reduced motion it waits on its first frame behind a play button. Without a clip: an animated SVG of
// the mechanic.
(() => {
  'use strict';

  const STORAGE_KEY = 'astro-romana-minigame-guides-seen';
  const CLIP_LANGS = ['en', 'pt', 'es']; // folders of assets/minigames/
  const COCKPIT_GUIDES = {
    'cockpit-ascent': { fileId: 'cockpit-ascent', key: 'ascent', mechanic: 'piloting' },
    'cockpit-cabin-dock': { fileId: 'cockpit-cabin-dock', key: 'cabinDock', mechanic: 'piloting' },
    'cockpit-orbital-dock': { fileId: 'cockpit-orbital-dock', key: 'orbitalDock', mechanic: 'piloting' },
    'cockpit-landing': { fileId: 'cockpit-landing', key: 'landing', mechanic: 'piloting' },
  };

  const t = (key, vars) => window.ASTRO_I18N?.t(key, vars) ?? key;

  function loadSeen() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter(x => typeof x === 'string')) : new Set();
    } catch {
      return new Set();
    }
  }

  const seenSet = loadSeen();
  function saveSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...seenSet]));
    } catch {
      /* storage blocked or full */
    }
  }

  function resolveGuide(id) {
    if (!id) return null;
    const cock = COCKPIT_GUIDES[id];
    if (cock) {
      return {
        id,
        fileId: cock.fileId,
        mechanic: cock.mechanic,
        title: t(`guide.cockpit.${cock.key}.title`),
        desc: t(`guide.cockpit.${cock.key}.desc`),
        mechLabel: t(`experiments.mechanics.${cock.mechanic}`),
        tip: t(`guide.mechanics.${cock.mechanic}`),
      };
    }
    const exp = window.ASTRO_EXPERIMENTS?.byId(id);
    if (!exp) return null;
    return {
      id,
      fileId: exp.file || String(id).toLowerCase(),
      mechanic: exp.mechanic || 'keep',
      title: t(`experiments.${id}.title`),
      desc: t(`experiments.${id}.desc`),
      mechLabel: t(`experiments.mechanics.${exp.mechanic}`),
      tip: t(`guide.mechanics.${exp.mechanic}`),
    };
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  }

  // Faceted low-poly visual demo matching each mechanic's spatial loop when no GIF/WebP is supplied.
  function buildDemoSvg(mechanic) {
    const svg = svgEl('svg', { viewBox: '0 0 220 96', class: 'mg-guide-svg', 'aria-hidden': 'true' });
    svg.append(svgEl('rect', { x: 0, y: 0, width: 220, height: 96, fill: '#11071f' }));
    svg.append(svgEl('line', { x1: 12, y1: 16, x2: 208, y2: 16, stroke: '#281147', 'stroke-width': 1 }));
    svg.append(svgEl('line', { x1: 12, y1: 80, x2: 208, y2: 80, stroke: '#281147', 'stroke-width': 1 }));

    if (mechanic === 'keep') {
      svg.append(svgEl('rect', { x: 24, y: 36, width: 172, height: 24, fill: '#281147' }));
      svg.append(svgEl('rect', { x: 82, y: 36, width: 56, height: 24, fill: '#1e6357', stroke: '#7edac2', 'stroke-width': 1.5 }));
      svg.append(svgEl('polygon', { points: '34,48 44,41 44,55', fill: '#f59e0b', class: 'mg-anim-cue' }));
      svg.append(svgEl('polygon', { points: '186,48 176,41 176,55', fill: '#f59e0b', class: 'mg-anim-cue' }));
      svg.append(svgEl('rect', { x: 106, y: 31, width: 8, height: 34, fill: '#fce8a6', class: 'mg-anim-keep-needle' }));
    } else if (mechanic === 'timing') {
      svg.append(svgEl('rect', { x: 24, y: 40, width: 172, height: 18, fill: '#281147' }));
      svg.append(svgEl('rect', { x: 128, y: 40, width: 32, height: 18, fill: '#1e6357', stroke: '#7edac2', 'stroke-width': 1.5 }));
      svg.append(svgEl('rect', { x: 26, y: 34, width: 6, height: 30, fill: '#f59e0b', class: 'mg-anim-timing-bar' }));
      svg.append(svgEl('polygon', { points: '144,24 138,34 150,34', fill: '#7edac2', class: 'mg-anim-pulse' }));
    } else if (mechanic === 'aim') {
      svg.append(svgEl('rect', { x: 34, y: 18, width: 152, height: 60, fill: 'none', stroke: '#3a1a62', 'stroke-width': 1.5 }));
      svg.append(svgEl('line', { x1: 110, y1: 18, x2: 110, y2: 78, stroke: '#3a1a62', 'stroke-width': 1 }));
      svg.append(svgEl('line', { x1: 34, y1: 48, x2: 186, y2: 48, stroke: '#3a1a62', 'stroke-width': 1 }));
      svg.append(svgEl('polygon', { points: '110,33 123,48 110,63 97,48', fill: 'none', stroke: '#7edac2', 'stroke-width': 2 }));
      const g = svgEl('g', { class: 'mg-anim-aim-reticle' });
      g.append(
        svgEl('line', { x1: 100, y1: 48, x2: 120, y2: 48, stroke: '#f59e0b', 'stroke-width': 2 }),
        svgEl('line', { x1: 110, y1: 38, x2: 110, y2: 58, stroke: '#f59e0b', 'stroke-width': 2 }),
        svgEl('polygon', { points: '110,41 117,48 110,55 103,48', fill: 'none', stroke: '#fce8a6', 'stroke-width': 1.5 }),
      );
      svg.append(g);
    } else if (mechanic === 'choice') {
      svg.append(svgEl('rect', { x: 26, y: 20, width: 168, height: 10, fill: '#281147' }));
      svg.append(svgEl('rect', { x: 26, y: 20, width: 118, height: 10, fill: '#f59e0b', class: 'mg-anim-choice-bar' }));
      const rows = [
        { y: 38, cls: 'mg-anim-choice-1', on: true },
        { y: 54, cls: 'mg-anim-choice-2', on: false },
        { y: 70, cls: 'mg-anim-choice-3', on: true },
      ];
      rows.forEach(r => {
        svg.append(svgEl('polygon', { points: `26,${r.y} 186,${r.y} 180,${r.y + 11} 26,${r.y + 11}`, fill: '#281147', class: r.cls }));
        svg.append(svgEl('rect', { x: 32, y: r.y + 3, width: r.on ? 78 : 54, height: 5, fill: r.on ? '#7edac2' : '#9b5de5' }));
      });
    } else if (mechanic === 'pattern') {
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          const x = 44 + c * 34;
          const y = 24 + r * 26;
          const hit = (r === 0 && c === 1) || (r === 1 && c === 3);
          svg.append(svgEl('rect', {
            x, y, width: 28, height: 20,
            fill: hit ? '#1e6357' : '#281147',
            stroke: hit ? '#7edac2' : '#3a1a62',
            'stroke-width': hit ? 1.5 : 1,
            class: hit ? 'mg-anim-pattern-hit' : '',
          }));
        }
      }
      svg.append(svgEl('rect', { x: 42, y: 22, width: 32, height: 24, fill: 'none', stroke: '#f59e0b', 'stroke-width': 2, class: 'mg-anim-pattern-scan' }));
    } else if (mechanic === 'route') {
      const cells = [
        [0, 0], [1, 0], [2, 0], [3, 0],
        [0, 1], [1, 1], [2, 1], [3, 1],
      ];
      cells.forEach(([c, r]) => {
        const x = 44 + c * 34;
        const y = 24 + r * 26;
        const hazard = c === 1 && r === 0;
        const goal = c === 3 && r === 1;
        svg.append(svgEl('rect', {
          x, y, width: 28, height: 20,
          fill: hazard ? '#4a1220' : goal ? '#1e6357' : '#281147',
          stroke: hazard ? '#f25c54' : goal ? '#7edac2' : '#3a1a62',
          'stroke-width': 1.2,
        }));
      });
      svg.append(svgEl('polyline', {
        points: '58,34 58,60 126,60 160,60',
        fill: 'none', stroke: '#f59e0b', 'stroke-width': 3, 'stroke-linecap': 'square',
        'stroke-dasharray': '140', class: 'mg-anim-route-path',
      }));
      svg.append(svgEl('polygon', { points: '58,28 64,34 58,40 52,34', fill: '#fce8a6', class: 'mg-anim-route-dot' }));
    } else {
      // piloting
      svg.append(svgEl('rect', { x: 40, y: 18, width: 140, height: 60, fill: '#180c2c', stroke: '#3a1a62', 'stroke-width': 1.5 }));
      svg.append(svgEl('line', { x1: 110, y1: 18, x2: 110, y2: 78, stroke: '#3a1a62', 'stroke-width': 1 }));
      svg.append(svgEl('line', { x1: 40, y1: 48, x2: 180, y2: 48, stroke: '#3a1a62', 'stroke-width': 1 }));
      svg.append(svgEl('rect', { x: 94, y: 34, width: 32, height: 28, fill: '#1e6357', stroke: '#7edac2', 'stroke-width': 1.5 }));
      svg.append(svgEl('polygon', { points: '110,21 105,29 115,29', fill: '#f59e0b', class: 'mg-anim-cue' }));
      svg.append(svgEl('polygon', { points: '110,75 105,67 115,67', fill: '#f59e0b', class: 'mg-anim-cue' }));
      svg.append(svgEl('polygon', { points: '44,48 52,43 52,53', fill: '#f59e0b', class: 'mg-anim-cue' }));
      svg.append(svgEl('polygon', { points: '176,48 168,43 168,53', fill: '#f59e0b', class: 'mg-anim-cue' }));
      svg.append(svgEl('polygon', { points: '110,41 117,48 110,55 103,48', fill: '#fce8a6', class: 'mg-anim-pilot-craft' }));
    }
    return svg;
  }

  const slots = new Map();
  const boundButtons = new WeakMap();
  const AUTO_LOCK_MS = 3000;
  const COLLAPSE_MS = 320;

  function ensureSlot(slot) {
    if (!slots.has(slot)) {
      slots.set(slot, { slot, guideId: null, container: null, button: null, backdrop: null, pop: null, open: false, unlockAt: 0, lockTimer: 0, collapseTimer: 0 });
    }
    return slots.get(slot);
  }

  function syncButton(state) {
    if (!state.button) return;
    state.button.setAttribute('aria-expanded', String(Boolean(state.open)));
    const label = t('guide.btnAria');
    state.button.setAttribute('aria-label', label);
    state.button.title = label;
    state.button.textContent = t('guide.btnLabel');
  }

  function syncDismissHint(state) {
    const r = state.pop?._refs;
    if (!r) return;
    const remMs = Math.max(0, state.unlockAt - performance.now());
    const ready = remMs <= 0;
    state.backdrop?.classList.toggle('is-ready', ready);
    r.dismissHint.classList.toggle('is-ready', ready);
    r.dismissHint.textContent = ready
      ? t('guide.clickOutside')
      : t('guide.clickOutsideWait', { s: Math.ceil(remMs / 1000) });
  }

  function createPopupNode(state) {
    const backdrop = el('div', 'mg-guide-backdrop');
    backdrop.dataset.guideSlot = state.slot;
    backdrop.setAttribute('role', 'presentation');
    backdrop.hidden = true;
    backdrop.addEventListener('click', e => {
      if (e.target !== backdrop) return;
      if (performance.now() < state.unlockAt) return;
      close(state.slot);
    });

    const pop = el('aside', 'mg-guide-pop');
    pop.dataset.guideSlot = state.slot;
    pop.setAttribute('role', 'region');

    const head = el('div', 'mg-guide-head');
    const titleWrap = el('div', 'mg-guide-title-wrap');
    const eyebrow = el('span', 'eyebrow mg-guide-eyebrow');
    const title = el('h4', 'mg-guide-title');
    titleWrap.append(eyebrow, title);

    const actions = el('div', 'mg-guide-head-right');
    const mechBadge = el('span', 'tag mg-guide-mech');
    actions.append(mechBadge);
    head.append(titleWrap, actions);

    const stage = el('div', 'mg-guide-stage');
    const img = el('img', 'mg-guide-media');
    img.hidden = true;
    img.decoding = 'async';
    // Reduced motion: the clip's first frame, still, until the player presses play.
    const still = el('canvas', 'mg-guide-media mg-guide-still');
    still.hidden = true;
    const playBtn = el('button', 'mg-guide-play', '▶');
    playBtn.type = 'button';
    playBtn.hidden = true;
    playBtn.addEventListener('click', () => {
      still.hidden = true; playBtn.hidden = true; img.hidden = false;
      const src = img.src; img.src = ''; img.src = src; // from the first frame
    });
    const anim = el('div', 'mg-guide-anim');
    const previewTag = el('span', 'mg-guide-badge');
    previewTag.hidden = true;
    stage.append(img, still, playBtn, anim, previewTag);

    const desc = el('p', 'mg-guide-desc');
    const tip = el('p', 'mg-guide-tip');

    const foot = el('div', 'mg-guide-foot');
    const dismissHint = el('span', 'mg-guide-dismiss-hint');
    foot.append(dismissHint);

    pop.append(head, stage, desc, tip, foot);
    backdrop.append(pop);
    pop._refs = { eyebrow, title, mechBadge, stage, img, still, playBtn, anim, previewTag, desc, tip, dismissHint };
    state.backdrop = backdrop;
    return pop;
  }

  function renderPopup(state) {
    const data = resolveGuide(state.guideId);
    if (!data || !state.container) return;

    let pop = state.pop;
    if (!pop || state.backdrop?.parentElement !== state.container) {
      const existingBackdrop = state.container.querySelector(`.mg-guide-backdrop[data-guide-slot="${state.slot}"]`);
      if (existingBackdrop) {
        state.backdrop = existingBackdrop;
        pop = existingBackdrop.querySelector('.mg-guide-pop') || createPopupNode(state);
      } else {
        pop = pop || createPopupNode(state);
      }
      state.pop = pop;
      state.container.append(state.backdrop);
    }

    const r = pop._refs;
    // The clip in the player's language (assets/minigames/<lang>/<id>.gif), else the English one.
    const lang = CLIP_LANGS.includes(window.ASTRO_I18N?.language) ? window.ASTRO_I18N.language : 'en';
    const clipKey = `${lang}/${data.fileId}`, prevClipKey = pop.dataset.guideClip;
    pop.dataset.guideId = data.id;
    pop.dataset.guideClip = clipKey;
    pop.dataset.mech = data.mechanic;
    pop.setAttribute('aria-label', `${t('guide.eyebrow')}: ${data.title}`);
    state.backdrop?.setAttribute('aria-label', t('guide.closeAria'));

    r.eyebrow.textContent = t('guide.eyebrow');
    r.title.textContent = data.title;
    r.mechBadge.textContent = data.mechLabel;
    r.previewTag.textContent = t('guide.previewTag');
    r.desc.textContent = data.desc;
    r.tip.textContent = data.tip;
    syncDismissHint(state);

    if (r.anim.dataset.mech !== data.mechanic || !r.anim.firstChild) {
      r.anim.dataset.mech = data.mechanic;
      r.anim.replaceChildren(buildDemoSvg(data.mechanic));
    }

    r.playBtn.setAttribute('aria-label', `${t('menu.play')}: ${t('guide.previewTag')}`);
    r.playBtn.title = r.playBtn.getAttribute('aria-label');
    if (prevClipKey !== clipKey) {
      const targetKey = clipKey;
      const sources = [...new Set([`assets/minigames/${lang}/${data.fileId}.gif`, `assets/minigames/en/${data.fileId}.gif`])];
      let idx = 0;
      const noClip = () => {
        r.img.hidden = true; r.still.hidden = true; r.playBtn.hidden = true;
        r.anim.hidden = false;
        r.previewTag.hidden = true;
        r.stage.classList.remove('has-clip');
      };
      noClip();
      r.img.alt = data.title;
      r.img.onload = () => {
        if (pop.dataset.guideClip !== targetKey || !r.img.naturalWidth) return;
        r.stage.classList.add('has-clip');
        r.stage.style.setProperty('--clip-ratio', String(r.img.naturalWidth / r.img.naturalHeight));
        r.anim.hidden = true;
        r.previewTag.hidden = false;
        if (r.img.dataset.played !== targetKey && matchMedia('(prefers-reduced-motion: reduce)').matches) {
          r.img.dataset.played = targetKey;
          r.still.width = r.img.naturalWidth; r.still.height = r.img.naturalHeight;
          r.still.getContext('2d')?.drawImage(r.img, 0, 0);
          r.img.hidden = true; r.still.hidden = false; r.playBtn.hidden = false;
        } else if (r.still.hidden) r.img.hidden = false;
      };
      r.img.onerror = () => {
        if (pop.dataset.guideClip !== targetKey) return;
        if (++idx < sources.length) r.img.src = sources[idx];
        else noClip();
      };
      r.img.src = sources[0];
    } else {
      r.img.alt = data.title;
    }
  }

  function setOpen(slot, nextOpen, { lockMs = 0, animate = true } = {}) {
    const state = ensureSlot(slot);
    clearInterval(state.lockTimer);
    state.lockTimer = 0;
    if (nextOpen) {
      if (!state.guideId || !state.container || !resolveGuide(state.guideId)) return false;
      clearTimeout(state.collapseTimer);
      state.collapseTimer = 0;
      // Avoid stacking two floating guide cards when opening an experiment dialog during cockpit orbit.
      for (const other of slots.keys()) if (other !== slot) setOpen(other, false, { animate: false });
      state.unlockAt = lockMs > 0 ? performance.now() + lockMs : 0;
      renderPopup(state);
      state.open = true;
      if (state.backdrop) {
        state.backdrop.classList.remove('is-collapsing');
        state.backdrop.hidden = false;
      }
      if (state.pop) {
        state.pop.style.removeProperty('--collapse-x');
        state.pop.style.removeProperty('--collapse-y');
      }
      if (lockMs > 0) {
        state.lockTimer = setInterval(() => {
          syncDismissHint(state);
          if (performance.now() >= state.unlockAt) {
            clearInterval(state.lockTimer);
            state.lockTimer = 0;
          }
        }, 200);
      }
    } else {
      const wasOpen = state.open;
      state.open = false;
      state.unlockAt = 0;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (wasOpen && animate && !reduce && state.backdrop && !state.backdrop.hidden && state.pop) {
        const popRect = state.pop.getBoundingClientRect();
        const btnRect = state.button?.getBoundingClientRect?.();
        if (btnRect && btnRect.width > 0 && popRect.width > 0) {
          const dx = (btnRect.left + btnRect.width / 2) - (popRect.left + popRect.width / 2);
          const dy = (btnRect.top + btnRect.height / 2) - (popRect.top + popRect.height / 2);
          state.pop.style.setProperty('--collapse-x', `${Math.round(dx)}px`);
          state.pop.style.setProperty('--collapse-y', `${Math.round(dy)}px`);
        }
        state.backdrop.classList.add('is-collapsing');
        clearTimeout(state.collapseTimer);
        state.collapseTimer = setTimeout(() => {
          state.collapseTimer = 0;
          if (state.backdrop) {
            state.backdrop.hidden = true;
            state.backdrop.classList.remove('is-collapsing');
          }
          state.pop?.style.removeProperty('--collapse-x');
          state.pop?.style.removeProperty('--collapse-y');
          if (state.button) {
            state.button.classList.remove('mg-guide-btn-pulse');
            void state.button.offsetWidth;
            state.button.classList.add('mg-guide-btn-pulse');
            setTimeout(() => state.button?.classList.remove('mg-guide-btn-pulse'), 520);
          }
        }, COLLAPSE_MS);
      } else if (state.backdrop) {
        clearTimeout(state.collapseTimer);
        state.collapseTimer = 0;
        state.backdrop.classList.remove('is-collapsing');
        state.backdrop.hidden = true;
      }
    }
    syncButton(state);
    return state.open;
  }

  function bindButton(button, slot) {
    if (!button) return;
    const prev = boundButtons.get(button);
    boundButtons.set(button, slot);
    if (prev !== undefined) return;
    button.addEventListener('click', () => {
      const targetSlot = boundButtons.get(button);
      if (targetSlot) toggle(targetSlot);
    });
  }

  function onEnter(id, { slot = 'dialog', container, button } = {}) {
    const state = ensureSlot(slot);
    state.guideId = id || null;
    if (container) state.container = container;
    if (button) {
      state.button = button;
      bindButton(button, slot);
    }
    setOpen(slot, false, { animate: false });
    if (!id || !resolveGuide(id)) {
      syncButton(state);
      return false;
    }
    const firstTime = !seenSet.has(id);
    if (firstTime) {
      seenSet.add(id);
      saveSeen();
      setOpen(slot, true, { lockMs: AUTO_LOCK_MS });
    } else {
      syncButton(state);
    }
    return firstTime;
  }

  function open(id, opts = {}) {
    const slot = opts.slot || 'dialog';
    const state = ensureSlot(slot);
    if (id) state.guideId = id;
    if (opts.container) state.container = opts.container;
    if (opts.button) {
      state.button = opts.button;
      bindButton(opts.button, slot);
    }
    if (state.guideId) {
      seenSet.add(state.guideId);
      saveSeen();
    }
    return setOpen(slot, true);
  }

  function close(slot = null) {
    if (slot) {
      setOpen(slot, false);
      return;
    }
    for (const key of slots.keys()) setOpen(key, false);
  }

  function toggle(slot = 'dialog') {
    const state = ensureSlot(slot);
    return setOpen(slot, !state.open);
  }

  function isOpen(slot = null) {
    if (slot) return Boolean(slots.get(slot)?.open);
    for (const s of slots.values()) if (s.open) return true;
    return false;
  }

  function currentId(slot = 'dialog') {
    return slots.get(slot)?.guideId || null;
  }

  function resetSeen() {
    seenSet.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // Escape closes an open guide popup first without bubbling to native <dialog> close.
  window.addEventListener('keydown', e => {
    if (e.code !== 'Escape' || !isOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const s of slots.values()) {
      if (s.open && (reduce || performance.now() >= s.unlockAt)) close(s.slot);
    }
  }, true);

  document.addEventListener('cancel', e => {
    if (e.target?.tagName === 'DIALOG' && isOpen('dialog')) {
      e.preventDefault();
      close('dialog');
    }
  }, true);

  window.addEventListener('astro:lang', () => {
    for (const state of slots.values()) {
      syncButton(state);
      if (state.open) renderPopup(state);
    }
  });

  window.ASTRO_MINIGAME_GUIDE = Object.freeze({
    onEnter,
    open,
    close,
    toggle,
    isOpen,
    currentId,
    resetSeen,
    seen: () => [...seenSet],
  });
})();
