// Mobile & responsive layout audit using headless Edge/Chrome over CDP (no npm dependencies).
// Serves the repo locally, walks Menu, Lobby (steps 1-5), Planner, and #surface-jezero across
// desktop, portrait mobile, and short-height landscape mobile viewports, reporting horizontal overflow,
// clipped overflow:hidden containers, small touch targets (< 32 px), and console/page errors.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const VIEWPORTS = [
  { name: '915x412', width: 915, height: 412, mobile: true, scale: 2 },
  { name: '844x390', width: 844, height: 390, mobile: true, scale: 3 },
  { name: '667x375', width: 667, height: 375, mobile: true, scale: 2 },
  { name: '412x915', width: 412, height: 915, mobile: true, scale: 2 },
  { name: '390x844', width: 390, height: 844, mobile: true, scale: 3 },
  { name: '1440x900', width: 1440, height: 900, mobile: false, scale: 1 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
};

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const saveScreenshots = args.includes('--screenshots');
const outIdx = args.indexOf('--out');
const screenshotDir = outIdx >= 0 && args[outIdx + 1]
  ? path.resolve(args[outIdx + 1])
  : path.join(os.tmpdir(), 'astro-mobile-audit');

function findBrowser() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ]
      : ['microsoft-edge', 'google-chrome', 'chromium', 'chromium-browser'];

  for (const c of candidates) {
    if (c && (!c.includes(path.sep) || existsSync(c))) return c;
  }
  return null;
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
        const filePath = path.resolve(ROOT, rel);
        if (!filePath.startsWith(ROOT)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        const stat = await fs.stat(filePath).catch(() => null);
        const target = stat?.isDirectory() ? path.join(filePath, 'index.html') : filePath;
        const data = await fs.readFile(target);
        const ext = path.extname(target).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404).end('Not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function launchBrowser(bin, userDataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--mute-audio',
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timed out waiting for browser DevTools port. stderr=${stderr}`));
    }, 15000);

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ proc, wsUrl: m[1] });
      }
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Browser exited early (${code}): ${stderr}`));
    });
  });
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const key = `${msg.sessionId || ''}:${msg.method}`;
        for (const fn of this.listeners.get(key) || []) fn(msg.params);
      }
    });
  }
  send(method, params = {}, sessionId = undefined) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(method, fn, sessionId = '') {
    const key = `${sessionId}:${method}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(fn);
  }
  close() {
    this.ws.close();
  }
}

async function connectCDP(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return new CDPClient(ws);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

const MEASURE_EXPR = `(function(isMobile){
  const vw = window.innerWidth, vh = window.innerHeight;
  const hOverflow = Math.ceil(document.documentElement.scrollWidth) - vw;
  const offRight = [];
  for (const el of document.querySelectorAll('.screen.active *')) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.closest('[hidden]') || el.closest('[aria-hidden="true"]') || el.closest('dialog:not([open])')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Ignore elements inside scrollable horizontal or hidden-overflow decorative stages
    if (r.right > vw + 3) {
      const idDesc = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : '');
      let clippedByAncestor = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'hidden' || ps.overflowX === 'clip' || ps.overflowX === 'auto' || ps.overflowX === 'scroll') { clippedByAncestor = true; break; }
      }
      if (!clippedByAncestor) offRight.push({ el: idDesc, right: Math.round(r.right), vw });
    }
  }
  const clipped = [];
  const checkSelectors = ['#menu', '.menu-shell', '.menu-copy', '#lobby', '.lobby-main', '#lobby-stepper', '.lobby-step-tab', '.setup-card', '.mode-visual', '.site-card', '.site-card-body', '.crew-card', '.dossier', '.cockpit-deck', '.surface-goals'];
  const seen = new Set();
  for (const sel of checkSelectors) {
    for (const el of document.querySelectorAll('.screen.active ' + sel + ', .screen.active' + sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (el.closest('[hidden]') || el.closest('[aria-hidden="true"]') && !el.classList.contains('mode-visual')) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((st.overflowY === 'hidden' || st.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 4) {
        // Ignore intentionally hidden horizontal strip or zero-content decorative clip
        clipped.push({ el: sel, id: el.id || '', sh: el.scrollHeight, ch: el.clientHeight });
      }
      if ((st.overflowX === 'hidden' || st.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 4) {
        clipped.push({ el: sel + ':x', id: el.id || '', sw: el.scrollWidth, cw: el.clientWidth });
      }
    }
  }
  const smallTouch = [];
  if (isMobile) {
    for (const el of document.querySelectorAll('.screen.active button, .screen.active a[href], .screen.active input:not([type="hidden"]), .screen.active select')) {
      if (el.disabled || el.closest('[hidden]') || el.closest('[aria-hidden="true"]') || el.closest('dialog:not([open])')) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.width < 32 || r.height < 32) {
        const desc = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : '');
        smallTouch.push({ el: desc, w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
  }
  return { vw, vh, hOverflow: Math.max(0, hOverflow), offRight: offRight.slice(0, 6), clipped, smallTouch };
})`;

async function auditScreen(cdp, sessionId, vp, stageName, errors) {
  await delay(saveScreenshots ? 600 : 180);
  const res = await cdp.send('Runtime.evaluate', {
    expression: MEASURE_EXPR + `(${vp.mobile})`,
    returnByValue: true,
  }, sessionId);
  const data = res.result?.value || { vw: vp.width, vh: vp.height, hOverflow: -1, offRight: [], clipped: [], smallTouch: [] };
  if (saveScreenshots) {
    await fs.mkdir(screenshotDir, { recursive: true });
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    await fs.writeFile(path.join(screenshotDir, `${vp.name}-${stageName}.png`), Buffer.from(shot.data, 'base64'));
  }
  return { viewport: vp.name, stage: stageName, ...data, errors: errors.splice(0) };
}

async function runViewport(cdp, baseUrl, vp) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext', {});
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.scale,
    mobile: vp.mobile,
  }, sessionId);
  if (vp.mobile) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }, sessionId);
  }

  cdp.on('Runtime.exceptionThrown', p => {
    errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'Runtime exception');
  }, sessionId);

  const navigate = async url => {
    const loaded = new Promise(resolve => {
      const timer = setTimeout(resolve, 6000);
      const listener = () => { clearTimeout(timer); resolve(); };
      cdp.on('Page.loadEventFired', listener, sessionId);
    });
    await cdp.send('Page.navigate', { url }, sessionId);
    await loaded;
    await delay(350);
  };

  const click = async selector => {
    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})?.click()`,
    }, sessionId);
  };

  const waitFor = async (expr, label, timeoutMs = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await cdp.send('Runtime.evaluate', { expression: `Boolean(${expr})`, returnByValue: true }, sessionId);
      if (res.result?.value) return true;
      await delay(80);
    }
    errors.push(`Timeout waiting for ${label}`);
    return false;
  };

  const results = [];
  await navigate(`${baseUrl}/index.html`);
  await waitFor(`document.querySelector('#menu.active')`, '#menu.active');
  results.push(await auditScreen(cdp, sessionId, vp, '01-menu', errors));

  await click('#play-button');
  await waitFor(`document.querySelector('#lobby.active') && !document.querySelector('#lobby-step-mode').hidden`, '#lobby-step-mode');
  results.push(await auditScreen(cdp, sessionId, vp, '02-lobby-mode', errors));

  await click('#mode-solo-btn');
  await waitFor(`!document.querySelector('#lobby-step-difficulty').hidden`, '#lobby-step-difficulty');
  results.push(await auditScreen(cdp, sessionId, vp, '03-lobby-difficulty', errors));

  await click('[data-lobby-step="destination"]');
  await waitFor(`!document.querySelector('#lobby-step-destination').hidden`, '#lobby-step-destination');
  results.push(await auditScreen(cdp, sessionId, vp, '04-lobby-destination', errors));

  await click('[data-lobby-step="site"]');
  await waitFor(`!document.querySelector('#lobby-step-site').hidden`, '#lobby-step-site');
  results.push(await auditScreen(cdp, sessionId, vp, '05-lobby-site', errors));

  await click('[data-lobby-step="crew"]');
  await waitFor(`!document.querySelector('#lobby-step-crew').hidden`, '#lobby-step-crew');
  results.push(await auditScreen(cdp, sessionId, vp, '06-lobby-crew', errors));

  await click('#lobby-next');
  await waitFor(`document.querySelector('#planner.active')`, '#planner.active');
  await click('#wizard-prompt-dismiss');
  await delay(140);
  results.push(await auditScreen(cdp, sessionId, vp, '07-planner', errors));
  if (vp.width <= 640) {
    await click('[data-planner-tab="catalog"]');
    results.push(await auditScreen(cdp, sessionId, vp, '07b-planner-parts', errors));
    await click('[data-planner-tab="telemetry"]');
    results.push(await auditScreen(cdp, sessionId, vp, '07c-planner-telemetry', errors));
  } else if (vp.height <= 500) {
    await click('[data-planner-tab="telemetry"]');
    results.push(await auditScreen(cdp, sessionId, vp, '07c-planner-telemetry', errors));
  }

  await cdp.send('Runtime.evaluate', { expression: `window.ASTRO?.jumpCockpit?.(0)` }, sessionId);
  await waitFor(`document.querySelector('#cockpit.active')`, '#cockpit.active');
  results.push(await auditScreen(cdp, sessionId, vp, '08-cockpit-liftoff', errors));

  await cdp.send('Runtime.evaluate', { expression: `window.ASTRO?.jumpCockpit?.(2)` }, sessionId);
  await delay(180);
  results.push(await auditScreen(cdp, sessionId, vp, '09-cockpit-dock', errors));

  await cdp.send('Runtime.evaluate', { expression: `window.ASTRO?.jumpResults?.()` }, sessionId);
  await waitFor(`document.querySelector('#results.active')`, '#results.active');
  results.push(await auditScreen(cdp, sessionId, vp, '10-results', errors));

  await navigate(`${baseUrl}/index.html?audit=surface#surface-jezero`);
  await waitFor(`document.querySelector('#surface.active')`, '#surface.active', 12000);
  await waitFor(`document.querySelectorAll('#surface-goals li').length > 0`, '#surface-goals items', 12000);
  await click('#surface-start');
  await delay(250);
  results.push(await auditScreen(cdp, sessionId, vp, '11-surface', errors));

  await cdp.send('Target.closeTarget', { targetId });
  await cdp.send('Target.disposeBrowserContext', { browserContextId });
  return results;
}

async function main() {
  const browserBin = findBrowser();
  if (!browserBin) {
    console.error('No Chromium/Edge executable found. Set CHROME_BIN to run mobile-audit.');
    process.exit(1);
  }
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'astro-audit-profile-'));
  const { server, baseUrl } = await startStaticServer();
  let proc = null;
  let cdp = null;
  try {
    const launched = await launchBrowser(browserBin, userDataDir);
    proc = launched.proc;
    cdp = await connectCDP(launched.wsUrl);
    const all = [];
    for (const vp of VIEWPORTS) {
      all.push(...await runViewport(cdp, baseUrl, vp));
    }

    let issueCount = 0;
    for (const r of all) {
      const problems = [];
      if (r.hOverflow > 0) problems.push(`hOverflow=${r.hOverflow}px`);
      if (r.offRight.length) problems.push(`offRight=${JSON.stringify(r.offRight)}`);
      if (r.clipped.length) problems.push(`clipped=${JSON.stringify(r.clipped)}`);
      if (r.smallTouch.length) problems.push(`smallTouch(<32px)=${JSON.stringify(r.smallTouch)}`);
      if (r.errors.length) problems.push(`errors=${JSON.stringify(r.errors)}`);
      if (problems.length) {
        issueCount += problems.length;
        console.log(`WARN [${r.viewport}] ${r.stage}: ${problems.join(' | ')}`);
      }
    }
    console.log(`Mobile audit complete: ${all.length} checks across ${VIEWPORTS.length} viewports, ${issueCount} issue group(s).`);
    if (saveScreenshots) console.log(`Screenshots saved to ${screenshotDir}`);
    if (strict && issueCount > 0) process.exitCode = 1;
  } finally {
    cdp?.close();
    proc?.kill();
    server.close();
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
