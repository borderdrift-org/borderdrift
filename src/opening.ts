// Where the map opens when a visitor arrives without a link (Phase 6 step S1, approved
// 2026-11-20).
//
// The day is the date of the event in OPENING_EVENT, as recorded in data/events/ (a test checks
// they match), so a first visit lands in Manchuria 1931–33, where the map's sourced events are:
// their markers fill the timeline's 20-year window. The centre and zoom are only a camera position
// over that area; they make no claim about any border or event.

import { civilToJdn } from './dates/index.ts';

export const OPENING_EVENT = 'mukden-incident-1931';

export const DEFAULT_VIEW = { day: civilToJdn(1931, 9, 18), zoom: 4, lat: 42, lng: 122 };

/** On a phone, one level further out, so Manchuria, Korea and Japan fit beside the header card. */
export const PHONE_ZOOM = 3;
