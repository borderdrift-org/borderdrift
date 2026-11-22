// Records the README's demo GIF (docs/demo.gif), or with --preview the share preview
// (public/preview.png), from the site running locally (Phase 6 steps S3 and S4).
//
// Usage: build the data and start the site first (npm run dev), then in a second terminal:
//   npm run record-demo                  writes docs/demo.gif
//   npm run record-demo -- --preview     writes public/preview.png
// The first time on a computer, Playwright needs its browser: npx playwright install chromium
//
// Both show only OpenHistoricalMap (CC0) and Natural Earth (public domain): every layer built from
// CShapes (CC BY-NC-SA) or Cliopatria (CC BY) is hidden, so the images are CC0 like our own data
// (listed in CREDITS.md). Never record a view that shows those layers without crediting them in
// the image. The GIF steps the timeline a month at a time instead of playing it in real time, so
// recording it twice gives the same frames.

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
// gifenc is a CommonJS module, so Node gives it to us whole.
import gifenc from 'gifenc';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { PNG } from 'pngjs';
import { civilToJdn } from '../src/dates/index.ts';

const { applyPalette, GIFEncoder, quantize } = gifenc;

const SITE = 'http://localhost:5173/';
/** Hidden in both images: every layer not drawn from OpenHistoricalMap or Natural Earth. */
const HIDDEN_LAYERS = /^(contested|baseline|differ|dejure|second|data-edge)/;

const PREVIEW = { file: 'public/preview.png', width: 1200, height: 630, hash: '#d=1934-06-01&m=4/42.5/121' };
const DEMO = {
  file: 'docs/demo.gif',
  width: 760,
  height: 640,
  // East Asia, kept inside OpenHistoricalMap's area there (73–150°E, 10–55°N), so the hidden layers leave
  // no gaps: one frame on 1 January of each year from 1900 to 1950, both included.
  view: '4/34/115',
  from: { year: 1900, month: 1 },
  to: { year: 1950, month: 1 },
  stepMonths: 12,
  frameMs: 400,
  holdMs: 2000, // the first and last frames stay longer
};

/** What the dev build exposes on `window` for debugging (src/main.ts). */
interface DevWindow {
  map: {
    getStyle(): { layers: { id: string }[] };
    setLayoutProperty(id: string, name: string, value: string): void;
    once(event: string, listener: () => void): void;
    triggerRepaint(): void;
  };
  timeline: { setDay(jdn: number): void };
  historical: { eras(): unknown };
}

const { values } = parseArgs({ options: { preview: { type: 'boolean', default: false } } });
const job = values.preview ? PREVIEW : DEMO;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const firstDay = values.preview ? PREVIEW.hash : `#d=${isoMonth(DEMO.from)}&m=${DEMO.view}`;
  await open(page, firstDay);

  if (values.preview) {
    writeFileSync(PREVIEW.file, await page.screenshot());
  } else {
    const gif = GIFEncoder();
    const days = months(DEMO.from, DEMO.to, DEMO.stepMonths);
    for (const [i, day] of days.entries()) {
      await page.evaluate((jdn) => (window as unknown as DevWindow).timeline.setDay(jdn), day);
      await mapIdle(page);
      const frame = PNG.sync.read(await page.screenshot());
      const palette = quantize(frame.data, 256);
      const held = i === 0 || i === days.length - 1;
      gif.writeFrame(applyPalette(frame.data, palette), frame.width, frame.height, {
        palette,
        delay: held ? DEMO.holdMs : DEMO.frameMs,
      });
    }
    gif.finish();
    writeFileSync(DEMO.file, gif.bytes());
  }
  if (errors.length) throw new Error(`The page reported errors:\n${errors.join('\n')}`);
  console.log(`Wrote ${job.file}`);
} finally {
  await browser.close();
}

/** Opens the site at a view, waits for the map, and hides what the images mustn't show. */
async function open(page: Page, hash: string): Promise<void> {
  await page.goto(SITE + hash, { waitUntil: 'load' });
  // tiles.json has loaded (so the historical layers exist) once the eras are known.
  await page.waitForFunction(() => Boolean((window as unknown as DevWindow).historical?.eras()), null, { timeout: 60_000 });
  await mapIdle(page);
  await page.evaluate((pattern) => {
    const { map } = window as unknown as DevWindow;
    const hidden = new RegExp(pattern);
    for (const { id } of map.getStyle().layers) if (hidden.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
    document.querySelector<HTMLButtonElement>('.notice-dismiss')?.click();
    document.querySelector('.timeline-play')?.classList.remove('timeline-play-invite');
  }, HIDDEN_LAYERS.source);
  await mapIdle(page);
}

/** Waits until the map has drawn everything it needs (or 15 seconds, whichever comes first). */
async function mapIdle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const { map } = window as unknown as DevWindow;
        map.once('idle', () => resolve());
        map.triggerRepaint();
        setTimeout(resolve, 15_000);
      }),
  );
}

/** The 1st of every `step`-th month from `from` to `to`, both included, as Julian Day Numbers. */
function months(from: { year: number; month: number }, to: { year: number; month: number }, step: number): number[] {
  const days: number[] = [];
  const last = to.year * 12 + to.month - 1;
  for (let n = from.year * 12 + from.month - 1; n <= last; n += step) {
    days.push(civilToJdn(Math.floor(n / 12), (n % 12) + 1, 1));
  }
  return days;
}

function isoMonth({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
