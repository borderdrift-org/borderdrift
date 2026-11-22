// Measures the "no data" strips along coasts where Cliopatria is the map (Phase 6 step 2, part 3),
// by area, for the coast-gap decision (question 3, option B: a flagged, build-only margin where a
// polity's shape stops short of the coast by less than the source's resolution). It reads only
// the data; it changes nothing.
//
// Usage: npm run measure-coast-gaps [-- --out=docs/measurements/coast-gaps.md]
//
// For one day (DAY), it finds the land (Natural Earth 1:10m) that no Cliopatria shape in effect
// covers, outside OpenHistoricalMap's area while its years apply, row by row along lines of
// latitude: on each row, the land's stretches minus the shapes' stretches. It then samples those
// uncovered stretches every STEP degrees, and sorts each sample by how far it is from the coast
// and how many different polities have a border within a given distance:
// - one polity within W km: a strip option B could fill with that polity's margin;
// - two or more: between polities, where the hatch would stay;
// - none: a wide gap, where the hatch stays.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { civilToJdn, formatDay } from '../src/dates/index.ts';
import { dayRanges } from './build-data.ts';
import { DATA_DIR, loadDataset } from './lib/data.ts';

const DAY = civilToJdn(1934, 6, 1);
const OHM_BOX = { west: 73, south: 10, east: 150, north: 55 }; // East Asia, OpenHistoricalMap's map 1900–1950
const STEP = 0.02; // degrees between rows, and between samples along a row (about 2 km)
const COAST_BAND_KM = 25; // uncovered land this close to the coast counts as coastal
const WIDTHS_KM = [5, 10, 15, 25]; // the margin widths to test
const ANTARCTICA = -60; // south of this, uncovered land is counted apart (Cliopatria has no polities there)

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const out: string[] = [];
const say = (line = '') => {
  out.push(line);
  console.log(line);
};

type Pt = [number, number];

function ringsOf(geometry: { type: string; coordinates: unknown }): Pt[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates as Pt[][];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Pt[][][]).flat();
  return [];
}

/** Where rings cross each row (row r is at latitude -90 + (r + 0.5) * STEP), as sorted x lists. */
function crossings(rings: Pt[][]): Map<number, number[]> {
  const rows = new Map<number, number[]>();
  for (const ring of rings)
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      if (a[1] === b[1]) continue;
      const lo = Math.ceil((Math.min(a[1], b[1]) + 90) / STEP - 0.5);
      const hi = Math.floor((Math.max(a[1], b[1]) + 90) / STEP - 0.5);
      for (let r = lo; r <= hi; r++) {
        const y = -90 + (r + 0.5) * STEP;
        if (y < Math.min(a[1], b[1]) || y >= Math.max(a[1], b[1])) continue;
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        const list = rows.get(r);
        if (list) list.push(x);
        else rows.set(r, [x]);
      }
    }
  for (const list of rows.values()) list.sort((p, q) => p - q);
  return rows;
}

/** Pairs of crossings as stretches (even-odd: inside between the 1st and 2nd, 3rd and 4th, ...). */
function stretches(xs: number[] | undefined): [number, number][] {
  const result: [number, number][] = [];
  if (!xs) return result;
  for (let i = 0; i + 1 < xs.length; i += 2) result.push([xs[i], xs[i + 1]]);
  return result;
}

function union(parts: [number, number][]): [number, number][] {
  const sorted = [...parts].sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = result[result.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else result.push([a, b]);
  }
  return result;
}

function subtract(from: [number, number][], cut: [number, number][]): [number, number][] {
  const result: [number, number][] = [];
  for (const [a, b] of from) {
    let start = a;
    for (const [c, d] of cut) {
      if (d <= start || c >= b) continue;
      if (c > start) result.push([start, c]);
      start = Math.max(start, d);
    }
    if (start < b) result.push([start, b]);
  }
  return result;
}

/** Segments in a grid, each with a label (a polity, or '' for the coast). */
class SegmentIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly coords: number[] = [];
  private readonly labels: string[] = [];
  private readonly cell = 0.25;
  addRing(ring: Pt[], label = ''): void {
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      const k = this.labels.length;
      this.coords.push(a[0], a[1], b[0], b[1]);
      this.labels.push(label);
      for (let x = Math.floor(Math.min(a[0], b[0]) / this.cell); x <= Math.floor(Math.max(a[0], b[0]) / this.cell); x++)
        for (let y = Math.floor(Math.min(a[1], b[1]) / this.cell); y <= Math.floor(Math.max(a[1], b[1]) / this.cell); y++) {
          const key = `${x},${y}`;
          const list = this.cells.get(key);
          if (list) list.push(k);
          else this.cells.set(key, [k]);
        }
    }
  }
  /** The nearest distance (km) to each label's segments within `reach` cells. */
  nearest(p: Pt, reach: number): Map<string, number> {
    const found = new Map<string, number>();
    const cx = Math.floor(p[0] / this.cell);
    const cy = Math.floor(p[1] / this.cell);
    for (let x = cx - reach; x <= cx + reach; x++)
      for (let y = cy - reach; y <= cy + reach; y++)
        for (const k of this.cells.get(`${x},${y}`) ?? []) {
          const c = this.coords;
          const d = segmentKm(p, [c[4 * k], c[4 * k + 1]], [c[4 * k + 2], c[4 * k + 3]]);
          const label = this.labels[k];
          if (d < (found.get(label) ?? Infinity)) found.set(label, d);
        }
    return found;
  }
}

function segmentKm(p: Pt, a: Pt, b: Pt): number {
  const k = Math.cos((p[1] * Math.PI) / 180) * 111.32;
  const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * 110.57;
  const bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * 110.57;
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

// --- Land, and the Cliopatria shapes in effect on DAY -------------------------------------------
const land = JSON.parse(readFileSync(join(DATA_DIR, 'imports', 'natural-earth', 'ne_10m_land.geojson'), 'utf8')) as {
  features: { geometry: { type: string; coordinates: unknown } }[];
};
const landRings = land.features.flatMap((f) => ringsOf(f.geometry));
const landRows = crossings(landRings);
const coast = new SegmentIndex();
for (const ring of landRings) coast.addRing(ring);

const ds = loadDataset(DATA_DIR);
const shapes = new Map(ds.shapes.map(({ value }) => [value.properties.id, value]));
const records = ds.assertions
  .filter(({ file }) => file.includes('imports/cliopatria/'))
  .flatMap(({ value }) => value)
  .filter((a) => a.shape && a.relation === 'controls')
  .filter((a) => {
    const { s0, e1 } = dayRanges(a.start, a.end);
    return s0 <= DAY && DAY < e1;
  });
const shapeRows = records.map((a) => crossings(ringsOf(shapes.get(a.shape!)!.geometry)));
const borders = new SegmentIndex();
for (const a of records) for (const ring of ringsOf(shapes.get(a.shape!)!.geometry)) borders.addRing(ring, a.subject);

// --- Row by row ---------------------------------------------------------------------------------
const inOhm = (x: number, y: number) => x > OHM_BOX.west && x < OHM_BOX.east && y > OHM_BOX.south && y < OHM_BOX.north;
const area = { coveredKm2: 0, inlandKm2: 0, antarcticaKm2: 0, coastalKm2: 0 };
const byWidth = WIDTHS_KM.map(() => ({ one: 0, several: 0, none: 0 }));
const reach = Math.ceil(Math.max(...WIDTHS_KM) / 25) + 1; // grid cells (0.25°, about 25 km) to search

for (const [r, xs] of landRows) {
  const y = -90 + (r + 0.5) * STEP;
  const cellKm2 = STEP * 110.57 * (STEP * 111.32 * Math.cos((y * Math.PI) / 180));
  const landHere = stretches(xs);
  const covered = union(shapeRows.flatMap((rows) => stretches(rows.get(r))));
  for (const [a, b] of subtract(landHere, subtract(landHere, covered))) area.coveredKm2 += ((b - a) / STEP) * cellKm2;
  for (const [a, b] of subtract(landHere, covered))
    for (let x = Math.ceil(a / STEP) * STEP; x < b; x += STEP) {
      if (inOhm(x, y)) continue;
      if (y < ANTARCTICA) {
        area.antarcticaKm2 += cellKm2;
        continue;
      }
      const coastKm = coast.nearest([x, y], 1).get('') ?? Infinity;
      if (coastKm > COAST_BAND_KM) {
        area.inlandKm2 += cellKm2;
        continue;
      }
      area.coastalKm2 += cellKm2;
      const near = borders.nearest([x, y], reach);
      WIDTHS_KM.forEach((w, i) => {
        const within = [...near.values()].filter((d) => d <= w).length;
        if (within === 1) byWidth[i].one += cellKm2;
        else if (within > 1) byWidth[i].several += cellKm2;
        else byWidth[i].none += cellKm2;
      });
    }
}

// --- Report --------------------------------------------------------------------------------------
const km2 = (v: number) => `${Math.round(v).toLocaleString('en')} km²`;
const pct = (v: number, of: number) => `${Math.round((v / of) * 100)}%`;
say('# The "no data" strips along coasts, by area (Phase 6 step 2)');
say();
say(`Measured by \`npm run measure-coast-gaps\` for ${formatDay(DAY)}: the land (Natural Earth 1:10m) that none of the ${records.length} Cliopatria records in effect covers, outside OpenHistoricalMap's East Asia area (where it's the map in these years), sampled every ${STEP}° (about ${Math.round(STEP * 111)} km).`);
say();
say('| Land with no Cliopatria shape | Area |');
say('|---|---|');
say(`| Within ${COAST_BAND_KM} km of the coast | ${km2(area.coastalKm2)} |`);
say(`| Further inland | ${km2(area.inlandKm2)} |`);
say(`| Antarctica (south of 60°S) | ${km2(area.antarcticaKm2)} |`);
say(`| For comparison: land the shapes cover | ${km2(area.coveredKm2)} |`);
say();
say(`The coastal strips, by what's near them: how many different polities have a border within the margin width. With one, option B would draw that polity's flagged margin there; with two or more, or none, the hatch stays.`);
say();
say('| Margin width | One polity within it (option B fills) | Two or more (hatch stays) | None (hatch stays) |');
say('|---|---|---|---|');
WIDTHS_KM.forEach((w, i) => {
  const { one, several, none } = byWidth[i];
  say(`| ${w} km | ${km2(one)} (${pct(one, area.coastalKm2)}) | ${km2(several)} (${pct(several, area.coastalKm2)}) | ${km2(none)} (${pct(none, area.coastalKm2)}) |`);
});

if (values.out) writeFileSync(values.out, `${out.join('\n')}\n`);
