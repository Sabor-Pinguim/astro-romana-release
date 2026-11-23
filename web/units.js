// Measurement unit conversion and locale-aware formatting (Metric SI / Imperial US).
// Simulation physics stay strictly in SI; conversion occurs only when formatting for display.
(() => {
  'use strict';
  const STORAGE_KEY = 'astro-romana-settings';

  const KG_TO_LB = 2.20462262;
  const KG_TO_SHORT_TON = 1 / 907.18474;
  const G_TO_OZ = 0.03527396;
  const KN_TO_LBF = 224.808943;
  const M_TO_FT = 3.2808399;
  const KM_TO_MI = 0.62137119;

  function readStoredSystem() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.unitSystem === 'imperial' ? 'imperial' : 'metric';
    } catch {
      return 'metric';
    }
  }

  let system = readStoredSystem();
  const locale = () => window.ASTRO_I18N?.locale || 'en-US';
  const nf = () => window.ASTRO_I18N?.t('common.nf') || 'n/f';
  const isImp = () => system === 'imperial';

  function number(n, opts) {
    if (n == null || Number.isNaN(n)) return nf();
    if (opts) return Number(n).toLocaleString(locale(), opts);
    return Math.round(n).toLocaleString(locale());
  }

  function decimal(n, digits = 1) {
    if (n == null || Number.isNaN(n)) return nf();
    return Number(n).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function money(n) {
    if (n == null || Number.isNaN(n)) return nf();
    return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString(locale(), { maximumFractionDigits: Math.abs(n) < 10 ? 1 : 0 }) + 'M';
  }

  function massKg(kg) {
    if (kg == null || Number.isNaN(kg)) return nf();
    if (isImp()) return `${number(kg * KG_TO_LB)} lb`;
    return `${number(kg)} kg`;
  }

  function massTonnes(kg) {
    if (kg == null || Number.isNaN(kg)) return nf();
    if (isImp()) {
      const ton = kg * KG_TO_SHORT_TON;
      return `${ton.toLocaleString(locale(), { maximumFractionDigits: ton < 10 ? 2 : 1 })} ton`;
    }
    return `${(kg / 1000).toLocaleString(locale(), { maximumFractionDigits: kg < 10000 ? 2 : 1 })} t`;
  }

  function massGrams(g, decimals = 1) {
    if (g == null || Number.isNaN(g)) return nf();
    if (isImp()) return `${decimal(g * G_TO_OZ, 2)} oz`;
    return `${decimal(g, decimals)} g`;
  }

  function thrustKn(kn) {
    if (kn == null || Number.isNaN(kn)) return nf();
    if (isImp()) return `${number(kn * KN_TO_LBF)} lbf`;
    return `${number(kn)} kN`;
  }

  function velocityMs(ms, decimals = 0) {
    if (ms == null || Number.isNaN(ms)) return nf();
    if (isImp()) {
      const fps = ms * M_TO_FT;
      return `${decimals > 0 ? decimal(fps, decimals) : number(fps)} ft/s`;
    }
    return `${decimals > 0 ? decimal(ms, decimals) : number(ms)} m/s`;
  }

  function speedKmh(kmh) {
    if (kmh == null || Number.isNaN(kmh)) return nf();
    if (isImp()) return `${number(kmh * KM_TO_MI)} mph`;
    return `${number(kmh)} km/h`;
  }

  function altitudeKm(km) {
    if (km == null || Number.isNaN(km)) return nf();
    if (isImp()) {
      const mi = km * KM_TO_MI;
      if (km < 1) return `${number(km * 1000 * M_TO_FT)} ft`;
      return `${(Math.round(mi * 10) / 10).toLocaleString(locale(), { maximumFractionDigits: 1 })} mi`;
    }
    if (km < 1) return `${number(km * 1000)} m`;
    return `${(Math.round(km * 10) / 10).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;
  }

  function distanceM(m, decimals = 0) {
    if (m == null || Number.isNaN(m)) return nf();
    if (isImp()) {
      const ft = m * M_TO_FT;
      return `${decimals > 0 ? decimal(ft, decimals) : number(ft)} ft`;
    }
    return `${decimals > 0 ? decimal(m, decimals) : number(m)} m`;
  }

  function distanceKm(km, decimals = 1) {
    if (km == null || Number.isNaN(km)) return nf();
    if (isImp()) {
      const mi = km * KM_TO_MI;
      return `${decimals > 0 ? decimal(mi, decimals) : number(mi)} mi`;
    }
    return `${decimals > 0 ? decimal(km, decimals) : number(km)} km`;
  }

  function tempC(c, decimals = 0) {
    if (c == null || Number.isNaN(c)) return nf();
    if (isImp()) {
      const f = (c * 9) / 5 + 32;
      return `${decimals > 0 ? decimal(f, decimals) : number(f)} °F`;
    }
    return `${decimals > 0 ? decimal(c, decimals) : number(c)} °C`;
  }

  function tempRangeC(minC, maxC) {
    if (isImp()) {
      const fMin = number((minC * 9) / 5 + 32);
      const fMax = number((maxC * 9) / 5 + 32);
      return `${fMin}–${fMax} °F`;
    }
    return `${number(minC)}–${number(maxC)} °C`;
  }

  function setSystem(next) {
    const normalized = next === 'imperial' ? 'imperial' : 'metric';
    if (normalized === system) return system;
    system = normalized;
    window.dispatchEvent(new CustomEvent('astro:units', { detail: { unitSystem: system } }));
    return system;
  }

  window.ASTRO_UNITS = {
    get system() { return system; },
    setSystem,
    number,
    decimal,
    money,
    massKg,
    massTonnes,
    massGrams,
    thrustKn,
    velocityMs,
    speedKmh,
    altitudeKm,
    distanceM,
    distanceKm,
    tempC,
    tempRangeC,
  };
})();
