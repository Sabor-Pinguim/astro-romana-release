(async () => {
// 3D views built from the generated GLBs (assets/models): the Saturn V flying on the menu,
// the selected crew member in the lobby and the rocket the crew is building in the planner.
// Models come from index.models.js (works from file://) or, when served, straight from the folder.
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = new GLTFLoader(), cache = new Map();
function loadGLTF(path) {
  if (!cache.has(path)) cache.set(path, (async () => {
    const b64 = window.ASTRO_GLB?.[path];
    let data;
    if (b64) { const bin = atob(b64); data = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i); data = data.buffer; }
    else data = await (await fetch('assets/models/' + path)).arrayBuffer();
    return loader.parseAsync(data, '');
  })());
  return cache.get(path);
}
const loadGLB = path => loadGLTF(path).then(gltf => gltf.scene.clone(true));
// One renderer per view, lit like the rest of the identity: cream key light, purple fill, Mars-orange rim.
function makeView(container, { fov = 30, append = false } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, 1, .05, 400);
  scene.add(new THREE.AmbientLight(0xb48cf0, .9));
  // Soft room reflections so metallic parts (engines, structure) are not black.
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .5;
  const key = new THREE.DirectionalLight(0xfce8a6, 2.4); key.position.set(-4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xe04f26, 1.8); rim.position.set(5, 1, -4); scene.add(rim);
  container[append ? 'append' : 'prepend'](renderer.domElement);
  const view = { renderer, scene, camera, width: 0, height: 0, onResize: null };
  new ResizeObserver(() => {
    view.width = container.clientWidth; view.height = container.clientHeight;
    if (!view.width || !view.height) return;
    renderer.setSize(view.width, view.height, false);
    camera.aspect = view.width / view.height; camera.updateProjectionMatrix();
    view.onResize?.();
  }).observe(container);
  return view;
}
const isActive = id => document.getElementById(id)?.classList.contains('active');

// Menu: Saturn V in flight. Play makes it burn hard and fly away before the screen changes.
(async () => {
  const art = document.querySelector('#menu .space-art'), view = art && makeView(art, { fov: 28, append: true });
  if (!view) return;
  view.renderer.domElement.classList.add('saturn-canvas');
  const { scene, camera } = view;
  const flight = new THREE.Group(), spin = new THREE.Group(), body = await loadGLB('rocket/saturn_v_lowpoly.glb');
  const height = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3()).y;
  body.position.y = -height / 2;
  spin.add(body); flight.add(spin); scene.add(flight);
  // Exhaust: three nested 7-sided cones, additive, flickering.
  const plume = new THREE.Group();
  plume.position.y = -height / 2;
  [[.62, 3.4, 0xe04f26, .5], [.42, 2.4, 0xf59e0b, .7], [.2, 1.4, 0xfce8a6, .95]].forEach(([r, h, color, opacity]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.rotation.x = Math.PI; cone.position.y = -h / 2;
    plume.add(cone);
  });
  spin.add(plume);
  camera.position.set(0, 0, 30); camera.lookAt(0, 0, 0);
  const home = new THREE.Vector3(), tilt = -.42;
  let scale = 1, launch = null, wasActive = true;
  view.onResize = () => {
    const H = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), W = H * camera.aspect, narrow = camera.aspect < .9;
    home.set(narrow ? W * .2 : W * .07, narrow ? H * .22 : -H * .02, 0);
    scale = (narrow ? .36 : .56) * H / height;
  };
  window.ASTRO_LAUNCH = () => new Promise(resolve => {
    if (reduce || !view.width) return resolve();
    launch = { start: performance.now(), resolve, done: false };
  });
  const up = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const active = isActive('menu');
    if (active && !wasActive) launch = null; // back on the menu: the rocket is waiting again
    wasActive = active;
    if (!active || !view.width) return;
    const t = reduce ? 0 : now / 1000;
    flight.rotation.set(-.12, 0, tilt);
    spin.rotation.y = t * .25;
    flight.scale.setScalar(scale);
    flight.position.copy(home);
    flight.position.y += Math.sin(t * 1.3) * .12;
    let burn = 1;
    if (launch) {
      const e = (now - launch.start) / 1000;
      up.set(0, 1, -.55).normalize().applyQuaternion(flight.quaternion);
      flight.position.addScaledVector(up, 26 * e * e);
      burn = 1 + e * 2.2;
      if (e > 1.05 && !launch.done) { launch.done = true; launch.resolve(); }
    }
    plume.scale.set(1 + Math.random() * .08, burn * (1 + Math.random() * .18), 1 + Math.random() * .08);
    view.renderer.render(scene, camera);
  }
  view.onResize();
  requestAnimationFrame(frame);
})().catch(err => console.warn('Saturn V not shown:', err));

// Lobby: the selected crew member (avatar GLB): idle loop, a wave when picked again.
(async () => {
  const box = document.getElementById('detail-view'), view = box && makeView(box, { fov: 24 });
  if (!view) return;
  const AVATARS = { helena: 'characters/helena.glb', lucas: 'characters/lucas.glb', oscar: 'characters/oscar.glb', maya: 'characters/maya.glb' };
  const { scene, camera } = view, holder = new THREE.Group();
  scene.add(holder);
  let mixer = null, idle = null, wave = null, current = null, last = performance.now(), token = 0;
  view.onResize = () => { const d = 1.3 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect * 1.1); camera.position.set(0, 1.15, d); camera.lookAt(0, .95, 0); };
  async function show(id) {
    if (!AVATARS[id]) return;
    if (id === current) { if (wave && idle) { wave.reset().play(); wave.crossFadeFrom(idle, .2, false); } return; }
    current = id;
    const mine = ++token, gltf = await loadGLTF(AVATARS[id]);
    if (mine !== token) return;
    const model = gltf.scene.clone(true);
    model.traverse(o => { if (o.name.startsWith('Prop_')) o.visible = false; });
    holder.clear(); holder.add(model);
    mixer = new THREE.AnimationMixer(model);
    const clip = name => THREE.AnimationClip.findByName(gltf.animations, name);
    idle = clip('idle_loop') && mixer.clipAction(clip('idle_loop'));
    wave = clip('wave') && mixer.clipAction(clip('wave'));
    if (wave) { wave.setLoop(THREE.LoopOnce, 1); wave.clampWhenFinished = false; }
    mixer.addEventListener('finished', () => idle?.reset().fadeIn(.2).play());
    idle?.play();
  }
  window.addEventListener('astro:detail', e => { if (e.detail.kind === 'crew') show(e.detail.id); });
  if (window.ASTRO?.state.detail.kind === 'crew') show(window.ASTRO.state.detail.id);
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!isActive('lobby') || !view.width || box.classList.contains('site')) return;
    if (!reduce) { mixer?.update(dt); holder.rotation.y = Math.sin(now / 2500) * .45; }
    view.renderer.render(scene, camera);
  }
  view.onResize();
  requestAnimationFrame(frame);
})().catch(err => console.warn('Avatar not shown:', err));

// Planner: the rocket the crew is building. Hull modules carry Attach_* nodes (the mounting points);
// engines hang from Attach_Engines in the real cluster pattern, the tank stands on Attach_Tank,
// one equipment module stands on each stage's Attach_Bay and up to 4 cabin modules sit on the cabin deck.
// Empty mounting points glow amber and can be clicked; "+" buttons in the gaps insert a stage.
(async () => {
  const blueprint = document.querySelector('.blueprint'), ui = window.ASTRO;
  if (!ui) return;
  const HULL = { booster: 'parts/structures/booster-thrust-section.glb', stage: 'parts/structures/stage-module.glb', cabin: 'parts/structures/crew-cabin.glb' };
  // Two versions of each hull: open here (the front half, node `Closed`, hidden so the bay shows) and closed
  // for outside views (launch pad), where the equipment is stowed inside and not loaded.
  const hullOf = async (file, closed) => {
    const h = await loadGLB(file);
    for (const n of ['Closed', 'Stowed_Front']) { const o = h.getObjectByName(n); if (o) o.visible = closed; }
    return h;
  };
  const CABIN_SLOTS = [[-.28, .24], [.28, .24], [-.28, .80], [.28, .80]]; // x, y on the enlarged cabin decks
  const GAP = .36, TANK_CAP = 3.2;
  const padMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: .8, depthWrite: false });
  const lineMat = new THREE.LineBasicMaterial({ color: 0xfce8a6 }), selMat = new THREE.LineBasicMaterial({ color: 0xf59e0b });
  const polygon = (r, n, mat) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, (_, k) => new THREE.Vector3(r * Math.cos(k * 2 * Math.PI / n), 0, r * Math.sin(k * 2 * Math.PI / n)))), mat);
  function mountPoint(r, info) {
    const g = new THREE.Group(), pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .014, 6), padMat);
    pad.userData.mount = info; g.add(pad, polygon(r * 1.4, 6, lineMat));
    g.userData.pulse = true;
    return g;
  }
  const attach = (hull, name, fallback) => hull.getObjectByName(name)?.position.y ?? fallback;
  const fitWidth = (obj, width) => { const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); obj.scale.setScalar(width / Math.max(s.x, s.z)); };
  const ring = (n, r, off = 0) => Array.from({ length: n }, (_, k) => [r * Math.cos(off + k * 2 * Math.PI / n), r * Math.sin(off + k * 2 * Math.PI / n)]);
  // Engine positions (x, z) and engine width inside the Ø 0.96 thrust plate, by cluster size (specs.defaultClusterCount).
  function cluster(n) {
    if (n === 1) return { w: .5, at: [[0, 0]] };
    if (n === 3) return { w: .32, at: ring(3, .22, Math.PI / 2) };
    if (n === 4) return { w: .3, at: ring(4, .22, Math.PI / 4) };
    if (n === 9) return { w: .22, at: [[0, 0], ...ring(8, .32)] };
    if (n === 33) return { w: .11, at: [...ring(3, .08), ...ring(10, .22), ...ring(20, .4)] };
    return { w: .8 / Math.sqrt(n), at: ring(n, .3) };
  }
  // Long tanks are squeezed so the whole stack fits the view (soft cap on the scaled height).
  const softCap = h => TANK_CAP * (1 - Math.exp(-h / TANK_CAP));

  async function booster(r, parts, module = 'booster') {
    const g = new THREE.Group(), hull = await loadGLB(HULL.booster);
    g.userData.module = module; g.add(hull);
    // Fins (Main Booster only) share the thrust section's origin: they bolt straight onto the skirt.
    if (module === 'booster' && r.booster.fins && parts[r.booster.fins]?.file) g.add(await loadGLB(parts[r.booster.fins].file));
    const engineY = attach(hull, 'Attach_Engines', 0), tankY = attach(hull, 'Attach_Tank', .5);
    let top = tankY;
    if (r.booster.engine && parts[r.booster.engine]?.file) {
      const { w, at } = cluster(parts[r.booster.engine].specs?.defaultClusterCount || 1);
      for (const [x, z] of at) { const e = await loadGLB(parts[r.booster.engine].file); fitWidth(e, w); e.position.set(x, engineY, z); g.add(e); }
    } else { const m = mountPoint(.24, { module, tab: 'engine' }); m.position.y = engineY - .03; g.add(m); }
    if (r.booster.tank && parts[r.booster.tank]?.file) {
      const t = await loadGLB(parts[r.booster.tank].file), size = new THREE.Box3().setFromObject(t).getSize(new THREE.Vector3());
      const s = .96 / Math.max(size.x, size.z), h = size.y * s, capped = softCap(h);
      t.scale.set(s, s * capped / h, s); t.position.y = tankY; g.add(t);
      top = tankY + capped;
    } else { const m = mountPoint(.32, { module, tab: 'tank' }); m.position.y = tankY + .02; g.add(m); }
    g.userData.top = top;
    return g;
  }
  async function stage(r, i, parts, closed = false) {
    if (r.stages[i].type === 'booster') return booster({ booster: r.stages[i] }, parts, `stage-${i}`);
    const g = new THREE.Group(), hull = await hullOf(HULL.stage, closed), key = `stage-${i}`, item = r.stages[i].item;
    g.userData.module = key; g.add(hull);
    const bay = attach(hull, 'Attach_Bay', .1);
    if (closed) { /* equipment stowed inside the closed bay */ }
    else if (item && parts[item]?.file) { const e = await loadGLB(parts[item].file); e.position.y = bay; g.add(e); }
    else { const m = mountPoint(.16, { module: key }); m.position.y = bay + .01; g.add(m); }
    g.userData.top = attach(hull, 'Attach_Top', 1);
    return g;
  }
  async function cabin(r, parts, closed = false) {
    const g = new THREE.Group();
    g.userData.module = 'cabin'; g.add(await hullOf(HULL.cabin, closed));
    for (let k = 0; k < (closed ? 0 : CABIN_SLOTS.length); k++) {
      const [x, y] = CABIN_SLOTS[k], id = r.cabin[k];
      if (id && parts[id]?.file) { const e = await loadGLB(parts[id].file); e.scale.setScalar(.58); e.position.set(x, y, 0); g.add(e); }
      else { const m = mountPoint(.09, { module: 'cabin' }); m.position.set(x, y + .01, 0); g.add(m); }
    }
    g.userData.top = new THREE.Box3().setFromObject(g).max.y;
    return g;
  }

  // Launch pad (web/launch.js) and other outside views: the same assembly, closed, stacked without gaps,
  // mounting points or selection rings. Exposed even if the planner's own WebGL view cannot initialize.
  window.ASTRO_BUILD_ROCKET = async () => {
    const data = ui.data(), parts = data?.parts || {}, r = ui.state.rocket;
    const groups = await Promise.all([booster(r, parts), ...r.stages.map((_, i) => stage(r, i, parts, true)), cabin(r, parts, true)]);
    const rocket = new THREE.Group();
    let y = 0;
    for (const g of groups) {
      g.traverse(o => { if (o.userData.pulse) o.visible = false; });
      g.position.y = y; rocket.add(g); y += g.userData.top;
    }
    const cab = groups[groups.length - 1], mark = cab.getObjectByName('View_Window') ?? new THREE.Object3D(); // the pilot's windows
    if (!mark.parent) { mark.position.y = cab.userData.top / 2; cab.add(mark); }
    rocket.updateMatrixWorld(true);
    const minY = new THREE.Box3().setFromObject(rocket).min.y;
    rocket.userData = { height: y, minY, cabin: mark, cabinMid: cab.position.y + cab.userData.top / 2 };
    return rocket;
  };

  const view = blueprint && makeView(blueprint, { fov: 26 });
  if (!view) return;
  blueprint.classList.add('is-3d');
  const { scene, camera, renderer } = view, overlay = blueprint.querySelector('#stack-overlay');
  const stack = new THREE.Group(); scene.add(stack);

  let key = '', build = 0, layout = [], gaps = [], focusKey = null;
  const center = new THREE.Vector3();
  const cameraCenter = new THREE.Vector3();
  let distance = 10, cameraDistance = 10;
  const zoomButton = document.getElementById('rocket-overview');
  const navigation = document.getElementById('rocket-navigation');
  const upButton = document.getElementById('rocket-up'), downButton = document.getElementById('rocket-down');
  const t = (key, opts) => window.ASTRO_I18N?.t(key, opts) ?? key;
  function updateZoomControls() {
    const index = layout.findIndex(item => item.key === focusKey);
    const zoomed = focusKey !== null;
    zoomButton.textContent = zoomed ? t('planner.zoomOut') : t('planner.zoomIn');
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    navigation.hidden = !zoomed;
    upButton.disabled = index < 0 || index >= layout.length - 1;
    downButton.disabled = index <= 0;
  }
  window.addEventListener('astro:settings', updateZoomControls);
  window.addEventListener('astro:focus-module', e => { focusKey = e.detail; updateZoomControls(); });
  window.addEventListener('astro:stage-removed', e => { if (focusKey !== null) focusKey = e.detail; updateZoomControls(); });
  zoomButton.addEventListener('click', () => { focusKey = focusKey === null ? ui.selectedKey() : null; updateZoomControls(); });
  function moveFocus(delta) {
    const index = layout.findIndex(item => item.key === focusKey);
    const next = layout[index + delta];
    if (next) ui.select(next.key);
  }
  upButton.addEventListener('click', () => moveFocus(1));
  downButton.addEventListener('click', () => moveFocus(-1));
  async function rebuild() {
    const data = ui.data();
    if (!data) return;
    const r = ui.state.rocket, selected = ui.selectedKey(), next = JSON.stringify([r, selected]);
    if (next === key) return;
    key = next;
    const id = ++build;
    const groups = await Promise.all([booster(r, data.parts), ...r.stages.map((_, i) => stage(r, i, data.parts)), cabin(r, data.parts)]);
    if (id !== build) return;
    stack.clear(); layout = []; gaps = [];
    let y = 0;
    groups.forEach((g, i) => {
      if (i > 0) { gaps.push({ insert: i - 1, y: y + GAP / 2 }); y += GAP; }
      g.position.y = y; stack.add(g);
      const top = g.userData.top;
      layout.push({ key: g.userData.module, mid: y + top / 2, height: top });
      if (g.userData.module === selected) { const ringR = g.userData.module === 'cabin' ? .86 : .66; [0, top].forEach(h => { const p = polygon(ringR, 12, selMat); p.position.y = y + h; stack.add(p); }); }
      y += top;
    });
    const box = new THREE.Box3().setFromObject(stack), size = box.getSize(new THREE.Vector3());
    box.getCenter(center);
    distance = (size.y * .66) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    center.y -= size.y * .02; // room for the label above and the tags below
    if (focusKey !== null && !layout.some(item => item.key === focusKey)) focusKey = ui.selectedKey();
    updateZoomControls();
  }
  window.addEventListener('astro:rocket', rebuild);
  rebuild();

  // Clicks: a mounting point selects its module and catalog tab; anything else selects its module.
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    for (const hit of ray.intersectObjects(stack.children, true)) {
      if (hit.object.userData.mount) return hit.object.userData.mount;
      let o = hit.object; while (o && !o.userData.module) o = o.parent;
      if (o) return { module: o.userData.module };
    }
    return null;
  }
  renderer.domElement.addEventListener('click', e => { const hit = pick(e); if (hit) ui.select(hit.module, hit.tab); });
  renderer.domElement.addEventListener('pointermove', e => { renderer.domElement.style.cursor = pick(e) ? 'pointer' : ''; });

  const v = new THREE.Vector3();
  const toY = y => { v.set(0, y, 0).project(camera); return (1 - v.y) / 2 * view.height; };
  function frame(now) {
    requestAnimationFrame(frame);
    if (!isActive('planner') || !view.width || !layout.length) return;
    const t = reduce ? 0 : now / 1000;
    stack.rotation.y = Math.sin(t * .35) * .75; // swing, but keep the open side of the cutaways in view
    stack.traverse(o => { if (o.userData.pulse) o.scale.setScalar(1 + Math.sin(t * 4) * .12); });
    const focused = layout.find(item => item.key === focusKey);
    const targetCenter = focused ? new THREE.Vector3(0, focused.mid, 0) : center;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const targetDistance = focused ? Math.min(distance, Math.max(focused.height * .8, 1.2 / Math.min(camera.aspect, 1)) / Math.tan(halfFov)) : distance;
    const blend = reduce ? 1 : .12;
    cameraCenter.lerp(targetCenter, blend);
    cameraDistance += (targetDistance - cameraDistance) * blend;
    camera.position.set(0, cameraCenter.y + cameraDistance * .2, cameraDistance);
    camera.lookAt(cameraCenter);
    // Labels sit beside their module; "+" buttons sit in the gaps on the rocket axis.
    for (const { key: k, mid } of layout) {
      const el = overlay.querySelector(`[data-module="${k}"]`);
      if (!el) continue;
      el.style.display = focused && k !== focusKey ? 'none' : '';
      el.style.top = Math.max(52, Math.min(view.height - 96, toY(mid) - el.offsetHeight / 2)) + 'px';
      el.classList.add('placed');
    }
    v.set(0, 0, 0).project(camera);
    const axisX = (v.x + 1) / 2 * view.width;
    for (const { insert, y } of gaps) {
      const el = overlay.querySelector(`[data-insert="${insert}"]`);
      if (!el) continue;
      const screenY = toY(y);
      el.style.display = screenY >= 30 && screenY <= view.height - 30 ? '' : 'none';
      el.style.left = axisX + 'px'; el.style.top = screenY + 'px';
      el.classList.add('placed');
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})().catch(err => console.warn('3D rocket not shown:', err));

// Planner catalog: render each part's 3D GLB once into an offscreen studio view (cached in window.ASTRO_THUMBS),
// then dispose the temporary WebGL context so it never counts against the browser's active context limit.
(async () => {
  const thumbs = window.ASTRO_THUMBS;
  if (!thumbs) return;
  let renderer = null, scene = null, camera = null, holder = null, envTex = null;
  function ensureThumbStudio() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { renderer = null; return false; }
    renderer.setPixelRatio(1);
    renderer.setSize(144, 144, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    scene.add(new THREE.AmbientLight(0xb48cf0, 0.95));
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xfce8a6, 2.4); key.position.set(-4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xe04f26, 1.8); rim.position.set(5, 1, -4); scene.add(rim);
    holder = new THREE.Group();
    scene.add(holder);
    return true;
  }
  function releaseThumbStudio() {
    if (!renderer) return;
    envTex?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer = null; scene = null; camera = null; holder = null; envTex = null;
  }

  const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
  async function renderPartThumb(p) {
    if (!ensureThumbStudio()) return null;
    const obj = await loadGLB(p.file);
    holder.clear();
    holder.rotation.set(0, 0, 0);
    box.setFromObject(obj);
    box.getSize(size);
    const maxXZ = Math.max(size.x, size.z, 0.01);
    if (p.category === 'tanks' && size.y > maxXZ * 2.2) {
      obj.scale.y *= (maxXZ * 2.2) / size.y;
      obj.updateMatrixWorld(true);
      box.setFromObject(obj);
    }
    box.getCenter(center);
    obj.position.sub(center);
    holder.add(obj);
    holder.rotation.set(0.24, -0.58, p.category === 'tanks' ? 0.32 : 0.06);
    holder.updateMatrixWorld(true);
    box.setFromObject(holder).getSize(size);
    const half = Math.max(size.x, size.y, 0.1) * 0.56;
    const dist = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + size.z * 0.55;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  let running = false, again = false;
  async function syncCatalogThumbs() {
    if (running) { again = true; return; }
    running = true;
    let renderedNew = false;
    try {
      do {
        again = false;
        const data = window.ASTRO?.data?.();
        if (!data) break;
        const slots = [...document.querySelectorAll('#parts-list [data-part-thumb]')];
        for (const slot of slots) {
          const id = slot.dataset.partThumb, p = data.parts?.[id];
          if (!p?.file) continue;
          let url = thumbs.get(id);
          if (!url) {
            url = await renderPartThumb(p);
            if (url) { thumbs.set(id, url); renderedNew = true; }
          }
          if (url) {
            document.querySelectorAll(`#parts-list [data-part-thumb="${CSS.escape(id)}"]`).forEach(el => {
              if (!el.querySelector('img')) el.innerHTML = `<img src="${url}" alt="">`;
            });
          }
        }
      } while (again);
    } finally {
      if (renderedNew) releaseThumbStudio();
      running = false;
    }
  }
  window.addEventListener('astro:catalog', syncCatalogThumbs);
  syncCatalogThumbs();
})().catch(err => console.warn('Catalog 3D thumbnails disabled:', err));
// Surface: the landing site in 3D. The ground is the real HiRISE terrain of the chosen site
// (assets/terrain, built by tools/terrain; index.terrain.<site>.js when opened from disk).
// First-person walk with the crew member's own suit in view when looking down (V: chase camera).
// One block per crew member marks a surface experiment (window.ASTRO_SIM.surf.tasks) at a random spot;
// its owner walks there and runs the minigame (placeholder for now). The rules (launch window timer,
// boarding, results) live in ASTRO_SIM; this module moves the crew and reports back.
(() => {
  const root = document.getElementById('surface'), ui = window.ASTRO, sim = () => window.ASTRO_SIM;
  if (!root || !ui) return;
  const t = (key, opts) => window.ASTRO_I18N?.t(key, opts) ?? key;
  const U = window.ASTRO_UNITS || { distanceM: (m, d = 0) => `${d > 0 ? Number(m).toFixed(d) : Math.round(m)} m` };
  const $s = id => document.getElementById(id);
  const viewEl = $s('surface-view'), startEl = $s('surface-start'), promptEl = $s('surface-prompt'), dlg = $s('minigame-dialog');
  const MARS_G = 3.71; // m/s², Mars surface gravity (same value as tools/modeling/lib/fx-presets.mjs)
  // game-balance: walk/run speed (m/s), jump speed, reach to a block or the lander, and where the blocks
  // land (close enough to visit all four within the launch window).
  const WALK = 2.2, RUN = 4.6, JUMP = 2.6, REACH = 3.2, BOARD_REACH = 5, BOARD_SAFE_R = 6.5, SPOT_MIN = 20, SPOT_MAX = 75, SPOT_GAP = 28;
  // Where each crew member stands after touchdown (m, south of the lander) and where NPCs rush to board in the final 10 s.
  const CREW_START = { helena: [-5.4, 6.6], lucas: [-1.8, 7.5], oscar: [2.1, 7.5], maya: [5.7, 6.3] };
  const CREW_BOARD = { helena: [-1.8, 2.8], lucas: [-0.7, 3.2], oscar: [0.7, 3.2], maya: [1.8, 2.8] };
  const STRIDE = 1.33; // m/s that matches walk_loop (1.1 s cycle, two ~0.73 m steps)
  // game: the photo is a grayscale stretch; this gain on the manifest tint makes it read as warm Mars ground under the game lights.
  const GROUND_GAIN = [3, 2, 1.25];
  // game: haze. With a horizon ring (manifest `horizon`), exp² by distance from the eye: clear for the first ~10 km,
  // HAZE_AT_EDGE at the ring's far edge so it melts into the sky; without one, a short fog hides the terrain edge.
  const HAZE_AT_EDGE = .97, EDGE_FOG = [45, 230], NO_RING_FAR = 1200;
  const radialFog = shader => { // fog by distance, not view depth: the ring edge stays hidden at the screen sides too
    shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#ifdef USE_FOG\n  vFogDepth = length(mvPosition.xyz);\n#endif');
  };
  const tasks = () => sim()?.surf.tasks ?? [];
  const isDone = id => !!sim()?.surf.completed.has(id);
  const touch = matchMedia('(pointer: coarse)').matches, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const s = { site: null, crew: null, emote: null, emoteCam: false, mode: 'first', yaw: 0, pitch: -.1, bodyYaw: 0, speed: 0, vy: 0, grounded: true, jump: false,
    pos: new THREE.Vector3(), keys: new Set(), stick: null, look: null, drag: null, ready: false, prompt: '' };
  let world = null;

  const hiddenMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); // still casts a shadow
  const flat = (color, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  function initWorld() {
    let renderer;
    // Logarithmic depth: the horizon ring reaches 100 km while the suit is 5 cm from the eye.
    try { renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }); } catch { return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    viewEl.prepend(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, 1, .05, NO_RING_FAR);
    camera.rotation.order = 'YXZ';
    // Daytime Mars sky (game colors): butterscotch at the horizon, darker overhead; faceted dome.
    const horizon = new THREE.Color(0xd8a07c), zenith = new THREE.Color(0x7a4c46);
    const skyGeo = new THREE.IcosahedronGeometry(900, 2), sp = skyGeo.attributes.position, colors = [];
    for (let k = 0; k < sp.count; k++) { const c = horizon.clone().lerp(zenith, Math.pow(Math.max(0, sp.getY(k) / 900), .55)); colors.push(c.r, c.g, c.b); }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1; scene.add(sky);
    scene.fog = new THREE.Fog(horizon, ...EDGE_FOG);
    scene.add(new THREE.HemisphereLight(0xf3c9a0, 0x4a2418, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .03;
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 180 });
    scene.add(sun, sun.target);
    const skirt = new THREE.Mesh(new THREE.CircleGeometry(1500, 6).rotateX(-Math.PI / 2), flat(0x6b3b28, 1));
    scene.add(skirt);
    const lander = makeLander(); scene.add(lander);
    const w = { renderer, scene, camera, sky, sun, skirt, lander, sunDir: new THREE.Vector3(0, 1, 0), terrain: null, hf: null,
      blocks: [], colliders: [], avatars: new Map(), avatar: null, width: 0, height: 0 };
    new ResizeObserver(() => {
      w.width = viewEl.clientWidth; w.height = viewEl.clientHeight;
      if (!w.width || !w.height) return;
      renderer.setSize(w.width, w.height, false); camera.aspect = w.width / w.height; camera.updateProjectionMatrix();
    }).observe(viewEl);
    bindInput(renderer.domElement);
    return w;
  }

  // The landed vehicle at the site center: the enlarged Crew Cabin / Mars Lander capsule with deployed legs and ladder.
  function makeLander() {
    const g = new THREE.Group(), steel = flat(0x9ea4ad, .45, .75), titanium = flat(0x8f9196, .4, .8),
      foil = flat(0xd4a72c, .3, .9), dark = flat(0x1e2024, .55), nozzleMat = flat(0x3a3633, .6, .6);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    const strut = (geo, mat, a, b) => {
      const dir = b.clone().sub(a), m = add(geo(dir.length()), mat, 0, 0, 0);
      m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    };
    g.userData.ready = loadGLB('parts/structures/crew-cabin.glb').then(hull => {
      for (const n of ['Stowed_Back', 'Stowed_Front']) { const o = hull.getObjectByName(n); if (o) o.visible = false; }
      const closed = hull.getObjectByName('Closed'); if (closed) closed.visible = true;
      hull.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      hull.scale.setScalar(2.05);
      hull.position.y = .65;
      g.add(hull);
    });
    // Under-hull heatshield base, thermal collar & descent engine nozzle.
    add(new THREE.CylinderGeometry(1.48, 1.32, .16, 12), dark, 0, 1.05, 0);
    add(new THREE.CylinderGeometry(.36, .42, .18, 10), foil, 0, .98, 0);
    add(new THREE.ConeGeometry(.58, .72, 10), nozzleMat, 0, .68, 0).rotation.x = Math.PI;
    // Four deployed landing legs with primary telescopic struts, A-frame braces & hexagonal footpads.
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, sin = Math.sin(a), cos = Math.cos(a);
      const top = new THREE.Vector3(sin * 1.50, 1.24, cos * 1.50);
      const low = new THREE.Vector3(sin * 1.38, 1.02, cos * 1.38);
      const foot = new THREE.Vector3(sin * 2.48, .08, cos * 2.48);
      const mid = top.clone().add(foot).multiplyScalar(.5);
      strut(len => new THREE.CylinderGeometry(.06, .07, len, 6), steel, top, foot);
      strut(len => new THREE.CylinderGeometry(.045, .045, len, 5), titanium, low, mid);
      add(new THREE.CylinderGeometry(.28, .34, .09, 6), steel, foot.x, .045, foot.z);
    }
    // Boarding ladder on +Z leading up to the crew hatch threshold.
    add(new THREE.BoxGeometry(.56, .04, .22), titanium, 0, 2.06, 1.56);
    for (const sx of [-.24, .24]) strut(len => new THREE.CylinderGeometry(.024, .024, len, 6), steel, new THREE.Vector3(sx, 2.06, 1.50), new THREE.Vector3(sx, .04, 2.18));
    for (let i = 0; i < 7; i++) {
      const t = (i + .6) / 7.2, y = 2.06 * (1 - t) + .04 * t, z = 1.50 * (1 - t) + 2.18 * t;
      const rung = add(new THREE.CylinderGeometry(.016, .016, .48, 5), steel, 0, y, z);
      rung.rotation.z = Math.PI / 2;
    }
    // Engine exhaust plume & point light for the timeout ascent sequence.
    const plume = new THREE.Group();
    plume.position.set(0, .32, 0);
    for (const [r, h, col, op] of [[.52, 2.8, 0xe04f26, .55], [.34, 2.0, 0xf59e0b, .72], [.16, 1.2, 0xfce8a6, .95]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      cone.rotation.x = Math.PI;
      cone.position.y = -h * .5;
      plume.add(cone);
    }
    plume.visible = false;
    g.add(plume);
    const engineLight = new THREE.PointLight(0xf59e0b, 0, 28, 1.6);
    engineLight.position.set(0, .1, 0);
    g.add(engineLight);
    g.userData.plume = plume;
    g.userData.engineLight = engineLight;
    return g;
  }

  // Experiment marker: hex plinth, a block in the owner's color, a floating gem and a light beam seen from afar.
  function makeBlock(exp, color) {
    const g = new THREE.Group(), tone = new THREE.Color(color), dark = flat(0x281147, .9), mat = flat(tone, .75);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, .4, 6), dark); plinth.position.y = .1;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat); block.position.y = .85; block.rotation.y = Math.PI / 4;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, .16, 1.14), dark); band.position.y = 1.05; band.rotation.y = Math.PI / 4;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshBasicMaterial({ color: 0xfce8a6 })); gem.position.y = 2.2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 60, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.y = 31;
    for (const m of [plinth, block, band]) m.castShadow = m.receiveShadow = true;
    g.add(plinth, block, band, gem, beam);
    g.userData = { exp, gem, beam, tag: null };
    return g;
  }

  // Terrain: the GLB comes from index.terrain.<site>.js (a <script> works on file://).
  const terrains = new Map();
  function fetchTerrain(id) {
    if (!terrains.has(id)) terrains.set(id, (async () => {
      if (!window.ASTRO_TERRAIN?.[id]) await new Promise((ok, fail) => {
        const tag = document.createElement('script');
        tag.src = `index.terrain.${id}.js`; tag.onload = ok; tag.onerror = () => fail(new Error(`index.terrain.${id}.js missing (npm run web:models)`));
        document.head.append(tag);
      });
      const entry = window.ASTRO_TERRAIN?.[id];
      if (!entry?.glb) throw new Error(`no terrain for ${id}`);
      const bin = atob(entry.glb), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      delete entry.glb;
      const gltf = await loader.parseAsync(bytes.buffer, '');
      // "Terrain": the walkable HiRISE crop. "Horizon" (optional): the land around it out to tens of km.
      const mesh = gltf.scene.getObjectByName('Terrain'), ring = gltf.scene.getObjectByName('Horizon') ?? null;
      mesh.receiveShadow = true;
      const { color, map } = mesh.material;
      color.setRGB(color.r * GROUND_GAIN[0], color.g * GROUND_GAIN[1], color.b * GROUND_GAIN[2]);
      if (map) map.anisotropy = world.renderer.capabilities.getMaxAnisotropy(); // keeps the photo sharp at grazing angles
      addGroundDetail(mesh.material, entry.site.sizeM);
      if (ring) { // its texture already carries the relief shading (real sun, 200 m DEM): light it as level ground
        const m = ring.material, n = ring.geometry.attributes.position.count;
        ring.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        m.color.setRGB(m.color.r * GROUND_GAIN[0], m.color.g * GROUND_GAIN[1], m.color.b * GROUND_GAIN[2]);
        if (m.map) m.map.anisotropy = world.renderer.capabilities.getMaxAnisotropy();
        m.flatShading = false; m.onBeforeCompile = radialFog; m.needsUpdate = true;
      }
      const hf = heightField(mesh);
      gltf.scene.add(scatterRocks(hf, entry.site.id));
      return { info: entry.site, scene: gltf.scene, hf, ring };
    })().catch(err => { terrains.delete(id); throw err; }));
    return terrains.get(id);
  }
  // The photo has 0.5 m pixels, too coarse at walking distance: a tiled grain (3 m tiles) multiplies it
  // up close and averages out with distance (mipmaps). Game art, not data.
  let grain = null;
  function addGroundDetail(material, sizeM) {
    if (!grain) {
      const N = 256, data = new Uint8Array(N * N * 4), rnd = (i, seed) => { const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
      const octave = (cells, seed) => (x, y) => { // tileable value noise
        const fx = x / N * cells, fy = y / N * cells, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
        const at = (a, b) => rnd(((b % cells) * cells) + (a % cells), seed);
        return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
      };
      const layers = [[octave(6, 1), .4], [octave(24, 2), .35], [octave(96, 3), .25]];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const g = Math.round(255 * layers.reduce((sum, [f, w]) => sum + f(x, y) * w, 0)), k = (y * N + x) * 4;
        data[k] = data[k + 1] = data[k + 2] = g; data[k + 3] = 255;
      }
      grain = new THREE.DataTexture(data, N, N);
      grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.magFilter = THREE.LinearFilter; grain.minFilter = THREE.LinearMipmapLinearFilter;
      grain.generateMipmaps = true; grain.anisotropy = world.renderer.capabilities.getMaxAnisotropy(); grain.needsUpdate = true;
    }
    material.onBeforeCompile = shader => {
      radialFog(shader);
      shader.uniforms.grainMap = { value: grain }; shader.uniforms.grainRepeat = { value: sizeM / 3 };
      shader.fragmentShader = 'uniform sampler2D grainMap;\nuniform float grainRepeat;\n' + shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n  diffuseColor.rgb *= 0.55 + 0.9 * texture2D(grainMap, vMapUv * grainRepeat).r;');
    };
  }
  // Loose rocks (game art): same spots every time for a site, so the ground has scale when walking.
  function scatterRocks(hf, seedText) {
    let seed = [...seedText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const COUNT = 900, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), flat(0xffffff, .95), COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), lim = hf.half - 6;
    for (let i = 0; i < COUNT; i++) {
      const size = rand() < .06 ? .5 + rand() * .7 : .06 + Math.pow(rand(), 2) * .35;
      p.set((rand() * 2 - 1) * lim, 0, (rand() * 2 - 1) * lim); p.y = hf.at(p.x, p.z) - size * .25;
      sc.set(size * (.8 + rand() * .5), size * (.45 + rand() * .3), size * (.8 + rand() * .5));
      rocks.setMatrixAt(i, m.compose(p, q.setFromEuler(e.set(rand() * .6, rand() * Math.PI * 2, rand() * .6)), sc));
      rocks.setColorAt(i, c.setRGB(.2 + rand() * .1, .1 + rand() * .05, .06 + rand() * .03));
    }
    rocks.castShadow = rocks.receiveShadow = true;
    return rocks;
  }
  // Ground height by bilinear lookup in the mesh grid: row-major from the north-west corner,
  // same layout as tools/terrain/lib/terrain-mesh.mjs (cheaper than a raycast on 129k triangles).
  function heightField(mesh) {
    const p = mesh.geometry.attributes.position, n = Math.round(Math.sqrt(p.count));
    const x0 = p.getX(0), z0 = p.getZ(0), step = p.getX(1) - x0, h = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) h[k] = p.getY(k);
    const at = (x, z) => {
      const fx = clamp((x - x0) / step, 0, n - 1.0001), fz = clamp((z - z0) / step, 0, n - 1.0001);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
      return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + n] * (1 - u) + h[k + n + 1] * u) * v;
    };
    const slope = (x, z) => Math.hypot(at(x + 1, z) - at(x - 1, z), at(x, z + 1) - at(x, z - 1)) / 2;
    return { at, slope, half: (n - 1) * step / 2 };
  }

  async function loadCrew(id) {
    if (world.avatars.has(id)) return world.avatars.get(id);
    const gltf = await loadGLTF(`characters/${id}.glb`), body = gltf.scene.clone(true); // pivot rig, no skinning
    const mixer = new THREE.AnimationMixer(body), clip = name => gltf.animations.find(a => a.name === name);
    const idle = mixer.clipAction(clip('idle_loop')), walk = mixer.clipAction(clip('walk_loop'));
    const wave = mixer.clipAction(clip('wave')), action = mixer.clipAction(clip('action_loop'));
    idle.play(); walk.play(); walk.setEffectiveWeight(0);
    wave.setLoop(THREE.LoopOnce, 1);
    const props = [];
    body.traverse(o => {
      if (o.isMesh) o.castShadow = true;
      if (o.name.startsWith('Prop_')) { o.visible = false; props.push(o); }
    });
    const head = body.getObjectByName('Head'), helmet = [];
    head.traverse(o => { if (o.isMesh) { o.userData.mat = o.material; helmet.push(o); } });
    body.updateMatrixWorld(true);
    const idx = world.avatars.size;
    const a = { id, body, mixer, idle, walk, wave, action, props, emoteAction: null, emoteW: 0, actW: 0, head, helmet, walkW: 0,
      upperArmL: body.getObjectByName('UpperArm_L'), lowerArmL: body.getObjectByName('LowerArm_L'),
      upperArmR: body.getObjectByName('UpperArm_R'), lowerArmR: body.getObjectByName('LowerArm_R'),
      torso: body.getObjectByName('Torso'),
      eyeY: head.getWorldPosition(new THREE.Vector3()).y, pos: new THREE.Vector3(), bodyYaw: 0,
      ai: { state: 'idle', last: 'idle', timer: 1.5 + idx * 0.9, tx: 0, tz: 0, waveCd: 0 } };
    mixer.addEventListener('finished', e => {
      if (e.action !== wave) return;
      if (world.avatar?.id === id && s.emote?.kind === 'wave') endEmote();
      else if (world.avatar?.id !== id && a.ai.state === 'wave') {
        wave.stop();
        idle.setEffectiveWeight(1);
        a.ai.state = 'idle'; a.ai.timer = 1.8 + Math.random() * 2;
      }
    });
    world.avatars.set(id, a); world.scene.add(body);
    return a;
  }
  // Every crew member stands on the surface; the player controls one (keys 1–4), while others run simple autonomous AI.
  async function useCrew(id) {
    endEmote();
    const prev = world.avatar;
    s.crew = id; renderCrewBar();
    const a = await loadCrew(id);
    if (s.crew !== id) return;
    if (prev && prev !== a) {
      prev.pos.copy(s.pos); prev.bodyYaw = s.bodyYaw;
      prev.action.stop(); prev.wave.stop();
      prev.emoteAction = null; prev.emoteW = 0; prev.actW = 0;
      for (const p of prev.props) p.visible = false;
      prev.ai = { state: 'idle', last: 'idle', timer: 2 + Math.random() * 2, tx: prev.pos.x, tz: prev.pos.z, waveCd: 3 };
    }
    a.action.stop(); a.wave.stop();
    a.emoteAction = null; a.emoteW = 0; a.actW = 0;
    for (const p of a.props) p.visible = false;
    a.ai.state = 'idle';
    for (const o of [prev, a]) if (o) { o.net = null; o.wasRemote = false; } // poses from before the switch are stale
    world.avatar = a;
    s.pos.copy(a.pos); s.bodyYaw = a.bodyYaw; s.yaw = a.bodyYaw - Math.PI; s.vy = 0; s.grounded = true;
    if (sim()) sim().surf.activeCrew = id;
    applyMode(); s.prompt = '';
  }
  const clampPitch = () => { s.pitch = s.mode === 'first' ? clamp(s.pitch, -1.45, 1.2) : clamp(s.pitch, -1, .45); };
  function applyMode() {
    for (const a of world.avatars.values()) for (const m of a.helmet) m.material = a === world.avatar && s.mode === 'first' ? hiddenMat : m.userData.mat;
    clampPitch();
  }
  function setMode(mode) { s.mode = mode; applyMode(); }

  function setTerrain(t) {
    const { info, hf } = t;
    if (world.terrain) world.scene.remove(world.terrain);
    world.terrain = t.scene; world.hf = hf; world.scene.add(t.scene);
    const az = info.sun.azimuthDeg * Math.PI / 180, el = info.sun.elevationDeg * Math.PI / 180; // sun of the photo (HiRISE label)
    world.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    world.skirt.position.y = info.elevation.minM - info.elevation.centerM - .4;
    world.skirt.material.color.setRGB(info.tint[0] * .2, info.tint[1] * .2, info.tint[2] * .2);
    // With a horizon ring the real land continues past the edge: no skirt, haze out to the ring's far edge.
    const reach = t.ring ? info.horizon.radiusM : 0;
    world.skirt.visible = !t.ring;
    const haze = world.scene.fog.color;
    world.scene.fog = t.ring ? new THREE.FogExp2(haze, Math.sqrt(-Math.log(1 - HAZE_AT_EDGE)) / reach) : new THREE.Fog(haze, ...EDGE_FOG);
    world.camera.far = t.ring ? reach * 1.05 : NO_RING_FAR; world.camera.updateProjectionMatrix();
  }

  // The spots come from a seed (the host's, in a room), so every screen puts the blocks in the same places.
  const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function placeBlocks(seed) {
    const { hf, scene } = world, tags = $s('surface-tags'), spots = [], lim = hf.half - 24, rand = seeded(seed ?? Math.floor(Math.random() * 2 ** 31));
    for (const b of world.blocks) scene.remove(b);
    tags.innerHTML = ''; world.blocks = []; world.colliders = [{ x: 0, z: 0, r: 2.9 }];
    for (const exp of tasks()) {
      let spot = null;
      for (let t = 0; t < 300 && !spot; t++) {
        const r = SPOT_MIN + rand() * (SPOT_MAX - SPOT_MIN), a = rand() * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
        const ok = Math.abs(x) < lim && Math.abs(z) < lim && hf.slope(x, z) < .2 && spots.every(p => Math.hypot(p.x - x, p.z - z) > SPOT_GAP);
        if (ok || t === 299) spot = { x, z };
      }
      spots.push(spot);
      const owner = ui.crew.find(c => c.id === exp.crew), block = makeBlock(exp, owner.color);
      block.position.set(spot.x, hf.at(spot.x, spot.z), spot.z);
      const tag = document.createElement('span');
      tag.className = 'surface-tag'; tag.style.setProperty('--crew', owner.color);
      tags.append(tag); block.userData.tag = tag;
      scene.add(block); world.blocks.push(block); world.colliders.push({ x: spot.x, z: spot.z, r: 1.6 });
    }
    function renderSurfaceGoals() {
      $s('surface-goals').innerHTML = tasks().map(e => { const o = ui.crew.find(c => c.id === e.crew);
        return `<li data-goal="${e.id}" style="--crew:${o.color}"><span class="goal-chip"></span><span class="goal-name"><strong>${e.id} · ${e.title}</strong><small>${o.name}</small></span><span class="goal-dist"></span><span class="goal-arrow"></span></li>`; }).join('');
    }
    renderSurfaceGoals();
  }

  // In a room, an astronaut another player moves cannot be taken.
  function renderCrewBar() {
    const control = sim()?.surf.control || {};
    $s('surface-crew').innerHTML = ui.crew.map((c, i) => { const other = mp() && c.id !== s.crew && !!control[c.id] && control[c.id] !== net().you.id;
      return `<button type="button" data-crew="${c.id}" style="--crew:${c.color}" aria-pressed="${c.id === s.crew}" ${other ? 'disabled' : ''}>${c.name}<small>${other ? t('common.player') : touch ? '' : t('surface.keyHint', { n: i + 1 })}</small></button>`; }).join('');
  }
  $s('surface-crew').addEventListener('click', e => { const b = e.target.closest('[data-crew]'); if (b && world) switchCrew(b.dataset.crew); });
  function switchCrew(id) {
    if (id === s.crew) return;
    if (mp()) { sim()?.requestCrew(id); return; } // the host hands out the AI astronauts (astro:control below)
    useCrew(id).then(() => ui.toast(t('surface.nowControlling', { name: ui.crew.find(c => c.id === id).name })));
  }
  window.addEventListener('astro:control', () => {
    if (!world || !s.ready || !mp()) return;
    const mine = sim()?.myCrew();
    if (mine && mine !== s.crew) useCrew(mine).then(() => ui.toast(t('surface.nowControlling', { name: ui.crew.find(c => c.id === mine).name })));
    else renderCrewBar();
  });

  function showStart(kicker, title, keys) {
    $s('surface-start-kicker').textContent = kicker; $s('surface-start-title').textContent = title;
    $s('surface-keys').innerHTML = keys; startEl.hidden = false;
  }
  function fail(message) { root.classList.add('surface-fail'); showStart(t('surface.surfaceLabel'), message, t('surface.failFallbackHint')); }

  async function land({ site, crew, seed }) {
    root.classList.remove('surface-fail');
    if (!world) world = initWorld();
    const info = ui.sites[site];
    if (!world) return fail(t('surface.needWebgl'));
    s.ready = false; s.site = site;
    showStart(t('surface.touchdown'), t('surface.loadingSite', { name: info.name }), '');
    try {
      const [terrain] = await Promise.all([fetchTerrain(site), world.lander.userData.ready]);
      if (s.site !== site) return;
      setTerrain(terrain);
      s.departing = null;
      world.lander.position.set(0, terrain.hf.at(0, 0), 0);
      if (world.lander.userData.plume) world.lander.userData.plume.visible = false;
      if (world.lander.userData.engineLight) world.lander.userData.engineLight.intensity = 0;
      world.camera.fov = 72; world.camera.updateProjectionMatrix();
      placeBlocks(seed); buildCompass();
      await Promise.all(ui.crew.map(c => loadCrew(c.id)));
      let idx = 0;
      for (const [id, [x, z]] of Object.entries(CREW_START)) {
        const a = world.avatars.get(id);
        a.body.visible = true;
        a.pos.set(x, terrain.hf.at(x, z), z); a.bodyYaw = 0;
        a.body.rotation.set(0, 0, 0);
        a.action.stop(); a.wave.stop(); a.emoteAction = null; a.emoteW = 0; a.actW = 0; a.walkW = 0;
        for (const p of a.props) p.visible = false;
        a.ai = { state: 'idle', last: 'idle', timer: 1.2 + idx++ * 0.85, tx: x, tz: z, waveCd: 1.5 };
      }
      world.avatar = null; s.pitch = -.1;
      await useCrew(crew);
      const first = world.blocks.find(b => b.userData.exp.crew === crew)?.position ?? world.blocks[0].position;
      s.yaw = Math.atan2(-(first.x - s.pos.x), -(first.z - s.pos.z)); s.bodyYaw = s.yaw + Math.PI;
      s.ready = true;
      startEl.hidden = true;
      ui.toast(window.ASTRO_I18N.t(touch ? 'surface.touchHint' : 'surface.desktopHint'));
      if (mp()) { for (const p of net().poses) takePose(p.data); sim()?.surfaceLoaded?.(); renderCrewBar(); }
    } catch (err) {
      console.warn('Surface not shown:', err);
      fail(window.ASTRO_I18N.t('surface.terrainError', { name: info?.name ?? site }));
    }
  }
  window.addEventListener('astro:land', e => land(e.detail));

  // Emote wheel: the animations every avatar has (AGENTS.md §5.5). Hold Q, aim with the mouse and release;
  // or click/tap the emotes button and pick. In first person the camera steps back while the emote plays.
  const ACTION_EMOTE = {
    helena: ['🪛', () => t('surface.emoteLabels.helena')],
    lucas: ['💻', () => t('surface.emoteLabels.lucas')],
    oscar: ['📡', () => t('surface.emoteLabels.oscar')],
    maya: ['🧪', () => t('surface.emoteLabels.maya')],
  };
  const wheelEl = $s('emote-wheel');
  const emotes = () => [
    ['wave', '👋', t('surface.emoteLabels.wave')],
    ...(ACTION_EMOTE[s.crew] ? [['action', ACTION_EMOTE[s.crew][0], ACTION_EMOTE[s.crew][1]()]] : []),
    ['walk', '🚶', t('surface.emoteLabels.walk')],
    ['idle', '🧍', t('surface.emoteLabels.idle')],
  ];
  const wheel = { open: false, hold: false, pick: -1, x: 0, y: 0 };
  function openWheel(hold) {
    if (!world?.avatar || dlg.open) return;
    const list = emotes();
    wheelEl.querySelectorAll('button').forEach(b => b.remove());
    list.forEach(([kind, icon, label], i) => wheelEl.insertAdjacentHTML('beforeend', `<button type="button" role="menuitem" data-emote="${kind}" style="--a:${i * 360 / list.length}deg">${icon}<small>${label}</small></button>`));
    Object.assign(wheel, { open: true, hold, pick: -1, x: 0, y: 0 });
    $s('emote-name').textContent = t('surface.emotesTitle'); wheelEl.hidden = false; s.keys.clear();
  }
  function closeWheel(play) {
    if (!wheel.open) return;
    const kind = wheel.pick >= 0 ? emotes()[wheel.pick][0] : null;
    wheel.open = false; wheelEl.hidden = true;
    if (play && kind) playEmote(kind);
  }
  function aimWheel(dx, dy) { // mouse direction picks the nearest slot (slot 0 at the top, clockwise)
    wheel.x += dx; wheel.y += dy;
    if (Math.hypot(wheel.x, wheel.y) < 20) return;
    const n = emotes().length, ang = (Math.atan2(wheel.x, -wheel.y) + Math.PI * 2) % (Math.PI * 2);
    wheel.pick = Math.round(ang / (Math.PI * 2 / n)) % n;
    wheelEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === wheel.pick));
    $s('emote-name').textContent = emotes()[wheel.pick][2];
  }
  wheelEl.addEventListener('pointerover', e => { // without pointer lock, hovering a slot picks it (hold Q, hover, release)
    const b = e.target.closest('[data-emote]'), all = [...wheelEl.querySelectorAll('button')];
    if (!b) return;
    wheel.pick = all.indexOf(b); all.forEach((x, i) => x.classList.toggle('on', i === wheel.pick)); $s('emote-name').textContent = emotes()[wheel.pick][2];
  });
  wheelEl.addEventListener('click', e => { const b = e.target.closest('[data-emote]'); if (b) { wheel.pick = [...wheelEl.querySelectorAll('button')].indexOf(b); closeWheel(true); } });
  $s('surface-emote').addEventListener('click', () => (wheel.open ? closeWheel(false) : openWheel(false)));
  function playEmote(kind) {
    const a = world?.avatar;
    if (!a) return;
    endEmote();
    if (kind === 'idle') return;
    s.emote = { kind };
    for (const p of a.props) p.visible = (kind === 'action');
    if (kind === 'wave' || kind === 'action') { a.emoteAction = a[kind]; a.emoteAction.reset().play(); }
    if (s.mode === 'first') { s.emoteCam = true; setMode('third'); }
  }
  function endEmote() {
    if (!s.emote) return;
    const a = world?.avatar;
    if (a) for (const p of a.props) p.visible = false;
    s.emote = null;
    if (s.emoteCam) { s.emoteCam = false; setMode('first'); }
  }

  // Compass strip: ±90° around the view heading; cardinal points, 15° ticks, the lander and each experiment.
  const compassEl = $s('surface-compass-strip');
  let compassItems = [];
  function buildCompass() {
    if (!world) return;
    const CARDINAL = t('surface.cardinals');
    compassEl.innerHTML = Array.from({ length: 24 }, (_, i) => i * 15).map(d => d % 45
      ? `<span class="cmp-tick" data-deg="${d}"></span>`
      : `<span class="cmp-card${d ? '' : ' north'}" data-deg="${d}">${CARDINAL[d / 45]}</span>`).join('')
      + `<span class="cmp-mark lander" title="${t('surface.landerTitle')}"></span>`
      + world.blocks.map(b => `<span class="cmp-mark" data-mark="${b.userData.exp.id}" style="--crew:${ui.crew.find(c => c.id === b.userData.exp.crew).color}"></span>`).join('');
    compassItems = [...compassEl.children].map(el => ({ el, deg: el.dataset.deg == null ? null : +el.dataset.deg,
      at: el.classList.contains('lander') ? new THREE.Vector3() : world.blocks.find(b => b.userData.exp.id === el.dataset.mark)?.position, id: el.dataset.mark }));
  }
  function updateCompass() {
    const heading = ((-s.yaw * 180 / Math.PI) % 360 + 360) % 360, half = compassEl.clientWidth / 2;
    for (const it of compassItems) {
      const bearing = it.deg ?? (Math.atan2(it.at.x - s.pos.x, -(it.at.z - s.pos.z)) * 180 / Math.PI + 360) % 360;
      const d = ((bearing - heading + 540) % 360) - 180;
      it.el.hidden = Math.abs(d) > 90;
      if (!it.el.hidden) it.el.style.left = `${half + d / 90 * (half - 8)}px`;
      if (it.id) it.el.classList.toggle('done', isDone(it.id));
    }
    $s('surface-compass-readout').textContent = t('surface.hdg', { deg: String(Math.round(heading) % 360).padStart(3, '0') });
  }

  // Input: keyboard + mouse look (a click on the view captures the mouse, Esc frees it; drag only when the
  // browser refuses the lock), touch stick + look.
  function bindInput(canvas) {
    const live = () => isActive('surface') && s.ready && !dlg.open;
    addEventListener('keydown', e => {
      if (!live()) return;
      if (e.code === 'KeyQ') { if (!e.repeat) openWheel(true); return; }
      if (wheel.open) { if (e.code === 'Escape') closeWheel(false); return; }
      s.keys.add(e.code);
      if (e.code === 'Space') { s.jump = true; e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'KeyE' || e.code === 'Enter') interact();
      if (e.code === 'KeyV') setMode(s.mode === 'first' ? 'third' : 'first');
      const n = /^Digit([1-4])$/.exec(e.code)?.[1];
      if (n) switchCrew(ui.crew[n - 1].id);
    });
    addEventListener('keyup', e => { s.keys.delete(e.code); if (e.code === 'KeyQ' && wheel.hold) closeWheel(true); });
    addEventListener('blur', () => s.keys.clear());
    const turn = (dx, dy, k) => { s.yaw -= dx * k; s.pitch -= dy * k; clampPitch(); };
    // Chrome can send a lone, huge movement right after locking and now and then while locked. Drop only that
    // outlier: a fast turn grows over several events and is kept. (A flat 200 px cut froze the view on quick
    // turns, more so at low frame rates, where the browser merges a whole frame of motion into one event.)
    const SPIKE_PX = 200, SPIKE_RATIO = 4;
    let settle = false, lastMove = 0;
    document.addEventListener('pointerlockchange', () => {
      settle = true;
      if (document.pointerLockElement === canvas) s.drag = null;
    });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) {
        const m = Math.max(Math.abs(e.movementX), Math.abs(e.movementY)), before = lastMove;
        if (!m) return; // Chrome also sends zero moves when the page changes under the cursor (HUD, tags)
        lastMove = m;
        if (settle || (m > SPIKE_PX && m > before * SPIKE_RATIO + 40)) { settle = false; return; }
        if (wheel.open) return aimWheel(e.movementX, e.movementY);
        turn(e.movementX, e.movementY, .0022);
      }
      else if (s.drag) { turn(e.clientX - s.drag.x, e.clientY - s.drag.y, .004); s.drag = { x: e.clientX, y: e.clientY }; }
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0 || document.pointerLockElement === canvas) return;
      s.drag = { x: e.clientX, y: e.clientY };
      if (!touch && live()) try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* drag to look instead */ }
    });
    addEventListener('mouseup', () => { s.drag = null; });
    const stickEl = $s('surface-stick');
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !live()) return;
      const r = viewEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < r.width * .45 && !s.stick) {
        s.stick = { id: e.pointerId, ox: x, oy: y, x: 0, y: 0 };
        stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.classList.add('on');
      } else if (!s.look) s.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    });
    canvas.addEventListener('pointermove', e => {
      if (s.stick?.id === e.pointerId) {
        const r = viewEl.getBoundingClientRect(), dx = e.clientX - r.left - s.stick.ox, dy = e.clientY - r.top - s.stick.oy, len = Math.hypot(dx, dy), k = Math.min(1, len / 50) / (len || 1);
        s.stick.x = dx * k; s.stick.y = -dy * k;
        stickEl.firstElementChild.style.translate = `${s.stick.x * 33}px ${-s.stick.y * 33}px`;
      } else if (s.look?.id === e.pointerId) { turn(e.clientX - s.look.x, e.clientY - s.look.y, .006); s.look.x = e.clientX; s.look.y = e.clientY; }
    });
    const release = e => {
      if (s.stick?.id === e.pointerId) { s.stick = null; stickEl.classList.remove('on'); stickEl.firstElementChild.style.translate = ''; }
      if (s.look?.id === e.pointerId) s.look = null;
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    $s('surface-jump').addEventListener('pointerdown', () => { s.jump = true; });
  }
  $s('surface-camera').addEventListener('click', () => { if (world?.avatar) setMode(s.mode === 'first' ? 'third' : 'first'); });
  const release = () => { if (document.pointerLockElement) document.exitPointerLock(); s.keys.clear(); };
  $s('surface-board').addEventListener('click', () => { release(); sim()?.board(); });
  promptEl.addEventListener('click', interact);

  // Experiments: the owner runs the minigame next to the block.
  const COMPLETE_DELAY_MS = 3400; // game-balance: time to read the confirmation and real fact card.
  const MINIGAME_PANELS = { 'H-S1': 'scout-game', 'L-S1': 'moxie-game', 'O-S1': 'relay-game', 'M-S1': 'bio-game' };
  let completionTimer = null;
  const confirmation = document.createElement('div');
  confirmation.className = 'minigame-complete';
  confirmation.setAttribute('role', 'status');
  confirmation.innerHTML = `<span class="minigame-check" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 24 L19 34 L40 12"/></svg></span><strong id="minigame-complete-banner">${t('minigames.completeBanner')}</strong><p class="minigame-fact" id="minigame-fact"></p>`;
  dlg.querySelector('.dialog-inner').append(confirmation);
  const nearBlock = () => world.blocks.find(b => Math.hypot(b.position.x - s.pos.x, b.position.z - s.pos.z) <= REACH) ?? null;
  const nearLander = () => Math.hypot(s.pos.x, s.pos.z) <= BOARD_REACH;
  function interact() {
    if (!world || !s.ready) return;
    const b = nearBlock();
    if (!b) { if (nearLander()) { release(); sim()?.board(); } return; }
    const e = b.userData.exp;
    if (isDone(e.id)) return;
    if (e.crew !== s.crew) return;
    const owner = ui.crew.find(c => c.id === e.crew);
    if (document.pointerLockElement) document.exitPointerLock();
    s.keys.clear();
    $s('minigame-kicker').textContent = t('minigames.kicker', { id: e.id, name: owner.name });
    $s('minigame-title').textContent = e.title;
    $s('minigame-brief').textContent = e.desc;
    $s('minigame-summary').innerHTML = [[t('minigames.summaryMinigame'), e.minigame], [t('minigames.summaryMechanic'), e.mechanic], [t('minigames.summaryBasis'), e.basis]].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
    dlg.dataset.exp = e.id;
    const panelId = MINIGAME_PANELS[e.id] || null;
    Object.values(MINIGAME_PANELS).forEach(id => { $s(id).hidden = id !== panelId; });
    $s('minigame-summary').hidden = false;
    $s('minigame-placeholder').hidden = Boolean(panelId);
    $s('minigame-done').hidden = Boolean(panelId);
    $s('minigame-done').textContent = t('minigames.completeBtn');
    $s('minigame-fact').textContent = '';
    window.ASTRO_MINIGAMES?.open(e.id);
    dlg.showModal();
  }
  $s('minigame-close').addEventListener('click', () => dlg.close());
  function markDone(b) { b.userData.done = true; b.userData.beam.visible = false; b.userData.gem.material.color.set(0x7edac2); b.userData.tag.classList.add('done'); }
  function finishExperiment(id) {
    if (!dlg.open || id !== dlg.dataset.exp || !id || isDone(id)) return;
    sim()?.completeSurfaceTask(id); s.prompt = '';
    const b = world.blocks.find(x => x.userData.exp.id === id);
    if (!isDone(id)) return;
    if (b) markDone(b);
    $s('minigame-fact').textContent = b?.userData.exp.fact || '';
    dlg.classList.add('is-complete');
    completionTimer = setTimeout(() => { if (dlg.open) dlg.close(); }, COMPLETE_DELAY_MS);
  }
  $s('minigame-done').addEventListener('click', () => finishExperiment(dlg.dataset.exp));
  dlg.addEventListener('astro:minigame-completed', event => finishExperiment(event.detail.id));
  dlg.addEventListener('close', () => {
    clearTimeout(completionTimer);
    completionTimer = null;
    dlg.classList.remove('is-complete');
    window.ASTRO_MINIGAMES?.close();
  });
  dlg.addEventListener('click', event => {
    if (event.target !== dlg) return;
    const bounds = dlg.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dlg.close();
  });

  const fwd = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3(), toNpc = new THREE.Vector3();
  const stepYaw = (cur, target, alpha) => cur + Math.atan2(Math.sin(target - cur), Math.cos(target - cur)) * Math.min(1, alpha);
  function pickNpcTarget(o, active) {
    const hf = world.hf, lim = hf.half - 16;
    const ownBlock = world.blocks.find(b => b.userData.exp.crew === o.id);
    for (let attempt = 0; attempt < 32; attempt++) {
      let tx, tz;
      if (ownBlock && attempt < 12 && Math.random() < 0.45) {
        const ang = Math.random() * Math.PI * 2, d = 3.2 + Math.random() * 4.5;
        tx = ownBlock.position.x + Math.sin(ang) * d;
        tz = ownBlock.position.z + Math.cos(ang) * d;
      } else {
        const nearShip = o.id === 'helena' && attempt < 18 && Math.random() < 0.45;
        const r = nearShip ? 5.2 + Math.random() * 4.0 : 12 + Math.random() * 26;
        const ang = Math.random() * Math.PI * 2;
        tx = Math.sin(ang) * r; tz = Math.cos(ang) * r;
      }
      if (Math.abs(tx) >= lim || Math.abs(tz) >= lim || hf.slope(tx, tz) >= 0.35) continue;
      if (Math.hypot(tx - o.pos.x, tz - o.pos.z) < 3.0) continue;
      if (world.colliders.some(c => Math.hypot(tx - c.x, tz - c.z) < c.r + 1.0)) continue;
      let crowded = false;
      for (const other of world.avatars.values()) {
        if (other === o) continue;
        const op = other === active ? s.pos : other.pos;
        if (Math.hypot(tx - op.x, tz - op.z) < 1.2) { crowded = true; break; }
      }
      if (!crowded) return [tx, tz];
    }
    return [o.pos.x, o.pos.z];
  }
  const NO_KEYS = new Set();
  // input false: my minigame is open in a room; my astronaut stands still while the others keep moving.
  function step(dt, input = true) {
    const k = input ? s.keys : NO_KEYS, a = world.avatar, hf = world.hf;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iy = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (s.stick && input) { ix += s.stick.x; iy += s.stick.y; }
    const len = Math.min(1, Math.hypot(ix, iy)), run = k.has('ShiftLeft') || k.has('ShiftRight') || (s.stick && len > .92);
    const speed = len > .08 ? len * (run ? RUN : WALK) : 0, sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
    let mx = 0, mz = 0;
    if (speed) { const n = Math.hypot(ix, iy); mx = (-sin * iy + cos * ix) / n * speed; mz = (-cos * iy - sin * ix) / n * speed; }
    const lim = hf.half - 8;
    s.pos.x = clamp(s.pos.x + mx * dt, -lim, lim); s.pos.z = clamp(s.pos.z + mz * dt, -lim, lim);
    const mates = [...world.avatars.values()].filter(o => o !== a).map(o => ({ x: o.pos.x, z: o.pos.z, r: .7 }));
    for (const c of [...world.colliders, ...mates]) {
      const dx = s.pos.x - c.x, dz = s.pos.z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r && d > 1e-4) { s.pos.x = c.x + dx / d * c.r; s.pos.z = c.z + dz / d * c.r; }
    }
    s.speed = speed;
    const ground = hf.at(s.pos.x, s.pos.z);
    if (s.grounded && s.jump && input) { s.vy = JUMP; s.grounded = false; }
    s.jump = false;
    if (s.grounded) s.pos.y = ground;
    else { s.vy -= MARS_G * dt; s.pos.y += s.vy * dt; if (s.pos.y <= ground) { s.pos.y = ground; s.vy = 0; s.grounded = true; } }
    // First person: the body faces the view. Chase camera: it turns toward where it walks.
    const target = s.mode === 'first' ? s.yaw + Math.PI : speed ? Math.atan2(mx, mz) : s.bodyYaw;
    const d = Math.atan2(Math.sin(target - s.bodyYaw), Math.cos(target - s.bodyYaw));
    s.bodyYaw += s.mode === 'first' ? d : d * Math.min(1, dt * 10);
    a.body.position.copy(s.pos); a.body.rotation.y = s.bodyYaw;
    if (s.emote && (speed || !s.grounded)) endEmote();
    const marching = s.emote?.kind === 'walk', walking = marching || (s.grounded && speed > 0) ? 1 : 0;
    a.walkW += (walking - a.walkW) * Math.min(1, dt * 8);
    a.emoteW += ((s.emote && a.emoteAction ? 1 : 0) - a.emoteW) * Math.min(1, dt * 10);
    if (!s.emote && a.emoteAction && a.emoteW < .02) { a.emoteAction.stop(); a.emoteAction = null; a.emoteW = 0; }
    a.walk.setEffectiveWeight(a.walkW * (1 - a.emoteW)); a.idle.setEffectiveWeight((1 - a.walkW) * (1 - a.emoteW));
    a.emoteAction?.setEffectiveWeight(a.emoteW);
    a.walk.timeScale = marching ? 1 : clamp(speed / STRIDE, .6, 2.6);
    const showPlayerProps = s.emote?.kind === 'action';
    for (const p of a.props) p.visible = showPlayerProps;
    a.mixer.update(reduce && !speed && !s.emote ? 0 : dt);
    world.camera.getWorldDirection(camDir);
    const timeLeft = sim()?.surf.timerSec ?? 999, rushing = timeLeft <= 10 && timeLeft > 0;
    for (const o of world.avatars.values()) { // teammates wander, work in role animations, and wave back when looked at while stopped
      if (o === a) continue;
      if (driverOf(o.id) !== 'ai') { followRemote(o, dt); poseAvatar(o, dt); continue; } // another screen moves it
      if (o.wasRemote) { o.wasRemote = false; o.ai = { state: 'idle', last: 'idle', timer: 1.5, tx: o.pos.x, tz: o.pos.z, waveCd: 3 }; o.wave.stop(); }
      if (rushing) {
        const [bx, bz] = CREW_BOARD[o.id] || [0, 3.2];
        o.ai.tx = bx; o.ai.tz = bz;
        const bdist = Math.hypot(bx - o.pos.x, bz - o.pos.z);
        if (o.ai.state === 'wave' || o.ai.state === 'action') { o.wave.stop(); o.action.stop(); o.actW = 0; }
        o.ai.state = bdist > 0.65 ? 'walk' : 'idle';
        o.ai.timer = 15;
      }
      o.ai.waveCd = Math.max(0, o.ai.waveCd - dt);
      if (!rushing && !reduce && (o.ai.state === 'idle' || o.ai.state === 'action') && o.ai.waveCd <= 0) {
        const pdist = Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z);
        if (pdist > 1.0 && pdist < 18) {
          toNpc.set(o.pos.x, o.pos.y + 1.35, o.pos.z).sub(world.camera.position).normalize();
          if (camDir.dot(toNpc) > 0.94) {
            o.action.stop(); o.actW = 0;
            o.wave.reset().setEffectiveWeight(1).play();
            o.ai.state = 'wave'; o.ai.timer = 2.35; o.ai.waveCd = 8;
          }
        }
      }
      o.ai.timer -= dt;
      if (o.ai.state === 'wave') {
        o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(s.pos.x - o.pos.x, s.pos.z - o.pos.z), dt * 7);
        o.walkW = 0; o.actW = 0;
        o.idle.setEffectiveWeight(0); o.walk.setEffectiveWeight(0); o.action.setEffectiveWeight(0); o.wave.setEffectiveWeight(1);
        if (o.ai.timer <= 0) { o.wave.stop(); o.idle.setEffectiveWeight(1); o.ai.state = 'idle'; o.ai.timer = 1.8 + Math.random() * 2; }
      } else {
        if (o.ai.state === 'action') {
          if (o.id === 'helena' && Math.hypot(o.pos.x, o.pos.z) < 8) {
            o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(-o.pos.x, -o.pos.z), dt * 6);
          }
          if (o.ai.timer <= 0) {
            o.ai.state = 'idle'; o.ai.last = 'action'; o.ai.timer = 1.5 + Math.random() * 2.2;
          }
        } else if (o.ai.state === 'idle') {
          if (rushing) {
            o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(-o.pos.x, -o.pos.z), dt * 8);
          } else if (!reduce && o.ai.timer <= 0) {
            if (o.ai.last !== 'action' && Math.random() < 0.55) {
              o.ai.state = 'action'; o.ai.timer = 4.5 + Math.random() * 3.5; o.action.reset().play();
            } else {
              const [tx, tz] = pickNpcTarget(o, a);
              o.ai.state = 'walk'; o.ai.tx = tx; o.ai.tz = tz; o.ai.timer = 8;
            }
          }
        } else if (o.ai.state === 'walk') {
          const spd = rushing ? WALK : WALK * 0.68, dx = o.ai.tx - o.pos.x, dz = o.ai.tz - o.pos.z, dist = Math.hypot(dx, dz);
          const stepDist = Math.min(dist, spd * dt);
          let nx = clamp(o.pos.x + (dist > 1e-4 ? dx / dist : 0) * stepDist, -lim, lim);
          let nz = clamp(o.pos.z + (dist > 1e-4 ? dz / dist : 0) * stepDist, -lim, lim);
          let blocked = false;
          for (const c of world.colliders) {
            const cx = nx - c.x, cz = nz - c.z, cd = Math.hypot(cx, cz), minR = c.r + (rushing ? 0.35 : 0.6);
            if (cd < minR && cd > 1e-4) { nx = c.x + cx / cd * minR; nz = c.z + cz / cd * minR; blocked = !rushing; }
          }
          for (const other of world.avatars.values()) {
            if (other === o) continue;
            const op = other === a ? s.pos : other.pos;
            const cx = nx - op.x, cz = nz - op.z, cd = Math.hypot(cx, cz), minR = 0.85;
            if (cd < minR && cd > 1e-4) { nx = op.x + cx / cd * minR; nz = op.z + cz / cd * minR; blocked = !rushing; }
          }
          if (dist < (rushing ? 0.65 : 0.45) || (!rushing && (o.ai.timer <= 0 || blocked))) {
            if (blocked) { o.pos.x = nx; o.pos.z = nz; o.pos.y = hf.at(nx, nz); }
            if (!rushing && Math.random() < 0.75) {
              o.ai.state = 'action'; o.ai.timer = 4.5 + Math.random() * 3.5; o.action.reset().play();
            } else {
              o.ai.state = 'idle'; o.ai.last = 'walk'; o.ai.timer = 1.8 + Math.random() * 2;
            }
          } else {
            o.pos.x = nx; o.pos.z = nz; o.pos.y = hf.at(nx, nz);
            o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(dx, dz), dt * (rushing ? 11 : 8));
          }
        }
        const targetWalk = o.ai.state === 'walk' ? 1 : 0;
        const targetAct = o.ai.state === 'action' ? 1 : 0;
        o.walkW += (targetWalk - o.walkW) * Math.min(1, dt * 8);
        o.actW += (targetAct - o.actW) * Math.min(1, dt * 8);
        if (!targetAct && o.actW < 0.02) { o.action.stop(); o.actW = 0; }
        o.walk.setEffectiveWeight(o.walkW * (1 - o.actW));
        o.idle.setEffectiveWeight((1 - o.walkW) * (1 - o.actW));
        o.action.setEffectiveWeight(o.actW);
        o.walk.timeScale = (rushing ? WALK : WALK * 0.68) / STRIDE;
      }
      poseAvatar(o, dt);
    }
  }
  function poseAvatar(o, dt) {
    const showProps = o.ai.state === 'action';
    for (const p of o.props) p.visible = showProps;
    o.body.position.copy(o.pos); o.body.rotation.y = o.bodyYaw;
    o.mixer.update(reduce ? 0 : dt);
  }

  // ---- Multiplayer (docs/multiplayer.md, item 6) ------------------------------------------------------------
  // Each screen moves its own astronaut; the host also moves the AI ones. Everyone sends the astronauts it moves
  // as poses (~10 Hz) and draws the others from theirs.
  const net = () => window.ASTRO_NET, mp = () => !!net() && net().mode !== 'solo';
  const POSE_MS = 100, POSE_IDLE_MS = 1000, SNAP_M = 5, FOLLOW_RATE = 10; // game-balance
  // 'me', 'ai' (solo, or the host for crew no player moves) or 'player' (drawn from the poses of another screen).
  function driverOf(id) {
    if (world?.avatar?.id === id) return 'me';
    if (!mp()) return 'ai';
    if (net().isGuest) return 'player';
    const peer = sim()?.surf.control?.[id];
    return peer && peer !== net().you.id ? 'player' : 'ai';
  }
  function takePose(data) {
    for (const [id, p] of Object.entries(data?.av || {})) {
      const o = world?.avatars.get(id);
      if (o && driverOf(id) === 'player' && [p.x, p.y, p.z, p.yaw].every(Number.isFinite)) o.net = p;
    }
  }
  window.ASTRO_NET?.on('pose', data => { if (s.ready) takePose(data); });
  // Glide toward the last pose; a jump of more than SNAP_M (a teleport) lands at once.
  function followRemote(o, dt) {
    if (!o.wasRemote) { o.wasRemote = true; o.net = null; } // just handed to another screen: wait for its poses
    const t = o.net;
    if (t) {
      const far = Math.hypot(t.x - o.pos.x, t.z - o.pos.z) > SNAP_M, f = far ? 1 : 1 - Math.exp(-dt * FOLLOW_RATE);
      o.pos.x += (t.x - o.pos.x) * f; o.pos.y += (t.y - o.pos.y) * f; o.pos.z += (t.z - o.pos.z) * f;
      o.bodyYaw = far ? t.yaw : stepYaw(o.bodyYaw, t.yaw, dt * 10);
      const anim = ['idle', 'walk', 'wave', 'action'].includes(t.anim) ? t.anim : 'idle';
      if (anim !== o.ai.state) {
        if (anim === 'wave') { o.action.stop(); o.wave.reset().play(); } else o.wave.stop();
        if (anim === 'action') o.action.reset().play();
        o.ai.state = anim;
      }
    }
    const waveW = o.ai.state === 'wave' ? 1 : 0, rest = 1 - waveW;
    o.walkW += ((o.ai.state === 'walk' ? 1 : 0) - o.walkW) * Math.min(1, dt * 8);
    o.actW += ((o.ai.state === 'action' ? 1 : 0) - o.actW) * Math.min(1, dt * 8);
    if (o.ai.state !== 'action' && o.actW < .02) { o.action.stop(); o.actW = 0; }
    o.walk.setEffectiveWeight(o.walkW * (1 - o.actW) * rest); o.idle.setEffectiveWeight((1 - o.walkW) * (1 - o.actW) * rest);
    o.action.setEffectiveWeight(o.actW * rest); o.wave.setEffectiveWeight(waveW);
    o.walk.timeScale = clamp((t?.spd || STRIDE) / STRIDE, .6, 2.6);
  }
  const r2 = v => Math.round(v * 100) / 100;
  let poseClock = 0, poseText = '', poseSentAt = 0;
  function sendPoses(now) {
    const a = world.avatar, av = {}, kind = s.emote?.kind;
    av[a.id] = { x: r2(s.pos.x), y: r2(s.pos.y), z: r2(s.pos.z), yaw: r2(s.bodyYaw),
      anim: kind === 'wave' || kind === 'action' ? kind : kind === 'walk' || s.speed > 0 ? 'walk' : 'idle', spd: r2(kind === 'walk' ? STRIDE : s.speed) };
    if (net().isHost) for (const o of world.avatars.values()) {
      if (o !== a && driverOf(o.id) === 'ai') av[o.id] = { x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z), yaw: r2(o.bodyYaw), anim: o.ai.state, spd: o.ai.state === 'walk' ? r2(WALK * .68) : 0 };
    }
    const text = JSON.stringify(av);
    if (text === poseText && now - poseSentAt < POSE_IDLE_MS) return;
    poseText = text; poseSentAt = now;
    net().pose({ av });
  }
  function placeCamera() {
    const { camera, avatar: a } = world;
    fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    if (s.mode === 'first') {
      a.body.updateMatrixWorld(true);
      if (reduce) eye.set(s.pos.x, s.pos.y + a.eyeY, s.pos.z); else a.head.getWorldPosition(eye);
      // Eyes in front of the suit; further forward when looking down, so the chest, legs and feet come into view.
      camera.position.copy(eye).addScaledVector(fwd, .3 + .22 * Math.max(0, -Math.sin(s.pitch))); camera.position.y += .14;
      camera.rotation.set(s.pitch, s.yaw, 0);
    } else {
      look.copy(s.pos); look.y += 1.45;
      const cp = Math.cos(s.pitch);
      camera.position.copy(look).add(tmp.set(Math.sin(s.yaw) * cp, -Math.sin(s.pitch), Math.cos(s.yaw) * cp).multiplyScalar(4.4));
      camera.position.y = Math.max(camera.position.y, world.hf.at(camera.position.x, camera.position.z) + .4);
      camera.lookAt(look);
    }
  }
  function updateHud() {
    for (const b of world.blocks) {
      const e = b.userData.exp, li = document.querySelector(`[data-goal="${e.id}"]`), dx = b.position.x - s.pos.x, dz = b.position.z - s.pos.z, dist = Math.hypot(dx, dz);
      li.classList.toggle('done', isDone(e.id)); li.classList.toggle('here', dist <= REACH);
      if (isDone(e.id) && !b.userData.done) markDone(b); // also when another player finished it
      li.querySelector('.goal-dist').textContent = isDone(e.id) ? t('surface.done') : U.distanceM(dist, 0);
      li.querySelector('.goal-arrow').style.rotate = `${Math.atan2(dx, -dz) + s.yaw}rad`; // bearing from north, relative to the view
    }
    const surf = sim()?.surf;
    $s('surface-count').textContent = t('surface.countDone', { done: surf?.completed.size ?? 0, total: tasks().length });
    const b = nearBlock(), e = b?.userData.exp, owner = e && ui.crew.find(c => c.id === e.crew);
    const state = e ? (isDone(e.id) ? 'done' : e.crew === s.crew ? 'run' : 'locked') : nearLander() ? 'board' : '';
    const key = state + (e?.id ?? '') + s.crew;
    if (key === s.prompt) return;
    s.prompt = key; promptEl.hidden = !state; promptEl.disabled = state === 'locked' || state === 'done';
    if (!state) return;
    promptEl.className = 'surface-prompt' + (state === 'run' || state === 'board' ? '' : ' ' + state);
    const keyLabel = t(touch ? 'surface.tapAction' : 'surface.keyAction');
    promptEl.textContent = state === 'board' ? t('surface.promptBoard', { key: keyLabel, done: surf?.completed.size ?? 0, total: tasks().length })
      : state === 'done' ? t('surface.promptDone', { id: e.id, title: e.title })
      : state === 'run' ? t('surface.promptRun', { key: keyLabel, id: e.id, title: e.title })
      : t('surface.promptLocked', { id: e.id, name: owner.name });
  }
  const v = new THREE.Vector3();
  function placeTags(now) {
    const { camera } = world;
    for (const b of world.blocks) {
      const { tag, gem, beam, exp } = b.userData, dist = Math.hypot(b.position.x - s.pos.x, b.position.z - s.pos.z);
      if (!reduce) { gem.rotation.y = now / 700; gem.position.y = 2.2 + Math.sin(now / 500 + b.position.x) * .12; beam.material.opacity = .22 + .1 * Math.sin(now / 400); }
      v.copy(b.position); v.y += 2.8; v.project(camera);
      const show = v.z < 1 && dist < 260;
      tag.hidden = !show;
      if (!show) continue;
      tag.textContent = isDone(exp.id) ? `${exp.id} ✓` : `${exp.id} · ${U.distanceM(dist, 0)}`;
      tag.style.transform = `translate(${(v.x + 1) / 2 * world.width}px, ${(1 - v.y) / 2 * world.height}px)`;
    }
  }
  window.addEventListener('astro:settings', () => {
    const banner = $s('minigame-complete-banner');
    if (banner) banner.textContent = t('minigames.completeBanner');
    if (!world || !s.ready) return;
    $s('surface-goals').innerHTML = tasks().map(e => { const o = ui.crew.find(c => c.id === e.crew);
      return `<li data-goal="${e.id}" style="--crew:${o.color}"><span class="goal-chip"></span><span class="goal-name"><strong>${e.id} · ${e.title}</strong><small>${o.name}</small></span><span class="goal-dist"></span><span class="goal-arrow"></span></li>`; }).join('');
    buildCompass();
    renderCrewBar();
    s.prompt = '';
    updateHud();
  });

  // Two-stage rocket departure cutscene:
  // Stage 1 (0..2.1s): ground camera watching the lander ignite and lift off into the Martian sky.
  // Stage 2 (2.1..5.2s): camera attached to the rising rocket hull looking down at any crew members left behind waving both arms.
  function playDeparture(strandedIds = []) {
    return new Promise(resolve => {
      if (!world || !s.ready || !world.hf) { resolve(); return; }
      if (document.pointerLockElement === world.renderer.domElement) document.exitPointerLock();
      if (dlg.open) dlg.close();
      closeWheel(false);
      endEmote();
      const strandedSet = new Set(strandedIds);
      let idx = 0;
      for (const [id, a] of world.avatars) {
        for (const m of a.helmet) m.material = m.userData.mat;
        for (const p of a.props) p.visible = false;
        a.action.stop(); a.wave.stop();
        a.walk.setEffectiveWeight(0); a.idle.setEffectiveWeight(1);
        if (!strandedSet.has(id)) {
          a.body.visible = false;
          continue;
        }
        a.body.visible = true;
        if (a === world.avatar) a.pos.copy(s.pos);
        // Bring far-off stranded astronauts near the pad perimeter (8..11 m) as if they ran up just too late, so the rocket camera frames them clearly.
        const d = Math.hypot(a.pos.x, a.pos.z);
        if (d > 12 || d < 4.5) {
          const baseAng = d > 0.5 ? Math.atan2(a.pos.x, a.pos.z) : (idx - 0.5) * 0.55;
          const targetR = 7.8 + idx * 1.4;
          a.pos.x = Math.sin(baseAng) * targetR;
          a.pos.z = Math.cos(baseAng) * targetR;
        }
        a.pos.y = world.hf.at(a.pos.x, a.pos.z);
        a.bodyYaw = Math.atan2(-a.pos.x, -a.pos.z);
        a.body.position.copy(a.pos);
        a.body.rotation.set(0, a.bodyYaw, 0);
        idx++;
      }
      const groundY = world.hf.at(0, 0);
      s.departing = { t: 0, duration: 5.2, switchAt: 2.1, groundY, stranded: [...strandedSet], resolve };
    });
  }

  let last = performance.now(), hudClock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    // Leaving the surface (timer, results) must give the mouse back.
    if (world && document.pointerLockElement === world.renderer.domElement && !isActive('surface')) document.exitPointerLock();
    if (!world || !s.ready || !world.avatar || !isActive('surface') || !world.width) return;
    if (s.departing) {
      const d = s.departing;
      d.t += dt;
      const climb = Math.max(0, d.t - 0.25);
      const rocketY = d.groundY + climb * climb * 2.5;
      world.lander.position.set((Math.random() - .5) * .03, rocketY, (Math.random() - .5) * .03);
      const plume = world.lander.userData.plume, engineLight = world.lander.userData.engineLight;
      if (plume) {
        plume.visible = true;
        const flicker = .88 + Math.sin(now * .06) * .18;
        plume.scale.set(flicker, .85 + Math.cos(now * .08) * .25, flicker);
      }
      if (engineLight) engineLight.intensity = 22 + Math.sin(now * .05) * 6;
      let fx = 0, fy = d.groundY, fz = 7.5;
      if (d.stranded.length) {
        let sx = 0, sy = 0, sz = 0;
        d.stranded.forEach((id, i) => {
          const a = world.avatars.get(id);
          if (!a) return;
          a.idle.setEffectiveWeight(1); a.walk.setEffectiveWeight(0);
          a.mixer.update(dt);
          // Raise and wave BOTH arms furiously while looking up at the departing rocket.
          const phase = now * 0.016 + i * 1.4, wL = Math.sin(phase) * 0.55, wR = Math.sin(phase + 0.35) * 0.55;
          if (a.upperArmL) a.upperArmL.rotation.set(-2.55, 0, 0.52 + wL);
          if (a.lowerArmL) a.lowerArmL.rotation.set(-0.35, 0, wL * 0.65);
          if (a.upperArmR) a.upperArmR.rotation.set(-2.55, 0, -0.52 - wR);
          if (a.lowerArmR) a.lowerArmR.rotation.set(-0.35, 0, -wR * 0.65);
          if (a.head) a.head.rotation.x = -0.58;
          const hop = reduce ? 0 : Math.max(0, Math.sin(now * 0.012 + i * 1.7)) * 0.22;
          const gy = world.hf.at(a.pos.x, a.pos.z);
          a.bodyYaw = Math.atan2(-a.pos.x, -a.pos.z);
          a.body.position.set(a.pos.x, gy + hop, a.pos.z);
          a.body.rotation.set(0, a.bodyYaw, 0);
          sx += a.pos.x; sy += gy; sz += a.pos.z;
        });
        fx = sx / d.stranded.length; fy = sy / d.stranded.length; fz = sz / d.stranded.length;
      }
      const { camera } = world;
      for (const b of world.blocks) if (b.userData.tag) b.userData.tag.hidden = true;
      promptEl.hidden = false; promptEl.disabled = true;
      promptEl.className = 'surface-prompt locked';
      if (d.t < d.switchAt) {
        // Stage 1: ground camera watching the rocket ignite and climb into the Martian sky.
        camera.fov = 66; camera.updateProjectionMatrix();
        camera.position.set(-10.5, d.groundY + 1.8, 12.5);
        camera.lookAt(0, rocketY + 2.2, 0);
        promptEl.textContent = t('surface.departingStandby');
      } else {
        // Stage 2: camera mounted on the rising rocket hull looking down at the stranded astronauts waving their arms.
        const fDist = Math.hypot(fx, fz) || 1, dirX = fx / fDist, dirZ = fz / fDist;
        const camProg = clamp((d.t - d.switchAt) / (d.duration - d.switchAt), 0, 1);
        camera.fov = 56 - camProg * 18; camera.updateProjectionMatrix();
        camera.position.set(dirX * 2.05, rocketY + 0.55, dirZ * 2.05);
        camera.lookAt(fx * 0.88, fy + 1.05, fz * 0.88);
        const strandedNames = d.stranded.map(id => ui.crew.find(c => c.id === id)?.name ?? id).join(', ');
        promptEl.textContent = d.stranded.length ? t('surface.departingStranded', { names: strandedNames }) : t('surface.departingStandby');
      }
      world.sky.position.copy(camera.position);
      world.sun.target.position.set(0, d.groundY, 0);
      world.sun.position.set(0, d.groundY, 0).addScaledVector(world.sunDir, 90);
      world.renderer.render(world.scene, camera);
      if (d.t >= d.duration) {
        const done = d.resolve;
        s.departing = null;
        if (plume) plume.visible = false;
        if (engineLight) engineLight.intensity = 0;
        camera.fov = 72; camera.updateProjectionMatrix();
        for (const a of world.avatars.values()) a.body.visible = true;
        done();
      }
      return;
    }
    if (!dlg.open) step(dt); else if (mp()) step(dt, false);
    if (mp() && (poseClock += dt * 1000) >= POSE_MS) { poseClock = 0; sendPoses(now); }
    placeCamera();
    world.sky.position.copy(world.camera.position);
    world.sun.target.position.copy(s.pos); world.sun.position.copy(s.pos).addScaledVector(world.sunDir, 90);
    placeTags(now); updateCompass();
    if ((hudClock += dt) > .12) { hudClock = 0; updateHud(); }
    world.renderer.render(world.scene, world.camera);
  }
  requestAnimationFrame(frame);
  // Test and debug hook (Playwright, console): state, and a teleport next to a block.
  window.ASTRO_SURFACE = { state: s, world: () => world, emote: kind => playEmote(kind), wheel: open => (open ? openWheel(false) : closeWheel(false)),
    running: () => !!(s.ready && startEl.hidden && !dlg.open && !s.departing), loaded: () => !!(s.ready && startEl.hidden),
    boardReach: BOARD_REACH, boardSafeReach: BOARD_SAFE_R, playDeparture,
    distanceToLander(id) { const a = world?.avatars.get(id); if (!a) return 0; const p = a === world.avatar ? s.pos : a.pos; return Math.hypot(p.x, p.z); },
    goTo(id) { const b = world?.blocks.find(x => x.userData.exp.id === id); if (b) { s.pos.x = b.position.x + 2.2; s.pos.z = b.position.z + 1.2; s.yaw = Math.atan2(-(b.position.x - s.pos.x), -(b.position.z - s.pos.z)); s.grounded = false; } } };
  // index.html#surface or #surface-gale opens the surface directly (quick testing).
  const direct = /^#surface(?:-(\w+))?$/.exec(location.hash);
  if (direct) { if (ui.sites[direct[1]]) ui.state.site = direct[1]; ui.land(); }
})();

})().catch(error => console.warn('views 3D unavailable:', error));
