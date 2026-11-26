# Experiments and Minigames by Character

For each character in [characters.md](../characters/characters.md), this document picks the **real experiments** that match their specialty. The experiments are split between **orbit** (done from Mars orbit) and **surface** (done after landing), and each one becomes a **simple minigame**.

Every number comes from real missions. The full data and the sources are in:

- [mars-experiments.md](../references/experiments/mars-experiments.md): the Mars catalog. The codes in backticks, such as `EN10`, point there.
- [experiments.md](../references/experiments/experiments.md): the general history.
- [minigames/](../references/experiments/minigames/): specification of the 3D models and animations of each MVP surface minigame (H-S1, L-S1, O-S1, M-S1), in the same format as the rocket parts ([_template.md](../references/experiments/minigames/_template.md)).

---

## General rules

1. **Each experiment has a real cost.** It weighs on the launch (**mass**), uses **power** when it runs and generates **data** that has to be transmitted. This is what forces the team to negotiate (see the matrix in [characters.md](../characters/characters.md)).
2. **The owner of the experiment plays the minigame.** The result affects the other characters' resources.
3. **The result is worth 0 to 3 stars**, which multiply the reward (science points, data, power, etc.).
4. **Failure has a consequence inspired by a real case**, never just "game over".
5. **At the end, a "Real fact" card appears** explaining what happened on the real mission. This meets the educational goal of the challenge ([description.md](description.md)): explaining *why* a decision affects the mission.
6. **Orbit experiments are only available with an orbiter.** Surface experiments need a lander or rover, and therefore go through the landing.

---

## Summary

The **MVP candidate** column marks 1 orbit minigame and 1 surface minigame per character, 8 in total.

| ID | Character | Where | Experiment | Real basis | Mechanic | MVP candidate |
|---|---|---|---|---|---|---|
| H-O1 | Helena | Orbit | Aerobraking | MRO, TGO | Keep in range | Yes |
| H-O2 | Helena | Orbit | Roll for the radar | MRO (2025) | Piloting | No |
| H-S1 | Helena | Surface | Escort route | Scouting / Ingenuity | Route planning | Yes |
| H-S2 | Helena | Surface | Precision landing | Perseverance (TRN) | Choice under a limit | No |
| L-O1 | Lucas | Orbit | Roll-out solar array | ROSA / iROSA | Timing | Yes |
| L-O2 | Lucas | Orbit | Keep the detector cold | CRISM (MRO) | Keep in range | No |
| L-S1 | Lucas | Surface | Oxygen oven | MOXIE | Keep in range | Yes |
| L-S2 | Lucas | Surface | Drilling | Curiosity's drill, HP3 | Timing (rhythm) | No |
| O-O1 | Oscar | Orbit | Laser to Earth | DSOC (Psyche) | Aim | Yes |
| O-O2 | Oscar | Orbit | Image compression | Kepler, Galileo | Choice under a limit | No |
| O-S1 | Oscar | Surface | Orbiter pass | UHF relay (Electra) | Choice under a limit | Yes |
| O-S2 | Oscar | Surface | Radio geodesy | RISE (InSight) | Keep in range | No |
| M-O1 | Maya | Orbit | High-resolution photo | HiRISE (MRO) | Timing | Yes |
| M-O2 | Maya | Orbit | Ice radar | SHARAD (MRO) | Pattern search | No |
| M-O3 | Maya | Orbit | Methane hunter | NOMAD/ACS (TGO) | Pattern search | No |
| M-S1 | Maya | Surface | Biosignature hunter | PIXL + SHERLOC | Pattern search | Yes |
| M-S2 | Maya | Surface | Laser on rocks | SuperCam / ChemCam | Aim | No |
| M-S3 | Maya | Surface | Listening for marsquakes | SEIS (InSight) | Pattern search | No |
| M-S4 | Maya | Surface | Choosing samples | Perseverance's tubes | Choice under a limit | No |
| M-S5 | Maya | Surface *(crewed)* | Radiation alert | RAD (Curiosity) | Timing | No |
| M-S6 | Maya | Surface *(crewed)* | Martian greenhouse | Veggie, tests in simulated soil | Keep in range | No |

Maya has more options because she is the mission scientist. The "crewed" ones only come in if the scenario has a crew.

---

## Reusable mechanics

The 21 minigames use only **7 base mechanics**. If the mechanics are built as generic components in the game (three.js), each minigame is basically art + parameters.

| Mechanic | How it works | Used in |
|---|---|---|
| **Keep in range** | An indicator drifts on its own; the player corrects it (↑/↓ or a slider) to keep it in the green zone for X seconds | H-O1, L-O2, L-S1, O-S2, M-S6; already built into the pilot's liftoff (`createKeepInRange` in `web/app.js`, 1 or 2 axes): keep the navball target centred in pitch and yaw; the booster fins reduce the gusts |
| **Timing** | A cursor swings; the player presses at the right moment (variant: rhythm) | L-O1, L-S2, M-O1, M-S5 |
| **Aim** | Hold or hit a 2D sight on a moving target | O-O1, M-S2 |
| **Choice under a limit** | Pick items with a size and a value to fit within a limit (time, bandwidth, tubes) | H-S2, O-O2, O-S1, M-S4 |
| **Pattern search** | Find the right signal in the noise: grid, chart or spectrum | M-O2, M-O3, M-S1, M-S3 |
| **Route planning** | Draw a continuous path on a grid connecting landmarks in order without crossing the route | H-S1 |
| **Piloting** | Direct control of a vehicle with a limited resource (battery, fuel) | H-O2 |

The 8 MVP candidates use 6 mechanics (grid route planning replaced the old helicopter piloting in H-S1, which keeps H-O2 out of the MVP).

---

## MVP flight flow

The cockpit flight selects at most one timed intervention from the spacecraft's construction problems. Priority is liftoff (incomplete propulsion, low TWR or missing fins), cabin docking (power deficit), orbital refueling (insufficient Mars transfer capability or a large refill), then landing (neither TRN nor LOFTID). If none applies, every cockpit stage uses its full-screen automatic cutscene. The other stages stay automatic after the selected intervention, including Mars landing; the separate H-S2 experiment may still appear if drawn. An orbital intervention starts with a red warning, a brief typed reason and a zoom into the cockpit; Helena then pilots the six-direction RCS docking task while everyone sees her seated 3D avatar. Easy mode uses automatic cockpit stages. The times, alignment limits and penalties below are `game-balance`; the parts used to build the spacecraft still come from `references/parts/`.

| Stage | Owner | Minigame | Consequence |
|---|---|---|---|
| 01 · Liftoff & Max-Q | Helena | keep the navball target centred on two axes; the duration follows the liftoff TWR (15 s at TWR 1.5; proportional to 1/√(TWR − 1), between 9 and 30 s): more thrust per tonne, a shorter climb | a bad ascent creates an extra breaker trip at separation. Without an engine that can light in stage 1 (no engine, no tank or a mismatched propellant) or with a TWR below 1.0, the rocket does not leave the pad: the mission fails, the debrief shows the cause and the podium stays empty. If the total Δv does not reach orbit (9,400 m/s), the crew aborts at MECO: the capsule comes down under parachutes into the sea and the mission fails |
| 02 · Cabin docking | Helena | align the cabin hatch in 3D on the centre monitor with `← →` (`A/D`), `↑ ↓` and `E/Q` (`W/S`), without using up all the fuel | a failure shows a red X, costs points and moves on to the next stage |
| 03 · Orbital docking | Helena if manual; otherwise automatic | six-direction RCS docking in the cockpit after the warning; the normal flight shows the full-screen exterior refueling cutscene | a missed window uses an automatic capture with a penalty. If even with a full tank the rocket cannot reach the 4,300 m/s of the transfer, the crew returns to Earth: the capsule comes down under parachutes into the sea and the mission fails |
| 04 · Mars landing | Helena | repeat the liftoff navball during the landing on Mars | little time in the band lowers the mission score |

**Assembly rules that stop the mission** (the same as the planner's telemetry):
- **Liftoff:** needs an engine in stage 1 that lights (with a tank of the same propellant) and a TWR of at least 1.0.
- **Upper stages:** need a vacuum TWR of at least 0.3 at ignition (`minUpperStageTwr`, `game-balance`, estimated from Centaur-class stages). A weaker stage does not light: it becomes dead weight, like an incomplete stage, and the catalog shows the TWR each engine and tank would give.
- **Δv:** must reach orbit and, after refuelling, make the transfer. When it falls short, the launch review warns ("This rocket will not reach orbit" or "cannot reach Mars") and the button becomes "Launch anyway".

**Cockpit telemetry** (`updateTelemetry` in `web/app.js`), consistent with the rocket that was built and with the real order of a flight:
- **Ascent:** the speed follows the Δv spent by the rocket that was built (Tsiolkovsky, stage by stage) and reaches 7,670 m/s in a 400 km orbit (`derived`: √(GM/r)). The altitude is a game curve. Stage 01 empties stage 1. The first 6 s of stage 02 finish the climb with the upper stage. The propellant reading is that of the tank of the stage that is burning.
- **Orbit:** engines off. Refuelling fills the tank of the stage that goes to Mars.
- **Landing:** Perseverance's entry, descent and landing (EDL) profile squeezed into the minigame, with real data from `references/experiments/mars-experiments.md`. Entry at 125 km and 19,500 km/h; parachute at 11 km and 1,512 km/h; retrorockets from 2.1 km; touchdown at ~0 m/s. The descent tank is only used by the retrorockets.
- **Radiation:** only appears at Mars, with Curiosity RAD's real median for a quiet period (165 µGy/day, detector E). Mars only appears in the window during this stage.

---

## 1. Helena: Commander and Pilot

**Resources:** Mass, Orbit, Budget. Her experiments are **maneuvers and flights**: technologies that were really tested at Mars.

### Orbit

#### H-O1 · Aerobraking (MVP candidate)
- **Real basis:** MRO (2006) and TGO (2017–18) · `EN10`
- **What it is:** using the drag of Mars's atmosphere to slow the spacecraft and lower its orbit, instead of spending fuel.
- **Minigame "Dive"** *(keep in range)*:
  - On each pass through the lowest point of the orbit, Helena adjusts the altitude of the dive.
  - A bar shows heat × braking: too deep heats the spacecraft, too shallow barely brakes.
  - There are 5 passes.
- **Success:** saves propellant, which frees mass for instruments (helps Maya).
- **Failure:** overheating, which takes integrity away from the spacecraft (a problem for Lucas); or the mission needs more passes, which costs time.
- **Cost:** no extra mass; it costs **time**.
- **Real fact:** "MRO made ~400 dives over ~5 months. Each one slowed it by ~2 m/s and saved ~1 kg of fuel. In total, that was ~600 kg less to carry."

#### H-O2 · Roll for the radar
- **Real basis:** in Nov 2025 MRO rolled 120° so the SHARAD radar could look from another angle at the supposed "lake" under the south polar ice · `PH7`
- **Minigame "Precise turn"** *(piloting)*:
  - Turn the spacecraft to the requested angle using few thruster pulses.
  - Hold it steady during the measurement window.
  - Overshooting the angle spends fuel to correct.
- **Success:** Maya gets radar data from a special target (bonus in M-O2).
- **Failure:** wasted fuel, which shortens the mission's lifetime.
- **Cost:** fuel (mass).
- **Real fact:** "With the roll, the radar saw only a faint echo at the 'lake' site. The 2018 discovery became very hard to support: in science, better data can overturn conclusions."

### Surface

#### H-S1 · Escort route (Surface scouting, MVP candidate)
- **Real basis:** planning traverse routes on Mars with support from aerial scouting (*Ingenuity*, `EN9`, 72 flights and 17 km flown between 2021 and 2024).
- **Minigame "Escort"** *(route planning on a 5×5 grid)*:
  - Draw a continuous escort route through the safe sectors of the 5×5 grid, visiting the waypoints in sequence, marked with the symbols of the most abundant elements in the Martian crust (`O → Si → Fe → Mg → Ca`), and avoiding the soft sand areas (`⚠`).
- **Success:** sets the crew's safe route across the terrain and reveals science targets for Maya.
- **Failure:** an incomplete route leaves stretches of soft sand without a risk map.
- **Cost:** the team's navigation and scouting time on the surface (relays coordinated with Oscar).
- **Real fact:** "Scouting routes on Mars avoid smooth, featureless sand ripples: Ingenuity was planned for 5 flights and made 72 (17 km in total), ending in Jan 2024 when its navigation camera lost visual reference over smooth sand on flight 72."

#### H-S2 · Precision landing
- **Real basis:** Perseverance's Terrain Relative Navigation (2021) · `EN4`
- **Minigame "Find the safe spot"** *(choice under a limit)*:
  - During the descent, an image of the terrain appears.
  - Helena has **10 seconds** to pick a spot without rocks or craters, within diversion range.
- **Success:** lands near the science target, so the rover drives less.
- **Failure:** lands far away, which takes more sols of driving; a dangerous spot gives a chance of damage.
- **Cost:** low; it is a software and camera system.
- **Real fact:** "Perseverance landed ~5 m from its target; the requirement was 60 m. The system decides on its own in under 10 s, because the whole landing takes 7 min and a signal takes ~11 min to reach Earth."
- **Suggestion:** this minigame could be the **mandatory landing phase** of every surface mission, instead of an optional experiment.

---

## 2. Lucas: Systems Engineer

**Resources:** Power, Lifetime / Integrity. His experiments are about **power, heat and mechanics**.

### Orbit

#### L-O1 · Roll-out solar array (MVP candidate)
- **Real basis:** ROSA (ISS test in 2017) and iROSA (ISS, 2021–23); DART used ROSA · `E5`
- **Minigame "Unroll"** *(timing)*:
  - The array opens in steps.
  - Lucas presses when the tension is in the right zone: too early and the array jams, too late and it rolls out crooked.
- **Success:** more power generated (Watts for everyone).
- **Failure:** the array jams partway, with less power; fixing it takes a repair action.
- **Cost:** array mass; no power (it *generates* power).
- **Real fact:** "In the 2017 test on the ISS, ROSA opened but could not close and was jettisoned. The improved version now increases the station's power by ~30%. At Mars, the Sun delivers only 43% of the energy that reaches Earth."

#### L-O2 · Keep the detector cold
- **Real basis:** CRISM, MRO's mineral spectrometer, had coolers that wore out by 2017; the instrument was retired in 2023 · `GE8`
- **Minigame "Cryogenics"** *(keep in range)*:
  - During Maya's observations, Lucas keeps the detector in the cold band, splitting power between the cooler and the rest of the spacecraft.
  - Pushing the cooler raises the **wear** gauge.
- **Success:** Maya gets a bonus on the mineral map.
- **Failure:** a noisy image; accumulated wear shortens the instrument's life.
- **Cost:** CRISM weighed 32.9 kg and drew 44–47 W.
- **Real fact:** "CRISM mapped 86% of Mars and helped choose the landing sites of Curiosity and Perseverance. Its end came from cooler wear, not from the camera."

### Surface

#### L-S1 · Oxygen oven (MVP candidate)
- **Real basis:** MOXIE, on Perseverance (2021–23) · `EN1`
- **Minigame "Make oxygen"** *(keep in range)*:
  - Heat the reactor to ~800 °C and keep it in the green zone.
  - Too hot damages the cell; too cold produces nothing.
  - The battery drains during operation.
- **Success:** grams of O₂, which count towards the "prepare for human arrival" goal.
- **Failure:** cell damage, with lower output in the following runs.
- **Cost:** **17.1 kg and 300 W**, the highest power draw on the list; it competes for power with Maya's instruments.
- **Real fact:** "MOXIE produced 122 g of oxygen in 16 runs, with a peak of 12 g/h, twice the goal. It was the first time a resource was made from the air of another planet."

#### L-S2 · Drilling
- **Real basis:** Curiosity's drill (holes up to 5 cm, 2 spare bits) and InSight's HP3 "mole", which failed · `GE6`, `G9`
- **Minigame "Drill without breaking"** *(timing / rhythm)*:
  - Press at the peak of each drill stroke.
  - Too much force breaks the bit (there are only 2 spares); too little does not advance.
  - Sometimes the ground is **treacherous**: the drill does not advance at the normal rhythm and the strategy has to change (push with the arm).
- **Success:** produces a sample (rock powder or a core) that Maya uses in M-S4.
- **Failure:** a broken bit, or a shallow hole that gives a worse sample.
- **Cost:** the robotic arm is busy (none of Maya's arm instruments can run at the same time).
- **Real fact:** "InSight's mole needed to go 3–5 m deep, but stopped at ~37 cm: the soil gave it no friction. The team tried for 2 years, even pushing with the robotic arm."

---

## 3. Oscar: Data and Telecom Specialist

**Resources:** Data, Communications. His experiments are about **transmission, compression and radio**.

### Orbit

#### O-O1 · Laser to Earth (MVP candidate)
- **Real basis:** DSOC, laser communication tested on the Psyche spacecraft (2023–25) · `EN13`
- **Minigame "Steady beam"** *(aim)*:
  - Keep the laser sight on the station on Earth while the spacecraft vibrates.
  - The greater the Earth–Mars distance at that moment, the harder it is (and the lower the rate).
  - Clouds passing over the station cut the signal.
- **Success:** empties the onboard memory, transmitting Maya's data.
- **Failure:** data stays stuck in memory.
- **Cost:** mass and power of the laser terminal (game value; the real numbers were not published).
- **Real fact:** "DSOC's laser transmitted 267 Mbps from 31 million km, but only ~8 Mbps from ~400 million km. Communication gets much worse with distance."

#### O-O2 · Image compression
- **Real basis:**
  - Kepler did not have the bandwidth to send whole images and only sent the pixels around the chosen stars · `A2`
  - Galileo saved its mission by compressing data after its main antenna failed · `CD1`
- **Minigame "Smart crop"** *(choice under a limit)*:
  - A photo from Maya arrives too heavy.
  - Oscar selects the regions that contain the science targets.
  - Fewer pixels save data, but cropping out a target loses science.
- **Success:** the same science with much less data (matches the *Smart Compression* perk).
- **Failure:** targets cropped out, with less science.
- **Cost:** processing (little power).
- **Real fact:** "A single HiRISE image can be up to 28 Gb, more than a rover sends in several days. Kepler and Galileo proved that choosing *what* to send is worth as much as having a bigger antenna."

### Surface

#### O-S1 · Orbiter pass (MVP candidate)
- **Real basis:** UHF relay (Electra), the network of orbiters that relays the rovers' data · `EN11`, [current fleet](../references/experiments/mars-experiments.md#22-relay-capacity-how-surface-data-gets-home)
- **Minigame "Contact window"** *(choice under a limit)*:
  - The orbiter passes overhead for a few seconds.
  - Data packets from the experiments arrive in a queue, each with a size and a priority.
  - Oscar chooses which ones to send before the window closes.
- **Examples of packets with real sizes:**
  - Mastcam-Z camera: ~148 Mb
  - Seismometer: 38 Mb/day
  - PIXL: ~16 Mb
  - SuperCam: 15.5 Mb
- **Success:** the science reaches Earth and scores points.
- **Failure:** the memory fills up and experiments stop.
- **Event:** "Orbiter lost" reduces the number of windows per sol.
- **Real fact:** "A rover spends ~12 h a day without a line of sight to Earth. Perseverance sends >1 Gbit per sol over 4–5 orbiter passes. In 2025 NASA lost MAVEN, and every surface mission lost ~0.9 Gb/day of capacity."

#### O-S2 · Radio geodesy
- **Real basis:** RISE, on the InSight lander (2018–22) · `PH3`
- **Minigame "Tune the Doppler"** *(keep in range)*:
  - A radio tone slides slowly because of Mars's motion.
  - Oscar turns the tuner to keep the signal locked.
  - The locked time adds up over the sols.
- **Success:** after many sols, reveals the size of Mars's core (a big science bonus).
- **Failure:** a lost session; the experiment takes longer.
- **Cost:** 7.3 kg; **78 W for up to 1 h/day**; needs a direct link to Earth.
- **Real fact:** "Only by tracking InSight's radio for ~900 sols did scientists measure that Mars's liquid core has a radius of ~1,835 km and that the planet's rotation is speeding up."

---

## 4. Maya: Mission Scientist and Medical Officer

**Resources:** Science Value, Crew Safety. Her experiments are the **science instruments**: geology and astrobiology, and medicine on crewed missions.

### Orbit

#### M-O1 · High-resolution photo (MVP candidate)
- **Real basis:** HiRISE, MRO's camera (2006–today) · `GE7`
- **Minigame "Perfect shot"** *(timing)*:
  - The surface of Mars scrolls below the spacecraft.
  - Maya takes the photo when the target (crater, delta, dunes) passes the centre of the frame.
  - Dust storms can blur the image.
- **Success:** images that unlock landing sites and targets for the rover.
- **Failure:** a blurred photo, which wastes data.
- **Cost:** **65 kg, 60 W**, and each photo is **huge in data** (pressure on Oscar).
- **Real fact:** "HiRISE sees 30 cm details from orbit and took its 100,000th photo in 2025. Its images help choose where to land safely."

#### M-O2 · Ice radar
- **Real basis:** SHARAD, MRO's radar · `PH7`
- **Minigame "Read the radargram"** *(pattern search)*:
  - In the chart of radar echoes, find the line of buried ice in the noise.
  - Side echoes from the relief are misleading.
- **Success:** reveals ice on the map. This unlocks landing sites for humans and future water extraction.
- **Failure:** a false positive (marks ice where there is none).
- **Cost:** 15 kg, 10 W; generates **40–90 Gb/day**.
- **Real fact:** "Under the Utopia plain, SHARAD found buried ice holding as much water as Lake Superior, in the USA (~14,300 km³)."

#### M-O3 · Methane hunter
- **Real basis:** the NOMAD and ACS spectrometers on the TGO orbiter · `BI3`
- **Minigame "Gas fingerprint"** *(pattern search)*:
  - Only at sunrise or sunset, as seen from orbit, does light pass through the atmosphere.
  - In that short window, Maya compares the dark lines of the spectrum with the "fingerprints" of the gases (methane, water, hydrogen chloride).
- **Success:** a gas identified, with habitability science.
- **"Conflicting data" event:** the orbiter sees no methane, but the rover does. The team has to decide how to check.
- **Real fact:** "From orbit, TGO finds no methane above 0.05 parts per billion, but on the ground Curiosity measures 0.2–0.7. Nobody knows yet who is right. In Nov 2026 TGO detected gas coming out of the fissures of a volcano, a possible sign of dormant magma."

### Surface

#### M-S1 · Biosignature hunter (MVP candidate)
- **Real basis:** PIXL + SHERLOC, on Perseverance; the "Cheyava Falls" rock (2024–25) · `BI1`, `GE3`, `B14`
- **Minigame "Leopard spots"** *(pattern search)*:
  - The rock is a grid.
  - Each scanned cell costs time and power; clue colours point to the chemistry.
  - Maya has to find the hidden spots before time runs out.
- **Success:** "possible biosignature", the highest science score in the game, but only **if the sample is stored** (M-S4).
- **Failure:** the rock stays unanalysed.
- **Cost:** the robotic arm is busy; PIXL 6.9 kg / 25 W + SHERLOC 4.72 kg / **48.8 W**.
- **Real fact:** "In 2025 NASA announced that spots on the Cheyava Falls rock are a 'possible biosignature'. To confirm it, the sample has to come to Earth, but the return mission was cancelled."

#### M-S2 · Laser on rocks
- **Real basis:** SuperCam (Perseverance) and ChemCam (Curiosity) · `GE2`
- **Minigame "Sharp shot"** *(aim)*:
  - Hit small spots on a rock several metres away.
  - The first shots only clear the dust; the next ones read the chemistry.
- **Success:** the rock's composition, quickly and without using the arm.
- **Failure:** shots wasted on dust.
- **Cost:** 10.6 kg, 17.9 W, 15.5 Mb per experiment.
- **Real fact:** "Curiosity's laser has fired more than 1 million times, although it was designed for 2 years. It reads rocks more than 7 m away."

#### M-S3 · Listening for marsquakes
- **Real basis:** SEIS, on the InSight lander (2018–22) · `PH2`
- **Minigame "Seismogram"** *(pattern search)*:
  - On the seismograph trace, mark the marsquakes and ignore the gusts of wind.
  - At night the wind drops and it gets easier.
- **Success:** recorded marsquakes, which reveal the planet's interior.
- **Failure:** wind marked as a marsquake (false data).
- **Cost:** ~29.5 kg (to be confirmed), ≤8.5 W, 38 Mb/day. Only works on a **stationary lander**.
- **Real fact:** "InSight recorded 1,319 marsquakes and found that Mars's core is liquid, with a radius of ~1,830 km."

#### M-S4 · Choosing samples
- **Real basis:** Perseverance's 43 sample tubes · `GE6`, `G8`
- **Minigame "Which rocks to keep?"** *(choice under a limit)*:
  - The tubes are few and cannot be reused.
  - Maya chooses among the samples Lucas drilled (L-S2), each with clues about what it contains.
  - The real value of each one only shows at the end of the mission.
- **Success:** keeps the highest-value samples (including the biosignature from M-S1).
- **Failure:** tubes spent on ordinary rocks.
- **Real fact:** "Perseverance collected 27 rock cores and left a depot of 10 backup tubes on the ground of Mars. In 2026 the mission to bring them back was cancelled. Today they wait for a future mission."

#### M-S5 · Radiation alert *(crewed mission)*
- **Real basis:** Curiosity's RAD detector · `PH1`
- **Minigame "Shelter!"** *(timing)*:
  - When the solar storm alert comes, Maya decides when to send the crew to the shelter.
  - Too early loses tasks; too late and the crew takes a high dose.
- **Success:** the crew is safe.
- **Failure:** a radiation dose above the limit (health −).
- **Cost:** 1.56 kg, 4.2 W.
- **Real fact:** "On the surface of Mars the dose is ~0.67 mSv per day, and during the trip ~1.8 mSv per day. A human mission of ~500 days would build up ~1 Sv."

#### M-S6 · Martian greenhouse *(crewed mission)*
- **Real basis:** the Veggie/APH greenhouses on the ISS and tests with simulated Martian soil · `BI7`
- **Minigame "Make it sprout"** *(keep in range)*:
  - Keep water and light in the right band for several sols.
  - Too much or too little watering kills the plants.
- **Success:** fresh food, which reduces the mass of food to carry and improves crew health.
- **Failure:** the seeds do not germinate.
- **Cost:** ~70 W, water and crew time.
- **Real fact:** "In the first harvest on the ISS, seeds did not germinate and plants died of thirst. The first space lettuce was only eaten in 2015. No plant has ever grown in real Martian soil, only in imitations of it on Earth."

---

## 5. Cooperation chains

These links make one character's minigames depend on the others. It is the "domino effect" the challenge asks for.

```text
Helena H-O1 (aerobraking) ──► saves mass ──► more instruments for Maya
Helena H-O2 (roll) ─────────► special target on Maya's radar (M-O2)
Helena H-S1 (escort) ───────► secures a safe route ──► Maya chooses where to investigate
                         └──► depends on the rover relay (Oscar's bandwidth)
Lucas  L-O1 (array) ────────► power for every experiment
Lucas  L-O2 (cooler) ───────► keeps Maya's spectrometer alive
Lucas  L-S1 (MOXIE, 300 W) ─► competes for power with Maya's instruments
Lucas  L-S2 (drill) ────────► produces samples ──► Maya chooses tubes (M-S4)
Maya   M-O1, M-O2 (image, radar) ──► generate huge data ──► Oscar has to transmit it
Maya   M-S1 (biosignature) ──► only counts if stored in a tube (M-S4)
Maya   M-O2 (ice) ──► unlocks landing sites for a crewed mission
Oscar  O-O1, O-S1 (laser, relay) ──► turns everyone's data into points
Oscar  O-O2 (compression) ──► reduces the size of Maya's photos
```

---

## 6. Suggested next steps

1. Decide whether the main scenario is **robotic** or **crewed**. This decides whether M-S5 and M-S6 come in.
2. Validate the MVP candidates with the team.
3. Prototype the base mechanics in the game (starting with **keep in range** and **choice under a limit**, which cover 9 minigames).
4. Write the final texts of the "Real fact" cards. Values marked as uncertain in the catalog must be checked first.
