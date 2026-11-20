# Measurements for Phase 6 (step 2: measure before building)

The plan's rule is to measure before changing how the map is drawn ([phase-6-plan.md](../phase-6-plan.md),
step 2). This folder keeps the numbers, so later steps can be compared with them.

## 1. Speed (2026-11-20)

The raw numbers are in [map-speed.md](map-speed.md), written by `npm run measure-map` (start
`npm run dev` first). They come from Chromium drawing **in software**, with no graphics card, so
every frame is far slower than on a visitor's machine. What they're good for is comparing: layer
against layer, and before against after a change. Each layer row is the middle of three runs, and
runs still differ by up to about 15%, so only bigger differences mean anything.

**What they say:**

- **An idle map costs nothing.** With nothing moving, the page asked for no frames and the map
  redrew nothing in five seconds, in both views. The plan's "make sure nothing repaints when
  nothing changes" is already true; high graphics use comes from moving the map, not from leaving
  it open.
- **The "no data" hatch is the most expensive thing to draw:** switching it off saved 22% of each
  frame over East Asia and 24% over the whole world, the one result that is clearly above the
  noise in both views. The plan's fix (a plain tint instead of the pattern at low zoom, with the
  pattern kept up close and in the key) is worth doing first.
- **The borders cost 11–17%,** as expected: they're the map's content, so the fixes there are
  merging and simplifying layers, not removing them.
- **The coast and the base map** cost 22–26% in the world view but almost nothing over East Asia.
  That's too uneven to act on yet; step 4 measures them again after the hatch change.
- **Labels, contested areas and the data edge** are within the noise.
- **A jump into another era leaves the map unfinished for 0.7–1.3 seconds** (in software; less
  on a real machine). That's what step 6 (smooth era changes) is for, and why plays pause at an
  era's end until then.

## 2. On a maintainer's own computer

Only a real graphics card gives real speeds. A short checklist, in Chrome or Edge on Windows:

1. Open the live site, then the developer tools (F12). In their menu (⋮), choose **More tools →
   Rendering**, and tick **Frame rendering stats**: a small box shows frames per second.
2. Over East Asia in 1934, pan and zoom the map for about ten seconds. Note the lowest frames per
   second you see.
3. Press **Play** and watch for ten seconds. Note the lowest frames per second again.
4. Stop touching it for 30 seconds, with **Task Manager** open (Ctrl+Shift+Esc → Processes):
   note the browser's **GPU** column.
5. Do the same on a phone if you can, by eye: is panning smooth or jerky?

The target (decision 2) is 30 frames a second or better while panning, zooming and playing, and
next to nothing when idle. When these numbers are shared with the assistant, it records them
here without any device details beyond the kind of machine ("an integrated-graphics laptop").
