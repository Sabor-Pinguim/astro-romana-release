# Visual identity: faceted low poly

Helena's scouting minigame opens in a dialog over the surface, with a faceted grid, an amber path and drag, touch or keyboard controls. The completion confirmation uses a chamfered square icon in lime green (`#B4DB55`).

A guide to reproducing the Astro Romana look on any screen: web (`index.html`), posters and slides. The living reference is [index.html](../index.html). When this guide and the code disagree, fix both in the same commit.

## 1. The idea in one sentence

The interface is made of the same material as the 3D models: **flat surfaces of solid colour, cut at an angle**. Each panel looks like a face of a low-poly object lit from above and from the left. Nothing is soft: no blur, glass, diffuse glow or rounded corners.

| Do | Don't |
|---|---|
| Facets with a hard transition between tones (gradient with a hard stop) | Smooth gradients, glassmorphism, `backdrop-filter`, `blur` |
| 45° chamfered corners, parallelograms, hexagons, diamonds, arrows | `border-radius`, pills, perfect circles on buttons |
| Separate areas by **tone** (a lighter or darker facet) | Thin 1 px borders around everything, drop shadows |
| Planets, terrain and characters in flat-coloured triangles | Photos, textures, emoji icons, outlined illustrations |
| Dark text on orange and amber | White text on orange (low contrast) |
| Short, mechanical motion (diagonal wipe, stepped blink) | Slow fades, bounce, parallax |

## 2. Palette

Use only these tokens. The names are those of the CSS variables in `:root`.

| Token | Hex | Role |
|---|---|---|
| `--bg-void` | `#11071F` | Page background; text on orange and amber |
| `--bg-plum` | `#1D1128` | Middle facet of panels |
| `--bg-indigo` | `#281147` | Light facet, tags, secondary button |
| `--bg-viewport` | `#17183B` | Background of "windows" onto space (orbital map, rocket plan) |
| `--violet-electric` | `#6D28D9` | Reserved for rare highlights |
| `--amethyst` | `#9B5DE5` | Cool accent: active tabs, Δv, orbit lines, quotes |
| `--mars-orange` | `#E04F26` | Main action, current step, ▲ marker |
| `--coral-hover` | `#EE7B57` | Light facet of the main action; danger state on gauges |
| `--crimson-alert` | `#8F241E` | Alert background |
| `--solar-amber` | `#F59E0B` | Selection, focus, numeric values, section labels |
| `--starlight-cream` | `#FCE8A6` | Titles |
| `--text-white` | `#FFFFFF` | Data text |
| `--muted` | `#B9B0CE` | Secondary text |
| `--safe` | `#7EDAC2` | OK, equipped, positive power |

**Facet tones** (derived, for a single surface): `--f0 #0c0517`, `--f1 #160b25`, `--f2 = --bg-plum`, `--f3 #24143a`, `--f4 = --bg-indigo`. A panel uses 3 close tones; a button uses 2 tones of the same hue.

**Body ramps** (dark to light; they live in `RAMPS` in `index.html`): `mars`, `marsDark`, `ice`, `ocean`, `land`, `jupiter`, `jupiterBand`, `sun`, `rock`, `jezero`, `gale`, `ground`. Each ramp has 6 colours. The light picks the colour: the most brightly lit face takes the end of the ramp.

**Character colours** (the `--crew` variable on cards and in the HUD): the interface uses the `Accent` colour of the 3D model, so that a label and its avatar are always recognisable as the same person.

| Character | Interface and 3D model (`Accent`) |
|---|---|
| Helena | `#D7263D` |
| Lucas | `#F2A900` |
| Oscar | `#1FA2FF` |
| Maya | `#2BB673` |
| Nancy Grace Roman (NPC — Rocket Assembly Wizard) | `#9B5DE5` (same as `--amethyst`) |

## 3. Typography

| Use | Font | Weight | Details |
|---|---|---|---|
| Titles, labels, buttons, numbers | **Chakra Petch** | 500–700 | The angular cuts of the letters match the chamfers. Titles in UPPERCASE. Numbers with `tabular-nums` |
| Body text | **Barlow** | 400–600 | Italics only in quotes |

- **Section label ("eyebrow"):** Chakra Petch 600, 0.7 rem, UPPERCASE, 0.14 em letter spacing, amber, preceded by an orange ▲ triangle drawn in CSS.
- **Menu title:** three staggered lines. The first in cream, the second in amethyst indented 0.5 em, the third in orange inside a parallelogram.
- Both fonts are OFL (Google Fonts) and can be embedded in any build.
- Do not use Inter or Space Grotesk: they are the face of generic interfaces.

## 4. Shapes

All of them are CSS `clip-path`.

| Shape | Where | CSS recipe |
|---|---|---|
| Double chamfer (top-left and bottom-right corners) | Panels (`.slab`), dialogs, cards | `polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)` |
| Parallelogram | Buttons, tabs, switches, toast | `polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)` |
| Chained arrow | Planning steps and mission route | `polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%,14px 50%)`, with a negative margin so they fit together |
| Hexagon | Step numbers, close button, site icons, pedestal | `polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)` |
| Diamond | Status dots, stars | `polygon(50% 0,100% 50%,50% 100%,0 50%)` |
| Hexagonal ring | Planet selection reticle (turns slowly) | `polygon(evenodd, <outer hexagon>, <inner hexagon>)` |
| Triangle strip | Header and footer edge | `conic-gradient` repeated every 12 × 6 px |

- **Keyboard focus:** `clip-path` cuts off the `outline`. On clipped elements, focus is `box-shadow: inset 0 0 0 2px var(--solar-amber)`.
- **Icons:** draw them with the shapes in the table above. No emoji or icon fonts.
- **Menu actions:** stack the main actions at equal width. Each action places its icon on the left and centers its label.
- **Menu contact:** place a chamfered chip with a geometric envelope beside the version; amber and orange highlight on hover and keyboard focus, with the contact email in its tooltip. Clicking opens the mail client, copies the address, and confirms the copy in a toast.
- **Lobby back button:** use the gold button fill at rest and the orange fill on hover, keyboard focus and press.
- **Settings shortcut:** place a borderless orange hexagonal gear at the right of each game screen header; hover, focus, and press switch its fill to starlight cream (`--starlight-cream`).
- **Symbol hexagons:** keep width about 1.15 times height so the six sides look even, including crew specialty icons and the settings shortcut.
- **Expanded multiplayer setup:** on mobile, use one compact line for Online, player count, and the editable astronaut name. Hide the duplicate dossier and card headings to save height. Keep the name input, confirm button, and amber-bordered change-name button on a single row.
- **Multiplayer room sections & leave action:** place a colored Earth icon before the open rooms title and an amber plus icon before the new room title. Highlight the "Leave room" button in orange (`.button.primary`), right-aligned in the mode strip and full-width below the connected players list in the crew room panel, opening a confirmation modal before returning to the main menu.
- **Crew cards & preview:** show the assigned player's name in a crew-tinted chamfered badge at the bottom-right corner of their crew card. On desktop, the selected character's name appears in an accent-coloured label inside the 3D viewport. Filled geometric pictograms in crew-coloured hexagons sit below it, each beside its full localized name.
- **Crew seat action:** multiplayer cards on the left select a character and show occupied player names. A free selected seat offers its crew-colored "Take seat" action inside the right character preview. On short landscape screens, compact the cards and room summary so the preview action remains visible without scrolling.
- **Difficulty portraits:** on wide desktop screens only, three recolored cutouts of the approved low-poly concept fill spare height in the difficulty cards. They show Nancy Grace Roman as young (easy), adult (normal), and mature (hard), all in left-facing profile with closed eyes. Preserve the original broad facets, transparent edges, round glasses on adult and mature Nancy, and constellation lines; use mint, amber, and crimson respectively. The transparent PNGs are produced by `tools/modeling/portraits/render-reference.mjs` from `references/art/nancy-difficulty-concept.png` and work without WebGL.
- **Difficulty biography:** a discreet hexagonal question mark sits at the top-right of the difficulty panel on desktop only. It reveals a short localized note about Nancy Grace Roman and the game's name, with a NASA source link.

## 5. Surfaces

- **Panel (`.slab`):** a 112° gradient with hard stops, `--f3` 0–17 %, `--f2` 17–62 %, `#1a0e26` 62–100 %, plus a light edge on top (`inset 0 1px 0 #ffffff12`).
- **Button:** a 165° gradient with a hard stop at 52 %. The top facet is lighter, like a bevel.
- **Screen background:** two `conic-gradient`s with hard stops and transparency layered over `--bg-void`. The fans cross and form large, almost invisible polygons.
- **Windows onto space:** `--bg-viewport` with a hexagonal honeycomb mesh (`--honeycomb` SVG tile) at ~12 % opacity.
- **Gauges:** 9 px blocks with a 3 px gap, slanted at −24° (`skewX`). In danger they turn coral and blink in 2 steps.
- **Alerts:** crimson background with a strip of hazard stripes (amber and void, at 45°) on the left edge.
- **Wizard chalkboard (`.chalkboard`):** faceted wooden frame (`#8c5b30` / `#6d4421` / `#523116`) with a bottom chalk tray (white & amber chalk sticks + two-tone eraser) framing a deep slate-green faceted surface (`#1d4233` / `#163529` / `#112920`), dashed chalk dividers, off-white chalk text (`#f3f5ec`), a red close button by default, and a chamfered 3D stage for Nancy Grace Roman (`#9B5DE5` accent).

## 6. Generated art

All art is generated by code from a fixed seed: the same code always draws the same image.

- **2D planet** (`facetPolys`):
  - Rings of vertices, for example 6, 12 and 18, with a small random offset, joined into triangles.
  - Each vertex is lifted onto the sphere and each face computes its own normal.
  - The colour comes from the ramp through the dot product of the normal with the light `(-0.55, -0.6, 0.58)`, which comes from above and from the left.
  - Regions switch ramps: polar cap, dark Martian maria, Earth's continents, Jupiter's bands.
- **3D planet** (orbital map, three.js 0.186.1, the same as the viewer):
  - Mesh: `IcosahedronGeometry` with detail 1 (Sun) or 2 (planets) and one colour per face (`vertexColors`).
  - Material: `MeshLambertMaterial` with `flatShading`.
  - Light: a cream `PointLight` at the Sun, so the lit side always faces it, plus a lilac `AmbientLight` `#b48cf0` for the dark side.
  - Full system: the 8 planets (Saturn with faceted rings), an asteroid belt (170 icosahedra) and the Earth→Mars transfer.
  - Orbits: a dashed 48-sided `LineLoop`; Mars's, the only open destination, in solid orange.
  - Mars aura: two icosahedron shells seen from inside (orange and amber, additive), turning and pulsing. It is the only glow allowed: it says "available".
  - Motion: real orbital periods in proportion (1 year = 36 s) and real axial tilt. The radii are stylized.
  - The orbit slows down while the mouse is over a planet.
  - The HTML buttons follow each planet's projection. Without WebGL, the 2D map stays.
  - Every planet is clickable. Unavailable ones get the reticle in grey `--muted`, the label "· unavailable", the status "UNAVAILABLE" on the card and a disabled (dimmed) planning button.
  - Planning background (crew and assembly): the same scene becomes a fixed layer behind the screen; the camera zooms smoothly onto the chosen planet (lit side, with the terminator, on the right of the screen) and follows it along its orbit, with faint stars and the belt passing by. On these screens the panels are translucent (72%) so the background shows through.
- **3D rockets** (generated GLBs, loaded from `index.models.js`):
  - Light: a cream key light from above and from the left, lilac ambient, a Mars-orange rim light and a soft room reflection (`RoomEnvironment`, intensity 0.5) so the metal does not go black.
  - Menu: a Saturn V tilted in flight, spinning on its own axis, with a flame of 3 seven-sided cones (orange, amber and cream, additive, flickering). On Play it speeds away and the screen changes after about 1 s.
  - Assembly: exploded view, bottom to top: booster thrust section, middle stages (0 to 7) and cabin. The shells (`parts/structures/*.glb`: thrust section, stage and cabin) have no engine or tank: the parts snap onto the `Attach_*` nodes. Engines follow the real cluster pattern (1 + 8 on Falcon 9, 4 on SLS, 3 + 10 + 20 on Super Heavy); the tank sits on `Attach_Tank`, with its height compressed to fit; 1 piece of equipment per bay; up to 4 modules in the cabin, at half scale.
  - Open and closed versions: the front half of the stage and of the cabin is in the `Closed` node. The builder hides that node (cut open towards +Z); the launch pad and other outside views show it and do not load the equipment inside. The closed cabin has a hatch, two windows on the cone and the launch escape tower.
  - Empty mounting points: an amber hexagonal plate with a cream outline, pulsing; clicking it opens the right catalog tab. Selected module: 12-sided amber rings. In the gaps between modules, hexagonal "+" buttons insert a stage.
  - The stack sways ±43° without hiding the open side, and each label follows its module.
  - Side catalog (`.catalog` / `#parts-list`): each part shows a chamfered 3D thumbnail (`.part-thumb`) of its GLB model under the same studio lighting (with a low-poly SVG fallback when WebGL is unavailable).
  - Lobby: the chosen crew member appears in 3D (avatar GLB, `idle_loop` animation; `wave` when selected again) on a hexagonal pedestal in their colour.
  - Landing sites (thumbnails and the large lobby view): a real HiRISE photo, 1.5 km around the landing point, north up, with a light Mars tint (`sepia`, a game choice); the selected thumbnail gets an amber chamfered frame, an amber title strip with dark text and a diamond marker (the others are slightly darkened); the large view marks the 512 m walkable area in dashed amber and carries the credit.
- **Launch pad** (between "Launch mission" and the cockpit, `web/launch.js`):
  - The assembled rocket, in its closed version and stacked without the builder's gaps, on a hexagonal pad with a crimson `--crimson-alert` tower and an arm to the cabin. The setting is a low-poly interpretation of the supplied photos of the Sorocaba Technology Park: a curved facade of concrete and green glass, lawns, paths, palm trees, lamp posts, distant trees and faceted clouds under a blue daytime sky. The sizes and positions are game approximations.
  - The camera circles the rocket during the countdown (T−10 in large Chakra Petch, cream with an orange shadow, and the countdown status on the card). At zero: a flame of 3 cones (orange, amber and cream), amber light and faceted smoke clouds; the camera drops to the base, the rocket climbs (faster for a higher TWR) and the camera swings round to the front and closes in on the cabin windows; the screen darkens and opens the cockpit.
  - Failed liftoff: at zero, "NO IGNITION" (no engine that can light: nothing happens) or "NO LIFTOFF" (TWR < 1: the engines light, the rocket shakes without climbing and the engines shut down), smaller and with a crimson `--crimson-alert` shadow; the camera keeps circling and darkens to the debrief. There, a crimson seal and grade "F" and an empty podium (no crew; in the 2D fallback, dimmed steps with "—").
  - Abort for lack of Δv (same screen, `window.ASTRO_SPLASHDOWN`): the cabin the player built, in its closed version and without the escape tower (cut by a plane above the docking ring), descends under three faceted parachutes with `--mars-orange` and `--starlight-cream` gores and cream lines. The daytime sky is the same as on the pad, over a faceted sea in the `ocean` colours of the 2D art, with waves on the vertices. "ABORT" and then "SPLASHDOWN" with a crimson shadow. On impact, foam of cream icosahedra; the parachutes fall sideways onto the water and the capsule bobs on the waves. The screen darkens to the "Mission Abort" debrief, with an empty podium.
- **Cockpit** (pilot panel in the Orion layout, `assets/models/rocket/cockpit_pilot.glb`):
  - Navball on the left screen: a faceted ball with blue sky (`Pack`) and orange ground (`Foam`), a lit horizon (`Lamp`), pitch lines every 20° and one meridian, facing the pilot's eyes. In front of the ball, a green target (a ring and three ticks) that the pilot keeps in the centre; fixed, the amber aircraft symbol and four green corners that mark the band.
  - Minigame card: a square sight with the band as a green octagon and a cream diamond (orange outside the band), a d-pad beside it with the keys (W/A/S/D and arrows), time to MECO, percentage in the band and stars.
  - Flight stepper: four red arrows with a number, a name and a countdown. The red area fills the arrow while the step is active; when it is done, it turns dark red, never green, so it still reads as a flight sequence.
  - Cabin docking: the centre monitor renders a 3D camera facing the station's rotating hatch (an *Endurance*-style modular ring, concentric capture rings and the 3D collar/sight of the cabin hatch in the foreground); the keys `← →` (`A/D`), `↑ ↓` and `E/Q` (`W/S`) move the camera on three axes (6 commands, no mouse), and the right side panel shows the remaining fuel bar.
  - Docking: in the third step, the right monitor shows the external approach camera (station, spacecraft and alignment line). The player centres the spacecraft before releasing the propellant transfer.
  - Fixed monitors: the left one shows the navball during liftoff and landing; the centre one shows the cabin docking; the right one shows the orbital approach. Outside their step, the images stay visible without responding to the controls. A glowing amber frame highlights the active monitor in each step (left in steps 1 and 4, centre in step 2 and right in step 3).
- **Surface** (landing, real HiRISE terrain in `index.terrain.<site>.js`):
  - First person with the body visible: the helmet is hidden from the camera but still casts a shadow; looking down shows the chest, hands, legs and feet. `V` switches to the camera behind the character. With a mouse, a click on the view captures the pointer and the mouse turns the camera (`Esc` releases it); dragging is only a fallback if the browser refuses the capture.
  - Sky: a faceted icosahedron dome, caramel `#d8a07c` at the horizon and `#7a4c46` overhead. The fog uses the horizon colour and grows with the square of the distance: almost none up to ~10 km, 97% at the end of the horizon ring, which fades into the sky (without the ring: 45 to 230 m).
  - Horizon: a ring out to 100 km with the real relief around the site (Mount Sharp at Gale, the crater rim and delta at Jezero), with Mars curvature. Greyscale texture (HiRISE and CTX photos; beyond them, the relief shaded with the photo's sun) × the site tint, lit as flat ground.
  - Ground: greyscale photo without the relief shading (the game light shades the mesh) × the manifest tint × a game gain (`GROUND_GAIN`), plus a grain repeated every 3 m and low-poly rocks (flat-shaded dodecahedra, same positions per site). Sunlight comes from the direction of the photo's sun.
  - Lander in the centre: a gold and white hexagon with 4 legs, built from primitives.
  - Experiment: a dark hexagonal plinth, a cube in the owner's colour, a spinning cream gem and a 60 m additive beam visible from afar. When done: the beam disappears and the gem turns green `--safe`. Interacting opens the chamfered dialog with each specialist's interactive minigame (`H-S1` 5×5 escort route grid with points marked by chemical symbols and a chamfered strip showing the order, an amber chip on the next one and green on those already visited, `L-S1` MOXIE banded thermometer, `O-S1` chamfered list of UHF relay packets, `M-S1` `8×6` SHERLOC UV matrix in purple/amethyst + PIXL in green/amber) and a final Real fact card on completion.
  - HUD: chamfered panels in the corners (a compact panel with only "Mars surface EVA" and the amber return-window timer; a list of experiments with distance and arrow), crew bar, interaction prompt in orange (locked in purple, done in green), "Board & depart" in orange. On touch: a hexagonal joystick and a hexagonal jump button.
  - All 4 astronauts are in the scene; the player controls one (keys 1–4) and the others walk over the terrain avoiding obstacles, stop to play each role's own action animation (with the temporary props appearing during the animation) and, when standing still, turn to the player and wave (`wave`) if the player looks straight at them.
  - Compass: a strip at the top centre with diagonal cuts at the ends, ±90° around the view direction, cardinal letters (N in amber), ticks every 15°, a Mars-orange needle and markers (a hexagon in the owner's colour for each experiment, a green diamond when done, a white triangle for the lander).
  - Emote wheel (Q or the Emotes button): a dark octagon with one hexagonal slice per avatar animation (👋 wave, each of the 4 characters' own action with temporary props — screwdriver on the spacecraft, portable antenna on the ground, sample collection, field computer —, 🚶 walk, 🧍 idle); the chosen slice turns amber. In first person the camera moves back while the emote plays.
- **Terrain** (`facetTerrain`):
  - Rows of vertices from a silhouette profile (a list of x, y points) down to the base, denser near the horizon.
  - Quads split along alternating diagonals.
  - Tone by distance (far = lighter) and by the triangle's orientation.
- **Astronaut:**
  - Flat polygons with tone classes: `s1–s3` suit, `c1–c2` character colour, `v1–v3` visor, `d1` dark equipment.
  - Light from the left: the left side of the body in `s1`, the right in `s2/s3`.
  - Stands on a hexagonal pedestal with a top face and a front face.
- **Stars:** small diamonds in cream, pink and lilac, blinking slowly.

## 7. Motion

| What | How |
|---|---|
| Screen change, opening a dialog | Diagonal wipe with `clip-path`, 0.4 to 0.55 s, `cubic-bezier(.7,0,.2,1)` |
| Gauge changing | Width in steps (`steps(10)`) |
| Danger | 2-step blink, 1 s |
| Hover | Shift 2 to 4 px or change tone. No growing shadow |
| Planet selection | Hexagonal reticle turning (14 s per turn) |
| Ambient | The menu's Mars floats 14 px; the refuelling ship orbits an octagon |

`prefers-reduced-motion: reduce` turns off every animation and stops the orbits. The screen stays complete and static.

## 8. Checklist for a new screen

- [ ] Only colours from the table in section 2 (or facet tones derived from them).
- [ ] No `border-radius`, `blur`, `backdrop-filter`, outer `box-shadow` or smooth gradient.
- [ ] Titles in uppercase Chakra Petch; text in Barlow.
- [ ] Main action in orange with dark text; selection in amber.
- [ ] Visible focus on every clipped control.
- [ ] Tested at 1440 px and 390 px wide and with reduced motion.

## Demo menu

The menu shows the title ASTRO ROMANA, the Play and Settings buttons stacked, and the demo version in the footer (currently v0.1.0).
