// Internationalization wrapper around i18next (with an offline fallback if CDN is blocked).
// Locale packs register themselves on window.ASTRO_LOCALES[code] = { _meta, translation }.
(() => {
  'use strict';
  const STORAGE_KEY = 'astro-romana-settings';
  const locales = window.ASTRO_LOCALES || {};
  const fallbackLng = 'en';

  function detectBrowserLang() {
    const candidates = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ].filter(Boolean);
    for (const raw of candidates) {
      const base = String(raw).toLowerCase().split('-')[0];
      if (locales[base]) return base;
    }
    return fallbackLng;
  }

  function readStoredLang() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.language && locales[parsed.language]) return parsed.language;
    } catch {
      /* ignore storage errors */
    }
    return detectBrowserLang();
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
      initImmediate: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
    });
  }

  // Translation checks (tools/web/i18n-audit.mjs reads them): keys found nowhere (they show raw on screen) and
  // keys the current language lacks, which i18next quietly fills in from English.
  const report = { missing: new Set(), fallback: new Set() };
  function track(key) {
    if (typeof key !== 'string' || !key || lookup(locales[currentLang]?.translation, key) !== undefined) return;
    if (lookup(locales[fallbackLng]?.translation, key) !== undefined) report.fallback.add(`${currentLang}:${key}`);
    else report.missing.add(key);
  }

  // Pseudo-localization (?pseudo): every translated string comes out accented, about a third longer and inside
  // ⟦ ⟧, so text still plain on screen was never translated and a cut ⟧ shows text that does not fit. HTML tags,
  // entities and the values put into placeholders stay as they are.
  const pseudo = /[?&]pseudo\b/.test(location.search);
  const ACCENT = { a: 'à', e: 'ë', i: 'ï', o: 'ö', u: 'ü', c: 'ç', n: 'ñ', y: 'ÿ', A: 'Å', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü', C: 'Ç', N: 'Ñ' };
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The string values put into placeholders (an e-mail, a player's name), longest first, as a regex alternative.
  const keptValues = opts => Object.entries(opts || {})
    .filter(([k, v]) => typeof v === 'string' && v.trim() && !['defaultValue', 'lng', 'context'].includes(k))
    .map(([, v]) => v).sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const pseudoize = (text, keep) => {
    const split = new RegExp(`(<[^>]+>|&[#a-z0-9]+;${keep ? `|${keep}` : ''})`);
    const body = text.split(split).map((part, i) => (i % 2 ? part : part.replace(/[a-zA-Z]/g, ch => ACCENT[ch] || ch))).join('');
    return `⟦${body}${'~'.repeat(Math.ceil(text.replace(/<[^>]+>/g, '').length * 0.35))}⟧`;
  };
  const deepPseudo = (value, keep) => (typeof value === 'string' ? pseudoize(value, keep) : Array.isArray(value) ? value.map(v => deepPseudo(v, keep)) : value);

  function resolve(key, opts) {
    if (hasI18next) {
      const res = window.i18next.t(key, opts);
      if (res !== undefined && res !== key) return res;
    }
    const primary = lookup(locales[currentLang]?.translation, key);
    const fb = primary !== undefined ? primary : lookup(locales[fallbackLng]?.translation, key);
    if (fb === undefined) return opts?.defaultValue ?? key;
    return typeof fb === 'string' ? interpolate(fb, opts) : fb;
  }
  function t(key, opts) {
    track(key);
    const out = resolve(key, opts);
    return pseudo && out !== key ? deepPseudo(out, keptValues(opts)) : out;
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
    pseudo,
    report: () => ({ missing: [...report.missing].sort(), fallback: [...report.fallback].sort() }),
  };

  syncDocumentAttributes();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { syncDocumentAttributes(); applyDOM(); });
  } else {
    applyDOM();
  }
})();
