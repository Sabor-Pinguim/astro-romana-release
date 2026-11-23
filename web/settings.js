// Settings persistence and UI controller for Language, Measurement System, and Multiplayer Server.
(() => {
  'use strict';
  const STORAGE_KEY = 'astro-romana-settings';
  const DEFAULTS = { language: 'en', unitSystem: 'metric', serverUrl: '' };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        language: parsed.language || DEFAULTS.language,
        unitSystem: parsed.unitSystem === 'imperial' ? 'imperial' : DEFAULTS.unitSystem,
        serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : DEFAULTS.serverUrl,
      };
    } catch {
      return { ...DEFAULTS };
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

  function renderLanguageButtons() {
    const container = document.getElementById('settings-lang');
    if (!container || !i18n()) return;
    const langs = i18n().languages;
    container.innerHTML = langs.map(lang =>
      `<button type="button" data-lang="${lang.code}" aria-pressed="${lang.code === current.language}">${lang.name}</button>`
    ).join('');
    container.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });
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
    setServerUrl,
    resetAll,
    syncUI,
  };
})();
