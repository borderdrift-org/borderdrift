// Measures how fast the map draws (Phase 6 step 2), from the site running locally, so speed work
// can be compared before and after: frame times while panning, zooming and playing, what the page
// draws while nothing happens, how long a jump into another era takes to fill in, and what each
// group of map layers costs.
//
// Usage: start the site first (npm run dev), then in a second terminal:
//   npm run measure-map [-- --out=docs/measurements/map-speed.md]
// The first time on a computer, Playwright needs its browser: npx playwright install chromium
//
// The browser here draws in software (no graphics card), so the times are much slower than a real
// visitor's: use them to compare (layer against layer, before against after), never as speeds.
// The maintainers' own-machine checklist is in docs/architecture.md.

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { civilToJdn } from '../src/dates/index.ts';

const SITE = 'http://localhost:5173/';
const VIEWPORT = { width: 1280, height: 800 };
/** Two views: East Asia, where most layers have data, and the whole world (the baseline). */
const SCENES = [
  { name: 'East Asia, 1 June 1934, zoom 4', hash: '#d=1934-06-01&m=4/38/118' },
  { name: 'The world, 1 June 1934, zoom 2', hash: '#d=1934-06-01&m=2/30/40' },
];
/** Layers are switched off a group at a time, by the start of their IDs (src/map/historical.ts). */
const GROUPS = ['no-data', 'borders', 'baseline', 'contested', 'coast', 'data-edge', 'labels', 'base map'];
const MOVE_MS = 3000;
/** Each layer test runs this many times, and the middle result counts: software drawing is noisy. */
const RUNS = 3;

/** What the dev build exposes on `window` for debugging (src/main.ts). */
interface DevWindow {
  map: {
    getStyle(): { layers: { id: string; source?: string }[] };
    setLayoutProperty(id: string, name: string, value: string): void;
    getLayoutProperty(id: string, name: string): string | undefined;
    on(event: string, listener: () => void): void;
    off(event: string, listener: () => void): void;
    once(event: string, listener: () => void): void;
    panBy(offset: [number, number], options: { duration: number }): void;
    zoomTo(zoom: number, options: { duration: number }): void;
    getZoom(): number;
    triggerRepaint(): void;
  };
  timeline: { setDay(jdn: number): void };
  historical: { eras(): unknown };
  __rafCalls: number;
  __hidden: string[];
}

interface FrameStats {
  frames: number;
  fps: number;
  medianMs: number;
  p95Ms: number;
}

const { values } = parseArgs({ options: { out: { type: 'string' } } });

const browser = await chromium.launch();
const lines: string[] = [];
const say = (line = '') => {
  lines.push(line);
  console.log(line);
};
try {
  say('# Map speed (Phase 6 step 2)');
  say();
  say(`Measured by \`npm run measure-map\` at ${VIEWPORT.width}×${VIEWPORT.height}, in Chromium drawing in software. Compare these numbers with each other, not with a real visitor's speed.`);
  for (const scene of SCENES) {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    // Count every animation frame anything on the page asks for, from the first script on.
    await page.addInitScript(() => {
      const w = window as unknown as { __rafCalls: number; requestAnimationFrame: typeof requestAnimationFrame };
      w.__rafCalls = 0;
      const original = w.requestAnimationFrame.bind(window);
      w.requestAnimationFrame = (callback) => {
        w.__rafCalls++;
        return original(callback);
      };
    });
    await open(page, scene.hash);
    say();
    say(`## ${scene.name}`);
    say();

    const idle = await idleCost(page);
    say(`- **Idle:** ${idle.renders} map redraws and ${idle.frames} animation frames requested in 5 seconds with nothing moving (both should be 0).`);
    const pan = await moving(page, 'pan');
    say(`- **Panning:** ${row(pan)}`);
    const zoom = await moving(page, 'zoom');
    say(`- **Zooming in and out:** ${row(zoom)}`);
    const play = await playing(page);
    say(`- **Playing** (a month a frame, 1934 to 1936): ${row(play)}`);
    const era = await eraJump(page);
    say(`- **Jumping into another era** (1934 to 1955): the map took ${era} ms to finish drawing.`);
    await open(page, scene.hash); // back to the scene's date and view

    say();
    say(`Panning with one group of layers switched off at a time; each row is the middle of ${RUNS} runs.`);
    say();
    say('| Layers switched off | Median frame | 95th percentile | Change in median |');
    say('|---|---|---|---|');
    const base = (await middle(page, null))!; // with no group hidden, there's always a result
    say(`| (none) | ${base.medianMs} ms | ${base.p95Ms} ms | |`);
    for (const group of GROUPS) {
      const result = await middle(page, group);
      if (!result) continue;
      const change = Math.round(((result.medianMs - base.medianMs) / base.medianMs) * 100);
      say(`| ${group} (${result.layers} layers) | ${result.medianMs} ms | ${result.p95Ms} ms | ${change > 0 ? '+' : ''}${change}% |`);
    }
    await page.close();
  }
  if (values.out) writeFileSync(values.out, `${lines.join('\n')}\n`);
} finally {
  await browser.close();
}

/** Pans RUNS times with a group hidden (or none), and returns the run with the middle median. */
async function middle(page: Page, group: string | null): Promise<(FrameStats & { layers: number }) | null> {
  const layers = group ? await setGroup(page, group, 'none') : 0;
  if (group && layers === 0) return null;
  const runs: FrameStats[] = [];
  for (let i = 0; i < RUNS; i++) runs.push(await moving(page, 'pan'));
  if (group) await setGroup(page, group, 'visible');
  runs.sort((a, b) => a.medianMs - b.medianMs);
  return { ...runs[Math.floor(RUNS / 2)], layers };
}

function row(s: FrameStats): string {
  return `${s.frames} frames, about ${s.fps} a second; median frame ${s.medianMs} ms, 95th percentile ${s.p95Ms} ms.`;
}

/** Opens the site at a view and waits until the map has drawn everything. */
async function open(page: Page, hash: string): Promise<void> {
  await page.goto(SITE + hash, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as unknown as DevWindow).historical?.eras()), null, { timeout: 60_000 });
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('.notice-dismiss')?.click();
    document.querySelector('.timeline-play')?.classList.remove('timeline-play-invite');
  });
  await mapIdle(page);
  await page.waitForTimeout(1500); // let anything after the first idle settle
}

async function mapIdle(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const { map } = window as unknown as DevWindow;
        const start = performance.now();
        map.once('idle', () => resolve(Math.round(performance.now() - start)));
        map.triggerRepaint();
        setTimeout(() => resolve(-1), 60_000);
      }),
  );
}

/** Map redraws and animation frames requested over 5 seconds with nothing moving. */
async function idleCost(page: Page): Promise<{ renders: number; frames: number }> {
  return page.evaluate(
    () =>
      new Promise<{ renders: number; frames: number }>((resolve) => {
        const w = window as unknown as DevWindow;
        let renders = 0;
        const onRender = () => renders++;
        w.map.on('render', onRender);
        const before = w.__rafCalls;
        setTimeout(() => {
          w.map.off('render', onRender);
          resolve({ renders, frames: w.__rafCalls - before });
        }, 5000);
      }),
  );
}

/** Frame times while the map pans (there and back) or zooms (in and out). */
async function moving(page: Page, kind: 'pan' | 'zoom'): Promise<FrameStats> {
  const times = await page.evaluate(
    ({ kind, ms }) =>
      new Promise<number[]>((resolve) => {
        const { map } = window as unknown as DevWindow;
        const times: number[] = [];
        let last = performance.now();
        const onRender = () => {
          const now = performance.now();
          times.push(now - last);
          last = now;
        };
        map.on('render', onRender);
        const z = map.getZoom();
        if (kind === 'pan') map.panBy([400, 0], { duration: ms / 2 });
        else map.zoomTo(z + 1, { duration: ms / 2 });
        setTimeout(() => {
          if (kind === 'pan') map.panBy([-400, 0], { duration: ms / 2 });
          else map.zoomTo(z, { duration: ms / 2 });
          setTimeout(() => {
            map.off('render', onRender);
            resolve(times.slice(1));
          }, ms / 2 + 200);
        }, ms / 2 + 100);
      }),
    { kind, ms: MOVE_MS },
  );
  await mapIdle(page);
  return stats(times, MOVE_MS);
}

/** Frame times while the timeline steps a month a frame, as a fast play does. */
async function playing(page: Page): Promise<FrameStats> {
  const days: number[] = [];
  for (let m = 0; m < 24; m++) days.push(civilToJdn(1934 + Math.floor((5 + m) / 12), ((5 + m) % 12) + 1, 1));
  const started = Date.now();
  const times = await page.evaluate(
    (days) =>
      new Promise<number[]>((resolve) => {
        const w = window as unknown as DevWindow;
        const times: number[] = [];
        let i = 0;
        let last = performance.now();
        const step = () => {
          const now = performance.now();
          if (i > 0) times.push(now - last);
          last = now;
          if (i === days.length) return resolve(times);
          w.timeline.setDay(days[i++]);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    days,
  );
  const elapsed = Date.now() - started;
  await mapIdle(page);
  return stats(times, elapsed);
}

/** How long the map takes to finish drawing after a jump into another era. */
async function eraJump(page: Page): Promise<number> {
  return page.evaluate(
    (day) =>
      new Promise<number>((resolve) => {
        const w = window as unknown as DevWindow;
        const start = performance.now();
        w.timeline.setDay(day);
        // Wait for a render first, so the idle is the one after the new tiles, not before.
        w.map.once('render', () => w.map.once('idle', () => resolve(Math.round(performance.now() - start))));
        w.map.triggerRepaint();
        setTimeout(() => resolve(-1), 60_000);
      }),
    civilToJdn(1955, 6, 1),
  );
}

/**
 * Hides a group's visible layers ('none'), or shows again exactly the ones it hid ('visible'), so
 * layers the current view keeps hidden (the legal view's, say) stay hidden. Returns how many.
 */
async function setGroup(page: Page, group: string, visibility: 'none' | 'visible'): Promise<number> {
  const count = await page.evaluate(
    ({ group, visibility }) => {
      const w = window as unknown as DevWindow;
      if (visibility === 'visible') {
        for (const id of w.__hidden) w.map.setLayoutProperty(id, 'visibility', 'visible');
        return w.__hidden.length;
      }
      // Our layers' IDs start with the group's name; the base map's layers are the rest.
      const ours = /^(no-data|borders|baseline|contested|coast|data-edge|dejure|differ|second|zone)/;
      const inGroup = (id: string) =>
        group === 'base map' ? !ours.test(id) && !id.includes('label') : group === 'labels' ? id.includes('label') : id.startsWith(group);
      w.__hidden = w.map
        .getStyle()
        .layers.map(({ id }) => id)
        .filter((id) => inGroup(id) && w.map.getLayoutProperty(id, 'visibility') !== 'none');
      for (const id of w.__hidden) w.map.setLayoutProperty(id, 'visibility', 'none');
      return w.__hidden.length;
    },
    { group, visibility },
  );
  await mapIdle(page);
  return count;
}

function stats(times: number[], elapsedMs: number): FrameStats {
  const sorted = [...times].sort((a, b) => a - b);
  const at = (q: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
  return { frames: times.length, fps: Math.round((times.length / elapsedMs) * 1000), medianMs: at(0.5), p95Ms: at(0.95) };
}
