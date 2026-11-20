# Map speed (Phase 6 step 2)

Measured by `npm run measure-map` at 1280×800, in Chromium drawing in software. Compare these numbers with each other, not with a real visitor's speed.

## East Asia, 1 June 1934, zoom 4

- **Idle:** 0 map redraws and 0 animation frames requested in 5 seconds with nothing moving (both should be 0).
- **Panning:** 21 frames, about 7 a second; median frame 166 ms, 95th percentile 192 ms.
- **Zooming in and out:** 23 frames, about 8 a second; median frame 161 ms, 95th percentile 194 ms.
- **Playing** (a month a frame, 1934 to 1936): 24 frames, about 6 a second; median frame 173 ms, 95th percentile 261 ms.
- **Jumping into another era** (1934 to 1955): the map took 659 ms to finish drawing.

Panning with one group of layers switched off at a time; each row is the middle of 3 runs.

| Layers switched off | Median frame | 95th percentile | Change in median |
|---|---|---|---|
| (none) | 152 ms | 179 ms | |
| no-data (2 layers) | 119 ms | 157 ms | -22% |
| borders (11 layers) | 126 ms | 138 ms | -17% |
| baseline (6 layers) | 141 ms | 167 ms | -7% |
| contested (3 layers) | 166 ms | 204 ms | +9% |
| coast (5 layers) | 151 ms | 170 ms | -1% |
| data-edge (2 layers) | 178 ms | 221 ms | +17% |
| labels (5 layers) | 167 ms | 214 ms | +10% |
| base map (4 layers) | 148 ms | 199 ms | -3% |

## The world, 1 June 1934, zoom 2

- **Idle:** 0 map redraws and 0 animation frames requested in 5 seconds with nothing moving (both should be 0).
- **Panning:** 14 frames, about 5 a second; median frame 238 ms, 95th percentile 266 ms.
- **Zooming in and out:** 19 frames, about 6 a second; median frame 172 ms, 95th percentile 279 ms.
- **Playing** (a month a frame, 1934 to 1936): 24 frames, about 5 a second; median frame 235 ms, 95th percentile 309 ms.
- **Jumping into another era** (1934 to 1955): the map took 1284 ms to finish drawing.

Panning with one group of layers switched off at a time; each row is the middle of 3 runs.

| Layers switched off | Median frame | 95th percentile | Change in median |
|---|---|---|---|
| (none) | 227 ms | 267 ms | |
| no-data (2 layers) | 172 ms | 219 ms | -24% |
| borders (11 layers) | 202 ms | 224 ms | -11% |
| baseline (6 layers) | 197 ms | 268 ms | -13% |
| contested (3 layers) | 200 ms | 232 ms | -12% |
| coast (5 layers) | 167 ms | 197 ms | -26% |
| data-edge (2 layers) | 203 ms | 237 ms | -11% |
| labels (5 layers) | 209 ms | 252 ms | -8% |
| base map (4 layers) | 176 ms | 202 ms | -22% |
