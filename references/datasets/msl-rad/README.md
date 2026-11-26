# Curiosity RAD dose rate (MSL RAD Level 2)

Radiation dose rate measured on the surface of Mars by the **Radiation Assessment Detector (RAD)** on NASA's Curiosity rover (Gale crater). These CSVs drive the game's radiation soundscape (`tools/audio/`, output in `assets/audio/`).

## Source

| Field | Value |
|---|---|
| Dataset | `MSL_RAD_OBS-L2`: "MSL/RAD Level 2 observational radiation data" |
| Variable | `DOSIMETRY_TOTAL_f`: quality-filtered dose rate |
| Provider | NASA Space Physics Data Facility (SPDF), CDAWeb |
| Instrument team | D. Hassler (PI), Southwest Research Institute, Boulder |
| Instrument paper | [Hassler et al. (2012), Space Science Reviews](https://link.springer.com/article/10.1007/s11214-012-9913-1) |
| Access | [CDAWeb REST API](https://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/MSL_RAD_OBS-L2/variables) (`npm run audio:fetch`) |
| Also archived at | [PDS PPI node, MSL-M-RAD-3-RDR-V1.0](https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/AAREADME.TXT) |
| Coverage on CDAWeb | 2012-08-17 (after landing) to 2026-11-11 at the time of retrieval |
| Retrieved | 2026-11-14 |
| Use | Public NASA mission data. Credit the MSL RAD team and NASA SPDF/CDAWeb when shown. |

The ISWA quick-look plots of the same instrument are marked "not for analysis or publication". Use this dataset instead.

## Files

| File | Window (UTC) | Rows | Used for |
|---|---|---|---|
| `quiet_2024-05-01.csv` | 2024-05-01 00:00 → 2024-05-06 00:00 | 413 | Surface ambience loop (first 4 sols) |
| `storm_2024-05-20.csv` | 2024-05-19 12:00 → 2024-05-23 00:00 | 370 | Solar storm one-shot (2024-05-20 00:00 → 2024-05-22 00:00) |

| Column | Meaning | Units |
|---|---|---|
| `time_utc` | Observation time from the dataset's `EPOCH` | ISO 8601, UTC |
| `dose_rate_b_si_rtg_corrected_ugy_per_day` | Detector B (silicon), with the rover's MMRTG power source contribution removed (`RTG_CORRECTED_DOSE_B`) | µGy/day |
| `dose_rate_e_plastic_ugy_per_day` | Detector E (tissue-equivalent plastic) (`TOTAL_DOSE_E`) | µGy/day |

- **Processing:** rows with the CDAWeb fill value (−1×10³¹) are dropped. Nothing else is changed.
- **Cadence:** one observation about every 16 to 17 minutes; ~27 minutes during the storm.

## Values (derived from these files)

| Value | Detector B | Detector E |
|---|---|---|
| Median, quiet window (1–6 May 2024) | 115.7 µGy/day | 165.2 µGy/day |
| Median before the storm (19 May 12:00 → 20 May 04:39) | 92.8 µGy/day | 132.8 µGy/day |
| Peak dose rate, 2024-05-20 06:15:19 UTC | **7,295.7 µGy/day** (~79× the pre-storm median) | **8,377.9 µGy/day** |
| Dose from the onset (05:39 UTC) to 23 May 00:00, trapezoidal sum | ~1,870 µGy | ~2,160 µGy |

- **Onset:** the largest relative jump between consecutive observations (×8.1 in detector B), 05:21:50 → 05:38:56 UTC on 2024-05-20.
- **Last normal observation: 05:04:45 UTC** (B 107.7, E 137.0 µGy/day, both ~2 standard deviations above the pre-storm mean). The next one, 05:21:50 UTC (B 178.6, E 238.9), is already ~12 σ above in B and ~50 σ above in E: the storm had begun. From the last normal observation to the peak took **70.6 minutes** (`derived`; pre-storm statistics over 19 May 12:00 → 20 May 04:39, 57 observations: B mean 93.6, σ 7.1; E mean 132.7, σ 2.1). From the 05:21:50 observation to the peak took 53.5 minutes (178.6 → 7,295.7 µGy/day, ~41×).
- **Context:** NASA describes this event as the largest radiation surge RAD had measured since Curiosity landed in 2012. It followed an X-class flare from the sunspot region later called AR3697 ([NASA, 2024](https://www.nasa.gov/missions/maven/nasa-watches-mars-light-up-during-epic-solar-storm/)).
- **Lower background before the storm:** the pre-storm median is ~20% below early May. This could be a Forbush decrease after earlier solar eruptions ⚠ (not verified against the literature).
- **Daily cycle:** RAD's dose rate has a daily cycle, anti-correlated with surface pressure. Thermal tides change how much atmosphere sits above Gale over the sol ([Rafkin et al. 2014, JGR Planets 119, 1345–1358](https://doi.org/10.1002/2013JE004525); checked from the abstract). In these files, folding the quiet window by sol shows about ±3% (est., our fold of 14 sols in 24 bins). That is close to the scatter of single observations, so it is subtle.

## Caveats

- **Absorbed dose vs dose equivalent:** these files hold absorbed dose (gray). `references/experiments/mars-experiments.md` quotes ~0.67 mSv/day, which is dose equivalent (sievert, weighted by particle type). The two are not directly comparable.
- **Press figures** ⚠: NASA's article on this storm ([NASA, 2024](https://www.nasa.gov/missions/maven/nasa-watches-mars-light-up-during-epic-solar-storm/)) says RAD registered "8,100 micrograys" and usually records ~700 micrograys per day. Neither matches the integrated dose or the quiet rate above. 8,100 is close to detector E's peak *rate*. Do not show the press numbers next to these values without checking the original source.
- **No cruise data:** CDAWeb has no RAD data from the 2011–2012 cruise (the inventory starts on 2012-08-17). Cruise data, if needed, must come from the PDS PPI archive.
