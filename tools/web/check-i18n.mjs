// Validates i18n locale packs (web/locales/*.js) for key parity, {{placeholder}} parity,
// and coverage of every rocket part in assets/models/parts/manifest.json.
// Usage: npm run i18n:check
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const localesDir = path.join(root, 'web/locales');
const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.js')).sort();

const ctx = { window: {} };
for (const file of localeFiles) {
  vm.runInNewContext(fs.readFileSync(path.join(localesDir, file), 'utf8'), ctx, { filename: file });
}

const packs = ctx.window.ASTRO_LOCALES || {};
const codes = Object.keys(packs).sort();
if (!packs.en) {
  console.error('✘ Base locale "en" not found.');
  process.exit(1);
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (item && typeof item === 'object') Object.assign(out, flatten(item, `${key}[${idx}]`));
        else out[`${key}[${idx}]`] = item;
      });
    } else if (v && typeof v === 'object') {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const varsOf = str => [...String(str ?? '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();
const enFlat = flatten(packs.en.translation);
const enKeys = Object.keys(enFlat);
let errors = 0;

for (const code of codes) {
  if (code === 'en') continue;
  const flat = flatten(packs[code].translation);
  const missing = enKeys.filter(k => !(k in flat));
  const extra = Object.keys(flat).filter(k => !(k in enFlat));
  const badVars = [];
  for (const k of enKeys) {
    if (!(k in flat)) continue;
    const a = varsOf(enFlat[k]).join(',');
    const b = varsOf(flat[k]).join(',');
    if (a !== b) badVars.push(`${k} (en: [${a}] vs ${code}: [${b}])`);
  }
  if (missing.length) {
    console.error(`✘ [${code}] missing ${missing.length} key(s):`, missing.slice(0, 15).join(', '));
    errors += missing.length;
  }
  if (extra.length) {
    console.error(`✘ [${code}] extra ${extra.length} key(s):`, extra.slice(0, 15).join(', '));
    errors += extra.length;
  }
  if (badVars.length) {
    console.error(`✘ [${code}] placeholder mismatch (${badVars.length}):`, badVars.slice(0, 10).join('; '));
    errors += badVars.length;
  }
  if (!missing.length && !extra.length && !badVars.length) {
    console.log(`✔ [${code}] ${Object.keys(flat).length} keys & placeholders match "en"`);
  }
}

// Verify every rocket part in manifest.json has a translation entry in all locales.
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/models/parts/manifest.json'), 'utf8'));
for (const code of codes) {
  const partsDict = packs[code].translation?.parts || {};
  const missingParts = manifest.parts.map(p => p.id).filter(id => !partsDict[id]?.name || !partsDict[id]?.role);
  if (missingParts.length) {
    console.error(`✘ [${code}] missing ${missingParts.length} rocket part translation(s):`, missingParts.slice(0, 10).join(', '));
    errors += missingParts.length;
  } else {
    console.log(`✔ [${code}] all ${manifest.parts.length} rocket parts translated`);
  }
}

if (errors > 0) {
  console.error(`\n✘ i18n check failed with ${errors} issue(s).`);
  process.exit(1);
}
console.log(`\n✔ i18n check passed across ${codes.length} locales (${codes.join(', ')}).`);
