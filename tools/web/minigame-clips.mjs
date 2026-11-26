// npm run web:clips — records the "How to solve" clips (assets/minigames/<lang>/<id>.gif, in English, Portuguese and
// Spanish) from the real game: each
// minigame opens in the minigame lab (the cockpit stages in index.html) in headless Edge/Chrome, an autopilot plays
// it the right way, and the frames become a looping GIF. web/minigame-guide.js shows the clip; without one it falls
// back to its generic SVG animation. The clips change only when this tool runs: re-record a minigame after changing
// its look or controls.
//   npm run web:clips                          every autopilot in tools/web/minigame-clips/
//   npm run web:clips -- --only H-S1,L-O1      some of them (experiment ids or cockpit file ids)
//   npm run web:clips -- --sheet <dir>         also write a contact sheet PNG per clip (for reviewing)
//   npm run web:clips -- --lang pt             only some languages (default en,pt,es)
// An autopilot (tools/web/minigame-clips/<id>.mjs) default-exports
//   { id, fileId?, seed?, level?, maxSeconds?, speed?, endHoldMs?, fps?, width?, setup?(p), play(p) }
// (fps and width lower the size of a clip whose whole picture moves every frame, such as a scrolling ground).
// and drives the page only through `p` (see makePage below): real CDP input, so the game sees trusted events, plus
// an on-screen cursor and key cap that the clip shows. Clips are not byte-reproducible (they follow real time).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, connectCDP, delay, findBrowser, launchBrowser, startStaticServer } from './lib/browser.mjs';
import { decodePng, encodePng } from '../modeling/lib/png.mjs';
import { encodeGif } from './lib/gif.mjs';

const OUT_DIR = path.join(ROOT, 'assets/minigames');
const PILOTS_DIR = path.join(ROOT, 'tools/web/minigame-clips');
const CLIP = {
  width: 420, // px of the GIF; the guide shows it about 280–320 CSS px wide
  fps: 10,
  maxSeconds: 12, // recording cap when an autopilot does not set its own
  endHoldMs: 1400, // the last frame stays this long before the loop restarts
  viewport: { width: 1000, height: 1200 },
};

const args = process.argv.slice(2);
const argOf = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--only')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const sheetDir = argOf('--sheet');
const LANGS = ['en', 'pt', 'es']; // the game's languages: each gets its own set of clips (the guide falls back to en)
const langs = (argOf('--lang') || LANGS.join(',')).split(',').map(s => s.trim()).filter(Boolean);
if (langs.some(l => !LANGS.includes(l))) throw new Error(`--lang: use some of ${LANGS.join(', ')}`);

// --- page helper ---------------------------------------------------------------------------------------------
const KEYS = {
  ArrowLeft: [37, '←'], ArrowUp: [38, '↑'], ArrowRight: [39, '→'], ArrowDown: [40, '↓'],
  Space: [32, 'Space', ' '], Enter: [13, 'Enter', '\r'], Escape: [27, 'Esc'], Tab: [9, 'Tab'], ShiftLeft: [16, 'Shift'],
};
function keyInfo(code) {
  if (KEYS[code]) { const [vk, label, text] = KEYS[code]; return { code, key: text ?? code, vk, label, text }; }
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return { code, key: m[1].toLowerCase(), vk: m[1].charCodeAt(0), label: m[1], text: m[1].toLowerCase() };
  m = /^Digit([0-9])$/.exec(code);
  if (m) return { code, key: m[1], vk: 48 + Number(m[1]), label: m[1], text: m[1] };
  throw new Error(`autopilot: unknown key code ${code}`);
}

// Overlay drawn into the page (and so into the clip): a faceted cursor and the key being pressed.
const OVERLAY = `(() => {
  if (window.__clip) return;
  const css = document.createElement('style');
  css.textContent = \`
    #clip-cursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;transition:transform .05s}
    #clip-cursor svg{display:block;filter:drop-shadow(0 2px 0 #07020f)}
    #clip-cursor.down svg{transform:scale(.82)}
    #clip-cursor .ring{position:absolute;left:-11px;top:-11px;width:28px;height:28px;border:3px solid #F59E0B;clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%);opacity:0}
    #clip-cursor.down .ring{opacity:1}
    #clip-keys{position:fixed;z-index:2147483647;pointer-events:none;display:flex;gap:6px}
    #clip-keys span{min-width:34px;padding:6px 10px;font:700 15px/1 'Chakra Petch',sans-serif;letter-spacing:.06em;text-align:center;color:#07020f;background:#F59E0B;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);box-shadow:inset 0 -3px 0 #b45309}\`;
  document.head.append(css);
  const cur = document.createElement('div');
  cur.id = 'clip-cursor'; cur.hidden = true;
  cur.innerHTML = '<span class="ring"></span><svg width="22" height="26" viewBox="0 0 22 26"><path d="M1 1 L1 21 L6.5 16 L10 24.5 L14 22.8 L10.6 14.6 L18 14.6 Z" fill="#FFF7E6" stroke="#07020f" stroke-width="1.6" stroke-linejoin="bevel"/></svg>';
  const keys = document.createElement('div');
  keys.id = 'clip-keys';
  document.body.append(cur, keys);
  window.__clip = {
    move(x, y) { cur.hidden = false; cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; },
    down(on) { cur.classList.toggle('down', on); },
    hide() { cur.hidden = true; },
    keys(labels, at) { keys.replaceChildren(...labels.map(l => Object.assign(document.createElement('span'), { textContent: l }))); keys.style.left = at.x + 'px'; keys.style.top = at.y + 'px'; },
  };
})()`;

// Key caps that are words follow the clip's language (the game's own buttons say "Espaço", "Espacio").
const KEY_WORDS = { pt: { Space: 'Espaço' }, es: { Space: 'Espacio' } };
function makePage(cdp, sessionId, getRect, lang = 'en') {
  const send = (method, params) => cdp.send(method, params, sessionId);
  const held = new Map(); // code → label, for the key overlay
  const mouse = { x: 0, y: 0, down: false };
  const started = Date.now();
  const showKeys = async () => {
    const r = getRect();
    await p.evalRaw(`window.__clip && window.__clip.keys(${JSON.stringify([...held.values()])}, { x: ${Math.round(r.x + r.width - 12 - 58 * held.size)}, y: ${Math.round(r.y + r.height - 44)} })`);
  };
  const center = async target => {
    if (typeof target !== 'string') return target;
    // Into view inside its scrolling list first ('nearest' leaves the page alone when the element is on screen).
    await p.eval(sel => document.querySelector(sel)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), target);
    const r = await p.rect(target);
    if (!r) throw new Error(`autopilot: no element ${target}`);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const p = {
    send,
    wait: ms => delay(ms),
    elapsed: () => (Date.now() - started) / 1000,
    async evalRaw(expression) {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (res.exceptionDetails) throw new Error(`autopilot eval: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
      return res.result?.value;
    },
    // Runs fn(...args) in the page and returns its (JSON-able) value.
    eval(fn, ...args) { return p.evalRaw(`(${fn})(...${JSON.stringify(args)})`); },
    async until(fn, { timeout = 8000, every = 50, args = [] } = {}) {
      const end = Date.now() + timeout;
      for (;;) {
        const v = await p.eval(fn, ...args);
        if (v) return v;
        if (Date.now() > end) throw new Error(`autopilot: timed out waiting for ${String(fn).slice(0, 120)}`);
        await delay(every);
      }
    },
    // Viewport rectangle of the first element matching a selector (null if none).
    rect: selector => p.eval(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, selector),
    rects: selector => p.eval(sel => [...document.querySelectorAll(sel)].map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }), selector),
    // Mouse (shown as the clip cursor). Targets are a selector or {x, y} in viewport px.
    async move(target, { ms = 260, steps = Math.max(2, Math.round(ms / 25)) } = {}) {
      const to = await center(target), from = { ...mouse };
      for (let i = 1; i <= steps; i++) {
        const k = i / steps, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
        mouse.x = from.x + (to.x - from.x) * e; mouse.y = from.y + (to.y - from.y) * e;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x, y: mouse.y, button: mouse.down ? 'left' : 'none', buttons: mouse.down ? 1 : 0 });
        await p.evalRaw(`window.__clip && window.__clip.move(${mouse.x}, ${mouse.y})`);
        if (steps > 1) await delay(ms / steps);
      }
    },
    async down() {
      mouse.down = true;
      await p.evalRaw('window.__clip && window.__clip.down(true)');
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: mouse.x, y: mouse.y, button: 'left', buttons: 1, clickCount: 1 });
    },
    async up() {
      mouse.down = false;
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mouse.x, y: mouse.y, button: 'left', buttons: 0, clickCount: 1 });
      await p.evalRaw('window.__clip && window.__clip.down(false)');
    },
    async click(target, { moveMs = 320, holdMs = 90, after = 160 } = {}) {
      await p.move(target, { ms: moveMs });
      await p.down(); await delay(holdMs); await p.up();
      if (after) await delay(after);
    },
    async drag(from, to, { moveMs = 300, ms = 600 } = {}) {
      await p.move(from, { ms: moveMs });
      await p.down();
      await p.move(to, { ms });
      await p.up();
    },
    hideCursor: () => p.evalRaw('window.__clip && window.__clip.hide()'),
    // Keyboard (shown as key caps at the clip's bottom right).
    async keyDown(code) {
      const k = keyInfo(code);
      if (held.has(code)) return;
      held.set(code, KEY_WORDS[lang]?.[code] ?? k.label);
      await send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, text: k.text });
      await showKeys();
    },
    async keyUp(code) {
      const k = keyInfo(code);
      held.delete(code);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk });
      await showKeys();
    },
    async press(code, holdMs = 110, after = 120) {
      await p.keyDown(code); await delay(holdMs); await p.keyUp(code);
      if (after) await delay(after);
    },
    // The mounted minigame (lab only): its layout and level numbers, and the def's solver when it has one.
    lab: () => p.eval(() => {
      const { id, seed, level } = window.LAB.state, MG = window.ASTRO_MINIGAMES;
      return { id, seed, level, P: MG.params(id, level), ...MG.layout(id, seed, level) };
    }),
    solve: () => p.eval(() => {
      const { id, seed, level } = window.LAB.state, MG = window.ASTRO_MINIGAMES, def = MG.def(id);
      return def?.solve ? def.solve(MG.layout(id, seed, level).layout, MG.params(id, level)) : null;
    }),
  };
  return p;
}

// --- recording ---------------------------------------------------------------------------------------------
function startCapture(cdp, sessionId, getRect, fps, width) {
  const frames = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      const t0 = Date.now(), r = getRect();
      try {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: r.x, y: r.y, width: r.width, height: r.height, scale: width / r.width } }, sessionId);
        frames.push({ png: Buffer.from(data, 'base64'), t: t0 });
      } catch { /* a frame lost while the page navigates */ }
      const wait = 1000 / fps - (Date.now() - t0);
      if (wait > 0) await delay(wait);
    }
  })();
  return async () => { running = false; await loop; return frames; };
}

function toRgba(img, width, height) {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    if (x >= img.width || y >= img.height) { out[o + 3] = 255; continue; }
    const i = (y * img.width + x) * img.channels;
    out[o] = img.data[i]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i + 2]; out[o + 3] = 255;
  }
  return out;
}

function contactSheet(frames, width, height, file) {
  const picks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(k => frames[Math.min(frames.length - 1, Math.round(k * (frames.length - 1)))]);
  const cols = 3, rows = 2, W = width * cols, H = height * rows, data = new Uint8Array(W * H * 3);
  picks.forEach((f, n) => {
    const ox = (n % cols) * width, oy = Math.floor(n / cols) * height;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = ((oy + y) * W + ox + x) * 3;
      data[d] = f.rgba[s]; data[d + 1] = f.rgba[s + 1]; data[d + 2] = f.rgba[s + 2];
    }
  });
  fs.writeFileSync(file, encodePng({ width: W, height: H, channels: 3, data }));
}

async function recordOne(cdp, baseUrl, pilot, lang) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext', {});
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...CLIP.viewport, deviceScaleFactor: 1, mobile: false }, sessionId);
    // No scrollbar: one appearing mid-clip (a taller page) would shift the recorded region sideways.
    await cdp.send('Emulation.setScrollbarsHidden', { hidden: true }, sessionId);
    cdp.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails?.exception?.description || e.exceptionDetails?.text), sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('astro-romana-settings', JSON.stringify({ language: '${lang}' })); } catch {}` }, sessionId);

    let rect = null;
    const getRect = () => rect;
    const p = makePage(cdp, sessionId, getRect, lang);
    p.baseUrl = baseUrl;
    p.navigate = async url => {
      const loaded = new Promise(resolve => { const fn = () => { cdp.off('Page.loadEventFired', fn, sessionId); resolve(); }; cdp.on('Page.loadEventFired', fn, sessionId); setTimeout(resolve, 15000); });
      await cdp.send('Page.navigate', { url }, sessionId);
      await loaded;
    };
    // The region to record: a selector (default: the lab's minigame stage) measured after setup.
    // Horizontally it also takes in children that stick out, plus padX on each side (the minigame readouts sit
    // flush with the stage edges).
    p.frame = async (selector, pad = 0, padX = pad) => {
      await p.eval(sel => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), selector);
      await delay(150);
      const r = await p.eval(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const box = el.getBoundingClientRect();
        let left = box.left, right = box.right;
        for (const child of el.querySelectorAll('*')) {
          const c = child.getBoundingClientRect();
          if (!c.width || !c.height || getComputedStyle(child).visibility === 'hidden') continue;
          left = Math.min(left, c.left); right = Math.max(right, c.right);
        }
        left = Math.max(0, left); right = Math.min(innerWidth, right);
        return { x: left, y: box.top, width: right - left, height: box.height };
      }, selector);
      if (!r) throw new Error(`autopilot: nothing to record at ${selector}`);
      rect = { x: Math.max(0, Math.round(r.x - padX)), y: Math.max(0, Math.round(r.y - pad)), width: Math.round(r.width + 2 * padX), height: Math.round(r.height + 2 * pad) };
      return rect;
    };
    // Lab only: the result card and the log under the stage stay out of the clip (the stage gets shorter at the end).
    p.labClean = () => p.evalRaw(`document.head.insertAdjacentHTML('beforeend', '<style>#lab-result,#lab-log{display:none!important}</style>')`);

    if (pilot.setup) await pilot.setup(p);
    else {
      const level = pilot.level || 'normal', seed = pilot.seed ?? 7;
      await p.navigate(`${baseUrl}/tools/minigame-lab/index.html#${pilot.id}/${level}/${seed}/${lang}`);
      await p.until(() => window.LAB?.state?.ctrl && document.querySelector('#lab-stage')?.childElementCount > 0, { timeout: 15000 });
      await p.labClean();
      await p.frame('#lab-stage', 0, 12);
    }
    if (!rect) throw new Error('autopilot setup did not call p.frame(selector)');
    await p.evalRaw(OVERLAY);
    await delay(250);

    const stop = startCapture(cdp, sessionId, getRect, pilot.fps ?? CLIP.fps, pilot.width ?? CLIP.width);
    const limit = (pilot.maxSeconds ?? CLIP.maxSeconds) * 1000;
    let timedOut = false;
    await Promise.race([pilot.play(p), delay(limit).then(() => { timedOut = true; })]);
    await p.hideCursor().catch(() => {});
    await delay(200);
    const shots = await stop();
    if (shots.length < 2) throw new Error('fewer than 2 frames recorded');

    const first = decodePng(shots[0].png), width = first.width, height = first.height, speed = pilot.speed ?? 1;
    const frames = shots.map((s, i) => ({
      rgba: toRgba(i ? decodePng(s.png) : first, width, height),
      delayMs: i < shots.length - 1 ? (shots[i + 1].t - s.t) / speed : (pilot.endHoldMs ?? CLIP.endHoldMs),
    }));
    const gif = encodeGif({ width, height, frames });
    const fileId = pilot.fileId || pilot.id.toLowerCase();
    fs.mkdirSync(path.join(OUT_DIR, lang), { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, lang, `${fileId}.gif`), gif);
    if (sheetDir) { fs.mkdirSync(sheetDir, { recursive: true }); contactSheet(frames, width, height, path.join(sheetDir, `${lang}-${fileId}-sheet.png`)); }
    const seconds = frames.reduce((s, f) => s + f.delayMs, 0) / 1000;
    return { fileId: `${lang}/${fileId}`, width, height, frames: frames.length, seconds: +seconds.toFixed(1), kb: Math.round(gif.length / 1024), timedOut, errors };
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

async function loadPilots() {
  const files = fs.readdirSync(PILOTS_DIR).filter(f => f.endsWith('.mjs') && !f.startsWith('_')).sort();
  const pilots = [];
  for (const f of files) {
    const mod = (await import(pathToFileURL(path.join(PILOTS_DIR, f)).href)).default;
    if (!mod?.id || typeof mod.play !== 'function') throw new Error(`${f}: default export needs { id, play }`);
    pilots.push(mod);
  }
  return pilots;
}

async function main() {
  const pilots = (await loadPilots()).filter(pl => !only || only.includes(pl.id) || only.includes(pl.fileId));
  if (!pilots.length) { console.error(`✘ no autopilot matches ${only?.join(', ') ?? '(none in tools/web/minigame-clips/)'}`); process.exitCode = 1; return; }
  const bin = findBrowser();
  if (!bin) { console.error('✘ no Edge/Chrome found: set CHROME_BIN'); process.exitCode = 1; return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = await fsp.mkdtemp(path.join(os.tmpdir(), 'astro-clips-'));
  const { server, baseUrl } = await startStaticServer();
  let proc = null, cdp = null, failed = 0;
  try {
    const launched = await launchBrowser(bin, profile);
    proc = launched.proc;
    cdp = await connectCDP(launched.wsUrl);
    for (const lang of langs) for (const pilot of pilots) {
      try {
        const r = await recordOne(cdp, baseUrl, pilot, lang);
        const warn = [r.timedOut && 'hit maxSeconds', ...r.errors.map(e => `page error: ${String(e).split('\n')[0]}`)].filter(Boolean);
        console.log(`${warn.length ? '⚠' : '✔'} ${r.fileId}.gif  ${r.width}×${r.height}, ${r.frames} frames, ${r.seconds} s, ${r.kb} KB${warn.length ? `  (${warn.join('; ')})` : ''}`);
      } catch (err) {
        failed++;
        console.error(`✘ ${lang}/${pilot.fileId || pilot.id}: ${err.message}`);
      }
    }
  } finally {
    cdp?.close();
    proc?.kill();
    server.close();
    await fsp.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  if (failed) process.exitCode = 1;
}

main().catch(err => { console.error(err); process.exitCode = 1; });
