/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { between, preview, sunset, type Observer } from '../src/index';

/*****************************************************************************************************************/

// The expected instants are astrometry's own for the UTC date each sunset is filed under, pinned at 0.69.0
// and checked against the almanac to the minute. The walk from day to day is what is under test here, not
// the astronomy.

/*****************************************************************************************************************/

// Near the prime meridian: the almanac gives 21:21 BST on the June solstice and 16:02 GMT at New Year.
const LONDON: Observer = { latitude: 51.5074, longitude: -0.1278 };

/*****************************************************************************************************************/

// Far east of Greenwich, where sunset comes early in the UTC day: the almanac gives 17:11 NZST on the June
// solstice, which is 05:11 UTC.
const AUCKLAND: Observer = { latitude: -36.8485, longitude: 174.7633 };

/*****************************************************************************************************************/

// Far west of Greenwich, where an evening sunset falls on the UTC date after the one it is filed under: the
// almanac gives 19:16 HST on the June solstice, which is 05:16 UTC the day after.
const HONOLULU: Observer = { latitude: 21.3069, longitude: -157.8583 };

/*****************************************************************************************************************/

const SOLSTICE = new Date('2026-06-21T00:00:00Z');

/*****************************************************************************************************************/

const SET_ON_THE_SOLSTICE = new Date('2026-06-21T20:21:34.470Z');

/*****************************************************************************************************************/

const SET_THE_DAY_AFTER = new Date('2026-06-22T20:21:44.413Z');

/*****************************************************************************************************************/

describe('sunset() from day to day', () => {
  it('is the coming sunset when asked from before it', () => {
    expect(sunset(LONDON).next(SOLSTICE)).toStrictEqual(SET_ON_THE_SOLSTICE);
  });

  it("is the next day's once the day's has passed", () => {
    expect(sunset(LONDON).next(new Date('2026-06-21T21:00:00Z'))).toStrictEqual(SET_THE_DAY_AFTER);
  });

  it('lies strictly after the instant, so re-arming from a sunset gives the next', () => {
    expect(sunset(LONDON).next(new Date(SET_ON_THE_SOLSTICE.getTime() - 1))).toStrictEqual(
      SET_ON_THE_SOLSTICE,
    );

    expect(sunset(LONDON).next(SET_ON_THE_SOLSTICE)).toStrictEqual(SET_THE_DAY_AFTER);
  });

  it('crosses the turn of the year', () => {
    expect(sunset(LONDON).next(new Date('2026-12-31T17:00:00Z'))).toStrictEqual(
      new Date('2027-01-01T16:01:55.555Z'),
    );
  });

  it('previews a sunset a day', () => {
    expect(
      preview(sunset(LONDON), { after: new Date('2026-06-20T22:00:00Z'), take: 2 }),
    ).toStrictEqual([SET_ON_THE_SOLSTICE, SET_THE_DAY_AFTER]);
  });
});

/*****************************************************************************************************************/

describe('sunset() around the world', () => {
  it('finds the sunset an observer far east sees early in the UTC day', () => {
    expect(sunset(AUCKLAND).next(SOLSTICE)).toStrictEqual(new Date('2026-06-21T05:11:39.018Z'));

    expect(sunset(AUCKLAND).next(new Date('2026-06-21T05:11:39.018Z'))).toStrictEqual(
      new Date('2026-06-22T05:11:52.668Z'),
    );
  });

  it('finds the sunset an observer far west sees after midnight UTC, filed under the day before', () => {
    expect(sunset(HONOLULU).next(new Date('2026-06-22T00:00:00Z'))).toStrictEqual(
      new Date('2026-06-22T05:16:18.205Z'),
    );

    expect(sunset(HONOLULU).next(new Date('2026-06-22T05:16:18.205Z'))).toStrictEqual(
      new Date('2026-06-23T05:16:30.125Z'),
    );
  });

  it('holds the sunset back for an observer above sea level', () => {
    expect(sunset({ ...LONDON, elevation: 100 }).next(SOLSTICE)).toStrictEqual(
      new Date('2026-06-21T20:24:04.845Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('sunset() purity', () => {
  it('is unaffected by later mutation of the observer it was given', () => {
    const place = { ...LONDON };

    const schedule = sunset(place);

    place.latitude = AUCKLAND.latitude;

    place.longitude = AUCKLAND.longitude;

    expect(schedule.next(SOLSTICE)).toStrictEqual(SET_ON_THE_SOLSTICE);
  });

  it('computes the same sunset from independent constructions', () => {
    expect(sunset(LONDON).next(SOLSTICE)).toStrictEqual(sunset(LONDON).next(SOLSTICE));
  });

  it('is bounded like any other schedule', () => {
    expect(
      preview(between(sunset(LONDON), { until: SET_ON_THE_SOLSTICE }), {
        after: new Date('2026-06-20T22:00:00Z'),
        take: 5,
      }),
    ).toStrictEqual([SET_ON_THE_SOLSTICE]);
  });
});

/*****************************************************************************************************************/

describe('sunset() refusal of what it is handed', () => {
  it('refuses a place that is not on the Earth, naming itself', () => {
    expect(() => sunset({ latitude: 90.5, longitude: 0 })).toThrow(
      'sunset() requires a latitude in degrees between -90 and 90',
    );

    expect(() => sunset({ latitude: 0, longitude: -181 })).toThrow(
      'sunset() requires a longitude in degrees between -180 and 180',
    );

    expect(() => sunset({ ...LONDON, elevation: Number.NaN })).toThrow(
      'sunset() requires a finite elevation in metres',
    );
  });

  it('refuses a coordinate that is null, rather than reading it as zero', () => {
    const place: unknown = { latitude: 0, longitude: null };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => sunset(place as Observer)).toThrow(
      'sunset() requires a longitude in degrees between -180 and 180',
    );
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => sunset(LONDON).next(new Date(Number.NaN))).toThrow(
      'sunset() requires a valid Date to advance from',
    );
  });
});

/*****************************************************************************************************************/
