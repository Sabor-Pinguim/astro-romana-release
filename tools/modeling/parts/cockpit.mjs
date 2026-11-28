import * as THREE from 'three';
import { createPartBuilder } from '../lib/part-builder.mjs';
import { ball, box, cyl, ring, shell } from '../lib/shapes.mjs';
import { RIG } from '../lib/avatar.mjs';

/**
 * Crew cabin of the cockpit phase (`cockpit-pilot`), laid out after NASA's Orion crew module: four reclined seats,
 * two over two. The commander (seat 1, Helena) and the pilot (seat 2, Lucas) sit on the upper row facing the
 * display and control panel: 3 display units, 7 switch interface panels (about 60 switches), hand controllers and
 * cursor control devices. The two mission specialists (seats 3 and 4, Oscar and Maya) sit on the lower row; Orion
 * gives them no panel, so each gets a display on the back of the seat above, where their line of sight lands
 * (game choice).
 * Counts, layout and sources: references/parts/cockpit/cockpit-pilot/README.md and references/parts/crew-cabins.md.
 *
 * Game choices (say so in the README): the crew lie back 58° from vertical instead of flat on their backs, so the
 * panel stays in view; the hand controllers, throttle, guarded switches and abort handle sit on a pedestal between
 * the upper seats (Orion has the hand controllers on the armrests); the lower-seat displays; the screen graphics.
 *
 * Conventions: metres, +Y up, the crew face -Z (the panel hangs ahead and above them); origin on the cabin floor
 * centre. One camera per seat (Camera_Seat_1..4, Camera_Pilot = seat 1) and the panel frame (Panel_Frame) and
 * lower displays (Screen_Seat_3/4) as anchors: web/flight.js places its screens and cameras on them by name.
 * Seat_1..4 sit at the Hips pivot of the seated avatar (shared rig, lib/avatar.mjs) and carry its seated pose in
 * extras, so the crew in web/flight.js and the camera eyes here come from the same numbers.
 */

const DEG = Math.PI / 180;

/**
 * A flat surface (yaw about Y, then tilt about its own X). `at(u, v, w)` gives a point on it (u right, v up the
 * surface, w out of it); `rot(local)` gives the Euler XYZ angles, in degrees, for a part lying on it.
 */
function surface(origin, yawDeg, tiltDeg) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltDeg * DEG, yawDeg * DEG, 0, 'YXZ'));
  const o = new THREE.Vector3(...origin);
  const rot = (local = [0, 0, 0]) => {
    const ql = new THREE.Quaternion().setFromEuler(new THREE.Euler(local[0] * DEG, local[1] * DEG, local[2] * DEG));
    const e = new THREE.Euler().setFromQuaternion(q.clone().multiply(ql), 'XYZ');
    return [e.x / DEG, e.y / DEG, e.z / DEG];
  };
  return { at: (u, v, w = 0) => new THREE.Vector3(u, v, w).applyQuaternion(q).add(o).toArray(), rot, r: rot() };
}

// Seats: hip point, recline from vertical (game: Orion crew lie flat at launch). A seat frame has v up the back and
// w toward the occupant's front (surface yawed 180°, tilted back), so seat parts are laid out from the hip.
const RECLINE = 58;
const SEATS = [
  { n: 1, crew: 'helena', role: 'commander', hip: [-0.42, 0.98, 0.2], upper: true },
  { n: 2, crew: 'lucas', role: 'pilot', hip: [0.42, 0.98, 0.2], upper: true },
  { n: 3, crew: 'oscar', role: 'mission specialist', hip: [-0.42, 0.22, 0.62], upper: false },
  { n: 4, crew: 'maya', role: 'mission specialist', hip: [0.42, 0.22, 0.62], upper: false },
].map(s => ({ ...s, frame: surface(s.hip, 180, -RECLINE) }));
// Seated avatar (game): its Hips pivot in the seat frame (the suit rests on the cushions), and the pose in degrees
// relative to the rig rest (thighs along the seat pan, shins down to the foot pan, hands on the lap, head nodding
// toward the panel). The PLSS backpack is left out in web/flight.js: Orion crew fly in launch suits.
const SIT = [0, 0.14, 0.215];
const HEAD_PITCH = 25;
const POSE = {
  Head: [HEAD_PITCH, 0, 0],
  UpperLeg_L: [-90, 0, 0], UpperLeg_R: [-90, 0, 0],
  LowerLeg_L: [90, 0, 0], LowerLeg_R: [90, 0, 0],
  UpperArm_L: [-10, 0, 12], UpperArm_R: [-10, 0, -12],
  LowerArm_L: [-60, 0, 0], LowerArm_R: [-60, 0, 0],
};
// Eyes inside the helmet (Head space), carried up the rig to the seat frame.
const EYE_IN_HELMET = [0, 0.17, 0.06];
const rigPos = name => RIG.find(j => j.name === name).pos;
const EYE = s => {
  const up = rigPos('Torso')[1] + rigPos('Head')[1], c = Math.cos(HEAD_PITCH * DEG), sn = Math.sin(HEAD_PITCH * DEG);
  const [, ey, ez] = EYE_IN_HELMET;
  return s.frame.at(SIT[0], SIT[1] + up + ey * c - ez * sn, SIT[2] + ey * sn + ez * c);
};
// Back cushion of a seat (seat frame): its rear face carries the display of the seat below.
const BACK = { v: 0.36, w: -0.05, h: 0.74, d: 0.07, width: 0.62 }; // as wide as the suit's shoulders

// Main panel hanging ahead of the upper seats, turned down toward the crew (tilt 30°), with side wings.
const PANEL = surface([0, 1.85, -0.08], 0, 30);
const WING_L = surface([-0.86, 1.72, 0.12], 50, 30);
const WING_R = surface([0.86, 1.72, 0.12], -50, 30);
const BULKHEAD = surface([0, 1.98, -0.45], 0, 55); // the cone over the panel, with two windows
const DU_U = [-0.5, 0, 0.5]; // display units: DU1 (commander), DU2 (shared), DU3 (pilot)
// Lower-seat displays (game): on struts from the back of the seat above, on the mission specialist's gaze
// (LOWER_LOOK below the seat's forward axis, about level), facing the eyes and as far out as the case allows
// (LOWER_CLEAR off the cushion). `mount` gives the struts: the case back, and their length along the seat's normal.
const LOWER_LOOK = 55, LOWER_CLEAR = 0.03, LOWER_CASE = { w: 0.34, h: 0.25, d: 0.03 };
const LOWER_DISPLAY = s => {
  const above = SEATS.find(o => o.upper && o.hip[0] === s.hip[0]);
  const vec = (f, u, v, w) => new THREE.Vector3(...f.at(u, v, w)).sub(new THREE.Vector3(...f.at(0, 0, 0)));
  const eye = new THREE.Vector3(...EYE(s));
  const gaze = vec(s.frame, 0, -Math.sin(LOWER_LOOK * DEG), Math.cos(LOWER_LOOK * DEG));
  const n = vec(above.frame, 0, 0, 1); // front of the seat above; its back's rear face looks along -n
  const rear = new THREE.Vector3(...above.frame.at(0, BACK.v, BACK.w - BACK.d / 2));
  const yaw = Math.atan2(-gaze.x, -gaze.z) / DEG, tilt = Math.asin(gaze.y) / DEG; // facing back along the gaze
  const probe = surface([0, 0, 0], yaw, tilt);
  // Distance along the gaze where every corner of the case (front and back) keeps LOWER_CLEAR off the seat back.
  let dist = Infinity;
  for (const u of [-1, 1]) for (const v of [-1, 1]) for (const w of [0.005, -LOWER_CASE.d]) {
    const off = new THREE.Vector3(...probe.at(u * LOWER_CASE.w / 2, v * LOWER_CASE.h / 2, w));
    dist = Math.min(dist, (-LOWER_CLEAR - eye.clone().sub(rear).dot(n) - off.dot(n)) / gaze.dot(n));
  }
  const c = eye.clone().addScaledVector(gaze, dist);
  const back = c.clone().add(new THREE.Vector3(...probe.at(0, 0, -LOWER_CASE.d)));
  const len = -back.clone().sub(rear).dot(n);
  const local = p => { const o = new THREE.Vector3(...above.frame.at(0, 0, 0)), q = p.clone().sub(o); return [q.dot(vec(above.frame, 1, 0, 0)), q.dot(vec(above.frame, 0, 1, 0)), q.dot(n)]; };
  return { ...surface(c.toArray(), yaw, tilt), dist, mount: { frame: above.frame, len, mid: local(back.clone().addScaledVector(n, len / 2)) } };
};

// Navball (attitude ball) on DU1: radius, and the band edge in degrees of ball rotation. It faces the commander.
const NAV_R = 0.095, NAV_BAND_DEG = 20;
const CAMERA = EYE(SEATS[0]);
const NAV_C = PANEL.at(-0.5, 0.065, 0.008);
const NAV = (() => {
  const d = CAMERA.map((c, i) => c - NAV_C[i]);
  return surface(NAV_C, Math.atan2(d[0], d[2]) / DEG, -Math.atan2(d[1], Math.hypot(d[0], d[2])) / DEG);
})();

// Camera anchors: eye position and the angles of a camera looking at the seat's own screens.
function cameraAt(eye, target) {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(...eye);
  cam.lookAt(...target);
  return [cam.rotation.x / DEG, cam.rotation.y / DEG, cam.rotation.z / DEG];
}
const CAMERAS = SEATS.map(s => {
  const target = s.upper ? PANEL.at(s.n === 1 ? -0.3 : 0.3, -0.15, 0) : LOWER_DISPLAY(s).at(0, 0.06, 0); // display a bit low in view
  return { name: `Camera_Seat_${s.n}`, pos: EYE(s), rot: cameraAt(EYE(s), target), userData: { target, fov: 62, seat: s.n, crew: s.crew, role: s.role } };
});

// Pedestal between the upper seats (game: in view of both). The two guarded switches and the throttle flip about
// their own X axis in web/flight.js: no base rotation.
const PED_Y = 1.29;
const PIVOTS = [
  { name: 'Joystick_RHC', pos: [0.08, PED_Y, -0.2] },
  { name: 'Controller_THC', pos: [-0.08, PED_Y, -0.2] },
  { name: 'Throttle_Lever', pos: [-0.09, PED_Y, -0.05] },
  { name: 'Stage_Sep_Switch', pos: [0.03, PED_Y, -0.05] },
  { name: 'EDL_Arm_Switch', pos: [0.1, PED_Y, -0.05] },
  { name: 'Abort_Button', pos: [0, PED_Y, -0.3] },
  { name: 'Navball', pos: NAV_C, rot: NAV.r },
  { name: 'Breaker_Bank', pos: WING_R.at(0, -0.09, 0.022), rot: WING_R.r }, // on the pilot's side: Lucas runs power
  { name: 'Alarm_Master_Red', pos: PANEL.at(-0.09, 0.255, 0.035), rot: PANEL.r },
  { name: 'Alarm_Caution_Amber', pos: PANEL.at(0.09, 0.255, 0.035), rot: PANEL.r },
];

const cockpitPilot = {
  id: 'cockpit-pilot',
  name: 'CockpitPilot',
  category: 'cockpit',
  tier: 2,
  displayName: 'Crew Cabin and Control Panel (Orion layout)',
  vehicle: 'NASA Orion crew module (layout reference)',
  role: 'Cockpit of the flight phase: four reclined seats, a camera per seat, the panel for the flight minigames',
  summary:
    'Orion-style cabin: 4 reclined seats two over two, 3 display units, 7 switch panels (51 switches), 15 circuit breakers, guarded stage and landing switches, hand controllers, cursor controls, caution and warning lights, displays for the lower seats',
  originNote: 'Origin on the cabin floor centre; the crew face -Z; Camera_Seat_1..4 at the eyes of each seat (Camera_Pilot = seat 1)',
  references: ['references/parts/cockpit/cockpit-pilot/README.md', 'references/parts/crew-cabins.md'],
  build() {
    const b = createPartBuilder({
      id: this.id,
      name: this.name,
      category: this.category,
      tier: this.tier,
      displayName: this.displayName,
      vehicle: this.vehicle,
      role: this.role,
      summary: this.summary,
      originNote: this.originNote,
      references: this.references,
      attachTop: [0, 2.24, 0],
      attachBottom: [0, 0, 0],
      extraAnchors: [
        { ...CAMERAS[0], name: 'Camera_Pilot' },
        ...CAMERAS,
        { name: 'Panel_Frame', pos: PANEL.at(0, 0, 0), rot: PANEL.r, userData: { du: DU_U, screenV: 0.065, screenW: 0.058 } },
        ...SEATS.filter(s => !s.upper).map(s => ({ name: `Screen_Seat_${s.n}`, pos: LOWER_DISPLAY(s).at(0, 0, 0.006), rot: LOWER_DISPLAY(s).r, userData: { w: 0.28, h: 0.19, seat: s.n, crew: s.crew } })),
        ...SEATS.map(s => ({ name: `Seat_${s.n}`, pos: s.frame.at(...SIT), rot: [RECLINE, 180, 0], userData: { seat: s.n, crew: s.crew, role: s.role, recline: RECLINE, pose: POSE } })),
      ],
      pivots: PIVOTS,
      fxAnchors: [
        { name: 'FX_Sparks_Left', pos: WING_L.at(-0.1, 0.1, 0.05), rot: [0, 0, -25], preset: 'sparks' },
        { name: 'FX_Sparks_Right', pos: WING_R.at(0.1, 0.1, 0.05), rot: [0, 0, 25], preset: 'sparks' },
      ],
      budget: { triangles: 5000, meshes: 48 },
    });
    // Pivot children are given as local offsets; part-builder expects root coordinates (it subtracts the origin).
    const origin = Object.fromEntries(PIVOTS.map(pv => [pv.name, pv.pos]));
    const pin = (node, mat, geo, local, r) => b.add(node, mat, geo, { p: local.map((x, i) => x + origin[node][i]), ...(r ? { r } : {}) });
    const on = (s, mat, geo, u, v, w, local) => b.add('Root', mat, geo, { p: s.at(u, v, w), r: local ? s.rot(local) : s.r });

    // 1. Cabin shell, closed all round (the crew can look around): floor, side walls with ribs, forward wall, the
    // cone over the panel with two windows, the ceiling behind it, the aft wall with stowage lockers, and the side
    // hatch on the right (the mission specialists sit on the hatch side).
    b.add('Root', 'Titanium', box(2.3, 0.04, 2.18), { p: [0, 0.02, 0.33] });
    for (const sx of [-1, 1]) {
      b.add('Root', 'Hull', box(0.04, 2.22, 2.18), { p: [sx * 1.17, 1.11, 0.33] });
      for (const z of [-0.6, 0.35, 1.3]) b.add('Root', 'Aluminum', box(0.03, 2.1, 0.03), { p: [sx * 1.14, 1.07, z] });
    }
    b.add('Root', 'Hull', box(2.3, 0.04, 1.52), { p: [0, 2.22, 0.68] }); // ceiling, from the top of the cone aft
    b.add('Root', 'Hull', box(2.3, 2.22, 0.04), { p: [0, 1.11, 1.42] }); // aft wall
    for (const x of [-0.55, 0.55]) {
      b.add('Root', 'SuitGrey', box(0.5, 0.5, 0.02), { p: [x, 1.55, 1.39] }); // stowage locker
      b.add('Root', 'Metal', box(0.14, 0.025, 0.025), { p: [x, 1.36, 1.375] });
    }
    b.add('Root', 'Hull', box(2.3, 1.75, 0.04), { p: [0, 0.875, -0.8] });
    on(BULKHEAD, 'Hull', box(2.3, 0.9, 0.04), 0, 0, 0);
    for (const u of [-0.74, 0.74]) {
      on(BULKHEAD, 'HullBlack', box(0.28, 0.2, 0.02), u, 0.05, 0.025);
      on(BULKHEAD, 'Visor', box(0.24, 0.16, 0.01), u, 0.05, 0.038);
    }
    b.add('Root', 'HullBlack', box(0.03, 0.62, 0.62), { p: [1.14, 0.78, 0.62] }); // hatch frame
    b.add('Root', 'Visor', box(0.02, 0.16, 0.16), { p: [1.125, 0.86, 0.62] }); // hatch window
    for (const z of [0.12, 1.02]) b.add('Root', 'Lamp', box(1.2, 0.02, 0.04), { p: [0, 2.12, z] }); // cabin lights

    // 2. Main instrument panel hanging from the cone, with a brow over the displays.
    on(PANEL, 'HullBlack', box(1.56, 0.62, 0.3), 0, 0, -0.17);
    on(PANEL, 'Strap', box(1.6, 0.58, 0.05), 0, 0, 0);
    on(PANEL, 'HullBlack', box(1.64, 0.04, 0.1), 0, 0.3, 0.03);

    // 3. Display units: bezel, screen and a row of bezel keys.
    for (const u of DU_U) {
      on(PANEL, 'HullBlack', box(0.42, 0.3, 0.03), u, 0.06, 0.04);
      on(PANEL, 'Display', box(0.34, 0.235, 0.006), u, 0.065, 0.058);
      for (let i = 0; i < 6; i++) on(PANEL, 'Metal', box(0.034, 0.02, 0.01), u - 0.125 + i * 0.05, -0.065, 0.058);
    }
    // Screen graphics (game art): attitude on the left, system levels in the centre, ascent path on the right.
    const S = 0.063;
    // Navball: sky and ground halves, a lit horizon line, pitch lines every 20°, sunk into DU1 so a cap bulges out
    // like a flight director attitude indicator. The aircraft symbol and the band brackets are fixed.
    const half = Math.PI / 2;
    pin('Navball', 'Pack', shell(NAV_R, 16, 6, 0, Math.PI * 2, 0, half), [0, 0, 0]);
    pin('Navball', 'Foam', shell(NAV_R, 16, 6, 0, Math.PI * 2, half, half), [0, 0, 0]);
    pin('Navball', 'Lamp', ring(NAV_R * 1.02, 0.006, 24, 3), [0, 0, 0]); // ring() already lies flat (XZ)
    for (const deg of [-40, -20, 20, 40]) {
      const a = deg * DEG;
      pin('Navball', 'Hull', ring(NAV_R * Math.cos(a) * 1.005, 0.0022, 20, 3), [0, NAV_R * Math.sin(a), 0]);
    }
    // A meridian shows yaw; the green target on the front of the ball is what the pilot keeps centred.
    pin('Navball', 'Hull', ring(NAV_R * 1.01, 0.0022, 24, 3), [0, 0, 0], [0, 0, 90]);
    pin('Navball', 'LedGreen', ring(0.013, 0.0025, 12, 3), [0, 0, NAV_R + 0.002], [90, 0, 0]);
    for (const [x, y] of [[0, 0.02], [-0.02, 0], [0.02, 0]]) pin('Navball', 'LedGreen', box(x ? 0.012 : 0.003, x ? 0.003 : 0.012, 0.004), [x, y, NAV_R - 0.002]);
    const front = NAV_R + 0.012, edge = NAV_R * Math.sin(NAV_BAND_DEG * DEG), arm = 0.014, bar = 0.004;
    on(NAV, 'LedAmber', box(0.008, 0.008, 0.004), 0, 0, front);
    for (const sx of [-1, 1]) on(NAV, 'LedAmber', box(0.016, 0.005, 0.004), sx * 0.016, 0, front);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      on(NAV, 'LedGreen', box(arm, bar, 0.004), sx * (edge - arm / 2 + bar / 2), sy * edge, front);
      on(NAV, 'LedGreen', box(bar, arm, 0.004), sx * edge, sy * (edge - arm / 2 + bar / 2), front);
    }
    [[0.15, 'LedGreen'], [0.11, 'LedGreen'], [0.17, 'Lamp'], [0.08, 'LedAmber'], [0.13, 'LedGreen']].forEach(([h, mat], i) => {
      on(PANEL, mat, box(0.035, h, 0.002), -0.12 + i * 0.06, -0.035 + h / 2, S);
    });
    on(PANEL, 'Lamp', box(0.3, 0.004, 0.002), 0, -0.038, S);
    const path = [[-0.14, -0.03], [-0.08, -0.015], [-0.02, 0.01], [0.04, 0.05], [0.09, 0.085], [0.14, 0.11]];
    for (let k = 0; k < path.length - 1; k++) {
      const [u0, v0] = path[k], [u1, v1] = path[k + 1], len = Math.hypot(u1 - u0, v1 - v0);
      on(PANEL, 'Lamp', box(len, 0.005, 0.002), 0.5 + (u0 + u1) / 2, 0.065 + (v0 + v1) / 2 - 0.04, S, [0, 0, Math.atan2(v1 - v0, u1 - u0) / DEG]);
    }
    on(PANEL, 'LedAmber', box(0.02, 0.02, 0.002), 0.64, 0.135, S, [0, 0, 45]);

    // 4. Switch interface panels: 3 under the displays (12 switches each), 2 on each side wing. Each switch is a
    // tilted lever on the panel plate.
    const toggles = (s, face, u0, v0, cols, rows, du, dv) => {
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        on(s, 'Steel', box(0.008, 0.008, 0.03), u0 + i * du, v0 + j * dv + 0.004, face + 0.015, [-15, 0, 0]);
      }
    };
    for (const u of DU_U) {
      on(PANEL, 'SuitGrey', box(0.42, 0.17, 0.012), u, -0.18, 0.032);
      toggles(PANEL, 0.038, u - 0.15, -0.215, 6, 2, 0.06, 0.07);
      for (const du of [-0.12, 0, 0.12]) on(PANEL, 'LedGreen', box(0.012, 0.008, 0.004), u + du, -0.115, 0.04);
    }
    for (const s of [WING_L, WING_R]) {
      on(s, 'HullBlack', box(0.34, 0.44, 0.12), 0, 0, -0.08);
      on(s, 'Strap', box(0.36, 0.42, 0.04), 0, 0, 0);
      on(s, 'SuitGrey', box(0.32, 0.15, 0.012), 0, 0.09, 0.026);
      toggles(s, 0.032, -0.1, 0.055, 3, 2, 0.1, 0.07);
      for (const du of [-0.08, 0.08]) on(s, 'LedGreen', box(0.012, 0.008, 0.004), du, 0.155, 0.034);
    }
    on(WING_L, 'SuitGrey', box(0.32, 0.15, 0.012), 0, -0.09, 0.026); // lower left panel
    toggles(WING_L, 0.032, -0.1, -0.09, 3, 1, 0.1, 0);

    // 5. Circuit breakers (lower right panel, the pilot's side; clickable in the minigame).
    pin('Breaker_Bank', 'SuitGrey', box(0.32, 0.15, 0.012), [0, 0, 0.004]);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) pin('Breaker_Bank', 'Pack', box(0.022, 0.022, 0.018), [-0.12 + i * 0.06, -0.04 + j * 0.04, 0.019]);

    // 6. Caution and warning lights over the displays (web/flight.js blinks their materials).
    for (const u of [-0.09, 0.09]) on(PANEL, 'HullBlack', box(0.13, 0.06, 0.01), u, 0.255, 0.03);
    pin('Alarm_Master_Red', 'LedRed', box(0.1, 0.04, 0.012), [0, 0, 0.006]);
    pin('Alarm_Caution_Amber', 'LedAmber', box(0.1, 0.04, 0.012), [0, 0, 0.006]);

    // 7. Pedestal between the upper seats: hand controllers, throttle, guarded switches, abort handle.
    const PED_TOP = 0.025;
    b.add('Root', 'HullBlack', box(0.24, PED_Y - PED_TOP, 0.34), { p: [0, (PED_Y - PED_TOP) / 2, -0.15] });
    b.add('Root', 'Strap', box(0.3, PED_TOP, 0.4), { p: [0, PED_Y - PED_TOP / 2, -0.15] });
    b.add('Root', 'Steel', box(0.04, 0.006, 0.1), { p: [-0.09, PED_Y + 0.003, -0.05] }); // throttle gate
    pin('Joystick_RHC', 'HullBlack', cyl(0.03, 0.04, 0.03, 8), [0, 0.015, 0]);
    pin('Joystick_RHC', 'Pack', cyl(0.016, 0.02, 0.1, 8), [0, 0.08, 0]);
    pin('Joystick_RHC', 'Pack', box(0.045, 0.032, 0.04), [0, 0.14, 0]);
    pin('Joystick_RHC', 'LedRed', box(0.011, 0.018, 0.011), [0, 0.136, -0.023]);
    pin('Controller_THC', 'HullBlack', cyl(0.03, 0.04, 0.03, 8), [0, 0.015, 0]);
    pin('Controller_THC', 'Steel', cyl(0.011, 0.011, 0.065, 6), [0, 0.048, 0]);
    pin('Controller_THC', 'Pack', box(0.09, 0.028, 0.032), [0, 0.09, 0]);
    pin('Throttle_Lever', 'Steel', box(0.014, 0.12, 0.014), [0, 0.06, 0]); // game control: Orion does not throttle
    pin('Throttle_Lever', 'Foam', ball(0.02, 8, 6), [0, 0.125, 0]);
    for (const [node, guard] of [['Stage_Sep_Switch', 'LedRed'], ['EDL_Arm_Switch', 'LedAmber']]) {
      pin(node, 'HullBlack', box(0.045, 0.012, 0.045), [0, 0.006, 0]);
      pin(node, 'Steel', box(0.008, 0.045, 0.008), [0, 0.032, 0]);
      pin(node, guard, box(0.04, 0.004, 0.048), [0, 0.058, 0]);
      for (const sx of [-1, 1]) pin(node, guard, box(0.004, 0.045, 0.048), [sx * 0.02, 0.036, 0]);
    }
    pin('Abort_Button', 'Steel', cyl(0.009, 0.009, 0.045, 6), [0, 0.022, 0]);
    pin('Abort_Button', 'FoilGold', box(0.1, 0.028, 0.028), [0, 0.055, 0]);
    for (const x of [-0.028, 0.028]) pin('Abort_Button', 'HullBlack', box(0.011, 0.03, 0.03), [x, 0.055, 0]);

    // 8. Four reclined seats: back, headrest, seat pan, foot pan, side rails and armrests. The upper seats have a
    // cursor control device on the left armrest; the lower seats a display on the back of the seat above.
    for (const s of SEATS) {
      const f = s.frame;
      on(f, 'Pack', box(BACK.width, BACK.h, BACK.d), 0, BACK.v, BACK.w);
      on(f, 'Pack', box(0.28, 0.15, 0.1), 0, 0.8, -0.03);
      on(f, 'Strap', box(0.56, 0.06, 0.42), 0, -0.04, 0.21);
      on(f, 'Strap', box(0.4, 0.04, 0.24), 0, -0.48, 0.52);
      for (const su of [-1, 1]) {
        on(f, 'Steel', box(0.03, 0.86, 0.03), su * 0.32, 0.3, -0.09);
        on(f, 'Steel', box(0.03, 0.03, 0.5), su * 0.32, -0.06, 0.2);
        on(f, 'HullBlack', box(0.06, 0.05, 0.3), su * 0.37, 0.24, 0.25); // under the forearms of the seated suit
      }
      if (s.upper) {
        on(f, 'HullBlack', cyl(0.026, 0.03, 0.016, 8), 0.37, 0.28, 0.3, [90, 0, 0]); // CCD (u is mirrored: +u = seat's left)
        on(f, 'LedGreen', box(0.012, 0.006, 0.012), 0.37, 0.29, 0.3);
      } else {
        const d = LOWER_DISPLAY(s);
        on(d, 'HullBlack', box(LOWER_CASE.w, LOWER_CASE.h, LOWER_CASE.d), 0, 0, -LOWER_CASE.d / 2);
        on(d, 'Display', box(0.28, 0.19, 0.006), 0, 0, 0.002);
        for (let i = 0; i < 5; i++) on(d, 'Metal', box(0.03, 0.016, 0.01), -0.1 + i * 0.05, -0.108, 0.002);
        const { frame: mf, len, mid } = d.mount; // two struts along the seat's normal, from the cushion to the case
        for (const du of [-0.09, 0.09]) on(mf, 'Steel', box(0.03, 0.03, len + 0.02), mid[0] + du, mid[1], mid[2]);
      }
    }
    // Seat supports: a spine between the seats and beams from the walls under the upper row.
    b.add('Root', 'Aluminum', box(0.08, 0.95, 0.08), { p: [0, 0.475, 0.4] });
    for (const sx of [-1, 1]) b.add('Root', 'Aluminum', box(0.5, 0.06, 0.06), { p: [sx * 0.9, 0.92, 0.3] });
    for (const s of SEATS.filter(x => !x.upper)) b.add('Root', 'Aluminum', box(0.3, 0.2, 0.05), { p: [s.hip[0], 0.1, s.hip[2] + 0.05] });
    return b;
  },
};

export default [cockpitPilot];
