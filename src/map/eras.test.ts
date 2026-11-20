import { describe, expect, it } from 'vitest';
import { eraEnd, eraOf } from './eras.ts';

// Made-up eras, in order and covering every day, as tiles.json lists them.
const eras = [
  { start: -1e9, end: 100 },
  { start: 100, end: 250 },
  { start: 250, end: 1e9 },
];

describe('eras', () => {
  it('finds the era holding a day, with each era starting on its first day', () => {
    expect(eraOf(eras, 99)).toBe(0);
    expect(eraOf(eras, 100)).toBe(1);
    expect(eraOf(eras, 249)).toBe(1);
    expect(eraOf(eras, 250)).toBe(2);
  });

  it('gives the first day of the next era, where playback pauses', () => {
    expect(eraEnd(eras, 120)).toBe(250);
    // Pressing play again on the era's last day carries on into the next era.
    expect(eraEnd(eras, 249 + 1)).toBe(1e9);
  });
});
