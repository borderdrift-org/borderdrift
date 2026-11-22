import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseEdtfDate } from './dates/index.ts';
import { DEFAULT_VIEW, OPENING_EVENT } from './opening.ts';

describe('the opening view', () => {
  it('opens on the date of its event, as the data records it', () => {
    // If the event's date is corrected in the data, this fails until the opening day follows it.
    const file = join(import.meta.dirname, '..', 'data', 'events', `${OPENING_EVENT}.yaml`);
    const event = parse(readFileSync(file, 'utf8')) as { id: string; date: string };
    expect(event.id).toBe(OPENING_EVENT);
    expect(DEFAULT_VIEW.day).toBe(parseEdtfDate(event.date).earliest);
  });
});
