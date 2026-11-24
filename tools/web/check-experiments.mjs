// Validates the experiment minigames without a browser (plan: docs/experiments-implementation.md §4.10).
// Loads the same classic scripts as the page into a Node vm and checks:
//   - the registry (21 experiments, every crew member has orbit and ground options);
//   - texts: required keys in English, Portuguese and Spanish, the same key set in all three, modifier names;
//   - each built minigame: 3 levels, layouts that are solvable, plain data, varied and fast to generate;
//   - bots: 1 or 2 stars; the draw: 8 per run, 1 orbit + 1 ground per crew member, all 21 reachable.
// Holds no game logic. Usage: node tools/web/check-experiments.mjs [--seeds 300] [--only H-S1,L-S1]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SEEDS = Number(opt('seeds', 300));
const ONLY = opt('only', '') ? new Set(opt('only').split(',')) : null;
const MAX_MS = 50; // a layout (generate + validate) must be ready in under 50 ms

let failures = 0, warnings = 0;
const ok = msg => console.log(`  ✔ ${msg}`);
const bad = msg => { failures++; console.log(`  ✘ ${msg}`); };
const warn = msg => { warnings++; console.log(`  ⚠ ${msg}`); };

const context = vm.createContext({ console, setTimeout, clearTimeout, performance });
context.window = context;
const load = rel => {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return false;
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: rel });
  return true;
};

console.log('Experiments registry');
load('web/locales/en.js');
load('web/locales/pt.js');
load('web/locales/es.js');
load('web/experiments.js');
const EXP = context.ASTRO_EXPERIMENTS;
if (EXP.list.length === 21) ok('21 experiments'); else bad(`${EXP.list.length} experiments (expected 21)`);
for (const crew of EXP.CREW) for (const side of ['orbit', 'ground']) if (!EXP.pool(crew, side).length) bad(`${crew} has no ${side} experiment`);

load('web/locales/experiments/_common.js');
const built = [];
for (const e of EXP.list) load(`web/locales/experiments/${e.file}.js`);
load('web/minigames/core.js');
const MG = context.ASTRO_MINIGAMES;
for (const e of EXP.list) if (load(`web/minigames/${e.file}.js`) && MG.has(e.id)) built.push(e.id);
console.log(`  · ${built.length} / 21 minigames built: ${built.join(', ') || 'none'}`);

// ---------------------------------------------------------------------------
// Player texts come in English (reference), Portuguese and Spanish (AGENTS.md §9): the same keys in all three.
const LANGS = ['en', 'pt', 'es'];
console.log(`Texts (${LANGS.join(' / ')})`);
const tr = code => context.ASTRO_LOCALES[code]?.translation?.experiments || {};
const keysOf = (obj, prefix = '') => Object.entries(obj || {}).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const REQUIRED = ['title', 'minigame', 'basis', 'desc', 'fact'];
const keyDiff = (a, b) => [...a].filter(k => !b.has(k)).concat([...b].filter(k => !a.has(k)).map(k => `+${k}`));
for (const block of ['common', 'mechanics', 'places', 'orbit', 'descent', 'results']) {
  const sets = Object.fromEntries(LANGS.map(l => [l, new Set(keysOf(tr(l)[block]))]));
  if (!sets.en.size) { bad(`experiments.${block} missing`); continue; }
  const diffs = LANGS.slice(1).map(l => [l, keyDiff(sets.en, sets[l])]).filter(([, d]) => d.length);
  if (diffs.length) diffs.forEach(([l, d]) => bad(`experiments.${block}: ${l} differs from en: ${d.slice(0, 8).join(', ')}${d.length > 8 ? '…' : ''}`));
  else ok(`experiments.${block}`);
}
for (const id of built) {
  const packs = Object.fromEntries(LANGS.map(l => [l, tr(l)[id]]));
  const absent = LANGS.filter(l => !packs[l]);
  if (absent.length) { bad(`${id}: missing texts (${absent.join(', ')})`); continue; }
  const missing = REQUIRED.filter(k => LANGS.some(l => typeof packs[l][k] !== 'string'));
  const ek = new Set(keysOf(packs.en));
  const diffs = LANGS.slice(1).map(l => [l, keyDiff(ek, new Set(keysOf(packs[l])))]).filter(([, d]) => d.length);
  const mods = (MG.def(id).mods || []).filter(m => LANGS.some(l => typeof packs[l].mods?.[m] !== 'string'));
  if (missing.length) bad(`${id}: missing ${missing.join(', ')}`);
  diffs.forEach(([l, d]) => bad(`${id}: ${l} keys differ from en: ${d.slice(0, 8).join(', ')}${d.length > 8 ? '…' : ''}`));
  if (mods.length) bad(`${id}: modifier names missing: ${mods.join(', ')}`);
  if (!missing.length && !diffs.length && !mods.length) ok(`${id}: ${ek.size} keys in ${LANGS.length} languages`);
}

// ---------------------------------------------------------------------------
console.log(`Layouts (${SEEDS} seeds per level)`);
for (const id of built) {
  if (ONLY && !ONLY.has(id)) continue;
  const def = MG.def(id);
  for (const level of EXP.LEVELS) {
    const seen = new Set();
    let worst = 0, unsolved = 0, maxTries = 0, notPlain = 0, solveFail = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const t0 = performance.now();
      const made = MG.layout(id, seed * 7919, level);
      const ms = performance.now() - t0;
      worst = Math.max(worst, ms);
      maxTries = Math.max(maxTries, made.tries);
      if (made.unsolved) unsolved++;
      const json = JSON.stringify(made.layout);
      if (JSON.stringify(JSON.parse(json)) !== json) notPlain++;
      seen.add(json);
      if (def.solve) {
        const best = def.solve(made.layout, MG.params(id, level));
        const value = best && typeof best === 'object' ? Object.values(best).find(v => typeof v === 'number') : best;
        if (!Number.isFinite(value)) solveFail++;
      }
    }
    const label = `${id} ${level}`;
    if (unsolved) bad(`${label}: ${unsolved} layouts without a solution`);
    if (solveFail) bad(`${label}: solver gave no finite result in ${solveFail} layouts`);
    if (notPlain) bad(`${label}: ${notPlain} layouts are not plain data`);
    if (seen.size < Math.min(SEEDS, 20) * 0.8) bad(`${label}: only ${seen.size} different layouts in ${SEEDS} seeds`);
    if (worst > MAX_MS) warn(`${label}: slowest layout ${worst.toFixed(1)} ms (limit ${MAX_MS})`);
    if (!unsolved && !solveFail && !notPlain) ok(`${label}: ${seen.size} different, ≤ ${maxTries} tries, slowest ${worst.toFixed(1)} ms`);
  }
  const bots = Array.from({ length: 200 }, (_, s) => MG.botResult(id, s, 'normal'));
  if (bots.every(b => (b.stars === 1 || b.stars === 2) && b.seconds > 0)) ok(`${id}: bot results 1–2 stars`); else bad(`${id}: bot result out of range`);
}

// ---------------------------------------------------------------------------
console.log('Draw (10,000 seeds)');
const count = Object.fromEntries(EXP.list.map(e => [e.id, 0]));
let drawBad = 0;
for (let seed = 0; seed < 10000; seed++) {
  const ids = EXP.draw(seed);
  const perCrew = EXP.CREW.every(c => ids.filter(id => EXP.byId(id).crew === c && EXP.byId(id).place === 'orbit').length === 1
    && ids.filter(id => EXP.byId(id).crew === c && EXP.byId(id).place !== 'orbit').length === 1);
  if (ids.length !== 8 || new Set(ids).size !== 8 || !perCrew) drawBad++;
  ids.forEach(id => { count[id]++; });
}
if (drawBad) bad(`${drawBad} draws break the 1 orbit + 1 ground per crew member rule`); else ok('8 per run, 1 orbit + 1 ground per crew member');
const never = Object.entries(count).filter(([, n]) => !n).map(([id]) => id);
if (never.length) bad(`never drawn: ${never.join(', ')}`); else ok(`all 21 drawn (least ${Math.min(...Object.values(count))}, most ${Math.max(...Object.values(count))})`);

console.log(failures ? `\n✘ ${failures} problem(s), ${warnings} warning(s)` : `\n✔ all checks passed${warnings ? ` (${warnings} warning(s))` : ''}`);
process.exit(failures ? 1 : 0);
