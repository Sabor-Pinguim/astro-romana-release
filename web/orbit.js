(async () => {
// 3D solar system: flat-shaded icospheres orbit the Sun on real 3D Keplerian ellipses
// (NASA/JPL SSD Table 1 J2000.0 elements: eccentricity, inclination, ascending node,
// longitude of perihelion, mean longitude at current UTC); radial scale is compressed so all 8 worlds stay clickable.
// Only Mars is open in this prototype, so it gets a faceted aura and a highlighted orbit.
// The HTML buttons follow each planet, so clicks and labels stay accessible. Without WebGL the 2D map stays.
// Behind the planning screens (lobby, planner) the same scene becomes the background: the camera zooms in on
// the chosen planet and follows it along its orbit while the rest of the system keeps moving.
const THREE = await import('three');
const art = window.ASTRO_ART, system = document.querySelector('.orbit-system');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { renderer = null; }
if (art && system && renderer) {
  renderer.domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 120);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.25));
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

  const DEG = Math.PI / 180;
  const wrap180 = deg => {
    const d = ((deg % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
  };
  const solveKepler = (mRad, e) => {
    let E = mRad + e * Math.sin(mRad);
    for (let i = 0; i < 5; i++) {
      const f = E - e * Math.sin(E) - mRad;
      const fp = 1 - e * Math.cos(E);
      E -= f / fp;
    }
    return E;
  };

  // Current UTC Julian Date and Julian centuries since J2000.0.
  const jd0 = Date.now() / 86400000 + 2440587.5;
  const T0 = (jd0 - 2451545.0) / 36525.0;
  const DAYS_PER_SEC = 10; // ~36.5 s per Earth year, preserving Kepler's 2nd & 3rd laws

  // NASA/JPL SSD Table 1 (Standish 1992, J2000.0, 1800–2050 AD) + compressed visual semi-major axis `radius`.
  const PLANET_ELEMENTS = [
    { id: 'mercury', radius: 1.25, size: .11, tilt: .03, seed: 3,
      e0: 0.20563593, eDot: 0.00001906, I0: 7.00497902, IDot: -0.00594749,
      L0: 252.25032350, LDot: 149472.67411175, wBar0: 77.45779628, wBarDot: 0.16047689, O0: 48.33076593, ODot: -0.12534081 },
    { id: 'venus', radius: 1.75, size: .19, tilt: 177.4, seed: 4,
      e0: 0.00677672, eDot: -0.00004107, I0: 3.39467605, IDot: -0.00078890,
      L0: 181.97909950, LDot: 58517.81538729, wBar0: 131.60246718, wBarDot: 0.00268329, O0: 76.67984255, ODot: -0.27769418 },
    { id: 'earth', radius: 2.30, size: .2, tilt: 23.4, seed: 2,
      e0: 0.01671123, eDot: -0.00004392, I0: -0.00001531, IDot: -0.01294668,
      L0: 100.46457166, LDot: 35999.37244981, wBar0: 102.93768193, wBarDot: 0.32327364, O0: 0.0, ODot: 0.0 },
    { id: 'mars', radius: 3.00, size: .17, tilt: 25.2, seed: 8,
      e0: 0.09339410, eDot: 0.00007882, I0: 1.84969142, IDot: -0.00813131,
      L0: -4.55343205, LDot: 19140.30268499, wBar0: -23.94362959, wBarDot: 0.44441088, O0: 49.55953891, ODot: -0.29257343 },
    { id: 'jupiter', radius: 4.70, size: .42, tilt: 3.1, seed: 6,
      e0: 0.04838624, eDot: -0.00013253, I0: 1.30439695, IDot: -0.00183714,
      L0: 34.39644051, LDot: 3034.74612775, wBar0: 14.72847983, wBarDot: 0.21252668, O0: 100.47390909, ODot: 0.20469106 },
    { id: 'saturn', radius: 5.65, size: .34, tilt: 26.7, seed: 9, rings: true,
      e0: 0.05386179, eDot: -0.00050991, I0: 2.48599187, IDot: 0.00193609,
      L0: 49.95424423, LDot: 1222.49362201, wBar0: 92.59887831, wBarDot: -0.41897216, O0: 113.66242448, ODot: -0.28867794 },
    { id: 'uranus', radius: 6.50, size: .26, tilt: 97.8, seed: 10,
      e0: 0.04725744, eDot: -0.00004397, I0: 0.77263783, IDot: -0.00242939,
      L0: 313.23810451, LDot: 428.48202785, wBar0: 170.95427630, wBarDot: 0.40805281, O0: 74.01692503, ODot: 0.04240589 },
    { id: 'neptune', radius: 7.25, size: .25, tilt: 28.3, seed: 11,
      e0: 0.00859048, eDot: 0.00005105, I0: 1.77004347, IDot: 0.00035372,
      L0: -55.12002969, LDot: 218.45945325, wBar0: 44.96476227, wBarDot: -0.32241464, O0: 131.78422574, ODot: -0.00508664 },
  ];

  const worlds = PLANET_ELEMENTS.map(w => {
    const e = w.e0 + w.eDot * T0;
    const incDeg = w.I0 + w.IDot * T0;
    const wBar = w.wBar0 + w.wBarDot * T0;
    const Odeg = w.O0 + w.ODot * T0;
    const omega = (wBar - Odeg) * DEG;
    const inc = incDeg * DEG;
    const node = Odeg * DEG;
    const cO = Math.cos(node), sO = Math.sin(node);
    const cI = Math.cos(inc), sI = Math.sin(inc);
    const cW = Math.cos(omega), sW = Math.sin(omega);

    // Ecliptic (x_ecl, y_ecl, z_ecl) -> Three.js (x_ecl, z_ecl, -y_ecl) for CCW orbits from +Y.
    const P = new THREE.Vector3(
      cO * cW - sO * sW * cI,
      sW * sI,
      -(sO * cW + cO * sW * cI),
    );
    const Q = new THREE.Vector3(
      -cO * sW - sO * cW * cI,
      cW * sI,
      -(-sO * sW + cO * cW * cI),
    );

    const pivot = new THREE.Group(), mesh = faceted(w.size, 2, art.PLANETS[w.id], w.seed);
    pivot.rotation.z = THREE.MathUtils.degToRad(w.tilt);
    pivot.add(mesh); scene.add(pivot);
    if (w.rings) [[1.35, 1.8, 0xb89a62], [1.9, 2.3, 0xe2cf9c]].forEach(([a, b, color]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(w.size * a, w.size * b, 18, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }));
      pivot.add(ring);
    });
    const button = system.querySelector(`[data-world="${w.id}"]`);
    const world = { ...w, e, incDeg, wBar, bFactor: Math.sqrt(1 - e * e), P, Q, pivot, mesh, button, hover: 0 };
    button?.addEventListener('pointerenter', () => { world.hovered = true; });
    button?.addEventListener('pointerleave', () => { world.hovered = false; });
    return world;
  });

  const orbitPos = (w, E, outVec) => {
    const xp = w.radius * (Math.cos(E) - w.e);
    const yp = w.radius * w.bFactor * Math.sin(E);
    return outVec.set(
      w.P.x * xp + w.Q.x * yp,
      w.P.y * xp + w.Q.y * yp,
      w.P.z * xp + w.Q.z * yp,
    );
  };

  const mars = worlds.find(w => w.id === 'mars');
  // Aura: two faceted shells seen from inside, additive, pulsing.
  const aura = new THREE.Group();
  [[1.9, 0xe04f26, .3], [2.7, 0xf59e0b, .12]].forEach(([k, color, opacity]) => aura.add(new THREE.Mesh(new THREE.IcosahedronGeometry(mars.size * k, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }))));
  mars.pivot.add(aura);

  // Orbits: 96-segment 3D Keplerian ellipses; Mars' orbit solid orange.
  const dashed = new THREE.LineDashedMaterial({ color: 0xc9a6ff, transparent: true, opacity: .28, dashSize: .12, gapSize: .09 });
  const marsLine = new THREE.LineBasicMaterial({ color: 0xe04f26, transparent: true, opacity: .75 });
  for (const w of worlds) {
    const pts = Array.from({ length: 96 }, (_, k) => orbitPos(w, (k / 96) * Math.PI * 2, new THREE.Vector3()));
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), w === mars ? marsLine : dashed);
    loop.computeLineDistances(); scene.add(loop);
  }
  // Main asteroid belt between Mars's aphelion (~3.28) and Jupiter's perihelion (~4.47).
  const belt = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.032, 0), new THREE.MeshLambertMaterial({ color: 0x8e7c7c, flatShading: true }), 170);
  { let s = 21; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < belt.count; i++) { const a = rnd() * Math.PI * 2, r = 3.55 + rnd() * .60, k = .6 + rnd(); belt.setMatrixAt(i, m.compose(new THREE.Vector3(r * Math.cos(a), (rnd() - .5) * .14, r * Math.sin(a)), q.setFromEuler(e.set(rnd() * 6, rnd() * 6, 0)), new THREE.Vector3(k, k, k))); } }
  scene.add(belt);
  // Hohmann-style transfer: starts at Earth's real 3D position and arcs 180° to Mars's orbit.
  const transferBuf = new Float32Array(25 * 3);
  const transferGeo = new THREE.BufferGeometry();
  transferGeo.setAttribute('position', new THREE.BufferAttribute(transferBuf, 3));
  const transfer = new THREE.Line(transferGeo, new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: .14, gapSize: .1 }));
  scene.add(transfer);
  const earthWorld = worlds.find(w => w.id === 'earth');
  const tmpTarget = new THREE.Vector3();

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
  let width = 0, height = 0, time = 0, simDays = 0, speed = 1, last = performance.now();
  function resize() {
    const host = renderer.domElement.parentElement || system;
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The map framing fits the whole system in the orbit screen's box, whatever box the canvas is in now.
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2), tilt = THREE.MathUtils.degToRad(30);
    const mapAspect = (system.clientWidth || width) / (system.clientHeight || height);
    const hHalf = Math.atan(Math.tan(vHalf) * mapAspect), d = Math.max(7.8 / Math.tan(hHalf), 5.1 / Math.tan(vHalf));
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
    if (!reduce) { time += dt * speed; simDays += dt * speed * DAYS_PER_SEC; }
    const T = T0 + simDays / 36525.0;
    sun.rotation.y = time * .15;
    belt.rotation.y = -simDays * Math.PI * 2 / (4.6 * 365.25);
    aura.rotation.y = time * .4;
    aura.scale.setScalar(1 + Math.sin(time * 2.4) * .1);
    for (const w of worlds) {
      const mRad = wrap180((w.L0 + w.LDot * T) - w.wBar) * DEG;
      const E = solveKepler(mRad, w.e);
      orbitPos(w, E, w.pivot.position);
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
    const ePos = earthWorld.pivot.position;
    const eLon = Math.atan2(-ePos.z, ePos.x);
    const mArrivalE = solveKepler(eLon + Math.PI - mars.wBar * DEG, mars.e);
    orbitPos(mars, mArrivalE, tmpTarget);
    const rStart = Math.hypot(ePos.x, ePos.z), rEnd = Math.hypot(tmpTarget.x, tmpTarget.z);
    for (let i = 0; i < 25; i++) {
      const u = i / 24;
      const ang = eLon + u * Math.PI;
      const r = rStart + (rEnd - rStart) * (0.5 - 0.5 * Math.cos(u * Math.PI));
      transferBuf[i * 3] = r * Math.cos(ang);
      transferBuf[i * 3 + 1] = ePos.y * (1 - u) + tmpTarget.y * u;
      transferBuf[i * 3 + 2] = -r * Math.sin(ang);
    }
    transferGeo.attributes.position.needsUpdate = true;
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

  window.ASTRO_ORBIT = {
    jd0,
    getSimDays: () => simDays,
    snapshot: () => worlds.map(w => ({ id: w.id, e: w.e, incDeg: w.incDeg, pos: w.pivot.position.toArray() })),
  };

  resize();
  requestAnimationFrame(frame);
}

})().catch(error => console.warn('orbit 3D unavailable:', error));
