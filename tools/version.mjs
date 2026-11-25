// Keeps the project version the same everywhere it appears (AGENTS.md §10). No dependencies.
//   npm run version:check             do all the places agree? (exit code 1 if not)
//   npm run version:bump -- patch     1.8.2 → 1.8.3: fixes, tweaks, docs, chores
//   npm run version:bump -- minor     1.8.2 → 1.9.0: big features
//   npm run version:bump -- major     only when the team asks; or -- X.Y.Z to set it outright
// A bump also opens "## [X.Y.Z] - YYYY-MM-DD" at the top of CHANGELOG.md, for the list of changes.
// Git side: `npm install` runs --install-hook (core.hooksPath = .githooks), and .githooks/pre-commit runs
// --pre-commit, which blocks a commit whose staged files keep the last commit's version, disagree with each
// other or have no filled-in CHANGELOG.md section for the new version.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = '(\\d+\\.\\d+\\.\\d+)';
// Every place the version is written: the file and a pattern (text before)(version)(text after).
const PLACES = [
  ['package.json', `^(\\s*"version":\\s*")${V}(")`, 'm'],
  ['package-lock.json', `^( {2}"version":\\s*")${V}(")`, 'm'], // the project itself
  ['package-lock.json', `(\\n {4}"":\\s*\\{\\s*"name":\\s*"[^"]*",\\s*"version":\\s*")${V}(")`, ''], // its packages[""] entry
  ['index.html', `(data-i18n="menu\\.version">v)${V}(<)`, ''],
  ...['en', 'pt', 'es'].map(lang => [`web/locales/${lang}.js`, `(\\bversion:\\s*'v)${V}(')`, '']),
];

const fail = msg => { console.error(`✘ ${msg}`); process.exit(1); };
const file = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(file(rel), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 << 20 });

// The version in every place, read through `get` (the working tree, or the staged files for the hook).
const versionsIn = get => PLACES.map(([rel, src, flags]) => {
  const all = [...get(rel).matchAll(new RegExp(src, `${flags}g`))];
  if (all.length !== 1) fail(`${rel}: expected the version once, found it ${all.length} time(s)`);
  return { rel, re: new RegExp(src, flags), version: all[0][2] };
});
const listing = found => found.map(f => `  ${f.version}  ${f.rel}`).join('\n');
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
// The body of a version's CHANGELOG.md section (null if there is none).
const changelogSection = (text, version) => {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => l.startsWith(`## [${version}]`));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^## \[/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
};

const args = process.argv.slice(2);

if (args.includes('--install-hook')) {
  // Only in a git checkout of this project (not in a copy or a tarball); never fails the install.
  try {
    if (!fs.existsSync(file('.git'))) throw new Error('not a git checkout');
    git('config', 'core.hooksPath', '.githooks');
    try { fs.chmodSync(file('.githooks/pre-commit'), 0o755); } catch { /* Windows: no exec bit to set */ }
    console.log('✔ git hook on: each commit must raise the version and fill its CHANGELOG.md section (AGENTS.md §10)');
  } catch {
    console.log('git hook not turned on (not a git checkout of this project)');
  }
  process.exit(0);
}

if (args.includes('--pre-commit')) {
  // A merge, rebase, cherry-pick or revert brings versions from other commits: nothing to check.
  const inProgress = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']
    .some(p => fs.existsSync(path.resolve(ROOT, git('rev-parse', '--git-path', p).trim())));
  let before;
  try { before = JSON.parse(git('show', 'HEAD:package.json')).version; } catch { before = null; } // first commit
  if (inProgress || !before) process.exit(0);

  const staged = versionsIn(rel => git('show', `:${rel}`));
  const versions = [...new Set(staged.map(f => f.version))];
  const problems = [];
  if (versions.length !== 1) problems.push(`The version differs between the files being committed (git add all the files version:bump changed):\n${listing(staged)}`);
  else if (newer(versions[0], before) <= 0) {
    problems.push(`The version is still ${versions[0]} (last commit: ${before}). Run npm run version:bump -- patch (or minor) and git add the files it changed.`);
    problems.push('Amending the commit that already raised the version? git commit --amend --no-verify');
  }
  else {
    const body = changelogSection(git('show', ':CHANGELOG.md'), versions[0]);
    if (!body) problems.push(`CHANGELOG.md has no "## [${versions[0]}]" section (npm run version:bump opens it).`);
    else if (!body.some(l => l.trim() && !l.trim().startsWith('#'))) problems.push(`The "## [${versions[0]}]" section of CHANGELOG.md is empty: list what was added, changed or fixed.`);
  }
  if (!problems.length) process.exit(0);
  console.error(`✘ Commit blocked (AGENTS.md §10: every commit raises the version and fills its CHANGELOG.md section).\n${problems.join('\n')}`);
  process.exit(1);
}

const found = versionsIn(read);
const versions = [...new Set(found.map(f => f.version))];
const level = args.find(a => !a.startsWith('--'));
if (args.includes('--check') || !level) {
  if (versions.length !== 1) fail(`the version differs between files:\n${listing(found)}`);
  console.log(`✔ version ${versions[0]} in all ${found.length} places`);
  if (!level && !args.includes('--check')) console.log('To bump it: npm run version:bump -- patch | minor | major | X.Y.Z');
  process.exit(0);
}

let next;
if (/^\d+\.\d+\.\d+$/.test(level)) next = level;
else {
  if (versions.length !== 1) fail(`the version differs between files, so there is nothing to bump from (pass X.Y.Z to set them all):\n${listing(found)}`);
  const [major, minor, patch] = versions[0].split('.').map(Number);
  next = { patch: `${major}.${minor}.${patch + 1}`, minor: `${major}.${minor + 1}.0`, major: `${major + 1}.0.0` }[level];
  if (!next) fail(`unknown level "${level}": use patch, minor, major or X.Y.Z`);
}

for (const { rel, re } of found) fs.writeFileSync(file(rel), read(rel).replace(re, `$1${next}$3`));

// CHANGELOG.md: the new version's section, above the latest one (kept if it is already there).
const changelog = read('CHANGELOG.md');
const NL = changelog.includes('\r\n') ? '\r\n' : '\n';
const now = new Date();
const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
let opened = false;
if (!changelog.includes(`## [${next}]`)) {
  const at = changelog.search(/^## \[/m);
  if (at < 0) fail('CHANGELOG.md: no "## [X.Y.Z]" section to put the new one above');
  fs.writeFileSync(file('CHANGELOG.md'), `${changelog.slice(0, at)}## [${next}] - ${today}${NL}${NL}${changelog.slice(at)}`);
  opened = true;
}

console.log(`✔ ${versions.join(' / ')} → ${next} in ${found.length} places:\n${found.map(f => `  ${f.rel}`).join('\n')}`);
console.log(opened ? `Now list what was added, changed or fixed under "## [${next}] - ${today}" in CHANGELOG.md.` : `CHANGELOG.md already has a ${next} section.`);
