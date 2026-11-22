// Measures how far the borders the map draws are from their sources, and from the coast (Phase 6
// step 2, part 2), so the detail work (step 5) knows which cause matters. It reads only files the
// build wrote and the data; it changes nothing.
//
// Usage: npm run build-data first (it writes public/data/), then
//   npm run measure-alignment [-- --out=docs/measurements/alignment.md]
//
// For one day (DAY below), it compares:
// 1. the border lines in the default map's tiles ("lines" layer), at each zoom, with the imported
//    OpenHistoricalMap shapes in effect that day, both ways: how far each drawn point is from the
//    source's border, and how far each point of the source's border is from the drawn line;
// 2. the coastal stretches of the shapes in effect (OpenHistoricalMap's, and Cliopatria's
//    worldwide) with Natural Earth's 1:10m coastline, which the map draws over them from zoom 4.
// Distances are on the globe, in km, with a flat approximation good to well under 1% at these
// distances. Points within the tiles' overlap with their neighbours are left out, since the
// tiles cut lines there.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { civilToJdn, formatDay } from '../src/dates/index.ts';
import { readLayer } from '../src/map/mvt.ts';
import { eraOf } from '../src/map/eras.ts';
import { dayRanges } from './build-data.ts';
import { DATA_DIR, loadDataset, ROOT } from './lib/data.ts';

const DAY = civilToJdn(1934, 6, 1);
const OHM_BOX = { west: 73, south: 10, east: 150, north: 55 }; // the import's East Asia area
const ZOOMS = [3, 4, 5, 6, 7];
const TILE_BUFFER = 64; // tile units of overlap (scripts/lib/tiles.ts)
const COAST_NEAR_KM = 25; // a shape's border point this close to Natural Earth's coast counts as coastal
const PUBLIC = join(ROOT, 'public', 'data');

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const lines: string[] = [];
const say = (line = '') => {
  lines.push(line);
  console.log(line);
};

type Pt = [number, number]; // [lng, lat]

/** Segments in a grid of cells, for "how far is the nearest segment" within a few tens of km. */
class SegmentIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly coords: number[] = [];
  private readonly cell: number;
  constructor(cell = 0.25) {
    this.cell = cell;
  }
  add(a: Pt, b: Pt): void {
    const i = this.coords.length;
    this.coords.push(a[0], a[1], b[0], b[1]);
    const [x0, x1] = [Math.floor(Math.min(a[0], b[0]) / this.cell), Math.floor(Math.max(a[0], b[0]) / this.cell)];
    const [y0, y1] = [Math.floor(Math.min(a[1], b[1]) / this.cell), Math.floor(Math.max(a[1], b[1]) / this.cell)];
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`;
        const list = this.cells.get(key);
        if (list) list.push(i);
        else this.cells.set(key, [i]);
      }
  }
  addRing(ring: Pt[]): void {
    for (let i = 1; i < ring.length; i++) this.add(ring[i - 1], ring[i]);
  }
  /** Distance in km to the nearest segment, or Infinity if none is within about `reach` cells. */
  nearestKm(p: Pt, reach = 2): number {
    const cx = Math.floor(p[0] / this.cell);
    const cy = Math.floor(p[1] / this.cell);
    let best = Infinity;
    const seen = new Set<number>();
    for (let x = cx - reach; x <= cx + reach; x++)
      for (let y = cy - reach; y <= cy + reach; y++)
        for (const i of this.cells.get(`${x},${y}`) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          const c = this.coords;
          best = Math.min(best, segmentKm(p, [c[i], c[i + 1]], [c[i + 2], c[i + 3]]));
        }
    return best;
  }
}

/**
 * Whether a point is on land: counts how many coastline segments a ray from the point eastward
 * crosses (odd means inside), using only the segments in the point's band of latitude.
 */
class LandTest {
  private readonly bands = new Map<number, number[]>();
  private readonly coords: number[] = [];
  private readonly band: number;
  constructor(band = 0.05) {
    this.band = band;
  }
  addRing(ring: Pt[]): void {
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      if (a[1] === b[1]) continue;
      const k = this.coords.length;
      this.coords.push(a[0], a[1], b[0], b[1]);
      for (let y = Math.floor(Math.min(a[1], b[1]) / this.band); y <= Math.floor(Math.max(a[1], b[1]) / this.band); y++) {
        const list = this.bands.get(y);
        if (list) list.push(k);
        else this.bands.set(y, [k]);
      }
    }
  }
  onLand([x, y]: Pt): boolean {
    let inside = false;
    const c = this.coords;
    for (const k of this.bands.get(Math.floor(y / this.band)) ?? []) {
      const [ax, ay, bx, by] = [c[k], c[k + 1], c[k + 2], c[k + 3]];
      if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
    }
    return inside;
  }
}

function segmentKm(p: Pt, a: Pt, b: Pt): number {
  const k = Math.cos((p[1] * Math.PI) / 180) * 111.32; // km per degree of longitude here
  const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * 110.57;
  const bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * 110.57;
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function ringsOf(geometry: { type: string; coordinates: unknown }): Pt[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates as Pt[][];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Pt[][][]).flat();
  return [];
}

function summary(values: number[]): string {
  if (values.length === 0) return 'no points';
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  const km = (v: number) => (v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`);
  return `${km(at(0.5))} | ${km(at(0.95))} | ${km(at(0.99))} | ${km(s[s.length - 1])} | ${s.length.toLocaleString('en')}`;
}

// --- The shapes in effect on DAY ---------------------------------------------------------------
const ds = loadDataset(DATA_DIR);
const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
const active = (folder: string) =>
  ds.assertions
    .filter(({ file }) => file.includes(`imports/${folder}/`))
    .flatMap(({ value }) => value)
    .filter((a) => a.shape && ['administers', 'controls'].includes(a.relation))
    .filter((a) => {
      const { s0, e1 } = dayRanges(a.start, a.end);
      return s0 <= DAY && DAY < e1;
    });
const ohm = active('openhistoricalmap');
const clio = active('cliopatria');
const ohmIds = new Set(ohm.map((a) => a.id));

say('# How far the drawn borders are from their sources (Phase 6 step 2)');
say();
say(`Measured by \`npm run measure-alignment\` for ${formatDay(DAY)}: ${ohm.length} OpenHistoricalMap records and ${clio.length} Cliopatria records in effect that day. Each table gives the median, 95th and 99th percentiles, the largest value, and how many points were measured.`);

// Natural Earth's 1:10m land: its coastline, and a test for which side of it a point is on.
const land = JSON.parse(readFileSync(join(DATA_DIR, 'imports', 'natural-earth', 'ne_10m_land.geojson'), 'utf8')) as {
  features: { geometry: { type: string; coordinates: unknown } }[];
};
const coast = new SegmentIndex();
const landTest = new LandTest();
for (const f of land.features)
  for (const ring of ringsOf(f.geometry)) {
    coast.addRing(ring);
    landTest.addRing(ring);
  }
/** The map draws no border line out at sea (more than 2 km from the coast) or along the import's edge. */
const drawnHere = (p: Pt) =>
  (landTest.onLand(p) || coast.nearestKm(p, 1) <= 2) &&
  Math.min(p[0] - OHM_BOX.west, OHM_BOX.east - p[0], p[1] - OHM_BOX.south, OHM_BOX.north - p[1]) > 0.05;

// --- 1. Tiles against the imported shapes ------------------------------------------------------
const sourceIndex = new SegmentIndex();
const sourcePoints: Pt[] = [];
for (const a of ohm) {
  const shape = shapes.get(a.shape!);
  if (!shape) continue;
  for (const ring of ringsOf(shape.geometry)) {
    sourceIndex.addRing(ring);
    for (const p of ring) if (drawnHere(p)) sourcePoints.push(p);
  }
}

const tilesJson = JSON.parse(readFileSync(join(PUBLIC, 'tiles.json'), 'utf8'));
const version: string = tilesJson.versions[eraOf(tilesJson.eras, DAY)];
const toLngLat = (z: number, x: number, y: number, px: number, py: number, extent: number): Pt => {
  const n = 2 ** z;
  const lng = ((x + px / extent) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI;
  return [lng, lat];
};
const tileRange = (z: number) => {
  const n = 2 ** z;
  const tx = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const ty = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  return { x0: tx(OHM_BOX.west), x1: tx(OHM_BOX.east), y0: ty(OHM_BOX.north), y1: ty(OHM_BOX.south) };
};

say();
say('## 1. The tiles against the imported OpenHistoricalMap shapes');
say();
say('The import already simplified each border to within 0.005° (about 500 m) of OpenHistoricalMap\'s own line (its manifest); these numbers are on top of that. "Drawn line off its source": how far each point the map draws is from the imported border. "Source detail left out": how far each point of the imported border is from the drawn line, which is what shows as small shapes not lining up; it leaves out the stretches the map never draws as lines (more than 2 km out to sea, and along the import\'s edge). From zoom 8, the map enlarges the zoom-7 tiles, so their error stays as at zoom 7 in km while growing on screen.');
say();
say('| Zoom | Drawn line off its source: median | 95% | 99% | largest | points | Source detail left out: median | 95% | 99% | largest | points |');
say('|---|---|---|---|---|---|---|---|---|---|---|');
for (const z of ZOOMS) {
  const { x0, x1, y0, y1 } = tileRange(z);
  const drawnIndex = new SegmentIndex();
  const off: number[] = [];
  let inside: (p: Pt) => boolean = () => false;
  const covered: [number, number, number, number][] = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) {
      const file = join(PUBLIC, 'tiles', version, String(z), String(x), `${y}.pbf`);
      if (!existsSync(file)) continue;
      const layer = readLayer(readFileSync(file), 'lines');
      if (!layer) continue;
      const nw = toLngLat(z, x, y, 0, 0, layer.extent);
      const se = toLngLat(z, x, y, layer.extent, layer.extent, layer.extent);
      covered.push([nw[0], se[1], se[0], nw[1]]);
      for (const f of layer.features) {
        const s0 = Number(f.properties.s0), e0 = Number(f.properties.e1 ?? f.properties.e0);
        if (!(s0 <= DAY && DAY < e0)) continue;
        if (f.properties.id !== undefined && !ohmIds.has(String(f.properties.id))) continue;
        for (const ring of f.rings) {
          const pts = ring.map(([px, py]) => ({ p: toLngLat(z, x, y, px, py, layer.extent), edge: px < 0 || py < 0 || px > layer.extent || py > layer.extent }));
          for (let i = 1; i < pts.length; i++) drawnIndex.add(pts[i - 1].p, pts[i].p);
          for (const { p, edge } of pts) if (!edge) off.push(sourceIndex.nearestKm(p, 4));
        }
      }
    }
  inside = (p) => covered.some(([w, s, e, n]) => p[0] >= w && p[0] < e && p[1] >= s && p[1] < n);
  // A tile's overlap is TILE_BUFFER of 4096 units; leave out source points that close to a tile edge.
  const marginDeg = (360 / 2 ** z) * (TILE_BUFFER / 4096);
  const missing = sourcePoints
    .filter(inside)
    .filter(([lng]) => {
      const f = (((lng + 180) / 360) * 2 ** z) % 1;
      return f * (360 / 2 ** z) > marginDeg && (1 - f) * (360 / 2 ** z) > marginDeg;
    })
    .map((p) => drawnIndex.nearestKm(p, 8))
    .filter(Number.isFinite);
  say(`| ${z} | ${summary(off.filter(Number.isFinite))} | ${summary(missing)} |`);
}

// --- 2. Coastal stretches against Natural Earth's 1:10m coast ----------------------------------
const coastal = (records: typeof ohm, box?: typeof OHM_BOX) => {
  const out = { short: [] as number[], beyond: [] as number[] };
  for (const a of records) {
    const shape = shapes.get(a.shape!);
    if (!shape) continue;
    for (const ring of ringsOf(shape.geometry))
      for (const p of ring) {
        if (box && !(p[0] > box.west && p[0] < box.east && p[1] > box.south && p[1] < box.north)) continue;
        const d = coast.nearestKm(p, 1);
        if (d <= COAST_NEAR_KM) (landTest.onLand(p) ? out.short : out.beyond).push(d);
      }
  }
  return out;
};

say();
say('## 2. Coastal stretches against Natural Earth\'s 1:10m coastline');
say();
say(`For every point of a shape's border within ${COAST_NEAR_KM} km of Natural Earth's coastline: how far it is from that coastline, split by side. **On land, short of the coast**: the shape stops before the sea, leaving a strip the map shows as "no data" (the coast gaps of question 3). **At sea, beyond the coast**: the shape runs out over the water (often on purpose, to include territorial waters); the map draws Natural Earth's sea over it from zoom 4, so it doesn't show.`);
say();
say('| Shapes | Side | median | 95% | 99% | largest | points |');
say('|---|---|---|---|---|---|---|');
for (const [name, result] of [
  ['OpenHistoricalMap, East Asia', coastal(ohm, OHM_BOX)],
  ['Cliopatria, worldwide', coastal(clio)],
] as const) {
  const total = result.short.length + result.beyond.length;
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;
  say(`| ${name} | on land, short of the coast (${share(result.short.length)} of points) | ${summary(result.short)} |`);
  say(`| ${name} | at sea, beyond the coast (${share(result.beyond.length)}) | ${summary(result.beyond)} |`);
}

if (values.out) writeFileSync(values.out, `${lines.join('\n')}\n`);
