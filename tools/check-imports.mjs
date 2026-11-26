// npm run check:imports — every relative import in the .mjs files (tools/, multiplayer/, eslint.config.mjs) points at
// a file that exists and exports the names asked for. `node --check` misses this, so a renamed export only broke at
// run time (AUDITORIA.md MOD-01: web:sites imported readRegion after it became readWindow). No dependencies: a
// static read of the house style (`import { a, b as c } from './x.mjs'`, `export function|const|class|{ }`).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.mjs'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/).filter(f => f && !f.includes('node_modules/')).map(f => path.join(ROOT, f));

// Comments out (block comments keep their line breaks, so line numbers still match the file).
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, '')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const exportsCache = new Map();
function exportsOf(file, seen = new Set()) {
  if (exportsCache.has(file)) return exportsCache.get(file);
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = stripComments(fs.readFileSync(file, 'utf8')), names = new Set();
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s+(?:const|let|var)\s+\{([^}]*)\}/gm)) for (const n of m[1].split(',')) { const k = n.split(':').pop().trim().split('=')[0].trim(); if (k) names.add(k); }
  if (/^\s*export\s+default\b/m.test(src)) names.add('default');
  for (const m of src.matchAll(/^\s*export\s*\{([^}]*)\}(?:\s*from\s*'([^']+)')?/gm)) for (const n of m[1].split(',')) { const k = n.trim().split(/\s+as\s+/).pop(); if (k) names.add(k); }
  for (const m of src.matchAll(/^\s*export\s*\*\s*from\s*'(\.[^']+)'/gm)) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (fs.existsSync(target)) for (const n of exportsOf(target, seen)) if (n !== 'default') names.add(n);
  }
  exportsCache.set(file, names);
  return names;
}

const problems = [];
let checked = 0;
for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8')), rel = path.relative(ROOT, file).replaceAll('\\', '/');
  // import x from, import { a, b as c } from, import x, { a } from, import * as ns from, export { a } from, import './x'
  const re = /^\s*(?:import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+[\w$]+)?\s*from\s*|import\s+|export\s*\{([^}]*)\}\s*from\s*)'(\.{1,2}\/[^']+)'/gm;
  for (const m of src.matchAll(re)) {
    const [, def, named, reexported, spec] = m;
    const target = path.resolve(path.dirname(file), spec), line = src.slice(0, m.index).split('\n').length + (m[0].match(/^\s*/)[0].split('\n').length - 1);
    checked++;
    if (!fs.existsSync(target)) { problems.push(`${rel}:${line}  '${spec}' does not exist`); continue; }
    const wanted = [...(def ? ['default'] : []), ...[named, reexported].filter(Boolean).flatMap(list => list.split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean))];
    const has = exportsOf(target);
    for (const name of wanted) if (!has.has(name)) problems.push(`${rel}:${line}  '${spec}' has no export named ${name}`);
  }
}

if (problems.length) {
  console.error(`✘ ${problems.length} broken import(s):\n${problems.map(p => `  ${p}`).join('\n')}`);
  process.exitCode = 1;
} else console.log(`✔ ${checked} relative imports in ${files.length} .mjs files resolve`);
