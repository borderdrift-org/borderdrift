import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseEdtfDate } from '../src/dates/index.ts';
import { inEra } from '../src/map/eras.ts';
import { dayRanges } from './build-data.ts';
import { DATA_DIR } from './lib/data.ts';
import type { Assertion } from './lib/types.ts';

describe('South Sudan’s independence on the administered map', () => {
  // Read the shipped assertions so a re-import that restores the source years fails this test.
  const file = join(DATA_DIR, 'imports', 'cliopatria', 'assertions.yaml');
  const assertions: Assertion[] = parse(readFileSync(file, 'utf8'));
  const sudan = 'cliopatria-republic-of-sudan';
  const southSudan = 'cliopatria-south-sudan';
  const records = assertions.filter((a) => a.relation === 'controls' && (a.subject === sudan || a.subject === southSudan));
  const united = [[sudan, `${sudan}-1992`]];
  const separate = [[sudan, `${sudan}-2014`], [southSudan, `${southSudan}-2014`]];

  it.each([
    { date: '2011-07-08', expected: united },
    { date: '2011-07-09', expected: separate },
    { date: '2011-07-10', expected: separate },
    { date: '2013-12-31', expected: separate },
    { date: '2014-01-01', expected: separate },
  ])('draws the expected boundaries on $date', ({ date, expected }) => {
    const day = parseEdtfDate(date).earliest;
    const active = records.filter((a) => {
      const { s0, e1 } = dayRanges(a.start, a.end);
      // Include possibly active shapes, as the map does for year-precision dates.
      return inEra({ start: day, end: day + 1 }, s0, e1);
    });
    expect(active.map((a) => [a.subject, a.shape]).sort()).toEqual(expected);
  });

  it('credits Cliopatria for the shape only, and the bulletin for the date', () => {
    const changed = records.filter((a) => a.start === '2011-07-09' || a.end === '2011-07-09');
    expect(changed.map((a) => a.id).sort()).toEqual([`${sudan}-1992`, `${sudan}-2014`, `${southSudan}-2014`]);
    for (const a of changed) {
      const [cliopatria, bulletin] = a.sources;
      expect(cliopatria.source).toBe('cliopatria');
      expect(cliopatria.note).toMatch(/is not\. It comes from the other source cited/);
      expect(bulletin.source).toBe('dos-guidance-bulletin-30');
      // The row's own whole years stay in its notes.
      expect(a.notes).toMatch(/this row covers the whole years/);
    }
  });
});
