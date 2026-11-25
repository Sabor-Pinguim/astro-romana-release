# Radiation soundscape

The game's background sound is generated from **real radiation measurements** taken by the RAD detector on the Curiosity rover, on the surface of Mars. What the player hears follows what the instrument measured.

- **Data and sources:** [references/datasets/msl-rad/](../references/datasets/msl-rad/README.md)
- **Generator:** `tools/audio/` (rules in [tools/audio/AGENTS.md](../tools/audio/AGENTS.md))
- **Generated files:** `assets/audio/`, with the `manifest.json`

The audio is generated **ahead of time**, outside the game. The game only plays the files and sets the volume, so everything works the same in the web version.

---

## The sounds

### Surface ambience: `rad_surface_bed.wav` (40 s loop)

Four quiet sols (1 to 5 May 2024) compressed into 40 s, that is, one sol every 10 s.

| Data | Sound |
|---|---|
| Smoothed dose from detector B (slow trend) | Brightness of the drone and how many notes of the chord sound: more dose, a more open chord |
| The same curve | Cutoff and volume of the background hiss. You can hear the cycle of each sol, because the dose changes with air pressure through the day |
| Each reading well above the trend (> 1.25 standard deviations) | A bell-like note. The bigger the deviation, the higher the note. Detector B (silicon) plays high, on the left; detector E (plastic) plays lower, on the right |

### Solar storm: `rad_storm_2024_05_20.wav` (32 s, plays once)

Forty-eight real hours (20 and 21 May 2024) in 32 s, that is, 1 s = 1.5 h. It is the largest radiation event Curiosity has recorded: the dose rose ~79-fold in under an hour.

| Data | Sound |
|---|---|
| Measured dose (linear between readings) | Click rate (a built-in, discreet Geiger counter): 0.4 per second before the event, proportional to the dose after it (~31 per second at the peak) |
| Dose on a log scale | Volume and brightness of the noise, dissonance and flutter of the drone |
| The largest jump between two readings | The deep impact, at ~3.7 s |

It plays over the ambience, in the same key (D).

### Geiger counter: `geiger_click_1…4.wav`

The game fires the clicks:

- **Rate:** `clicksPerSecondAtQuiet × dose / quietDoseRateUgyPerDay`, capped at `maxClicksPerSecond`. The numbers are in the `manifest.json`: the quiet dose is real, and the click rate is `game-balance`.
- **Intervals:** random (exponential draw), as in a real counter.
- **Variety:** pick one of the 4 clicks at random each time.

---

## How the game should use them

- **Surface of Mars:** `rad_surface_bed` on loop. The loop is already marked in the WAV, with no import settings.
- **Storm event** (for example, the M-S5 "Shelter!" minigame):
  - play `rad_storm_2024_05_20` over the ambience;
  - optionally, lower the ambience by ~6 dB while it plays;
  - to sync the dose meter and the clicks with the sound, use `stems[1].envelope`: the dose (µGy/day) every `stepS` seconds of the file.
- **Multiplayer:** the dose is game state and the host decides it (see [multiplayer.md](multiplayer.md)). The sound is local: each client plays its own from the state it receives.
- **Web:** the game only plays the finished WAVs and sets the volume; no real-time synthesis or effects.

---

## "Real fact" card (ready to use)

> "On 20 May 2024, a solar storm made the radiation measured by the Curiosity rover, on the surface of Mars, rise about 79-fold in under an hour."

**Source:** RAD detector, `MSL_RAD_OBS-L2` data (NASA SPDF). Calculated in [references/datasets/msl-rad/](../references/datasets/msl-rad/README.md): from 92.8 to 7,295.7 µGy/day; last normal reading at 05:22 UTC and peak at 06:15 UTC.

The press figures ("8,100 micrograys") do not match the data. Check the ⚠ marks in the README before using them.

---

## What is missing

- **Game integration:** `index.html` plays the ambience and the clicks on the surface (`radAudio`), and the storm once at the solar storm event on the way to Mars (`radAudio.storm`, [rocket-consequences.md](rocket-consequences.md)). The dose meter is not synced to `stems[1].envelope` yet.
- **Trip to Mars:** CDAWeb has no RAD data from the cruise (2011–2012). If the game wants a cruise sound, the data has to come from the PDS archive.
- **Listen and tune:** validation checks format, volume and the loop seam, not whether it sounds good. The volumes and the key are `game-balance` and can change freely.
