(async () => {
// Launch pad: the rocket the crew designed stands on the pad while the camera circles it and the countdown
// runs. At zero the engines light, the stack starts to climb and the camera flies up to the pilot's windows
// (the closed cabin faces +Z); the screen fades and the cockpit, in the pilot's view, takes over.
// The climb pace follows the net thrust (lift.accel, from the liftoff TWR in web/app.js). A rocket that cannot lift
// off (lift.ok false) stays on the pad: nothing lights without a working engine; with thrust below its weight the
// engines burn, the stack strains and the engines shut down. The screen then fades to the debrief.
// window.ASTRO_LAUNCHPAD(lift) shows this screen and resolves when the cockpit (or the debrief) should start.
// The same screen also shows a Δv abort ending in a splashdown (window.ASTRO_SPLASHDOWN, below).
const THREE = await import('three');
const screen = document.getElementById('launchpad'), host = document.getElementById('launchpad-view');
const $id = id => document.getElementById(id);
const ui = window.ASTRO, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const t = (key, opts) => window.ASTRO_I18N?.t(key, opts) ?? key;
// game: countdown length, how long the engines burn on screen before the camera moves, the fly-in time; on a
// failed liftoff, how long the engines burn on the pad before the shutdown and how long the pad stays on screen.
const COUNT = 10, IGNITION_HOLD = 1.6, FLY_IN = 2.2, PAD_BURN = 3, FAIL_HOLD = 4.5;
const STATUS = [[10, 'launch.pad.status10'], [7, 'launch.pad.status7'], [5, 'launch.pad.status5'], [2, 'launch.pad.status2'], [0, 'launch.pad.status0']];

let renderer = null;
function ensureRenderer() {
  if (renderer) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
  } catch { renderer = null; }
  return renderer;
}
function releaseRenderer() {
  if (!renderer) return;
  renderer.dispose();
  renderer.forceContextLoss?.();
  renderer.domElement.remove();
  renderer = null;
  view = null;
  seaView = null;
}
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, ...extra });
let view = null;

// Stylized Sorocaba technology park, reconstructed from the supplied photographs.
// Dimensions and placement are game-scale approximations, not a surveyed site plan.
function addTechnologyPark(scene) {
  const park = new THREE.Group(); scene.add(park);
  const concrete = flat(0xbcb9ae), seam = flat(0x8b8982), glass = flat(0x26665d, { metalness: .12, roughness: .35 });
  const pavement = flat(0xafa99d), road = flat(0x777a76), trunk = flat(0x74644b);
  const greens = [flat(0x466f38), flat(0x5c833e), flat(0x78954b), flat(0x345d38)];
  const white = flat(0xe3e8e5), greyCloud = flat(0xc5d0d3);
  const box = (parent, w, h, d, mat, x, y, z, ry = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.rotation.y = ry; parent.add(mesh); return mesh;
  };

  // The photographed building is a broad, curved concrete facade over a band of green glazing.
  // Short tangent panels make the horseshoe recognisable while keeping a faceted low-poly silhouette.
  const building = new THREE.Group(); building.position.set(0, 0, -55); park.add(building);
  const radius = 28, segments = 14, start = -1.12, span = 2.24;
  for (let i = 0; i < segments; i++) {
    const a = start + (i + .5) * span / segments, width = 2 * radius * Math.tan(span / segments / 2) + .03;
    const x = Math.sin(a) * radius, z = Math.cos(a) * radius - radius;
    box(building, width, 2.7, .35, glass, x, 1.55, z, a);
    box(building, width, 5.1, .7, concrete, x, 5.45, z, a);
    for (const y of [3.02, 5.25, 7.72]) box(building, width, .045, .74, seam, x, y, z, a);
    box(building, .14, 2.7, .46, concrete, x - Math.cos(a) * width * .48, 1.55, z + Math.sin(a) * width * .48, a);
  }
  // Dark lettering follows the facade; layered, offset silhouettes give it visible depth.
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 2048; signCanvas.height = 128;
  const signContext = signCanvas.getContext('2d');
  signContext.textAlign = 'center'; signContext.textBaseline = 'middle';
  signContext.font = '700 78px sans-serif';
  signContext.fillStyle = '#34413f'; signContext.fillText('PARQUE TECNOLÓGICO DE SOROCABA', 1024, 64, 1990); // i18n-ok: the name on the real sign
  const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
  const signPositions = [], signUVs = [], signIndices = [], signSegments = 12;
  // Centre the lettering on the junction of the two facade halves and the rocket's x=0 axis.
  // Keep it in the upper concrete band, above the horizontal seam.
  const signCenterX = -building.position.x, signSpan = .55, signRadius = radius + .46, signY = 6.35, signHeight = 1.1;
  for (let i = 0; i <= signSegments; i++) {
    const u = i / signSegments, a = (u - .5) * signSpan;
    const x = signCenterX + Math.sin(a) * signRadius, z = Math.cos(a) * signRadius - radius;
    signPositions.push(x, signY - signHeight / 2, z, x, signY + signHeight / 2, z);
    signUVs.push(u, 0, u, 1);
    if (i < signSegments) { const n = i * 2; signIndices.push(n, n + 2, n + 1, n + 2, n + 3, n + 1); }
  }
  const signGeometry = new THREE.BufferGeometry();
  signGeometry.setAttribute('position', new THREE.Float32BufferAttribute(signPositions, 3));
  signGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(signUVs, 2));
  signGeometry.setIndex(signIndices); signGeometry.computeVertexNormals();
  const sign = new THREE.Group(); sign.name = 'TechnologyParkSign';
  // Each offset silhouette is physical geometry, so the lettering stands off the wall in oblique views.
  for (let layer = 0; layer < 5; layer++) {
    const face = new THREE.Mesh(signGeometry, new THREE.MeshBasicMaterial({ map: signTexture, color: layer === 4 ? 0xffffff : 0x59605d, transparent: true, alphaTest: .1, side: THREE.DoubleSide }));
    face.position.z = layer * .025;
    sign.add(face);
  }
  building.add(sign);
  // Recessed wings and entrance beyond the curved facade, as seen in the oblique photographs.
  box(building, 19, 7.7, 12, concrete, -19, 3.85, -9, -.17);
  box(building, 19, 7.7, 12, concrete, 19, 3.85, -9, .17);
  box(building, 14, 6.4, 10, concrete, 0, 3.2, -14);
  box(building, 11, 3, .2, glass, 0, 2, -8.9);
  box(building, 13, .25, 3, concrete, 0, 3.6, -7.8);

  // Concrete paths, perimeter road and lights, with the launch pad kept clear.
  box(park, 76, .06, 7, pavement, 0, .04, -27);
  box(park, 5, .07, 21, pavement, 0, .05, -17);
  box(park, 180, .05, 5, road, 0, .035, -96);
  box(park, 140, .05, 3, pavement, 0, .04, 42);
  function lamp(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); park.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .14, 9, 6), seam); pole.position.y = 4.5; g.add(pole);
    for (const s of [-1, 1]) box(g, 1.4, .1, .16, seam, s * .62, 8.9, 0, 0);
    for (const s of [-1, 1]) box(g, .55, .1, .27, white, s * 1.15, 8.83, 0);
  }
  for (const x of [-60, -40, -20, 20, 40, 60]) { lamp(x, -35); lamp(x, 40); }

  function palm(x, z, scale, tall = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); park.add(g);
    const h = tall ? 3.3 : 1.05;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.10, .2, h, 6), trunk); stem.position.y = h / 2; g.add(stem);
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.32, 2.2, 4), greens[i % greens.length]);
      const a = i * Math.PI / 4; leaf.position.set(Math.sin(a) * .7, h + .25, Math.cos(a) * .7);
      leaf.rotation.set(Math.cos(a) * .95, 0, -Math.sin(a) * .95); g.add(leaf);
    }
  }
  [[-21,-25,1],[-13,-24,.8],[14,-24,1],[25,-23,.85],[-26,15,1.1],[24,19,1],[-42,0,.8],[42,-2,1]].forEach(([x,z,s]) => palm(x,z,s));
  [[-60,-48],[60,-48],[-50,28],[52,30],[-35,50],[35,52]].forEach(([x,z]) => palm(x,z,1.15,true));
  // Distant treeline provides the wooded horizon seen in the panorama.
  const treeGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, r = 125 + (i % 5) * 4, h = 4 + (i % 4);
    const tree = new THREE.Mesh(treeGeo, greens[i % greens.length]);
    tree.position.set(Math.sin(a) * r, h * .65, Math.cos(a) * r); tree.scale.set(3.2, h, 3.2); park.add(tree);
  }
  // Cumulus: clusters of flat-shaded polyhedra rather than photo textures.
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4, r = 100 + (i % 4) * 24, cloud = new THREE.Group();
    cloud.position.set(Math.sin(a) * r, 55 + (i % 5) * 8, Math.cos(a) * r); park.add(cloud);
    for (let j = 0; j < 5; j++) {
      const puff = new THREE.Mesh(cloudGeo, j === 0 ? greyCloud : white);
      puff.position.set((j - 2) * 5, (j % 3) * 1.6, (j % 2) * 2); puff.scale.set(6, 3.2 + (j % 2), 3.8); cloud.add(puff);
    }
  }
}

function initScene() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, .1, 2000);
  // Faceted daytime sky inspired by the supplied park photographs.
  const sky = new THREE.IcosahedronGeometry(900, 2), sp = sky.attributes.position, c = [];
  const low = new THREE.Color(0xc2d8e2), high = new THREE.Color(0x3976b6);
  for (let k = 0; k < sp.count; k++) { const col = low.clone().lerp(high, Math.pow(Math.max(0, sp.getY(k) / 900), .45)); c.push(col.r, col.g, col.b); }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  scene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  scene.fog = new THREE.Fog(0xb9d0d8, 160, 520);
  scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x536b44, 1.3));
  const sun = new THREE.DirectionalLight(0xfff4df, 2.2); sun.position.set(-40, 48, 30); scene.add(sun);
  const glow = new THREE.PointLight(0xf59e0b, 0, 40, 1.6); scene.add(glow);
  // Ground, pad, flame trench and a crimson service tower with a swing arm to the cabin.
  scene.add(new THREE.Mesh(new THREE.CircleGeometry(600, 9).rotateX(-Math.PI / 2), flat(0x668e49)));
  addTechnologyPark(scene);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, .6, 6), flat(0x8f86ab)); pad.position.y = .3; scene.add(pad);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(1.1, .05, 4.6), flat(0x1d1128)); trench.position.y = .61; scene.add(trench);
  const tower = new THREE.Group(), red = flat(0x8f241e), arm = new THREE.Group();
  scene.add(tower); tower.add(arm);
  const rocket = new THREE.Group(); scene.add(rocket);
  // Exhaust: three nested 7-sided cones (orange, amber, cream), additive, as on the menu's Saturn V.
  const plume = new THREE.Group();
  [[.62, 3.6, 0xe04f26, .55], [.42, 2.6, 0xf59e0b, .7], [.2, 1.5, 0xfce8a6, .95]].forEach(([r, h, color, opacity]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.rotation.x = Math.PI; cone.position.y = -h / 2; plume.add(cone);
  });
  // Smoke: faceted puffs that billow out of the trench after ignition.
  const smoke = Array.from({ length: 16 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xd8c8c0, roughness: 1, flatShading: true, transparent: true, opacity: 0 }));
    m.userData.dir = new THREE.Vector3(Math.cos(i * 2.4), 0, Math.sin(i * 2.4)).multiplyScalar(i % 2 ? 1 : -1); scene.add(m); return m;
  });
  const v = { scene, camera, glow, tower, red, arm, rocket, plume, smoke, height: 6, width: 0, h: 0 };
  new ResizeObserver(() => {
    v.width = host.clientWidth; v.h = host.clientHeight;
    if (!v.width || !v.h) return;
    renderer.setSize(v.width, v.h, false); camera.aspect = v.width / v.h; camera.updateProjectionMatrix();
  }).observe(host);
  return v;
}

/** Rebuilds the tower for the rocket's height. */
function buildTower(v) {
  v.tower.clear(); v.arm.clear(); v.tower.add(v.arm);
  const H = v.height + 1.2, x = 3.1;
  for (const [dx, dz] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.12, H, .12), v.red); post.position.set(x + dx, .6 + H / 2, dz); v.tower.add(post);
  }
  for (let y = 1.4; y < H; y += 1.1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.82, .08, .82), v.red); beam.position.set(x, .6 + y, 0); v.tower.add(beam);
  }
  const cabinY = .6 + v.cabinMid;
  const armMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, .14, .3), v.red); armMesh.position.set(-.8, 0, 0); v.arm.add(armMesh);
  v.arm.position.set(x - .35, cabinY, 0); v.arm.rotation.y = 0;
}

function countdownText(tSec, lift) {
  const left = Math.max(0, Math.ceil(COUNT - tSec)), zero = tSec >= COUNT, failed = zero && !lift.ok, count = $id('launchpad-count');
  count.textContent = !zero ? `T−${String(left).padStart(2, '0')}` : lift.ok ? t('launch.pad.liftoff') : lift.pad;
  count.classList.toggle('fail', failed);
  $id('launchpad-status').textContent = failed ? lift.status : t(([...STATUS].reverse().find(([s]) => s >= left) ?? STATUS[0])[1]); // the latest step reached
}

window.ASTRO_LAUNCHPAD = (lift = { ok: true, accel: 1 }) => new Promise(async resolve => {
  ui.show('launchpad');
  const site = ui.sites?.[ui.state.site];
  $id('launchpad-title').textContent = t('common.missionPrefix', { name: site?.mission ?? t('orbit.worlds.mars') });
  $id('launchpad-fade').classList.remove('on'); $id('launchpad-count').style.opacity = ''; $id('launchpad-count').classList.remove('fail');
  $id('launchpad-eyebrow').textContent = t('launch.pad.eyebrow');
  let done = false;
  const onKey = e => {
    if (e.code !== 'Escape') return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    finish();
  };
  const finish = () => { if (done) return; done = true; removeEventListener('keydown', onKey); $id('launchpad-fade').classList.add('on'); setTimeout(() => { releaseRenderer(); resolve(); }, reduce ? 0 : 350); };
  $id('launchpad-skip').onclick = finish;
  addEventListener('keydown', onKey);

  let stackGroup = null;
  if (ensureRenderer() && window.ASTRO_BUILD_ROCKET) {
    try {
      view ||= initScene();
      stackGroup = await Promise.race([
        window.ASTRO_BUILD_ROCKET(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ASTRO_BUILD_ROCKET timeout')), 2500)),
      ]);
    } catch (err) {
      console.warn('Launch pad 3D stack fallback:', err);
      stackGroup = null;
    }
  }
  if (!renderer || !view || !stackGroup) { // no 3D: the countdown alone
    const t0 = performance.now();
    const tick = () => { if (done) return; const elapsed = (performance.now() - t0) / 1000; countdownText(elapsed, lift); if (elapsed >= COUNT + (lift.ok ? 0 : FAIL_HOLD)) finish(); else requestAnimationFrame(tick); };
    tick(); return;
  }
  const v = view, { camera } = v;
  const w = host.clientWidth, h = host.clientHeight;
  if (w && h) { v.width = w; v.h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  // The engines hang below the booster's origin: lift the stack so the nozzles clear the pad top.
  const base = .62 - stackGroup.userData.minY + .08;
  v.rocket.clear(); v.rocket.add(stackGroup); v.rocket.position.set(0, base, 0);
  v.height = stackGroup.userData.height; v.cabinMid = base - .62 + stackGroup.userData.cabinMid;
  buildTower(v);
  v.plume.scale.setScalar(0.001); v.rocket.add(v.plume); v.plume.position.y = stackGroup.userData.minY;
  v.smoke.forEach(m => { m.material.opacity = 0; m.scale.setScalar(.01); });
  const mid = new THREE.Vector3(), cabin = new THREE.Vector3(), look = new THREE.Vector3(), into = new THREE.Vector3();
  const R = v.height * 1.15 + 4;
  const lights = lift.ok || lift.reason === 'low-twr', accel = lift.ok ? Math.max(.05, lift.accel ?? 1) : 0;
  let tSec = reduce ? COUNT : 0, last = performance.now(), flyFrom = null, lookFrom = null;
  function frame(now) {
    if (done || !screen.classList.contains('active')) return;
    requestAnimationFrame(frame);
    const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now; tSec += dt; // rAF time can precede performance.now()
    if (window.ASTRO_LAUNCH_PAUSE) tSec -= dt; // tests: hold the moment
    if (window.ASTRO_LAUNCH_JUMP != null) { tSec = window.ASTRO_LAUNCH_JUMP; window.ASTRO_LAUNCH_JUMP = null; } // tests: jump in time
    countdownText(tSec, lift);
    const zero = Math.max(0, tSec - COUNT), lit = lights ? zero : 0, climb = Math.max(0, lit - .8);
    v.rocket.position.y = base + climb * climb * .9 * accel; // slow at first, then faster; the net thrust sets the pace
    // Tower arm swings away at T−5.
    v.arm.rotation.y = -Math.min(1, Math.max(0, (tSec - (COUNT - 5)) / 2)) * 1.4;
    // Ignition: plume, glow, smoke. A rocket too heavy to lift strains on the pad until the engines shut down.
    const flame = Math.min(1, lit / .6) * (lift.ok ? 1 : Math.max(0, Math.min(1, (PAD_BURN - lit) / .6)));
    v.rocket.position.x = lift.ok || reduce ? 0 : (Math.random() - .5) * .05 * flame;
    v.plume.scale.set(flame, flame * (1 + .08 * Math.sin(now * .05)), flame);
    v.glow.position.set(0, v.rocket.position.y + stackGroup.userData.minY - .5, 0); v.glow.intensity = flame * (28 + 6 * Math.sin(now * .04));
    v.smoke.forEach((m, i) => {
      const age = Math.max(0, lit - i * .05);
      m.position.copy(m.userData.dir).multiplyScalar(1 + age * 2.4); m.position.y = .8 + age * .4 + (i % 3) * .3;
      m.scale.setScalar(Math.min(2.2, .2 + age * .9)); m.material.opacity = Math.min(.75, age * .9) * Math.max(0, 1 - age / 6);
    });
    stackGroup.userData.cabin.getWorldPosition(cabin);
    mid.set(0, v.rocket.position.y + v.height * .45, 0);
    if (tSec < COUNT + IGNITION_HOLD || !lift.ok) {
      // Orbit around the rocket; a little shake once the engines are lit (more when it strains on the pad).
      // At T−0 the camera drops and looks at the base, so the flame and the smoke (or their absence) are in frame.
      const a = .6 + tSec * .32, shake = flame * (lift.ok ? .06 : .12), low = Math.min(1, zero / .8), baseY = v.rocket.position.y + stackGroup.userData.minY + 1.2;
      look.set(0, mid.y + (baseY - mid.y) * low * .85, 0);
      camera.position.set(Math.sin(a) * R + (Math.random() - .5) * shake, look.y + Math.sin(tSec * .5) * 1.2 * (1 - low) + 1.5 * low + (Math.random() - .5) * shake, Math.cos(a) * R);
      camera.lookAt(look);
      if (!lift.ok && zero >= FAIL_HOLD) finish();
    } else {
      // Fly up to the pilot's windows (+Z), following the climbing rocket; the fade covers the way in.
      if (!flyFrom) { flyFrom = camera.position.clone(); lookFrom = look.clone(); }
      const k = Math.min(1, (tSec - COUNT - IGNITION_HOLD) / FLY_IN), e = k * k * (3 - 2 * k);
      $id('launchpad-count').style.opacity = String(1 - e);
      into.copy(cabin).add({ x: 0, y: .02, z: .14 });
      // Swing round the rocket to its front (+Z) and up to the windows by halfway, then close in.
      const half = Math.min(1, k * 2), turn = half * half * (3 - 2 * half);
      const a = Math.atan2(flyFrom.x, flyFrom.z) * (1 - turn), r0 = Math.hypot(flyFrom.x, flyFrom.z), rr = r0 + (into.z - r0) * e;
      camera.position.set(Math.sin(a) * rr, flyFrom.y + (into.y - flyFrom.y) * turn, Math.cos(a) * rr); // level with the windows by halfway
      look.copy(lookFrom).lerp(cabin.clone().add({ x: 0, y: 0, z: -1 }), turn); // the gaze is on the windows by then
      camera.lookAt(look);
      if (k >= .9) $id('launchpad-fade').classList.add('on');
      if (k >= 1) finish();
    }
    renderer.render(v.scene, camera);
  }
  requestAnimationFrame(frame);
});
// ---------------------------------------------------------------------------------------------------------------
// Splashdown: a flight short of Δv aborts (abortOf in web/app.js). The crew cabin the players built, closed and without
// its abort tower (jettisoned before the parachutes open), comes down under three main parachutes and splashes into the
// sea; the screen then fades to the debrief. window.ASTRO_SPLASHDOWN(info) shows it and resolves when the debrief opens.
// game: start height (model metres), seconds of steady descent to the water, seconds on screen after it, sway in degrees.
const SPLASH = { from: 15, fall: 7, hold: 4, sway: 6 };
// The abort tower is the thin part on top of the cabin: it starts above the highest vertex wider than TOWER_R
// (the docking ring), found on the loaded model so a redesigned cabin keeps working.
const TOWER_R = .15;
function towerBaseOf(cab) {
  cab.updateMatrixWorld(true);
  const inv = cab.matrixWorld.clone().invert(), m = new THREE.Matrix4(), p = new THREE.Vector3();
  let top = 0;
  cab.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { p.fromBufferAttribute(a, i).applyMatrix4(m); if (Math.hypot(p.x, p.z) > TOWER_R) top = Math.max(top, p.y); }
  });
  return top + .01;
}
const OCEAN = [0x123a6b, 0x1d5f9a, 0x2c86ba]; // ocean ramp of the 2D art (RAMPS.ocean in web/app.js)
const GORES = [0xe04f26, 0xfce8a6]; // parachute gores: Mars orange and starlight cream
const CANOPY = { r: 1.25, cap: Math.PI * .4, lines: 3.4, spread: 1.1, tilt: .32 };
let seaView = null;
const wave = (x, z, time) => .16 * Math.sin(x * .32 + time * 1.2) + .11 * Math.sin(z * .45 - time * .9) + .06 * Math.sin((x + z) * .8 + time * 2);
// One flat colour per triangle (non-indexed geometry), picked by pick(face index, centroid).
function faceColors(geo, pick) {
  const p = geo.attributes.position, c = [], v = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    v.set(0, 0, 0); for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(p, f * 3 + k));
    const col = new THREE.Color(pick(f, v.divideScalar(3))); for (let k = 0; k < 3; k++) c.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return geo;
}

function initSea() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, .1, 2000);
  // The same faceted daytime sky as the launch pad, over open water.
  const sky = new THREE.IcosahedronGeometry(900, 2), sp = sky.attributes.position, c = [];
  const low = new THREE.Color(0xc2d8e2), high = new THREE.Color(0x3976b6);
  for (let k = 0; k < sp.count; k++) { const col = low.clone().lerp(high, Math.pow(Math.max(0, sp.getY(k) / 900), .45)); c.push(col.r, col.g, col.b); }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  scene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  scene.fog = new THREE.Fog(0xb9d0d8, 40, 260);
  scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x6f9fc0, 1.3));
  const sun = new THREE.DirectionalLight(0xfff4df, 2.2); sun.position.set(-40, 48, 30); scene.add(sun);
  // Sunlight bounced off the water lights the undersides of the canopies, so the gores keep their colours.
  const bounce = new THREE.DirectionalLight(0xfff0dd, 1.1); bounce.position.set(20, -30, 15); scene.add(bounce);
  // Ocean: a faceted grid, one flat colour per face; the waves move its vertices every frame.
  const oceanGeo = faceColors(new THREE.PlaneGeometry(240, 240, 40, 40).rotateX(-Math.PI / 2).toNonIndexed(), f => OCEAN[(f * 7 + (f >> 4)) % 3]);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .5, metalness: .1 }));
  const base = Float32Array.from(oceanGeo.attributes.position.array);
  scene.add(ocean);
  // The craft: the capsule (added on each splashdown) and, above its docking ring, three canopies on their risers.
  const craft = new THREE.Group(), chutes = new THREE.Group(), canopies = [];
  craft.add(chutes); scene.add(craft);
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.SphereGeometry(CANOPY.r, 10, 3, 0, Math.PI * 2, 0, CANOPY.cap).toNonIndexed();
    geo.translate(0, -CANOPY.r * Math.cos(CANOPY.cap), 0); // rim at y = 0
    faceColors(geo, (f, mid) => GORES[Math.floor((Math.atan2(mid.z, mid.x) + Math.PI) / (Math.PI / 5)) % 2]);
    const canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, side: THREE.DoubleSide }));
    const a = i * Math.PI * 2 / 3 + .4;
    canopy.userData.at = new THREE.Vector3(Math.sin(a) * CANOPY.spread, CANOPY.lines, Math.cos(a) * CANOPY.spread);
    canopy.rotation.set(Math.cos(a) * CANOPY.tilt, 0, -Math.sin(a) * CANOPY.tilt);
    chutes.add(canopy); canopies.push(canopy);
  }
  // Risers: four per canopy, from the docking ring to the canopy rim (rebuilt every frame as the canopies open).
  const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 4 * 2 * 3), 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xfce8a6, transparent: true, opacity: .85 }));
  chutes.add(lines);
  // Splash: faceted foam puffs thrown out around the capsule.
  const foam = Array.from({ length: 16 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), new THREE.MeshStandardMaterial({ color: 0xfff6dc, roughness: 1, flatShading: true, transparent: true, opacity: 0 }));
    m.userData.a = i * 2.4; m.userData.k = .6 + (i % 4) * .25; scene.add(m); return m;
  });
  const clip = new THREE.Plane();
  return { scene, camera, ocean, base, craft, chutes, canopies, lines, foam, clip, cabin: null, towerY: 1 };
}

window.ASTRO_SPLASHDOWN = (info = {}) => new Promise(async resolve => {
  ui.show('launchpad');
  const site = ui.sites?.[ui.state.site], count = $id('launchpad-count');
  $id('launchpad-title').textContent = t('common.missionPrefix', { name: site?.mission ?? t('orbit.worlds.mars') });
  $id('launchpad-eyebrow').textContent = t('launch.pad.abortEyebrow');
  $id('launchpad-status').textContent = info.status ?? t('launch.pad.abort');
  $id('launchpad-fade').classList.remove('on'); count.style.opacity = ''; count.classList.add('fail'); count.textContent = t('launch.pad.abort');
  let done = false;
  const onKey = e => {
    if (e.code !== 'Escape') return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    finish();
  };
  const finish = () => { if (done) return; done = true; removeEventListener('keydown', onKey); $id('launchpad-fade').classList.add('on'); setTimeout(() => { releaseRenderer(); resolve(); }, reduce ? 0 : 350); };
  $id('launchpad-skip').onclick = finish;
  addEventListener('keydown', onKey);
  const end = SPLASH.fall + SPLASH.hold;
  let stackGroup;
  if (ensureRenderer() && window.ASTRO_BUILD_ROCKET) {
    try {
      seaView ||= initSea();
      stackGroup = await window.ASTRO_BUILD_ROCKET();
    } catch (err) {
      console.warn('Splashdown 3D stack fallback:', err);
      stackGroup = null;
    }
  }
  if (!renderer || !seaView || !stackGroup) { // no 3D: the texts alone
    const t0 = performance.now();
    const tick = () => { if (done) return; const elapsed = (performance.now() - t0) / 1000; if (elapsed >= SPLASH.fall) count.textContent = t('launch.pad.splashdown'); if (elapsed >= end) finish(); else requestAnimationFrame(tick); };
    tick(); return;
  }
  const v = seaView, { camera } = v;
  if (!renderer.domElement.parentNode) { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.prepend(renderer.domElement); }
  renderer.localClippingEnabled = true;
  // The configured cabin: the top module of the stack the crew built (views.js), closed. Its materials are cloned so the
  // clipping plane that removes the abort tower only touches this copy.
  const cab = stackGroup.children[stackGroup.children.length - 1];
  if (v.cabin) v.craft.remove(v.cabin);
  cab.position.set(0, 0, 0); v.craft.position.set(0, 0, 0); v.craft.rotation.set(0, 0, 0); v.craft.add(cab); v.cabin = cab; v.towerY = towerBaseOf(cab);
  cab.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); [].concat(o.material).forEach(m => { m.clippingPlanes = [v.clip]; }); } });
  v.chutes.position.set(0, v.towerY, 0); v.chutes.rotation.set(0, 0, 0); v.lines.visible = true;
  const up = new THREE.Vector3(), top = new THREE.Vector3(), rim = new THREE.Vector3(), look = new THREE.Vector3();
  const pos = v.ocean.geometry.attributes.position, linePos = v.lines.geometry.attributes.position;
  let tSec = reduce ? SPLASH.fall - 1 : 0, last = performance.now(), size = '';
  function frame(now) {
    if (done || !screen.classList.contains('active')) return;
    requestAnimationFrame(frame);
    const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now; tSec += dt;
    if (window.ASTRO_LAUNCH_JUMP != null) { tSec = window.ASTRO_LAUNCH_JUMP; window.ASTRO_LAUNCH_JUMP = null; } // tests: jump in time
    const w = host.clientWidth, h = host.clientHeight;
    if (w && h && size !== `${w}x${h}`) { size = `${w}x${h}`; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const wt = reduce ? 0 : tSec, fall = Math.min(1, tSec / SPLASH.fall), after = Math.max(0, tSec - SPLASH.fall), splashed = tSec >= SPLASH.fall;
    for (let i = 0; i < pos.count; i++) pos.setY(i, wave(v.base[i * 3], v.base[i * 3 + 2], wt));
    pos.needsUpdate = true; v.ocean.geometry.computeVertexNormals();
    // Steady descent under the canopies, swinging a little; afloat after the splash, riding the waves.
    const water = wave(0, 0, wt) - .22, sway = reduce ? 0 : SPLASH.sway * Math.PI / 180;
    v.craft.position.y = splashed ? water : SPLASH.from + (water - SPLASH.from) * fall;
    v.craft.rotation.z = Math.sin(tSec * 1.25) * sway * (splashed ? .4 : 1);
    v.craft.rotation.x = Math.sin(tSec * .9 + 1) * sway * .5 * (splashed ? .4 : 1);
    // Canopies inflate in the first second; after the splash they come off, fall to the side and settle on the water.
    const k = Math.min(1, tSec / .9), open = k < 1 ? .2 + .8 * (1 - (1 - k) * (1 - k)) : 1;
    v.canopies.forEach(c => { c.position.copy(c.userData.at); c.scale.set(open, splashed ? Math.max(.12, 1 - after * .8) : .6 + .4 * k, open); });
    v.chutes.position.y = splashed ? v.towerY - Math.min(v.towerY + 1.6, after * 2.4) : v.towerY;
    v.chutes.rotation.z = splashed ? Math.min(1.25, after * 1.1) : 0;
    v.lines.visible = !splashed;
    if (!splashed) {
      let n = 0;
      v.canopies.forEach(c => { c.updateMatrix(); for (let q = 0; q < 4; q++) {
        const a = q * Math.PI / 2 + .3; rim.set(Math.cos(a) * CANOPY.r * Math.sin(CANOPY.cap), 0, Math.sin(a) * CANOPY.r * Math.sin(CANOPY.cap)).applyMatrix4(c.matrix);
        linePos.setXYZ(n++, 0, 0, 0); linePos.setXYZ(n++, rim.x, rim.y, rim.z);
      } });
      linePos.needsUpdate = true;
    }
    v.foam.forEach(m => {
      const r = .5 + after * 1.7 * m.userData.k;
      m.position.set(Math.cos(m.userData.a) * r, water + .3 + Math.sin(Math.min(Math.PI, after * 2.2)) * .6 * m.userData.k, Math.sin(m.userData.a) * r);
      const size = .4 + after * .3; m.scale.set(size, size * .55, size); m.material.opacity = splashed ? Math.max(0, .9 - after * .3) : 0;
    });
    // Abort tower clipped: keep what lies below the docking ring, along the capsule's own axis.
    v.craft.updateMatrixWorld(true);
    up.set(0, 1, 0).applyQuaternion(cab.getWorldQuaternion(new THREE.Quaternion()));
    cab.localToWorld(top.set(0, v.towerY, 0));
    v.clip.setFromNormalAndCoplanarPoint(up.negate(), top);
    count.textContent = splashed ? t('launch.pad.splashdown') : t('launch.pad.abort');
    // Camera: follows the capsule down with the canopies in frame, then settles low over the water.
    const a = .7 + tSec * .05, dist = (splashed ? 7 : 9) / Math.min(1, camera.aspect * 1.4); // narrow screens: step back
    look.set(0, splashed ? .4 : v.craft.position.y + 2.4, 0);
    camera.position.set(Math.sin(a) * dist, splashed ? 1.3 : Math.max(1.3, v.craft.position.y + .6), Math.cos(a) * dist);
    camera.lookAt(look);
    if (tSec >= end) finish();
    renderer.render(v.scene, camera);
  }
  requestAnimationFrame(frame);
});
})().catch(error => console.warn('launch pad unavailable:', error));
