# Minigame clips (`assets/minigames/`) — GENERATED

Looping GIFs of each minigame played the right way, recorded from the real game in each of its languages. The
**"How to solve"** popup (`web/minigame-guide.js`, the **?** button) shows the clip in the player's language, falls
back to English when that one is missing, and without any clip shows a generic SVG animation of the mechanic. Do not
edit or replace a GIF by hand: re-record it.

## How they are made

```bash
npm run web:clips                          # every clip in en, pt and es (headless Edge/Chrome; about 40 minutes)
npm run web:clips -- --only H-S1,L-O1      # some of them (experiment ids or cockpit file ids)
npm run web:clips -- --lang pt             # one language (or a list: --lang pt,es)
npm run web:clips -- --sheet <dir>         # also a contact sheet PNG per clip, to review it at a glance
```

- **Recorder:** [tools/web/minigame-clips.mjs](../../tools/web/minigame-clips.mjs) opens each experiment in the
  minigame lab (`tools/minigame-lab/index.html#<id>/<level>/<seed>/<lang>`) and each cockpit stage in `index.html`,
  runs its autopilot and captures the minigame area at 10 fps, 420 px wide.
- **Autopilots:** one per clip in [tools/web/minigame-clips/](../../tools/web/minigame-clips/). Each one plays through
  real browser input (a visible cursor and on-screen key caps show what it does) and reads the seeded layout to
  make the right moves. The seed and level are in the autopilot; the same play is recorded in every language.
- **When to re-record:** after changing how a minigame looks, reads or is controlled (`--only <id>`), and after
  changing its texts (the clips show them). The clips follow real time, so a new recording is never byte-identical.

## Files (25 per language: `en/`, `pt/`, `es/`)

| File | Shown for |
|---|---|
| `cockpit-ascent.gif` | Step 1 · Liftoff & Max-Q |
| `cockpit-cabin-dock.gif` | Step 2 · Cabin docking |
| `cockpit-orbital-dock.gif` | Step 3 · Orbital docking and refuelling |
| `cockpit-landing.gif` | Step 4 · Mars entry and touchdown |
| `h-o1.gif` … `o-s2.gif` | The 21 experiments, by id in lower case (`H-O1` → `h-o1.gif`) |
