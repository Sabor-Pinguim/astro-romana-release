# Minigame Walkthrough Clips (`assets/minigames/`)

Optional animated demonstration clips (`GIF` or `WebP`) shown inside the **"How to solve"** popup (`web/minigame-guide.js`).

## Loading Behavior
- When a minigame opens, `web/minigame-guide.js` tries:
  1. `assets/minigames/<fileId>.gif`
  2. `assets/minigames/<fileId>.webp`
  3. **Fallback (no file needed):** renders a lightweight faceted low-poly SVG+CSS animated demo matched to that minigame's mechanic (`keep`, `timing`, `aim`, `choice`, `pattern`, `route`, or `piloting`).
- Recommended clip size: **`480×270`** or **`320×180`** (16:9), looping silently, under **1 MB** each.

## Expected Filenames (25 total)

### Cockpit Flight Stages (4)
| File prefix (`<fileId>`) | Stage | Mechanic |
|---|---|---|
| `cockpit-ascent` | Step 1 · Liftoff & Max-Q | `piloting` |
| `cockpit-cabin-dock` | Step 2 · Booster Separation & Cabin Docking | `piloting` |
| `cockpit-orbital-dock` | Step 3 · Orbital Refueling Docking | `piloting` |
| `cockpit-landing` | Step 4 · Mars Entry & Touchdown | `piloting` |

### Scientific Experiment Minigames (21)
| File prefix (`<fileId>`) | Experiment ID | Mechanic |
|---|---|---|
| `h-o1` | `H-O1` | `keep` |
| `h-o2` | `H-O2` | `piloting` |
| `h-s1` | `H-S1` | `route` |
| `h-s2` | `H-S2` | `choice` |
| `l-o1` | `L-O1` | `timing` |
| `l-o2` | `L-O2` | `keep` |
| `l-s1` | `L-S1` | `keep` |
| `l-s2` | `L-S2` | `timing` |
| `o-o1` | `O-O1` | `aim` |
| `o-o2` | `O-O2` | `choice` |
| `o-s1` | `O-S1` | `choice` |
| `o-s2` | `O-S2` | `keep` |
| `m-o1` | `M-O1` | `timing` |
| `m-o2` | `M-O2` | `pattern` |
| `m-o3` | `M-O3` | `pattern` |
| `m-s1` | `M-S1` | `pattern` |
| `m-s2` | `M-S2` | `aim` |
| `m-s3` | `M-S3` | `pattern` |
| `m-s4` | `M-S4` | `choice` |
| `m-s5` | `M-S5` | `timing` |
| `m-s6` | `M-S6` | `keep` |
