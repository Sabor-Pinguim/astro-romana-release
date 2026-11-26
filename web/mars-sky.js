// Mars astronomical ephemeris: Sun (NASA GISS Mars24, Allison & McEwen 2000), Phobos & Deimos
// (JPL SSD / Jacobson 2010), IAU 2015 Mars rotation, and solar/lunar eclipse detection.
// Pure classic script (file:// safe, zero DOM dependencies, works in Node via globalThis).
(() => {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const TAU = Math.PI * 2;

  const MARS_RADIUS_KM = 3396.19; // IAU 2015 equatorial radius
  const SUN_RADIUS_KM = 695700;
  const AU_KM = 149597870.7;
  const MARS_OBLIQUITY_DEG = 25.1919;
  const SOL_SEC = 88775.244;

  // Mars24 7-term orbital perturbation sum (Allison & McEwen 2000, eq. 18)
  const PBS_TERMS = [
    [0.0071, 2.2353, 49.409],
    [0.0057, 2.7543, 168.173],
    [0.0039, 1.1177, 191.837],
    [0.0037, 15.7866, 21.736],
    [0.0021, 2.1354, 15.704],
    [0.0020, 2.4694, 95.528],
    [0.0018, 32.8493, 49.095],
  ];

  // Phobos & Deimos orbital elements (JPL SSD / Jacobson 2010, Mars equatorial J2000)
  const MOONS = {
    phobos: {
      id: 'phobos',
      aKm: 9376,
      e: 0.0151,
      incDeg: 1.075,
      periodDays: 0.31891023,
      m0Deg: 92.47,
      omega0Deg: 150.2,
      node0Deg: 169.2,
      precDegPerDay: -0.43477,
      radiusKm: 11.27,
    },
    deimos: {
      id: 'deimos',
      aKm: 23463.2,
      e: 0.0002,
      incDeg: 1.79,
      periodDays: 1.2624407,
      m0Deg: 270.0,
      omega0Deg: 260.7,
      node0Deg: 316.6,
      precDegPerDay: -0.01807,
      radiusKm: 6.2,
    },
  };

  let overrideMs = null;
  let overrideBaseRealMs = 0;
  let rate = 1;

  const mod360 = deg => ((deg % 360) + 360) % 360;
  const wrap180 = deg => {
    const d = mod360(deg);
    return d > 180 ? d - 360 : d;
  };
  const mod24 = hrs => ((hrs % 24) + 24) % 24;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function getClockMs() {
    if (overrideMs == null) return Date.now();
    return overrideMs + (Date.now() - overrideBaseRealMs) * rate;
  }

  let nowCache = null;
  const basisCache = new Map();
  function invalidateCache() { nowCache = null; }

  function setTime(ms) {
    invalidateCache();
    if (ms == null || !Number.isFinite(ms)) {
      overrideMs = null;
      overrideBaseRealMs = 0;
      return null;
    }
    overrideMs = ms;
    overrideBaseRealMs = Date.now();
    return overrideMs;
  }

  function setRate(nextRate) {
    invalidateCache();
    const clean = Number(nextRate);
    if (!Number.isFinite(clean) || clean <= 0) return rate;
    if (overrideMs != null) {
      overrideMs = getClockMs();
      overrideBaseRealMs = Date.now();
    } else if (clean !== 1) {
      overrideMs = Date.now();
      overrideBaseRealMs = Date.now();
    }
    rate = clean;
    return rate;
  }

  function formatClock(hours) {
    const h24 = mod24(hours);
    const hh = Math.floor(h24);
    const mm = Math.floor((h24 - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function enuBasis(latDeg, lonDeg) {
    const key = `${latDeg},${lonDeg}`;
    let cached = basisCache.get(key);
    if (cached) return cached;
    const lat = latDeg * DEG;
    const lon = lonDeg * DEG;
    const sLat = Math.sin(lat), cLat = Math.cos(lat);
    const sLon = Math.sin(lon), cLon = Math.cos(lon);
    cached = {
      east: [-sLon, cLon, 0],
      north: [-sLat * cLon, -sLat * sLon, cLat],
      up: [cLat * cLon, cLat * sLon, sLat],
      obsKm: [MARS_RADIUS_KM * cLat * cLon, MARS_RADIUS_KM * cLat * sLon, MARS_RADIUS_KM * sLat],
    };
    basisCache.set(key, cached);
    return cached;
  }

  // Project body-fixed vector into Three.js local surface coordinates (+X=East, +Y=Up, -Z=North).
  function toEnuDir(vec, basis) {
    const e = vec[0] * basis.east[0] + vec[1] * basis.east[1] + vec[2] * basis.east[2];
    const n = vec[0] * basis.north[0] + vec[1] * basis.north[1] + vec[2] * basis.north[2];
    const u = vec[0] * basis.up[0] + vec[1] * basis.up[1] + vec[2] * basis.up[2];
    const len = Math.hypot(e, n, u) || 1;
    const az = Math.atan2(e, n);
    const el = Math.asin(clamp(u / len, -1, 1));
    return {
      dir: [e / len, u / len, -n / len],
      azDeg: mod360(az * RAD),
      elDeg: el * RAD,
      distKm: len,
    };
  }

  function circleOverlapFraction(rSun, rMoon, sep) {
    if (sep >= rSun + rMoon) return 0;
    if (sep <= Math.abs(rSun - rMoon)) {
      const rMin = Math.min(rSun, rMoon);
      return (rMin * rMin) / (rSun * rSun);
    }
    const r1 = rSun, r2 = rMoon;
    const a1 = r1 * r1 * Math.acos(clamp((sep * sep + r1 * r1 - r2 * r2) / (2 * sep * r1), -1, 1));
    const a2 = r2 * r2 * Math.acos(clamp((sep * sep + r2 * r2 - r1 * r1) / (2 * sep * r2), -1, 1));
    const tri = 0.5 * Math.sqrt(Math.max(0, (-sep + r1 + r2) * (sep + r1 - r2) * (sep - r1 + r2) * (sep + r1 + r2)));
    return clamp((a1 + a2 - tri) / (Math.PI * r1 * r1), 0, 1);
  }

  function moonState(cfg, dJ2000, wRad, sunBfUnit, rSunRad, basis) {
    const mDeg = mod360(cfg.m0Deg + (360 / cfg.periodDays) * dJ2000);
    const mRad = mDeg * DEG;
    let eccAnom = mRad;
    for (let k = 0; k < 3; k++) {
      eccAnom -= (eccAnom - cfg.e * Math.sin(eccAnom) - mRad) / (1 - cfg.e * Math.cos(eccAnom));
    }
    const xOrb = cfg.aKm * (Math.cos(eccAnom) - cfg.e);
    const yOrb = cfg.aKm * Math.sqrt(1 - cfg.e * cfg.e) * Math.sin(eccAnom);

    const omega = (cfg.omega0Deg - cfg.precDegPerDay * dJ2000) * DEG;
    const node = (cfg.node0Deg + cfg.precDegPerDay * dJ2000) * DEG;
    const inc = cfg.incDeg * DEG;

    const cO = Math.cos(node), sO = Math.sin(node);
    const co = Math.cos(omega), so = Math.sin(omega);
    const ci = Math.cos(inc), si = Math.sin(inc);

    const xEq = (cO * co - sO * so * ci) * xOrb + (-cO * so - sO * co * ci) * yOrb;
    const yEq = (sO * co + cO * so * ci) * xOrb + (-sO * so + cO * co * ci) * yOrb;
    const zEq = (so * si) * xOrb + (co * si) * yOrb;

    // Rotate from Mars equatorial inertial to Mars body-fixed by -W around +Z.
    const cW = Math.cos(wRad), sW = Math.sin(wRad);
    const xBf = cW * xEq + sW * yEq;
    const yBf = -sW * xEq + cW * yEq;
    const zBf = zEq;

    const rel = [xBf - basis.obsKm[0], yBf - basis.obsKm[1], zBf - basis.obsKm[2]];
    const topo = toEnuDir(rel, basis);
    const angularRadiusRad = Math.asin(clamp(cfg.radiusKm / topo.distKm, 0, 1));

    // Phase fraction: 1 = full, 0 = new.
    const toObs = [-rel[0] / topo.distKm, -rel[1] / topo.distKm, -rel[2] / topo.distKm];
    const phase = 0.5 * (1 + (sunBfUnit[0] * toObs[0] + sunBfUnit[1] * toObs[1] + sunBfUnit[2] * toObs[2]));

    // Lunar eclipse: Mars shadow cone along -sunBfUnit.
    const proj = -(xBf * sunBfUnit[0] + yBf * sunBfUnit[1] + zBf * sunBfUnit[2]);
    let lunarEclipse = 0;
    if (proj > 0) {
      const px = xBf + proj * sunBfUnit[0];
      const py = yBf + proj * sunBfUnit[1];
      const pz = zBf + proj * sunBfUnit[2];
      const perp = Math.hypot(px, py, pz);
      const penumbraR = MARS_RADIUS_KM + proj * rSunRad;
      const umbraR = Math.max(0, MARS_RADIUS_KM - proj * rSunRad);
      if (perp <= umbraR) lunarEclipse = 1;
      else if (perp < penumbraR) lunarEclipse = clamp((penumbraR - perp) / (penumbraR - umbraR), 0, 1);
    }

    // Mars-centric Three.js vector (+Y = North Pole, +Z = 0° lon, +X = 90° E) matching lobby globe.
    const lobbyDir = [yBf / MARS_RADIUS_KM, zBf / MARS_RADIUS_KM, xBf / MARS_RADIUS_KM];

    return {
      id: cfg.id,
      dir: topo.dir,
      azDeg: topo.azDeg,
      elDeg: topo.elDeg,
      distKm: topo.distKm,
      angularRadiusRad,
      phase,
      lunarEclipse,
      bodyFixedKm: [xBf, yBf, zBf],
      lobbyDir,
    };
  }

  function compute(site = { lat: 18.4447, lon: 77.4508 }, dateMs = getClockMs()) {
    const latDeg = Number.isFinite(site?.lat) ? site.lat : 18.4447;
    const lonDeg = Number.isFinite(site?.lon) ? site.lon : 77.4508;

    const jdUt = dateMs / 86400000 + 2440587.5;
    const jdTt = jdUt + 69.184 / 86400;
    const dJ2000 = jdTt - 2451545.0;

    const mDeg = mod360(19.3871 + 0.52402073 * dJ2000);
    const mRad = mDeg * DEG;
    const alphaFms = mod360(270.3871 + 0.524038496 * dJ2000);

    let pbsDeg = 0;
    for (let i = 0; i < PBS_TERMS.length; i++) {
      const [amp, tau, phi] = PBS_TERMS[i];
      pbsDeg += amp * Math.cos(((0.985626 * dJ2000) / tau + phi) * DEG);
    }

    const nuMinusM =
      (10.691 + 3.0e-7 * dJ2000) * Math.sin(mRad) +
      0.623 * Math.sin(2 * mRad) +
      0.050 * Math.sin(3 * mRad) +
      0.005 * Math.sin(4 * mRad) +
      0.0005 * Math.sin(5 * mRad) +
      pbsDeg;

    const lsDeg = mod360(alphaFms + nuMinusM);
    const lsRad = lsDeg * DEG;
    const eotDeg =
      2.861 * Math.sin(2 * lsRad) -
      0.071 * Math.sin(4 * lsRad) +
      0.002 * Math.sin(6 * lsRad) -
      nuMinusM;

    const msd = (jdTt - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
    const mtc = mod24(msd * 24);
    const lmst = mod24(mtc + lonDeg / 15);
    const ltst = mod24(lmst + eotDeg / 15);

    const declRad = Math.asin(Math.sin(MARS_OBLIQUITY_DEG * DEG) * Math.sin(lsRad));
    const subsolarLatDeg = declRad * RAD;
    const subsolarLonDeg = wrap180(180 - mtc * 15 - eotDeg);
    const subLonRad = subsolarLonDeg * DEG;
    const sunBfUnit = [
      Math.cos(declRad) * Math.cos(subLonRad),
      Math.cos(declRad) * Math.sin(subLonRad),
      Math.sin(declRad),
    ];

    const rMarsAU = 1.52367934 * (1 - 0.0934 * Math.cos(mRad + pbsDeg * DEG));
    const rSunRad = Math.asin(SUN_RADIUS_KM / (rMarsAU * AU_KM));

    const basis = enuBasis(latDeg, lonDeg);
    const sunTopo = toEnuDir(sunBfUnit, basis);

    const wDeg = mod360(176.630 + 350.89198226 * dJ2000);
    const wRad = wDeg * DEG;

    const phobos = moonState(MOONS.phobos, dJ2000, wRad, sunBfUnit, rSunRad, basis);
    const deimos = moonState(MOONS.deimos, dJ2000, wRad, sunBfUnit, rSunRad, basis);

    let solarEclipse = { active: false, body: null, occultation: 0, sepDeg: 180 };
    if (sunTopo.elDeg > -1) {
      for (const moon of [phobos, deimos]) {
        if (moon.elDeg <= -1) continue;
        const dot = clamp(
          sunTopo.dir[0] * moon.dir[0] + sunTopo.dir[1] * moon.dir[1] + sunTopo.dir[2] * moon.dir[2],
          -1,
          1,
        );
        const sep = Math.acos(dot);
        const occ = circleOverlapFraction(rSunRad, moon.angularRadiusRad, sep);
        if (occ > solarEclipse.occultation) {
          solarEclipse = {
            active: occ > 0.01,
            body: moon.id,
            occultation: occ,
            sepDeg: sep * RAD,
          };
        }
      }
    }

    let lunarEclipse = { active: false, body: null, shadow: 0 };
    for (const moon of [phobos, deimos]) {
      if (moon.elDeg <= -1) continue;
      if (moon.lunarEclipse > lunarEclipse.shadow) {
        lunarEclipse = {
          active: moon.lunarEclipse > 0.05,
          body: moon.id,
          shadow: moon.lunarEclipse,
        };
      }
    }

    return {
      dateMs,
      jdTt,
      dJ2000,
      msd,
      sol: Math.floor(msd),
      lsDeg,
      mtc,
      lmst,
      ltst,
      wDeg,
      subsolarLatDeg,
      subsolarLonDeg,
      sun: {
        dir: sunTopo.dir,
        azDeg: sunTopo.azDeg,
        elDeg: sunTopo.elDeg,
        angularRadiusRad: rSunRad,
        lobbyDir: [sunBfUnit[1], sunBfUnit[2], sunBfUnit[0]],
      },
      phobos,
      deimos,
      solarEclipse,
      lunarEclipse,
    };
  }

  function jumpToSolarHour(site, targetHour) {
    const base = getClockMs();
    const s = compute(site, base);
    let deltaH = targetHour - s.ltst;
    if (deltaH > 12) deltaH -= 24;
    if (deltaH < -12) deltaH += 24;
    const nextMs = base + (deltaH / 24) * SOL_SEC * 1000;
    setTime(nextMs);
    return nextMs;
  }

  function findNextEclipse(site, fromMs = getClockMs(), kind = 'solar-phobos') {
    const isSolar = kind === 'solar-phobos' || kind === 'solar-deimos';
    const body = kind.endsWith('deimos') ? 'deimos' : 'phobos';
    const coarseMs = body === 'phobos' ? 6 * 60 * 1000 : 20 * 60 * 1000;
    const fineMs = 10 * 1000;
    const maxDays = 690;
    const totalCoarse = Math.floor((maxDays * 86400 * 1000) / coarseMs);

    const scoreAt = (ms, isCoarse = false) => {
      const s = compute(site, ms);
      if (isSolar) {
        if (isCoarse ? (s.sun.elDeg < 1 || s[body].elDeg < -6) : (s.sun.elDeg < 4 || s[body].elDeg < 2)) return -Math.PI;
        const m = s[body];
        const dot = clamp(s.sun.dir[0] * m.dir[0] + s.sun.dir[1] * m.dir[1] + s.sun.dir[2] * m.dir[2], -1, 1);
        const sep = Math.acos(dot);
        const occ = circleOverlapFraction(s.sun.angularRadiusRad, m.angularRadiusRad, sep);
        return occ > 0 ? 1 + occ : -sep;
      }
      if (s[body].elDeg < 6) return -1;
      return s[body].lunarEclipse;
    };

    let bestMs = null;
    let bestScore = isSolar ? 1.01 : 0.3;
    const threshCoarse = isSolar ? -9 * DEG : 0.05;

    for (let i = 1; i <= totalCoarse; i++) {
      const ms = fromMs + i * coarseMs;
      if (scoreAt(ms, true) < threshCoarse) continue;
      // Scan ±coarseMs in fineMs steps to catch brief 20-30s transits.
      for (let fms = ms - coarseMs; fms <= ms + coarseMs; fms += fineMs) {
        const sc = scoreAt(fms, false);
        if (sc > bestScore) {
          bestScore = sc;
          bestMs = fms;
        }
      }
      if (bestMs != null) break;
    }
    if (bestMs == null) return null;

    // Refine peak to ~1 second precision around bestMs.
    let lo = bestMs - fineMs;
    let hi = bestMs + fineMs;
    for (let iter = 0; iter < 14; iter++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (scoreAt(m1) < scoreAt(m2)) lo = m1;
      else hi = m2;
    }
    const peakMs = 0.5 * (lo + hi);
    return { kind, peakMs, state: compute(site, peakMs) };
  }

  function jumpToNextEclipse(site, kind = 'solar-phobos', leadSec = 8) {
    const hit = findNextEclipse(site, getClockMs(), kind);
    if (!hit) return null;
    setTime(hit.peakMs - leadSec * 1000);
    return hit;
  }

  function now(site) {
    const latDeg = site?.lat ?? 18.4447;
    const lonDeg = site?.lon ?? 77.4508;
    const key = `${latDeg},${lonDeg}`;
    const realMs = Date.now();
    const ttl = rate === 1 ? 250 : 33;
    if (nowCache && nowCache.key === key && realMs - nowCache.realMs < ttl) {
      return nowCache.result;
    }
    const result = compute(site, getClockMs());
    nowCache = { key, realMs, result };
    return result;
  }

  root.ASTRO_MARS_SKY = Object.freeze({
    compute,
    now,
    setTime,
    setRate,
    getRate: () => rate,
    getClockMs,
    isLive: () => overrideMs == null && rate === 1,
    formatClock,
    jumpToSolarHour,
    findNextEclipse,
    jumpToNextEclipse,
  });
})();
