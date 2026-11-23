// Settings persistence and UI controller for Language, Measurement System, Engineering Hints, and Multiplayer Server.
(() => {
  'use strict';
  const STORAGE_KEY = 'astro-romana-settings';
  function defaultLanguage() {
    return window.ASTRO_I18N?.language || 'en';
  }
  const DEFAULTS = { get language() { return defaultLanguage(); }, unitSystem: 'metric', hints: true, serverUrl: '' };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        language: parsed.language || defaultLanguage(),
        unitSystem: parsed.unitSystem === 'imperial' ? 'imperial' : DEFAULTS.unitSystem,
        hints: typeof parsed.hints === 'boolean' ? parsed.hints : DEFAULTS.hints,
        serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : DEFAULTS.serverUrl,
      };
    } catch {
      return { language: defaultLanguage(), unitSystem: 'metric', hints: true, serverUrl: '' };
    }
  }

  function saveSettings(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode or blocked storage */
    }
  }

  let current = loadSettings();
  const i18n = () => window.ASTRO_I18N;
  const units = () => window.ASTRO_UNITS;
  const net = () => window.ASTRO_NET;
  const t = (key, opts) => (i18n() ? i18n().t(key, opts) : key);
  const showToast = msg => window.ASTRO?.toast?.(msg);

  function emitChange() {
    window.dispatchEvent(new CustomEvent('astro:settings', { detail: { ...current } }));
  }

  // Geometric SVG flags (no emoji) for the quick menu switcher and settings.
  const LANG_FLAGS = {
    en: `<svg class="lang-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#D7263D"/><rect y="2.3" width="24" height="2.3" fill="#FFFFFF"/><rect y="6.9" width="24" height="2.3" fill="#FFFFFF"/><rect y="11.5" width="24" height="2.3" fill="#FFFFFF"/><rect width="10.5" height="9.2" fill="#1D3A8A"/><polygon points="5.2,1.8 6.4,4.6 5.2,7.4 4,4.6" fill="#FFFFFF"/></svg>`,
    pt: `<svg class="lang-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#1E8E4A"/><polygon points="12,1.8 21.5,8 12,14.2 2.5,8" fill="#F5C518"/><polygon points="12,4.4 15.6,8 12,11.6 8.4,8" fill="#1D3A8A"/><polygon points="9.2,7.3 14.8,8.1 14.5,9.1 8.9,8.3" fill="#FFFFFF"/></svg>`,
    es: `<svg class="lang-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#C60B1E"/><rect y="4" width="24" height="8" fill="#FFC400"/><polygon points="6.5,5.6 9.5,5.6 9.5,10.2 8,11.2 6.5,10.2" fill="#C60B1E"/></svg>`,
  };
  const LANG_SHORT = { en: 'EN', pt: 'PT-BR', es: 'ES' };

  function renderLanguageButtons() {
    const container = document.getElementById('settings-lang');
    if (container && i18n()) {
      const langs = i18n().languages;
      container.innerHTML = langs.map(lang =>
        `<button type="button" data-lang="${lang.code}" aria-pressed="${lang.code === current.language}">${LANG_FLAGS[lang.code] || ''}<span>${lang.name}</span></button>`
      ).join('');
      container.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
      });
    }
    const menuBar = document.getElementById('menu-lang-bar');
    if (menuBar && i18n()) {
      const langs = i18n().languages;
      menuBar.innerHTML = langs.map(lang =>
        `<button type="button" class="menu-lang-btn" data-lang="${lang.code}" aria-pressed="${lang.code === current.language}" title="${lang.name}" aria-label="${lang.name}">${LANG_FLAGS[lang.code] || ''}<span>${LANG_SHORT[lang.code] || lang.code.toUpperCase()}</span></button>`
      ).join('');
      menuBar.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
      });
    }
  }

  function updateServerPreview(raw) {
    const preview = document.getElementById('settings-server-preview');
    const tag = document.getElementById('settings-server-tag');
    const overrideEl = document.getElementById('settings-server-override');
    const n = net();
    if (!n) return;

    if (tag) {
      tag.textContent = current.serverUrl ? t('settings.serverCustomTag') : t('settings.serverDefaultTag');
      tag.classList.toggle('is-custom', Boolean(current.serverUrl));
    }
    if (overrideEl) {
      overrideEl.hidden = !n.queryOverride;
      if (n.queryOverride) overrideEl.textContent = t('settings.serverOverride', { url: n.queryOverride });
    }
    if (!preview) return;
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      preview.textContent = t('settings.serverPreview', { url: n.defaultUrl });
      preview.classList.remove('is-error');
      return;
    }
    const normalized = n.normalizeServerUrl(trimmed);
    if (!normalized) {
      preview.textContent = t('settings.serverInvalid');
      preview.classList.add('is-error');
    } else {
      preview.textContent = t('settings.serverPreview', { url: normalized });
      preview.classList.remove('is-error');
    }
  }

  function syncUI() {
    renderLanguageButtons();
    document.querySelectorAll('#settings-units [data-unit]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.unit === current.unitSystem));
    });
    document.querySelectorAll('#settings-hints [data-hints]').forEach(btn => {
      btn.setAttribute('aria-pressed', String((btn.dataset.hints === 'on') === current.hints));
    });
    const input = document.getElementById('settings-server-input');
    const n = net();
    if (input && n) {
      input.value = current.serverUrl || n.defaultUrl;
      updateServerPreview(input.value);
    }
  }

  async function setLanguage(code, silent = false) {
    const target = i18n()?.languages.some(l => l.code === code) ? code : DEFAULTS.language;
    current.language = target;
    saveSettings(current);
    await i18n()?.changeLanguage(target);
    syncUI();
    emitChange();
    if (!silent) showToast(t('settings.savedToast'));
  }

  function setUnitSystem(sys, silent = false) {
    const target = sys === 'imperial' ? 'imperial' : 'metric';
    current.unitSystem = target;
    saveSettings(current);
    units()?.setSystem(target);
    syncUI();
    emitChange();
    if (!silent) showToast(t('settings.savedToast'));
  }

  function setHints(enabled, silent = false) {
    current.hints = Boolean(enabled);
    saveSettings(current);
    syncUI();
    emitChange();
    if (!silent) showToast(t('settings.savedToast'));
  }

  function setServerUrl(raw, silent = false) {
    const n = net();
    if (!n) return false;
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      current.serverUrl = '';
      saveSettings(current);
      n.setServerUrl('');
      syncUI();
      emitChange();
      if (!silent) showToast(t('settings.serverResetToast'));
      return true;
    }
    const normalized = n.normalizeServerUrl(trimmed);
    if (!normalized) {
      updateServerPreview(trimmed);
      if (!silent) showToast(t('settings.serverInvalid'));
      return false;
    }
    current.serverUrl = normalized === n.defaultUrl ? '' : normalized;
    saveSettings(current);
    n.setServerUrl(current.serverUrl);
    syncUI();
    emitChange();
    if (!silent) {
      showToast(current.serverUrl ? t('settings.serverSavedToast', { url: normalized }) : t('settings.serverResetToast'));
    }
    return true;
  }

  async function resetAll() {
    current = { ...DEFAULTS };
    saveSettings(current);
    units()?.setSystem(current.unitSystem);
    net()?.setServerUrl('');
    await i18n()?.changeLanguage(current.language);
    syncUI();
    emitChange();
    showToast(t('settings.resetAllToast'));
  }

  function bindUI() {
    document.querySelectorAll('#settings-units [data-unit]').forEach(btn => {
      btn.addEventListener('click', () => setUnitSystem(btn.dataset.unit));
    });
    document.querySelectorAll('#settings-hints [data-hints]').forEach(btn => {
      btn.addEventListener('click', () => setHints(btn.dataset.hints === 'on'));
    });
    const serverInput = document.getElementById('settings-server-input');
    const serverSave = document.getElementById('settings-server-save');
    const serverReset = document.getElementById('settings-server-reset');
    const resetAllBtn = document.getElementById('settings-reset-all');

    serverInput?.addEventListener('input', () => updateServerPreview(serverInput.value));
    serverInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        setServerUrl(serverInput.value);
      }
    });
    serverSave?.addEventListener('click', () => setServerUrl(serverInput?.value || ''));
    serverReset?.addEventListener('click', () => setServerUrl(''));
    resetAllBtn?.addEventListener('click', () => resetAll());

    syncUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUI);
  } else {
    bindUI();
  }

  window.ASTRO_SETTINGS = {
    get: () => ({ ...current }),
    setLanguage,
    setUnitSystem,
    setHints,
    setServerUrl,
    resetAll,
    syncUI,
  };
})();
