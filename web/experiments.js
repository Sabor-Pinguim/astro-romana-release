// Registry of the 21 experiments of docs/minigames.md and the per-run draw.
// Plan: docs/experiments-implementation.md. Texts live in web/locales/experiments/<id>.js; each minigame
// (levels, generator, solver, UI) lives in web/minigames/<id>.js and registers itself in web/minigames/core.js.
// Classic script (no modules) so the page keeps working from file://. No DOM access at load time: the
// validator (tools/web/check-experiments.mjs) loads this file in Node.
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;

  // ---------------------------------------------------------------------------
  // Seeded random numbers. Every random choice of a run (draw, layouts, bot results) comes from the run seed,
  // so every screen of a room builds the same thing and a run can be replayed.
  // ---------------------------------------------------------------------------
  function mulberry32(a) {
    let s = a >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // FNV-1a, so the same seed gives independent streams per key ('draw', 'H-S1', 'H-S1:bot'...).
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  const rngFor = (seed, key) => mulberry32((Number(seed) >>> 0) ^ hash(String(key)));
  const newSeed = () => Math.floor(Math.random() * 2 ** 31);

  // ---------------------------------------------------------------------------
  // The 21 experiments. place: where it is played. 'descent' (H-S2) runs during the landing stage and takes
  // Helena's surface slot in the draw. chains: soft links (docs/minigames.md §5), bonus only, never a lock.
  // ---------------------------------------------------------------------------
  const CREW = ['helena', 'lucas', 'oscar', 'maya'];
  const MECHANICS = ['keep', 'timing', 'aim', 'choice', 'pattern', 'route', 'piloting'];
  const LIST = [
    { id: 'H-O1', crew: 'helena', place: 'orbit', mechanic: 'keep', basis: ['EN10'], chains: [{ to: 'maya', kind: 'mass' }] },
    { id: 'H-O2', crew: 'helena', place: 'orbit', mechanic: 'piloting', basis: ['PH7'], chains: [{ to: 'M-O2', kind: 'target' }] },
    { id: 'H-S1', crew: 'helena', place: 'surface', mechanic: 'route', basis: ['EN9'], chains: [{ to: 'M-S1', kind: 'targets' }] },
    { id: 'H-S2', crew: 'helena', place: 'descent', mechanic: 'choice', basis: ['EN4'], chains: [] },
    { id: 'L-O1', crew: 'lucas', place: 'orbit', mechanic: 'timing', basis: ['E5'], chains: [{ to: 'all', kind: 'power' }] },
    { id: 'L-O2', crew: 'lucas', place: 'orbit', mechanic: 'keep', basis: ['GE8'], chains: [{ to: 'M-O1', kind: 'detector' }, { to: 'M-O2', kind: 'detector' }, { to: 'M-O3', kind: 'detector' }] },
    { id: 'L-S1', crew: 'lucas', place: 'surface', mechanic: 'keep', basis: ['EN1'], chains: [] },
    { id: 'L-S2', crew: 'lucas', place: 'surface', mechanic: 'timing', basis: ['GE6', 'G9'], chains: [{ to: 'M-S4', kind: 'samples' }] },
    { id: 'O-O1', crew: 'oscar', place: 'orbit', mechanic: 'aim', basis: ['EN13'], chains: [] },
    { id: 'O-O2', crew: 'oscar', place: 'orbit', mechanic: 'choice', basis: ['A2', 'CD1'], chains: [{ to: 'M-O1', kind: 'data' }] },
    { id: 'O-S1', crew: 'oscar', place: 'surface', mechanic: 'choice', basis: ['EN11'], chains: [] },
    { id: 'O-S2', crew: 'oscar', place: 'surface', mechanic: 'keep', basis: ['PH3'], chains: [] },
    { id: 'M-O1', crew: 'maya', place: 'orbit', mechanic: 'timing', basis: ['GE7'], chains: [] },
    { id: 'M-O2', crew: 'maya', place: 'orbit', mechanic: 'pattern', basis: ['PH7'], chains: [] },
    { id: 'M-O3', crew: 'maya', place: 'orbit', mechanic: 'pattern', basis: ['BI3'], chains: [] },
    { id: 'M-S1', crew: 'maya', place: 'surface', mechanic: 'pattern', basis: ['BI1', 'GE3', 'B14'], chains: [{ to: 'M-S4', kind: 'samples' }] },
    { id: 'M-S2', crew: 'maya', place: 'surface', mechanic: 'aim', basis: ['GE2'], chains: [] },
    { id: 'M-S3', crew: 'maya', place: 'surface', mechanic: 'pattern', basis: ['PH2'], chains: [] },
    { id: 'M-S4', crew: 'maya', place: 'surface', mechanic: 'choice', basis: ['GE6', 'G8'], chains: [] },
    { id: 'M-S5', crew: 'maya', place: 'surface', mechanic: 'timing', basis: ['PH1'], crewed: true, chains: [] },
    { id: 'M-S6', crew: 'maya', place: 'surface', mechanic: 'keep', basis: ['BI7'], crewed: true, chains: [] },
  ].map(e => Object.freeze({ ...e, file: e.id.toLowerCase() }));
  const BY_ID = Object.fromEntries(LIST.map(e => [e.id, e]));

  // Orbit pool and ground pool (surface + descent) of one crew member.
  const pool = (crew, side) => LIST.filter(e => e.crew === crew && (side === 'orbit' ? e.place === 'orbit' : e.place !== 'orbit'));

  // The draw (decided 2026-11-23): 8 per run, 1 orbit + 1 ground per crew member, pure random with no memory
  // between runs. Revealed only when each one comes into play (orbit stage, descent, landing).
  function draw(seed) {
    const rng = rngFor(seed, 'draw');
    const ids = [];
    for (const crew of CREW) {
      for (const side of ['orbit', 'ground']) {
        const options = pool(crew, side);
        ids.push(options[Math.floor(rng() * options.length)].id);
      }
    }
    return ids;
  }

  const LEVELS = ['easy', 'normal', 'hard'];
  // The minigame level is the run level (decided 2026-11-23); the lobby difficulty ids map one to one.
  const levelOf = difficulty => (LEVELS.includes(difficulty) ? difficulty : 'normal');

  root.ASTRO_EXPERIMENTS = Object.freeze({
    CREW, MECHANICS, LEVELS, list: LIST, byId: id => BY_ID[id] || null, pool, draw, levelOf,
    random: Object.freeze({ mulberry32, hash, rngFor, newSeed }),
  });
})();
