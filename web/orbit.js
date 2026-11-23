(async () => {
// 3D solar system: flat-shaded icospheres orbit the Sun. Orbital periods (sidereal, years) and axial
// tilts (degrees) are real, from the NASA NSSDC Planetary Fact Sheet; distances and sizes are stylized.
// Only Mars is open in this prototype, so it gets a faceted aura and a highlighted orbit.
// The HTML buttons follow each planet, so clicks and labels stay accessible. Without WebGL the 2D map stays.
// Behind the planning screens (lobby, planner) the same scene becomes the background: the camera zooms in on
// the chosen planet and follows it along its orbit while the rest of the system keeps moving.
const THREE = await import('three');
const art = window.ASTRO_ART, system = document.querySelector('.orbit-system');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { renderer = null; }
if (art && system && renderer) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 120);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  system.prepend(renderer.domElement);
  system.classList.add('is-3d');
  scene.add(new THREE.AmbientLight(0xb48cf0, 1.1));
  scene.add(new THREE.PointLight(0xfce8a6, 5, 0, 0));

  // One flat colour per face, from the same ramps as the 2D art (indices 2–4 = lit tones).
  function faceted(radius, detail, { ramp, regions = [] }, seed, basic = false) {
    const geo = new THREE.IcosahedronGeometry(radius, detail), pos = geo.attributes.position, colors = [];
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const c = new THREE.Color(), v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      v.set(0, 0, 0); for (let k = 0; k < 3; k++) v.add(w.fromBufferAttribute(pos, i + k));
      v.normalize();
      const region = regions.find(r => r.test(v.x, -v.y)), r = region ? region.ramp : ramp;
      c.set(r[2 + Math.floor(rnd() * 3)]);
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = basic ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    return new THREE.Mesh(geo, mat);
  }
  const sun = faceted(.55, 1, { ramp: art.RAMPS.sun }, 7, true);
  scene.add(sun);

  const YEAR = 36; // seconds per Earth year on screen
  const worlds = [
    { id: 'mercury', radius: 1.2, size: .11, period: .2408, tilt: .03, angle: 120, seed: 3 },
    { id: 'venus', radius: 1.7, size: .19, period: .6152, tilt: 177.4, angle: 300, seed: 4 },
    { id: 'earth', radius: 2.3, size: .2, period: 1, tilt: 23.4, angle: 200, seed: 2 },
    { id: 'mars', radius: 2.95, size: .17, period: 1.8808, tilt: 25.2, angle: 20, seed: 8 },
    { id: 'jupiter', radius: 4.65, size: .42, period: 11.862, tilt: 3.1, angle: -50, seed: 6 },
    { id: 'saturn', radius: 5.6, size: .34, period: 29.457, tilt: 26.7, angle: 140, seed: 9, rings: true },
    { id: 'uranus', radius: 6.45, size: .26, period: 84.011, tilt: 97.8, angle: 250, seed: 10 },
    { id: 'neptune', radius: 7.2, size: .25, period: 164.79, tilt: 28.3, angle: 70, seed: 11 }
  ].map(w => {
    const pivot = new THREE.Group(), mesh = faceted(w.size, 2, art.PLANETS[w.id], w.seed);
    pivot.rotation.z = THREE.MathUtils.degToRad(w.tilt);
    pivot.add(mesh); scene.add(pivot);
    if (w.rings) [[1.35, 1.8, 0xb89a62], [1.9, 2.3, 0xe2cf9c]].forEach(([a, b, color]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(w.size * a, w.size * b, 18, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }));
      pivot.add(ring);
    });
    const button = system.querySelector(`[data-world="${w.id}"]`);
    const world = { ...w, pivot, mesh, button, hover: 0 };
    button?.addEventListener('pointerenter', () => { world.hovered = true; });
    button?.addEventListener('pointerleave', () => { world.hovered = false; });
    return world;
  });
  const mars = worlds.find(w => w.id === 'mars');
  // Aura: two faceted shells seen from inside, additive, pulsing.
  const aura = new THREE.Group();
  [[1.9, 0xe04f26, .3], [2.7, 0xf59e0b, .12]].forEach(([k, color, opacity]) => aura.add(new THREE.Mesh(new THREE.IcosahedronGeometry(mars.size * k, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }))));
  mars.pivot.add(aura);

  // Orbits: dashed 48-gons; Mars' orbit solid orange.
  const dashed = new THREE.LineDashedMaterial({ color: 0xc9a6ff, transparent: true, opacity: .28, dashSize: .12, gapSize: .09 });
  const marsLine = new THREE.LineBasicMaterial({ color: 0xe04f26, transparent: true, opacity: .75 });
  for (const w of worlds) {
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, k) => new THREE.Vector3(w.radius * Math.cos(k / 48 * Math.PI * 2), 0, -w.radius * Math.sin(k / 48 * Math.PI * 2)))), w === mars ? marsLine : dashed);
    loop.computeLineDistances(); scene.add(loop);
  }
  // Main asteroid belt between Mars and Jupiter (Ceres takes ~4.6 years per orbit).
  const belt = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.032, 0), new THREE.MeshLambertMaterial({ color: 0x8e7c7c, flatShading: true }), 170);
  { let s = 21; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < belt.count; i++) { const a = rnd() * Math.PI * 2, r = 3.45 + rnd() * .75, k = .6 + rnd(); belt.setMatrixAt(i, m.compose(new THREE.Vector3(r * Math.cos(a), (rnd() - .5) * .14, r * Math.sin(a)), q.setFromEuler(e.set(rnd() * 6, rnd() * 6, 0)), new THREE.Vector3(k, k, k))); } }
  scene.add(belt);
  // Hohmann-style transfer: always starts at Earth and ends half an orbit later on Mars' orbit.
  const transfer = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: .14, gapSize: .1 }));
  scene.add(transfer);
  const r1 = 2.3, r2 = 2.95, ecc = (r2 - r1) / (r2 + r1), p = (r1 + r2) / 2 * (1 - ecc * ecc);

  // Faint stars, only seen in the close-up (the orbit screen has its own background).
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1200 }, (_, i) => {
    const a = (i * 2.399963) % (Math.PI * 2), z = 1 - 2 * ((i * 0.618034) % 1), r = 60, k = Math.sqrt(1 - z * z); return [r * k * Math.cos(a), r * z, r * k * Math.sin(a)];
  }).flat(), 3)), new THREE.PointsMaterial({ color: 0xfce8a6, size: .12, transparent: true, opacity: 0 }));
  scene.add(stars);
  const bg = document.createElement('div');
  bg.className = 'space-bg'; bg.setAttribute('aria-hidden', 'true'); document.body.prepend(bg);
  const isOn = id => document.getElementById(id)?.classList.contains('active');
  const destStep = document.getElementById('lobby-step-destination');
  let focusId = 'mars', focus = 0, zoomTarget = false;
  window.addEventListener('astro:world', e => { focusId = e.detail; });
  // Smooth zoom-into-Mars transition when advancing from Step 03 (Destination) → Step 04 (Landing site).
  window.ASTRO_ZOOM_TO_PLANET = () => new Promise(resolve => {
    if (reduce || !destStep || destStep.hidden) return resolve();
    zoomTarget = true;
    destStep.classList.add('zooming');
    setTimeout(() => {
      zoomTarget = false;
      destStep.classList.remove('zooming');
      resolve();
    }, 420);
  });
  const mapPos = new THREE.Vector3(), mapLook = new THREE.Vector3(0, -.4, 0), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const out = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3();
  const marker = system.querySelector('.orbit-marker'), v = new THREE.Vector3(), edge = new THREE.Vector3();
  let width = 0, height = 0, time = 0, speed = 1, last = performance.now();
  function resize() {
    const host = renderer.domElement.parentElement || system;
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The map framing fits the whole system in the orbit screen's box, whatever box the canvas is in now.
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2), tilt = THREE.MathUtils.degToRad(30);
    const mapAspect = (system.clientWidth || width) / (system.clientHeight || height);
    const hHalf = Math.atan(Math.tan(vHalf) * mapAspect), d = Math.max(7.7 / Math.tan(hHalf), 4.9 / Math.tan(vHalf));
    mapPos.set(0, d * Math.sin(tilt), d * Math.cos(tilt));
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(system); ro.observe(bg);
  // Close-up: sunward of the planet and 60° around it (lit side with a terminator), a bit above,
  // aimed left of the planet so it sits on the right of the screen, away from the panels.
  function closeUp(w) {
    const d = w.size * 5.5;
    out.copy(w.pivot.position).normalize(); side.crossVectors(up, out).normalize();
    camPos.copy(w.pivot.position).addScaledVector(out, -d * .5).addScaledVector(side, d * .87).addScaledVector(up, d * .32);
    right.subVectors(w.pivot.position, camPos).normalize().cross(up).normalize();
    camLook.copy(w.pivot.position).addScaledVector(right, -d * .2);
  }
  const look = new THREE.Vector3();
  const toScreen = vec => { vec.project(camera); return [(vec.x + 1) / 2 * width, (1 - vec.y) / 2 * height]; };

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const map = isOn('lobby') && !!destStep && !destStep.hidden;
    const planning = (isOn('lobby') && !map) || isOn('planner');
    bg.classList.toggle('on', planning); document.body.classList.toggle('space-focus', planning);
    if (!map && !planning) return;
    const host = map ? system : bg;
    if (renderer.domElement.parentElement !== host) { host.prepend(renderer.domElement); resize(); }
    if (!width) return;
    const targetFocus = planning || zoomTarget ? 1 : 0;
    focus += (targetFocus - focus) * Math.min(1, dt * (zoomTarget ? 6.5 : 1.4));
    if (window.ASTRO_FOCUS_NOW) focus = planning ? 1 : 0; // tests: skip the zoom animation
    // Slow down while a planet is hovered, so it is easy to click.
    speed += ((map && worlds.some(w => w.hovered) ? .12 : 1) - speed) * .1;
    if (!reduce) time += dt * speed;
    sun.rotation.y = time * .15;
    belt.rotation.y = -time * Math.PI * 2 / (4.6 * YEAR);
    aura.rotation.y = time * .4;
    aura.scale.setScalar(1 + Math.sin(time * 2.4) * .1);
    for (const w of worlds) {
      const a = THREE.MathUtils.degToRad(w.angle) + time * Math.PI * 2 / (w.period * YEAR);
      w.theta = a;
      w.pivot.position.set(w.radius * Math.cos(a), 0, -w.radius * Math.sin(a));
      w.mesh.rotation.y = time * .9 / Math.sqrt(w.size);
      w.hover += ((w.hovered ? 1 : 0) - w.hover) * .2;
      w.pivot.scale.setScalar(1 + w.hover * .2);
      if (!w.button || !map) continue;
      // Keep the button centred on the planet and as big as its projection.
      const [x, y] = toScreen(v.copy(w.pivot.position));
      edge.copy(camera.up).cross(v.copy(camera.position).sub(w.pivot.position)).normalize().multiplyScalar(w.size).add(w.pivot.position);
      const [ex, ey] = toScreen(edge), size = Math.max(22, 2 * Math.hypot(ex - x, ey - y));
      Object.assign(w.button.style, { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px' });
      if (w.id === 'earth' && marker) Object.assign(marker.style, { left: x + 'px', top: (y - size / 2 - 8) + 'px' });
    }
    const earth = worlds.find(w => w.id === 'earth').theta;
    transfer.geometry.setFromPoints(Array.from({ length: 25 }, (_, k) => {
      const t = k / 24 * Math.PI, r = p / (1 + ecc * Math.cos(t));
      return new THREE.Vector3(r * Math.cos(earth + t), 0, -r * Math.sin(earth + t));
    }));
    transfer.computeLineDistances();
    // Camera: the map framing blends into the close-up of the chosen planet (eased).
    const k = focus * focus * (3 - 2 * focus), w = worlds.find(x => x.id === focusId) || mars;
    closeUp(w);
    camera.position.lerpVectors(mapPos, camPos, k);
    camera.lookAt(look.lerpVectors(mapLook, camLook, k));
    stars.material.opacity = .7 * k;
    aura.children.forEach((m, i) => { m.material.opacity = (i ? .12 : .3) * (1 - .6 * k); });
    renderer.render(scene, camera);
  }
  resize();
  requestAnimationFrame(frame);
}

})().catch(error => console.warn('orbit 3D unavailable:', error));
