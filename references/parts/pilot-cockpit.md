# First-Person Pilot Control Panel (`pilot-cockpit.md`)

> **Model redone on 2026-11-15** on the real Orion layout (3 display units, 7 switch panels, hand controllers), and **on 2026-11-24** as the full crew cabin: four reclined seats, two over two, a camera per seat (`Camera_Seat_1..4`). The current model spec, with sources and images, is [cockpit/cockpit-pilot/README.md](cockpit/cockpit-pilot/README.md); the archetypes below are the earlier design notes.

Real spacecraft cockpit references, human-factors layout analysis, and low-poly 3D model specification for the **First-Person Pilot Control Panel** (`assets/models/rocket/cockpit_pilot.glb`) used in **Phase 5 (Launch & Orbit Insertion)** and **Phase 6 (Orbital Refueling, Transit Emergencies & Mars Landing)** — see [docs/resources/space-mission-game-transcricao-organizada.md](../../docs/resources/space-mission-game-transcricao-organizada.md) §7–§8.

---

## 1. Visual & Historical Reference Synthesis

The pilot's first-person view blends **three complementary reference archetypes** (matching the team's visual references) with real NASA flight-deck engineering:

| Reference | Core Visual Elements | What We Take for the 3D Cockpit |
|---|---|---|
| **1. Space Shuttle Orbiter — Aft Flight Deck (`AFD`, panels A6/A7/A8) & Forward `MEDS` Glass Cockpit** *(Real NASA photo)* | Sloped 3-bay grey switch desk (`~2,000+` switches/breakers in forward deck), central vertical **Rotational Hand Controller (`RHC`)** + square **Translational Hand Controller (`THC`)**, central backlit **Caution & Warning (`C&W`) annunciator tile matrix**, blue `"Warning"` plaque, **upper-left canted CCTV monitor**, and **twin forward + twin overhead viewing windows** framed by white structural ribs. | Primary structural silhouette of the lower desk, physical switch/breaker banks, central `RHC`/`THC` sticks, `C&W` fault matrix, upper-left external booster CCTV monitor, and twin forward + overhead window frames. |
| **2. Wrap-Around 3-Wing Command Bridge** *(Simulator / Sci-Fi Bridge photo)* | **3-wing U-shaped console** (angled left wing `+25°`, raised center MFD radar/attitude pedestal, angled right wing `−25°`), recessed red/amber warning light wells, overhead louvered air vents with central status display, and a wide forward viewport. | Ergonomic **wrap-around 3-wing desk geometry** that fills the 1st-person camera FOV naturally, recessed red emergency glow strips when alarms fire, and top ventilation grilles. |
| **3. Stylized First-Person Cockpit Dashboard** *(Vector Bridge illustration)* | Framing by **left & right pilot/copilot seats**, wide **3-zone primary instrument hood** (left circular **attitude/alignment reticle**, center **vertical system bars**, right **real-time ascent trajectory curve**), and a front pedestal with twin control levers and large tactile red buttons. | Clear, instant-read **3-screen telemetry layout** (Attitude Reticle · Resource/Engine Bars · Ascent Trajectory Curve) and oversized color-coded physical levers/buttons readable at a glance during chaotic minigames. |
| **4. NASA Apollo `MDC`, Orion `MPCV` (`3 DUs`) & SpaceX `Crew Dragon`** *(Real NASA / Commercial)* | Apollo **FDAI "8-Ball"** attitude indicator & guarded stage-separation switches; Orion **`3` Display Units (`DUs`)** with tactile bezel keys (`~57` critical switches ⚠, `120 VDC` bus); Crew Dragon ** booster engine-ring graphic** (showing individual engines lighting or failing during ascent). | Real launch telemetry semantics: **TWR**, **$\Delta v$**, **G-load**, **Stage Engine Ring**, guarded **Stage Separation / Abort** switches, and `120 VDC` breaker trips. |

---

## 2. How the Cockpit Translates Rocket Build Choices into Phase 5–6 Gameplay

Per [space-mission-game-transcricao-organizada.md](../../docs/resources/space-mission-game-transcricao-organizada.md) §5.4, §7.1, §7.2, and §12, the rocket built in Phases 3–4 directly drives what happens on this panel during launch:

| Build Condition (Phase 3–4) | What Happens on the Pilot Panel (Phase 5–6) | Interactive Nodes / Minigame Hook |
|---|---|---|
| **Overweight Rocket / Low Liftoff TWR (`1.0 ≤ TWR < 1.2`)** | High structural vibration; red `OVERWEIGHT / LOW TWR` tile lights on the `C&W` matrix; a `120 VDC` breaker pops on the Left Wing with **`FX_Sparks_Left`**; ascent trajectory line on `Screen_Right` droops below target corridor. | Pilot must hold pitch on `Screen_Left` with `Joystick_RHC` while resetting tripped `Breaker_1..4` and firing `Stage_Sep_Switch` at the exact burnout window. |
| **Electric-Pump Booster (`rutherford`) or High Power Draw (`powerW < 0`)** | Battery/bus bar in the center display drains rapidly during the 3-minute ascent burn; amber `MAIN BUS UNDERVOLT` tile flashes. | Requires shedding non-essential cabin loads on the Left Wing switches before bus voltage collapses. |
| **Clustered Booster Engines (`9× merlin-1d`, `3× raptor`, `4× rs-25`)** | Center screen displays the active engine cluster ring; an engine-out anomaly extinguishes one ring sector and induces yaw drift. | Pilot compensates roll/yaw (`H-O2` / ascent steering) using `Joystick_RHC` and `Throttle_Lever`. |
| **Phase 6 Mandatory Orbital Refueling (`cabin-idss-docking`)** | Forward windows show the tanker docking target; `Screen_Left` switches to the IDSS alignment crosshairs; `Monitor_CCTV` shows umbilical latch view. | Pilot uses `Controller_THC` + `Joystick_RHC` to align and latch cryo umbilicals (`H-O1`). |
| **Phase 6 Transit Events (`P8` Cooling Pump, `P10` Solar Storm, `E5` Solar Wing)** | Master Warning (`Alarm_Master_Red`) flashes; `FX_Sparks_Right` or overhead vent smoke (`FX_Vent_Smoke`) triggers; `HERA` radiation bar spikes. | Directs crew to trigger `cabin-storm-shelter` (`M-S5`), repair `cabin-pcdu-thermal` (`L-O2`), or arm EDL (`EDL_Arm_Switch`). |
| **Phase 6→7 Mars Entry, Descent & Landing (`edl-trn-medli2`, `edl-aspire-loftid`)** | `Screen_Right` displays heatshield temp (`MEDLI2`) and terrain hazard map (`TRN`); `EDL_Arm_Switch` deploys supersonic chute (`ASPIRE`) and retro-propulsion. | Powers **`H-S2` ("Pouso preciso")** directly from the cockpit view before surface exploration begins. |

---

## 3. 3D Model Architecture & Node Hierarchy (`cockpit_pilot.glb`)

### 3.1 Coordinate & Camera Conventions
Follows [AGENTS.md](../../AGENTS.md) §5:
- **Units:** meters (`+Y` up, `+Z` toward the rear of the cabin, **`−Z` forward out the windshield** — the three.js camera forward vector).
- **Origin `(0, 0, 0)`:** cockpit floor directly underneath the **Pilot's 1st-Person Seat / Camera Rig**.
- **Pilot Eye Point (`Camera_Pilot` anchor):** `(0, 1.18, 0.38)` looking forward/slightly down at `(0, 0.88, −0.55)` (`FOV ≈ 65°–75°`). From this exact point, the 3-wing console, the 3 main screens, the upper-left CCTV monitor, the forward/overhead windows, and the flanking seat headrests frame the screen just like References 1, 2, and 3.
- **Envelope:** `width = 2.10 m` (`x ∈ [−1.05, +1.05]`), `height = 1.65 m` (`y ∈ [0.00, 1.65]`), `depth = 1.40 m` (`z ∈ [−0.85, +0.55]`).
- **Budget:** `≤ 2,200 triangles`, `≤ 35 meshes`, flat-shaded palette materials only (`createPartsPalette()`), zero textures.

### 3.2 Interactive Node Tree (Named Pivots for Animation & Raycast Clicking)

```text
CockpitPilot                      origin: (0, 0, 0) cabin floor under pilot station
├─ Camera_Pilot                   (0, 1.18, 0.38)  1st-person Camera3D mount (looks toward -Z)
├─ Shell_Cabin                    curved inner frame, 2 forward windows, 2 overhead windows, seats
├─ Monitor_CCTV                   (-0.56, 1.18, -0.48) canted upper-left Shuttle AFD external camera monitor
├─ Console_Main                   3-wing wrap-around desk housing + glareshield hood
│  ├─ Screen_Left_Attitude        (-0.34, 0.89, -0.58) FDAI 8-ball / orbital & docking reticle
│  ├─ Screen_Center_Telemetry     ( 0.00, 0.89, -0.60) TWR, Δv, fuel bars, g-meter & engine ring
│  ├─ Screen_Right_Trajectory     ( 0.34, 0.89, -0.58) ascent curve (Alt vs Vel) & TRN landing map
│  ├─ CW_Matrix                   ( 0.00, 0.72, -0.46) 12 backlit Caution & Warning tiles (Shuttle AFD style)
│  ├─ Alarm_Master_Red            (-0.12, 1.02, -0.55) flashing red Master Warning push-button
│  └─ Alarm_Caution_Amber         ( 0.12, 1.02, -0.55) flashing amber Master Caution push-button
├─ Controls_Center                central pedestal between pilot's hands
│  ├─ Joystick_RHC                ( 0.14, 0.75, -0.36) pivots Pitch/Roll/Yaw during launch & H-O1/H-S2
│  ├─ Controller_THC              (-0.14, 0.75, -0.36) square 3-axis translation controller (Shuttle AFD)
│  └─ Throttle_Lever              (-0.28, 0.73, -0.34) pivots X for main booster / landing thrust
├─ Controls_Left_Wing             (+25° angled engineering, power & staging bay)
│  ├─ Breaker_Bank                4 pop-out circuit breakers (trip when overweight / power overload)
│  ├─ Stage_Sep_Switch            guarded red flip-cover switch for stage separation
│  └─ FX_Sparks_Left              (-0.52, 0.78, -0.38) preset: "sparks" (fires when breaker/bus trips)
└─ Controls_Right_Wing            (-25° angled comms, EDL & emergency bay)
   ├─ DSKY_Keypad                 numeric keypad + Verb/Noun telemetry readout
   ├─ EDL_Arm_Switch              guarded orange/silver switch for parachute / HIAD / landing gear
   ├─ Abort_Button                large red guarded emergency button
   └─ FX_Sparks_Right             ( 0.52, 0.78, -0.38) preset: "sparks" (fires on thermal/avionics fault)
```

---

## 4. Sources

1. **NASA Space Shuttle Orbiter Aft Flight Deck & MEDS Glass Cockpit:** NASA NTRS / Shuttle Crew Operations Manual (panels `A6`–`A8`, `RHC`/`THC`, `CCTV`, `C&W` matrix, `MEDS` 9-LCD upgrade).
2. **NASA Orion MPCV Cockpit:** NASA Johnson Space Center (`3` Display Units, RHC, `< 60` physical switches ⚠, `120 VDC` bus). Cited counts (3 display units, 7 switch interface panels, 2 rotational + 2 translational hand controllers, about 60 switches) and other capsules: [crew-cabins.md](crew-cabins.md).
3. **NASA Apollo Command Module Main Display Console (`MDC`):** NASA Apollo Operations Handbook (FDAI 8-Ball, DSKY, C&W annunciator matrix).
4. **SpaceX Crew Dragon Cockpit:** NASA Commercial Crew Program overview (3 central touchscreens, ascent trajectory plot, physical emergency controls).
