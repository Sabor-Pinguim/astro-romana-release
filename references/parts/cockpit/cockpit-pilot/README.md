---
id: cockpit-pilot
name: Crew cabin and control panel (Orion layout)
category: cockpit
role: cockpit of the flight phase; four reclined seats, a camera per seat, the panel for the flight minigames
tier: 2
propellants: []
manufacturer: game model (layout after NASA's Orion crew module cockpit)
vehicles: ["Crew cabin of the game rocket (cockpit phase)"]
status: game model (Orion is operational; checked 2026-11)
---

# Crew cabin and control panel (Orion layout)

The crew cabin of the cockpit phase (`assets/models/rocket/cockpit_pilot.glb`). It follows the layout NASA describes and shows for the Orion crew module: four crew seats, reclined, two over two; the commander and the pilot on the upper row facing three display units, seven switch interface panels with about 60 switches, hand controllers and cursor control devices, with physical controls kept for critical actions. The two mission specialists sit on the lower row with no panel of their own. In the game, Helena (commander, seat 1) and Lucas (seat 2) take the upper row, Oscar (seat 3) and Maya (seat 4) the lower one. In a room each player sees the cabin from their own seat; solo play follows whoever is acting (Helena flying, Lucas on a tripped breaker, Oscar on the orbital docking approach, Maya on the propellant transfer, each one during their orbit experiment), and the lower displays show their task during step 2. From any seat the player can look around by dragging on the view off the controls (or with the right button anywhere): the head turns the way the pointer moves, at the Mars surface speeds; the cursor stays free for the controls and the minigames; double click or tap, or C, recentres. A few controls the flight minigames need (throttle, abort handle, guarded stage and landing switches) and the lower-seat displays are game choices and are marked as such.

**Why tier 2:** a glass cockpit with physical backups, between a bare capsule panel (tier 1) and a full Shuttle-class flight deck (tier 3).

## 1. Game data

The cabin is not a real flight unit, so mass, power and cost are `game-balance`; the game reads them from `tools/modeling/parts/specs.mjs`.

| Key | Value | Unit | Source | Note |
|---|---|---|---|---|
| `mass_dry` | 98 | kg | game-balance | n/f: no published mass for the Orion display and control panel |
| `power_electric` | 115 | W | game-balance | n/f: Orion display power not published |
| `cost_unit` | 9.5 | USD M (game) | game-balance | same scale as `specs.mjs` |
| `crew_seats` | 4 (two over two) | count | [1][3], `in-context-2.jpg`, `in-context-3.jpg` | Orion |
| `display_units` | 3 | count | [1][2] | Orion |
| `switch_interface_panels` | 7 | count | [1] | model: 3 under the displays, 2 on each side wing (the lower right one holds the breakers) |
| `switches` | about 60 (model: 51 toggles + 15 breakers + 2 guarded) | count | [1][2] | the model counts the toggles toward "about 60" |
| `rotational_hand_controllers` | 2 (model: 1) | count | [1] | one per upper seat in Orion; the model has one on the pedestal, shared |
| `translational_hand_controllers` | 2 (model: 1) | count | [1] | same |
| `cursor_control_devices` | 2 | count | [1] | on the left armrest of each upper seat in the model |
| `seat_recline` | 58 | ° from vertical | game-balance | Orion crew lie on their backs with knees up for launch (`in-context-3.jpg`, `in-context-4.jpg`); 58° keeps the panel and the pedestal in view |

## 2. Vehicle and stage data

| Key | Value | Unit | Source | Note |
|---|---|---|---|---|
| `vehicle` | Orion crew module (layout reference) | — | [1] | |
| `crew` | 4 | count | [3] | |
| `habitable_volume` | 8.95 ⚠ | m³ | [3] | 9.34 m³ in [2]; see crew-cabins.md |
| `diameter` | 5.0 | m | [2] | the crew module, not this cabin model |
| `backup` | a backup set of switches can fly Orion if a display or hand controller fails | — | [1] | |

## 3. Geometry

All dimensions are `est.`: no drawing of the Orion cabin was found, only photos (section 5). Sizes are set for readable first-person views from the four seats and stay inside the validator box for cockpits (2.40 × 2.30 × 2.30 m).

| Dimension | Value (m) | Source | Note |
|---|---|---|---|
| Overall (built) | 2.38 × 2.28 × 2.27 | model | width × height × depth |
| Main panel | 1.60 × 0.58, tilted 30° down toward the crew | est. | centre (0, 1.85, −0.08); `Panel_Frame` |
| Display unit bezel / screen | 0.42 × 0.30 / 0.34 × 0.235 | est. | 3 units, 0.50 apart |
| Switch interface panel | 0.42 × 0.17 (under the displays), 0.32 × 0.15 (wings) | est. | |
| Pedestal top | 0.30 × 0.40, at y = 1.29 | est. | between the upper seats; hand controllers, throttle, guarded switches, abort handle |
| Seats (hip points) | upper (±0.42, 0.98, 0.20); lower (±0.42, 0.22, 0.62) | est. | seat back 0.62 × 0.74; recline 58° |
| Seated avatar (Hips pivot) | hip point + (0, 0.14, 0.215) in the seat frame | game | `Seat_1..4`, with the seated pose in extras |
| Lower-seat display | 0.34 × 0.25 (screen 0.28 × 0.19) | game | on two struts from the back of the upper seat, on the level gaze, 0.50 m from the eyes; `Screen_Seat_3/4` |
| Cameras (eyes) | seats 1–2 (±0.42, 1.71, 0.73); seats 3–4 (±0.42, 0.95, 1.15); fov 62° | game | `Camera_Seat_1..4`, from the avatar rig and the seated pose |

## 4. Low-poly model

Generated by `tools/modeling/parts/cockpit.mjs` (`node tools/modeling/build-parts.mjs cockpit-pilot`), which also writes the copy `assets/models/rocket/cockpit_pilot.glb` used by `index.html`. `web/flight.js` places its screens on `Panel_Frame` and `Screen_Seat_3/4`, its cameras on `Camera_Seat_1..4`, and the four crew avatars on `Seat_1..4`.

### 4.1 Shape in words

A boxy cabin closed all round: ribbed side walls, a slanted cone over the front with two windows, a ceiling, an aft wall with two stowage lockers, and a side hatch on the right. Four seats, two over two, lean back 58°: each one a padded back and headrest, a seat pan, a foot pan, steel side rails and armrests. Over the upper seats hangs the dark grey panel, turned down toward the crew, with three display units in a row and a row of keys under each screen. Under each display, a light grey switch panel with two rows of six toggles and three green lights. The left display holds a navball (attitude ball): blue sky and orange ground halves, a lit horizon line and pitch lines every 20°, bulging out of the screen and turned toward the commander's eyes, with a fixed amber aircraft symbol and green brackets that mark the keep-in-range band of the liftoff minigame. A dark brow tops the panel, with the red master alarm and the amber caution light over the centre display. Two side wings turn toward the crew, each with a switch panel; the right one, on the pilot's side, also holds 15 circuit breakers. Between the upper seats, a pedestal carries the hand controllers, the throttle, two guarded switches and a striped abort T-handle. The left armrest of each upper seat carries a cursor control. On the back of each upper seat, a display on two short struts faces the mission specialist below. Screen graphics (attitude ring, system bars, ascent path) are game art.

A cutaway render of the cabin with the crew seated: [docs/images/cockpit-crew-cutaway.png](../../../../docs/images/cockpit-crew-cutaway.png).

### 4.2 Node hierarchy

```text
CockpitPilot                 origin: cabin floor centre; the crew face -Z
├─ Attach_Top                (0, 2.24, 0)
├─ Attach_Bottom             (0, 0, 0)
├─ Camera_Pilot              = Camera_Seat_1 (kept for older code)
├─ Camera_Seat_1..4          eyes of each seat; userData target, fov, seat, crew, role
├─ Panel_Frame               (0, 1.85, -0.08), rot [30, 0, 0]; userData du (display offsets), screenV, screenW
├─ Screen_Seat_3 / _4        lower-seat displays; userData w, h, seat, crew (web/flight.js draws on them)
├─ Seat_1..4                 Hips pivot of the seated avatar, rot [58, 180, 0]; userData seat, crew, role, recline, pose
├─ Joystick_RHC              (0.08, 1.29, -0.20)   attitude; web/flight.js tilts it (x, z)
├─ Controller_THC            (-0.08, 1.29, -0.20)
├─ Throttle_Lever            (-0.09, 1.29, -0.05)  web/flight.js sets rotation.x
├─ Stage_Sep_Switch          (0.03, 1.29, -0.05)   web/flight.js sets rotation.x (no base rotation)
├─ EDL_Arm_Switch            (0.10, 1.29, -0.05)   same
├─ Abort_Button              (0, 1.29, -0.30)
├─ Navball                   on the left display, faces the commander's eyes; web/flight.js turns it (pitch error, roll)
├─ Breaker_Bank              lower right wing panel (clickable)
├─ Alarm_Master_Red          over the centre display (web/flight.js blinks its material)
├─ Alarm_Caution_Amber       same
├─ FX_Sparks_Left / _Right   on the side wings, preset sparks
```

### 4.3 Parts

The code is the source of truth for every primitive; the main ones:

| # | Node | Primitive | Size (m) | Position (m) | Rotation (°) | Material | Segments |
|---|---|---|---|---|---|---|---|
| 1 | Root | box (floor) | 2.3 × 0.04 × 2.18 | (0, 0.02, 0.33) | — | Titanium | — |
| 2 | Root | box (×2 walls; ceiling; aft wall) | 0.04 × 2.22 × 2.18; 2.3 × 0.04 × 1.52; 2.3 × 2.22 × 0.04 | (±1.17, 1.11, 0.33); (0, 2.22, 0.68); (0, 1.11, 1.42) | — | Hull | — |
| 3 | Root | box (cone over the panel) | 2.3 × 0.9 × 0.04 | (0, 1.98, −0.45) | (55, 0, 0) | Hull | — |
| 4 | Root | box (panel face) | 1.6 × 0.58 × 0.05 | (0, 1.85, −0.08) | (30, 0, 0) | Strap | — |
| 5 | Root | box (×3 screens) | 0.34 × 0.235 × 0.006 | on the panel | panel | Display | — |
| 6 | Root | box (×18 bezel keys) | 0.034 × 0.02 × 0.01 | under each screen | panel | Metal | — |
| 7 | Root | box (×51 toggle levers) | 0.008 × 0.008 × 0.03 | on the switch panels | panel, lever −15° | Steel | — |
| 8 | Breaker_Bank | box (×15) | 0.022 × 0.022 × 0.018 | 3 rows × 5 | wing | Pack | — |
| 9 | Joystick_RHC | cylinder, box | grip r 0.016–0.02 × 0.10, head 0.045 × 0.032 × 0.04 | pivot + (0, 0.08, 0) | — | Pack, LedRed | 8 |
| 10 | Abort_Button | box (T-bar + 2 bands) | 0.10 × 0.028 × 0.028 | pivot + (0, 0.055, 0) | — | FoilGold, HullBlack | — |
| 11 | Root | box (×4 seat backs, headrests) | 0.62 × 0.74 × 0.07; 0.28 × 0.15 × 0.10 | seat frame | recline 58° | Pack | — |
| 12 | Root | box (×4 seat pans, foot pans) | 0.56 × 0.06 × 0.42; 0.40 × 0.04 × 0.24 | seat frame | recline 58° | Strap | — |
| 13 | Root | box (×2 lower displays: case, screen) | 0.34 × 0.25 × 0.03; 0.28 × 0.19 × 0.006 | back of the upper seats | facing the eyes below | HullBlack, Display | — |

### 4.5 Simplify

- Game choices: the crew lean back 58° instead of lying flat; one set of hand controllers on a pedestal between the upper seats so both pilots see it (Orion has a pair on each upper seat's armrests); the throttle lever is a minigame control (Orion's crew does not throttle an engine); the abort T-handle follows Crew Dragon's abort handle ([4], via crew-cabins.md); the displays on the back of the upper seats (Orion gives the mission specialists no panel), with the lower seats set far enough aft that they sit half a metre from the eyes; the guarded switches, the navball band brackets and all screen graphics are game art.
- The seated crew are the game avatars (`tools/modeling/characters/`); `web/flight.js` leaves out their PLSS backpack, since Orion crew fly in launch suits ([1], `in-context-5.jpg`).
- No labels, logos or text on the panel.

### 4.6 Budget and checks

| Check | Target |
|---|---|
| Triangles | ≤ 5,000 (built: 4,564) |
| Meshes | ≤ 48 (built: 40) |
| GLB size | ≤ 400 KB (built: 354 KB) |
| Box | ≤ 2.40 × 2.30 × 2.30 m (built: 2.38 × 2.28 × 2.27) |
| Nodes | the cockpit nodes required by `tools/modeling/validate.mjs`, including `Camera_Seat_1..4`, `Seat_1..4`, `Panel_Frame`, `Screen_Seat_3/4` |

Palette materials used only here (in `tools/modeling/lib/palette.mjs`): `LedAmber` (#FFB020, emissive) for the caution light and the landing switch guard, and `Display` (#0F2236, dim emissive, matte) for lit screens.

## 5. Images

| File | View | What it shows (and what to take from it) | Source | Author | License |
|---|---|---|---|---|---|
| `in-context-1.jpg` | in-context | Orion simulator at Johnson Space Center, 2020: the cone shape of the crew module and a side window | [NASA jsc2022e046106](https://images.nasa.gov/details/jsc2022e046106) | NASA | Public domain (NASA) |
| `in-context-2.jpg` | in-context | Orion mockup, 2014: four crew members in reclined seats, two over two, and the cabin wall structure | [NASA jsc2022e044164](https://images.nasa.gov/details/jsc2022e044164) | Robert Markowitz (NASA) | Public domain (NASA) |
| `in-context-3.jpg` | in-context | Orion mockup, Oct. 24, 2014: the display and control panel right over the upper crew, three display units with switch rows and guarded switches, the crew on their backs with knees up | [NASA jsc2022e044165](https://images.nasa.gov/details/jsc2022e044165) | Robert Markowitz (NASA) | Public domain (NASA) |
| `in-context-4.jpg` | in-context | Same session, from the side: switch panels overhead, a crew member reaching up to them, the windows beside the panel | [NASA jsc2022e044162](https://images.nasa.gov/details/jsc2022e044162) | Robert Markowitz (NASA) | Public domain (NASA) |
| `in-context-5.jpg` | in-context | Artemis II crew members Reid Wiseman and Victor Glover strapped in the Orion mockup, Jan. 30, 2025: launch suits without backpacks, seat structure and harness | [NASA jsc2025e004075](https://images.nasa.gov/details/jsc2025e004075) | Mark Sowa (NASA) | Public domain (NASA) |

**Linked only:** NASA's Orion crew systems page [1] describes the cockpit.

## 6. Gaps and cautions

- All cabin dimensions are estimates; a drawing of the Orion cabin would let us check proportions.
- Real Orion crew lie on their backs during launch (`in-context-3.jpg`); the game seats lean back 58° so the panel stays readable from every seat.
- The switch count "about 60" is approximate in the sources [1][2].

## 7. Sources

1. NASA, *Orion crew systems* (reference page). https://www.nasa.gov/reference/crew-systems/ (accessed 2026-11-15)
2. Plant Services, *Inside Lockheed Martin's Orion crew capsule*. https://www.plantservices.com/industrial-science-report/article/55378102/inside-lockheed-martins-orion-crew-capsule (accessed 2026-11-15)
3. Wikipedia, *Orion (spacecraft)*. https://en.wikipedia.org/wiki/Orion_(spacecraft) (accessed 2026-11-15)
4. NASA Commercial Crew blog, *Crew Dragon Displays and Crew Spacesuits Ready for Mission to Space Station*, 2020. https://blogs.nasa.gov/commercialcrew/2020/05/12/crew-dragon-displays-and-crew-spacesuits-ready-for-mission-to-space-station (accessed 2026-11-15)
