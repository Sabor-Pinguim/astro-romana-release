// Static check of the player-facing translations (en, pt, es), no dependencies. Run: npm run i18n:check
// Checks, following the usual i18n QA layers (key parity, placeholder drift, undefined keys, untranslated and
// hard-coded text):
//   errors   - a key one language has and another lacks; {{placeholders}} or HTML tags that differ between
//              languages; a rocket part (assets/models/parts/manifest.json) with no name or role in a language;
//              a key the code or index.html uses that no language defines (it shows raw on screen);
//              a family of dynamic keys (t(`crew.${id}.role`)) whose prefix does not exist.
//   warnings - pt/es text identical to English (maybe untranslated); visible text in index.html with no
//              data-i18n*; literal text drawn on canvas or toasted from code.
// Exit code 1 when there are errors (--strict: warnings too). The runtime side (raw keys on screen, English
// fallbacks, pseudo-localization) is tools/web/i18n-audit.mjs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LANGS = ['en', 'pt', 'es'];
const strict = process.argv.includes('--strict');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Texts that are the same in every language on purpose: names, units, codes, symbols, brand. Keys whose path
// matches stay out of the "identical to English" warning. Keep it short: a real translation gap must show up.
const SAME_OK = [
  /^parts\.[^.]+\.name$/, // part names are product names (RS-25, Merlin 1D…)
  /^crew\.[^.]+\.name$/,
  /\.(unit|units|abbr|symbol|code)$/i,
  /^_meta\./,
  /^menu\.version$/,
];
// Reviewed 2026-11-25: the same word in that language (Status, Normal, Altitude, Menu, Minigame, Venus, Solo).
const SAME_REVIEWED = new Set([
  'pt:settings.back', 'pt:leaderboard.back', 'pt:orbit.back', 'pt:lobby.setup.steps.mode.back', 'pt:leaderboard.sourceSolo',
  'pt:orbit.statStatus', 'pt:lobby.statusLabel', 'es:orbit.worlds.venus', 'pt:difficulty.normal.label', 'es:difficulty.normal.label',
  'pt:cockpit.altitude', 'pt:minigames.summaryMinigame',
]);
// Unit words and abbreviations that read the same in every language.
const UNIT_WORDS = /\b(min|pts|exp|Mbps|kbps|km|kg|lb|lbf|ton|ft|mi|oz|s)\b\.?/g;
const sameIsFine = (key, text, lang) =>
  SAME_OK.some(re => re.test(key)) || SAME_REVIEWED.has(`${lang}:${key}`)
  || !/[a-z]{3}/.test(text.replace(/\{\{\w+\}\}/g, '').replace(/<[^>]+>/g, '').replace(UNIT_WORDS, '')) // codes, numbers, units, ACRONYMS
  || /^[\w\s.·/%°+\-–—()×:,&{}]+$/.test(text) && text.length <= 4;

// ---- load the locale packs in the order index.html does ------------------------------------------------------
const html = read('index.html');
const localeFiles = [...html.matchAll(/<script src="(web\/locales\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of localeFiles) vm.runInContext(read(file), sandbox, { filename: file });
const packs = sandbox.window.ASTRO_LOCALES || {};

const ARRAY = Symbol('array'), OBJECT = Symbol('object'); // branch markers, never equal to a text
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      out.set(key, Array.isArray(v) ? ARRAY : OBJECT);
      flatten(v, key, out);
    } else out.set(key, v);
  }
  return out;
}
const flat = Object.fromEntries(LANGS.map(l => [l, flatten(packs[l]?.translation)]));
const errors = [], warnings = [];
const err = (kind, msg) => errors.push(`${kind}: ${msg}`);
const warn = (kind, msg) => warnings.push(`${kind}: ${msg}`);

// ---- 1. key parity and types ------------------------------------------------------------------------------------
for (const l of LANGS) if (!packs[l]) err('pack', `${l} not loaded`);
const keyKind = v => (v === ARRAY ? 'array' : v === OBJECT ? 'object' : typeof v);
for (const l of LANGS.slice(1)) {
  for (const [key, v] of flat.en) {
    if (!flat[l].has(key)) err('missing', `${l} lacks ${key}`);
    else if (keyKind(flat[l].get(key)) !== keyKind(v)) err('type', `${key}: en ${keyKind(v)}, ${l} ${keyKind(flat[l].get(key))}`);
  }
  for (const key of flat[l].keys()) if (!flat.en.has(key)) err('extra', `${l} has ${key}, en does not`);
}

// ---- 2. placeholders and HTML tags -------------------------------------------------------------------------------
const vars = s => [...String(s).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1]).sort().join(',');
const tags = s => [...String(s).matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)].map(m => m[1].toLowerCase()).sort().join(',');
for (const [key, en] of flat.en) {
  if (typeof en !== 'string') continue;
  for (const l of LANGS.slice(1)) {
    const other = flat[l].get(key);
    if (typeof other !== 'string') continue;
    if (vars(en) !== vars(other)) err('placeholders', `${key}: en {${vars(en)}} vs ${l} {${vars(other)}}`);
    if (tags(en) !== tags(other)) err('tags', `${key}: en <${tags(en)}> vs ${l} <${tags(other)}>`);
    if (en === other && en.trim() && !sameIsFine(key, en, l)) warn('identical', `${l} ${key} = "${en.slice(0, 70)}"`);
  }
}

// ---- 2b. every rocket part has a name and a role in every language (assets/models/parts/manifest.json) ---------
const partsManifest = JSON.parse(read('assets/models/parts/manifest.json'));
for (const l of LANGS) {
  const dict = packs[l]?.translation?.parts || {};
  const gaps = partsManifest.parts.map(p => p.id).filter(id => !dict[id]?.name || !dict[id]?.role);
  for (const id of gaps) err('parts', `${l} lacks the name or role of ${id}`);
}

// ---- 3. keys the page and the code use --------------------------------------------------------------------------
const used = new Map(); // key → first place it is used
const families = new Map(); // dynamic prefix → place
for (const m of html.matchAll(/data-i18n(?:-html|-aria|-title|-placeholder)?="([^"]+)"/g)) if (!used.has(m[1])) used.set(m[1], 'index.html');
const jsFiles = [];
const walk = dir => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'locales') walk(rel); }
    else if (e.name.endsWith('.js')) jsFiles.push(rel);
  }
};
walk('web');
const sources = Object.fromEntries(jsFiles.map(f => [f, read(f)]));
// A minigame's own t(key) reads experiments.<ID>.<key> (web/minigames/core.js); <ID> comes from the file name.
const minigameId = file => /^web\/minigames\/([a-z]-[a-z]\d)\.js$/.exec(file)?.[1]?.toUpperCase();
for (const [file, src] of Object.entries(sources)) {
  const id = minigameId(file);
  if (id) {
    for (const m of src.matchAll(/(?<![\w$.])t\(\s*(['"])([a-zA-Z_][\w.-]*)\1/g)) {
      const key = `experiments.${id}.${m[2]}`;
      if (!used.has(key)) used.set(key, file);
    }
    continue;
  }
  // t('a.b'), T('a.b'), i18n.t("a.b"): literal keys with at least one dot.
  for (const m of src.matchAll(/(?<![\w$])(?:t|T)\(\s*(['"])([a-zA-Z_][\w-]*(?:\.[\w-]+)+)\1/g)) if (!used.has(m[2])) used.set(m[2], file);
  // t(`a.${x}.b`): a family of keys; its static prefix must exist.
  for (const m of src.matchAll(/(?<![\w$])(?:t|T)\(\s*`([a-zA-Z_][\w.-]*)\$\{/g)) {
    const prefix = m[1].replace(/\.$/, '');
    if (prefix && !families.has(prefix)) families.set(prefix, file);
  }
}
for (const [key, where] of used) if (!flat.en.has(key)) err('undefined', `${key} (used in ${where})`);
for (const [prefix, where] of families) if (prefix.includes('.') || flat.en.has(prefix)) {
  if (!flat.en.has(prefix)) err('family', `${prefix}.* (used in ${where}) has no entries`);
}

// ---- 4. hard-coded text -----------------------------------------------------------------------------------------
// index.html: visible text with no data-i18n on its element. The brand and symbols are fine, and so are proper
// names marked translate="no" (the HTML way to keep browser translators off them too) and e-mail addresses or URLs.
const BRAND = /^(?:(?:ASTRO|ROMANA|NASA)\b|[0-9.,:%°\s·/+\-–—×→←↗★▲▼◀▶✕×])+$/;
const LITERAL = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^https?:\/\//;
const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<!--[\s\S]*?-->/g, '');
for (const m of body.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>([^<]+)</gi)) {
  const [, tag, attrs, raw] = m, text = raw.replace(/&[a-z#0-9]+;/gi, ' ').trim();
  if (!/[A-Za-z]{2}/.test(text) || BRAND.test(text) || tag === 'title' || tag === 'option') continue;
  // An id or data-i18n-dynamic: the code fills it (the runtime audit checks what it puts there).
  if (/data-i18n(-html)?=/.test(attrs) || /\sid="|\sdata-i18n-dynamic|\stranslate="no"/.test(attrs)) continue;
  warn('html-text', `<${tag}> "${text.slice(0, 60)}"`);
}
for (const m of body.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
  const attrs = m[2];
  for (const [attr, i18n] of [['aria-label', 'aria'], ['title', 'title'], ['placeholder', 'placeholder'], ['alt', 'alt']]) {
    const a = new RegExp(`\\s${attr}="([^"]*[A-Za-z]{2}[^"]*)"`).exec(attrs);
    if (a && !new RegExp(`data-i18n-${i18n}=|data-i18n-dynamic|translate="no"`).test(attrs) && !BRAND.test(a[1]) && !LITERAL.test(a[1])) warn('html-attr', `${attr}="${a[1].slice(0, 60)}" on <${m[1]}>`);
  }
}
// Code: literal words drawn on a canvas or shown as a toast.
for (const [file, src] of Object.entries(sources)) {
  // A line marked // i18n-ok is a deliberate exception (a proper name painted in the scene, say).
  const lineOf = i => src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i));
  const words = text => /[A-Za-z]{3}/.test(text.replace(/\$\{[^}]*\}/g, ''));
  for (const m of src.matchAll(/\.(?:fillText|strokeText)\(\s*(['"`])([^'"`]*)\1/g)) {
    if (words(m[2]) && !lineOf(m.index).includes('i18n-ok')) warn('canvas-text', `${file}: "${m[2].slice(0, 50)}"`);
  }
  for (const m of src.matchAll(/(?<![\w$.])toast\(\s*(['"`])([^'"`]*)\1/g)) {
    if (words(m[2]) && !lineOf(m.index).includes('i18n-ok')) warn('toast-text', `${file}: "${m[2].slice(0, 50)}"`);
  }
}

// ---- report -----------------------------------------------------------------------------------------------------
const group = list => list.reduce((acc, line) => { const k = line.split(':')[0]; (acc[k] ||= []).push(line.slice(k.length + 2)); return acc; }, {});
const print = (title, list, mark) => {
  const g = group(list);
  for (const [kind, items] of Object.entries(g)) {
    console.log(`${mark} ${title} · ${kind} (${items.length})`);
    for (const item of items.slice(0, 40)) console.log(`    ${item}`);
    if (items.length > 40) console.log(`    … ${items.length - 40} more`);
  }
};
console.log(`i18n check: ${flat.en.size} keys in en · ${used.size} literal keys and ${families.size} key families used by the code and index.html`);
print('error', errors, '✘');
print('warning', warnings, '⚠');
if (!errors.length && !warnings.length) console.log('✔ all checks passed');
else console.log(`${errors.length ? '✘' : '✔'} ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length || (strict && warnings.length) ? 1 : 0);
