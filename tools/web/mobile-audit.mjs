// Mobile & responsive layout audit using headless Edge/Chrome over CDP (no npm dependencies).
// Serves the repo locally, walks Menu, Lobby (steps 1-5), Planner, and #surface-jezero across
// desktop, portrait mobile, and short-height landscape mobile viewports, reporting horizontal overflow,
// clipped overflow:hidden containers, small touch targets (< 32 px), and console/page errors.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { connectCDP, delay, findBrowser, launchBrowser, startStaticServer } from './lib/browser.mjs';

const VIEWPORTS = [
  { name: '915x412', width: 915, height: 412, mobile: true, scale: 2 },
  { name: '844x390', width: 844, height: 390, mobile: true, scale: 3 },
  { name: '667x375', width: 667, height: 375, mobile: true, scale: 2 },
  { name: '412x915', width: 412, height: 915, mobile: true, scale: 2 },
  { name: '390x844', width: 390, height: 844, mobile: true, scale: 3 },
  { name: '1440x900', width: 1440, height: 900, mobile: false, scale: 1 },
];

const args = process.argv.slice(2);
const strict = args.includes('--strict');
// --smoke (npm run web:smoke, CI): one desktop viewport with reduced motion, plus a mission end to end through the
// test hooks: the launch pad cutscene, the surface with the player's experiments done, boarding and the results.
// Fails (exit 1) on any page exception, console.error or step that never happens; layout warnings only print.
// It exists because FLT-01, SURF-01 and GAME-01 broke every mission in one commit (AUDITORIA.md REPO-01).
const smoke = args.includes('--smoke');
const saveScreenshots = args.includes('--screenshots');
// --lang pt|es|en: audit in that language (Portuguese and Spanish run 20–30% longer than English); --pseudo: with
// pseudo-localization (web/i18n.js), every text about a third longer, to catch text that does not fit.
const langIdx = args.indexOf('--lang');
const auditLang = langIdx >= 0 ? args[langIdx + 1] : null;
const pseudoQuery = args.includes('--pseudo') ? 'pseudo&' : '';
const outIdx = args.indexOf('--out');
const screenshotDir = outIdx >= 0 && args[outIdx + 1]
  ? path.resolve(args[outIdx + 1])
  : path.join(os.tmpdir(), 'astro-mobile-audit');

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

  if (auditLang) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('astro-romana-settings', JSON.stringify({ language: '${auditLang}' })); } catch {}` }, sessionId);
  }

  if (smoke) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);

  cdp.on('Runtime.exceptionThrown', p => {
    errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'Runtime exception');
  }, sessionId);
  cdp.on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') errors.push(`console.error: ${p.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
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
  await navigate(`${baseUrl}/index.html${pseudoQuery ? `?${pseudoQuery}` : ''}`);
  await waitFor(`document.querySelector('#menu.active')`, '#menu.active');
  if (smoke) await waitFor(`/^v\\d+\\.\\d+\\.\\d+$/.test(document.getElementById('menu-version')?.textContent) && document.getElementById('menu-version').textContent === 'v' + window.ASTRO_VERSION`, 'the menu version label (web/version.js)', 3000);
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

  if (smoke) {
    // The launch pad cutscene, jumped to its end (FLT-01 hung it forever).
    await cdp.send('Runtime.evaluate', { expression: `window.ASTRO_LAUNCH_JUMP = 1e6; window.ASTRO.launchPad().then(() => { window.__smokePad = true; })` }, sessionId);
    await waitFor(`window.__smokePad === true`, 'the launch pad to finish', 15000);
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

  await navigate(`${baseUrl}/index.html?${pseudoQuery}audit=surface#surface-jezero`);
  await waitFor(`document.querySelector('#surface.active')`, '#surface.active', 12000);
  await waitFor(`document.querySelectorAll('#surface-goals li').length > 0`, '#surface-goals items', 12000);
  await click('#surface-start');
  await delay(250);
  results.push(await auditScreen(cdp, sessionId, vp, '11-surface', errors));

  if (smoke) {
    // The player's experiments (GAME-01 threw on completion), then boarding and the results screen.
    await waitFor(`window.ASTRO_SURFACE?.running?.()`, 'the surface to run', 12000);
    const done = await cdp.send('Runtime.evaluate', {
      expression: `(() => { const sim = window.ASTRO_SIM, mine = sim.surf.tasks.filter(task => task.crew === sim.surf.activeCrew);
        for (const task of mine) { window.ASTRO_SURFACE.goTo(task.id); sim.completeSurfaceTask(task.id, undefined, 3); }
        return mine.length && mine.every(task => sim.surf.completed.has(task.id)) ? mine.length : 0; })()`,
      returnByValue: true,
    }, sessionId);
    if (!done.result?.value) errors.push(`Surface experiments did not complete: ${done.exceptionDetails?.exception?.description?.split('\n')[0] ?? JSON.stringify(done.result?.value)}`);
    await cdp.send('Runtime.evaluate', { expression: `window.ASTRO_SIM.board()` }, sessionId);
    await waitFor(`document.querySelector('#results.active')`, '#results.active after boarding', 20000);
    results.push(await auditScreen(cdp, sessionId, vp, '12-results-after-mission', errors));
  }

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
    const viewports = smoke ? VIEWPORTS.filter(vp => vp.name === '1440x900') : VIEWPORTS;
    for (const vp of viewports) {
      all.push(...await runViewport(cdp, baseUrl, vp));
    }
    if (smoke) {
      const errors = all.flatMap(r => r.errors.map(e => `[${r.stage}] ${e}`));
      const unique = [...new Set(errors)];
      if (unique.length) { console.error(`✘ smoke test: ${unique.length} error(s)\n${unique.map(e => `  ${e}`).join('\n')}`); process.exitCode = 1; }
      else console.log(`✔ smoke test: menu → lobby → planner → launch pad → cockpit → surface (experiments done) → boarding → results, no errors`);
      return;
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
