// Runtime translation audit (headless Edge/Chrome over CDP, no npm dependencies). Run: npm run i18n:audit
// Walks the game's screens in English, Portuguese and Spanish, then once more with pseudo-localization
// (index.html?pseudo, web/i18n.js), and reports:
//   raw keys       - visible text or labels that look like a translation key (chat.title): the key is missing;
//   missing keys   - keys the code asked for that no language has (web/i18n.js report);
//   English leaks  - keys the language lacks, filled in from English by i18next (web/i18n.js report);
//   pseudo misses  - with ?pseudo every translated text is wrapped in ⟦ ⟧, so visible words without it never went
//                    through t(): hard-coded text (the brand, names, numbers and units are left out);
//   page errors    - exceptions and console errors.
// Exit code 1 on raw keys, missing keys, English leaks or page errors (--strict: pseudo misses too).
// The static side (key parity, placeholders, keys used in the code) is tools/web/check-i18n.mjs.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const strict = process.argv.includes('--strict');
const PAGE = pathToFileURL(path.join(ROOT, 'index.html')).href;
const MODES = [{ id: 'en', lang: 'en' }, { id: 'pt', lang: 'pt' }, { id: 'es', lang: 'es' }, { id: 'pseudo', lang: 'en', query: 'pseudo' }];

// Screens to visit: [name, expression run in the page, wait in ms].
const STAGES = [
  ['menu', `ASTRO.show('menu')`, 600],
  ['settings', `document.getElementById('settings-button').click()`, 600],
  ['leaderboard', `document.getElementById('leaderboard-button').click()`, 900],
  ['lobby · mode', `(ASTRO.show('lobby'), ASTRO.setLobbyStep('mode'))`, 800],
  ['lobby · difficulty', `ASTRO.setLobbyStep('difficulty')`, 500],
  ['lobby · destination', `ASTRO.setLobbyStep('destination')`, 800],
  ['lobby · site', `ASTRO.setLobbyStep('site')`, 800],
  ['lobby · crew', `ASTRO.setLobbyStep('crew')`, 800],
  ['planner', `ASTRO.show('planner')`, 1200],
  ['launch review', `document.getElementById('launch-button').click()`, 500],
  ['wizard', `(document.getElementById('launch-dialog').close(), ASTRO.wizard.open(0))`, 700],
  ['cockpit · liftoff', `(ASTRO.wizard.close(), ASTRO.jumpCockpit(0))`, 2500],
  ['cockpit · cabin docking', `ASTRO.jumpCockpit(1)`, 1200],
  ['cockpit · orbital docking', `ASTRO.jumpCockpit(2)`, 1200],
  ['cockpit · landing', `(ASTRO.jumpCockpit(3), document.getElementById('minigame-dialog')?.close())`, 1200],
  ['Mars orbit', `ASTRO.jumpMarsOrbit(6)`, 1500],
  ['orbit minigame', `document.querySelector('[data-orbit-play]')?.click()`, 1500],
  ['surface', `(document.getElementById('minigame-dialog')?.close(), ASTRO.land())`, 7000],
  ['results', `ASTRO.jumpResults()`, 1500],
];

// Visible text and labels on screen; what looks like a key; in pseudo mode, words that skipped t().
const SCAN = `(() => {
  const pseudo = !!window.ASTRO_I18N?.pseudo;
  const KEY = /^[a-z][a-zA-Z0-9]*(\\.[a-zA-Z0-9_-]+)+$/;
  const looksKey = s => KEY.test(s) && /\\.[a-zA-Z]/.test(s) && !/\\.(js|css|html|io|com|png|glb|wav)$/.test(s);
  const crew = (window.ASTRO?.crew || []).map(c => c.name);
  // The brand, crew names and instrument names stay as they are in every language.
  const BRAND = new RegExp('^(ASTRO|ROMANA|NASA|HiRISE|' + crew.join('|') + ')$', 'i');
  // An e-mail address or a URL (the contact link's title) is not a word to translate.
  const LITERAL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$|^https?:\\/\\//;
  // A word that went through t() has its vowels accented (a tag inside a translation splits it into several text
  // nodes, so the ⟦ ⟧ may sit in another node). Plain: 4+ letters, a bare vowel, not the brand or a crew name.
  const plainWords = s => s.replace(/⟦[^⟧]*⟧?/g, ' ').split(/[^A-Za-zÀ-ÿ]+/).filter(w => w.length >= 4 && /[aeiouAEIOU]/.test(w) && !BRAND.test(w));
  const visible = el => {
    if (!el || el.closest('[hidden], script, style, template, dialog:not([open]), [aria-hidden="true"]')) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // What the player typed (names, codes), text written in its own language on purpose (the language buttons) and
  // proper names marked translate="no".
  const docLang = document.documentElement.lang;
  const user = el => el.closest('.room-player, .leader-row b, .mp-name-display, #room-player-name, .chat-msg, .room-code, input, [data-lang], [translate="no"]')
    || [...document.querySelectorAll('[lang]')].some(x => x !== document.documentElement && x.contains(el) && x.lang !== docLang);
  const rawKeys = new Set(), plain = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.trim();
    if (!text || !visible(n.parentElement)) continue;
    if (looksKey(text)) rawKeys.add(text);
    else if (pseudo && !user(n.parentElement)) for (const w of plainWords(text)) plain.add(text.slice(0, 60));
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
    if (!visible(el)) continue;
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const v = (el.getAttribute(attr) || '').trim();
      if (!v) continue;
      if (looksKey(v)) rawKeys.add(attr + '=' + v);
      else if (pseudo && !user(el) && !LITERAL.test(v) && plainWords(v).length) plain.add(attr + '="' + v.slice(0, 50) + '"');
    }
  }
  return { rawKeys: [...rawKeys], plain: [...plain] };
})()`;

function findBrowser() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
    : process.platform === 'darwin'
      ? ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['microsoft-edge', 'google-chrome', 'chromium', 'chromium-browser'];
  return candidates.find(c => !c.includes(path.sep) || existsSync(c)) || null;
}
function launchBrowser(bin, userDataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, '--no-first-run',
      '--no-default-browser-check', '--allow-file-access-from-files', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error(`no DevTools port: ${stderr}`)); }, 15000);
    proc.stderr.on('data', chunk => {
      stderr += chunk;
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); resolve({ proc, wsUrl: m[1] }); }
    });
    proc.on('error', e => { clearTimeout(timer); reject(e); });
  });
}
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    else if (msg.method) listeners.forEach(fn => fn(msg));
  });
  return {
    send: (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId && { sessionId }) })); }),
    on: fn => listeners.push(fn),
    close: () => ws.close(),
  };
}
const delay = ms => new Promise(r => setTimeout(r, ms));

async function audit(cdp, mode) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);
  const errors = new Set();
  cdp.on(msg => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') errors.add((msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).split('\n')[0]);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.add(msg.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('astro-romana-settings', JSON.stringify({ language: '${mode.lang}' })); } catch {}` });
  await send('Page.navigate', { url: `${PAGE}?${mode.query || ''}&r=${Date.now()}` });
  await delay(4500);
  const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
  const found = { rawKeys: new Map(), plain: new Map() };
  for (const [name, expr, wait] of STAGES) {
    try { await evaluate(`(() => { ${expr}; return 1; })()`); } catch (e) { errors.add(`${name}: ${e.message}`); }
    await delay(wait);
    const r = await evaluate(SCAN) || { rawKeys: [], plain: [] };
    for (const k of r.rawKeys) if (!found.rawKeys.has(k)) found.rawKeys.set(k, name);
    for (const p of r.plain) if (!found.plain.has(p)) found.plain.set(p, name);
  }
  const report = await evaluate('window.ASTRO_I18N?.report?.()') || { missing: [], fallback: [] };
  await cdp.send('Target.closeTarget', { targetId });
  return { ...found, missing: report.missing, fallback: report.fallback, errors: [...errors] };
}

const bin = findBrowser();
if (!bin) { console.error('No Edge/Chrome found (set CHROME_BIN).'); process.exit(2); }
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-i18n-'));
const { proc, wsUrl } = await launchBrowser(bin, userDataDir);
const cdp = await connect(wsUrl);
let failures = 0, misses = 0;
try {
  for (const mode of MODES) {
    const r = await audit(cdp, mode);
    const list = (title, items, bad) => {
      if (!items.length) return;
      if (bad) failures += items.length;
      console.log(`  ${bad ? '✘' : '⚠'} ${title} (${items.length})`);
      for (const it of items.slice(0, 30)) console.log(`      ${it}`);
      if (items.length > 30) console.log(`      … ${items.length - 30} more`);
    };
    console.log(`[${mode.id}]`);
    list('raw keys on screen', [...r.rawKeys].map(([k, s]) => `${k}  (${s})`), true);
    list('missing keys', r.missing, true);
    list('English fallbacks', r.fallback.filter(k => !k.startsWith('en:')), true);
    list('page errors', r.errors, true);
    if (mode.query === 'pseudo') { misses = r.plain.size; list('text that skipped t() (pseudo)', [...r.plain].map(([k, s]) => `${k}  (${s})`), strict); }
    if (!r.rawKeys.size && !r.missing.length && !r.fallback.filter(k => !k.startsWith('en:')).length && !r.errors.length && !(mode.query && r.plain.size)) console.log('  ✔ clean');
  }
} finally {
  cdp.close();
  proc.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* the browser may still hold it */ }
}
console.log(failures ? `✘ ${failures} problem(s)` : `✔ no raw keys, missing keys, English fallbacks or page errors${misses ? ` · ${misses} pseudo miss(es) to review` : ''}`);
process.exit(failures || (strict && misses) ? 1 : 0);
