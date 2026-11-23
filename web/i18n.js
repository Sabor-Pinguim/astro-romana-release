// Internationalization wrapper around i18next (with an offline fallback if CDN is blocked).
// Locale packs register themselves on window.ASTRO_LOCALES[code] = { _meta, translation }.
(() => {
  'use strict';
  const STORAGE_KEY = 'astro-romana-settings';
  const locales = window.ASTRO_LOCALES || {};
  const fallbackLng = 'en';

  function readStoredLang() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.language && locales[parsed.language] ? parsed.language : fallbackLng;
    } catch {
      return fallbackLng;
    }
  }

  // Fallback interpolation/lookup when i18next CDN script could not load (e.g. offline file://).
  function lookup(obj, key) {
    return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
  }
  function interpolate(str, vars) {
    if (typeof str !== 'string' || !vars) return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
  }

  let currentLang = readStoredLang();
  const hasI18next = Boolean(window.i18next && typeof window.i18next.init === 'function');

  if (hasI18next) {
    const resources = {};
    for (const [code, pack] of Object.entries(locales)) {
      resources[code] = { translation: pack.translation };
    }
    window.i18next.init({
      lng: currentLang,
      fallbackLng,
      resources,
      returnObjects: true,
      interpolation: { escapeValue: false },
    });
  }

  function t(key, opts) {
    if (hasI18next) {
      const res = window.i18next.t(key, opts);
      if (res !== key || !opts?.defaultValue) return res;
    }
    const primary = lookup(locales[currentLang]?.translation, key);
    const fb = primary !== undefined ? primary : lookup(locales[fallbackLng]?.translation, key);
    if (fb === undefined) return opts?.defaultValue ?? key;
    return typeof fb === 'string' ? interpolate(fb, opts) : fb;
  }

  function syncDocumentAttributes() {
    const meta = locales[currentLang]?._meta || locales[fallbackLng]?._meta;
    document.documentElement.lang = meta?.locale || currentLang || 'en';
    document.documentElement.style.setProperty('--unavailable-suffix', `" · ${t('orbit.unavailableLower')}"`);
  }

  function applyDOM(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }

  async function changeLanguage(code) {
    const target = locales[code] ? code : fallbackLng;
    currentLang = target;
    if (hasI18next) await window.i18next.changeLanguage(target);
    syncDocumentAttributes();
    applyDOM();
    window.dispatchEvent(new CustomEvent('astro:lang', { detail: { language: target } }));
    return target;
  }

  const languages = Object.values(locales).map(pack => pack._meta).filter(Boolean);

  window.ASTRO_I18N = {
    t,
    changeLanguage,
    applyDOM,
    languages,
    get language() { return currentLang; },
    get locale() { return locales[currentLang]?._meta?.locale || 'en-US'; },
  };

  syncDocumentAttributes();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { syncDocumentAttributes(); applyDOM(); });
  } else {
    applyDOM();
  }
})();
