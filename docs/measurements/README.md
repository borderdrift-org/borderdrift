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

## 3. Alignment (2026-11-20)

The raw numbers are in [alignment.md](alignment.md), written by `npm run measure-alignment` from
the built files (`npm run build-data` first), for 1 June 1934. They answer the maintainers'
report that small shapes don't line up when zoomed in, and that fills don't reach the ocean
(the plan's section 2).

**The tiles aren't the cause.** At zoom 7, the border lines the map draws are within 40 m of the
imported OpenHistoricalMap shapes for 99% of points, both ways (drawn points against the
source's border, and the source's points against the drawn line), and within 32 m for 95%.
Zoomed out, the tiles leave out 1–2 km of detail at zooms 3–4 (95th percentile), which is
smaller than a pixel there. A few points, at most 5.5 km, are where the line-builder's "more than
2 km out to sea" cut and this measure's coastline differ slightly.

**What does show up close.** From zoom 8, the map enlarges the zoom-7 tiles, and two coarser
things become visible:

- the import's own simplification, up to 0.005° (about 500 m) from OpenHistoricalMap's line,
  which is 3–4 pixels at zoom 10;
- Natural Earth's 1:10m coastline, drawn over the shapes from zoom 4, which is coarser than
  OpenHistoricalMap's coasts.

So step 5's levers are the right ones, in this order: less simplification at import where the
source is finer, tiles above zoom 7 where there's the detail, and a matching coast. Each is a size
trade, which step 5 measures before applying.

**Coasts.** Of the border points within 25 km of Natural Earth's coastline:

- **OpenHistoricalMap:** 95% are out at sea (its country boundaries often include territorial
  waters; the map already cuts those at the coast), and 5% stop short on land.
- **Cliopatria:** 28% stop short on land, leaving the "no data" strips along coasts, and they're
  mostly narrow: a median of 2.7 km, and 14.5 km at the 95th percentile.

That supports option B (decision 3): a margin limited to about the source's resolution would fill
nearly all of Cliopatria's coastal strips, while the wide ones, real gaps, keep the hatch. Part 3
measures the strips by area, and checks how Cliopatria's authors say their shapes were made.
