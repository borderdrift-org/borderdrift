# Map speed (Phase 6 step 2)

Measured by `npm run measure-map` at 1280×800, in Chromium drawing in software. Compare these numbers with each other, not with a real visitor's speed.

## East Asia, 1 June 1934, zoom 4

- **Idle:** 0 map redraws and 0 animation frames requested in 5 seconds with nothing moving (both should be 0).
- **Panning:** 25 frames, about 8 a second; median frame 134 ms, 95th percentile 157 ms.
- **Zooming in and out:** 24 frames, about 8 a second; median frame 149 ms, 95th percentile 184 ms.
- **Playing** (a month a frame, 1934 to 1936): 24 frames, about 6 a second; median frame 169 ms, 95th percentile 257 ms.
- **Jumping into another era** (1934 to 1955): the map took 778 ms to finish drawing.

Panning with one group of layers switched off at a time; each row is the middle of 3 runs.

| Layers switched off | Median frame | 95th percentile | Change in median |
|---|---|---|---|
| (none) | 142 ms | 165 ms | |
| no-data (3 layers) | 99 ms | 112 ms | -30% |
| borders (11 layers) | 106 ms | 122 ms | -25% |
| baseline (6 layers) | 119 ms | 154 ms | -16% |
| contested (3 layers) | 123 ms | 140 ms | -13% |
| coast (5 layers) | 117 ms | 138 ms | -18% |
| data-edge (2 layers) | 136 ms | 147 ms | -4% |
| labels (5 layers) | 136 ms | 147 ms | -4% |
| base map (4 layers) | 120 ms | 139 ms | -15% |

## The world, 1 June 1934, zoom 2

- **Idle:** 0 map redraws and 0 animation frames requested in 5 seconds with nothing moving (both should be 0).
- **Panning:** 23 frames, about 8 a second; median frame 149 ms, 95th percentile 179 ms.
- **Zooming in and out:** 26 frames, about 9 a second; median frame 130 ms, 95th percentile 167 ms.
- **Playing** (a month a frame, 1934 to 1936): 24 frames, about 7 a second; median frame 170 ms, 95th percentile 243 ms.
- **Jumping into another era** (1934 to 1955): the map took 1292 ms to finish drawing.

Panning with one group of layers switched off at a time; each row is the middle of 3 runs.

| Layers switched off | Median frame | 95th percentile | Change in median |
|---|---|---|---|
| (none) | 148 ms | 159 ms | |
| no-data (3 layers) | 135 ms | 161 ms | -9% |
| borders (11 layers) | 137 ms | 153 ms | -7% |
| baseline (6 layers) | 124 ms | 141 ms | -16% |
| contested (3 layers) | 143 ms | 163 ms | -3% |
| coast (5 layers) | 110 ms | 121 ms | -26% |
| data-edge (2 layers) | 145 ms | 161 ms | -2% |
| labels (5 layers) | 142 ms | 170 ms | -4% |
| base map (4 layers) | 118 ms | 135 ms | -20% |
