/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { between, preview, sunrise, type Observer } from '../src/index';

/*****************************************************************************************************************/

// The expected instants are astrometry's own for the UTC date each sunrise is filed under, pinned at 0.69.0
// and checked against the almanac to the minute. The walk from day to day is what is under test here, not
// the astronomy.

/*****************************************************************************************************************/

// Near the prime meridian: the almanac gives 04:43 BST on the June solstice and 08:06 GMT at New Year.
const LONDON: Observer = { latitude: 51.5074, longitude: -0.1278 };

/*****************************************************************************************************************/

// Far east of Greenwich, where a morning sunrise falls on the UTC date before the one it is filed under: the
// almanac gives 07:33 NZST on the June solstice, which is 19:33 UTC the day before.
const AUCKLAND: Observer = { latitude: -36.8485, longitude: 174.7633 };

/*****************************************************************************************************************/

// Far west of Greenwich, where sunrise comes late in the UTC day: the almanac gives 05:50 HST on the June
// solstice, which is 15:50 UTC.
const HONOLULU: Observer = { latitude: 21.3069, longitude: -157.8583 };

/*****************************************************************************************************************/

const SOLSTICE = new Date('2026-06-21T00:00:00Z');

/*****************************************************************************************************************/

const RISE_ON_THE_SOLSTICE = new Date('2026-06-21T03:43:04.677Z');

/*****************************************************************************************************************/

const RISE_THE_DAY_AFTER = new Date('2026-06-22T03:43:18.739Z');

/*****************************************************************************************************************/

describe('sunrise() from day to day', () => {
  it('is the coming sunrise when asked from before it', () => {
    expect(sunrise(LONDON).next(SOLSTICE)).toStrictEqual(RISE_ON_THE_SOLSTICE);
  });

  it("is the next day's once the day's has passed", () => {
    expect(sunrise(LONDON).next(new Date('2026-06-21T05:00:00Z'))).toStrictEqual(
      RISE_THE_DAY_AFTER,
    );
  });

  it('lies strictly after the instant, so re-arming from a sunrise gives the next', () => {
    expect(sunrise(LONDON).next(new Date(RISE_ON_THE_SOLSTICE.getTime() - 1))).toStrictEqual(
      RISE_ON_THE_SOLSTICE,
    );

    expect(sunrise(LONDON).next(RISE_ON_THE_SOLSTICE)).toStrictEqual(RISE_THE_DAY_AFTER);
  });

  it('crosses the turn of the year', () => {
    expect(sunrise(LONDON).next(new Date('2026-12-31T09:00:00Z'))).toStrictEqual(
      new Date('2027-01-01T08:06:10.025Z'),
    );
  });

  it('previews a sunrise a day', () => {
    expect(
      preview(sunrise(LONDON), { after: new Date('2026-06-20T12:00:00Z'), take: 2 }),
    ).toStrictEqual([RISE_ON_THE_SOLSTICE, RISE_THE_DAY_AFTER]);
  });
});

/*****************************************************************************************************************/

describe('sunrise() around the world', () => {
  it('finds the sunrise an observer far east sees before the UTC date it is filed under', () => {
    expect(sunrise(AUCKLAND).next(new Date('2026-06-20T12:00:00Z'))).toStrictEqual(
      new Date('2026-06-20T19:33:39.822Z'),
    );

    expect(sunrise(AUCKLAND).next(new Date('2026-06-20T19:33:39.822Z'))).toStrictEqual(
      new Date('2026-06-21T19:33:52.978Z'),
    );
  });

  it('finds the sunrise an observer far west sees late in the UTC day', () => {
    expect(sunrise(HONOLULU).next(SOLSTICE)).toStrictEqual(new Date('2026-06-21T15:50:23.090Z'));

    expect(sunrise(HONOLULU).next(new Date('2026-06-21T15:50:23.090Z'))).toStrictEqual(
      new Date('2026-06-22T15:50:36.823Z'),
    );
  });

  it('brings the sunrise forward for an observer above sea level', () => {
    expect(sunrise({ ...LONDON, elevation: 100 }).next(SOLSTICE)).toStrictEqual(
      new Date('2026-06-21T03:40:34.219Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('sunrise() purity', () => {
  it('is unaffected by later mutation of the observer it was given', () => {
    const place = { ...LONDON };

    const schedule = sunrise(place);

    place.latitude = AUCKLAND.latitude;

    place.longitude = AUCKLAND.longitude;

    expect(schedule.next(SOLSTICE)).toStrictEqual(RISE_ON_THE_SOLSTICE);
  });

  it('computes the same sunrise from independent constructions', () => {
    expect(sunrise(LONDON).next(SOLSTICE)).toStrictEqual(sunrise(LONDON).next(SOLSTICE));
  });

  it('is bounded like any other schedule', () => {
    expect(
      preview(between(sunrise(LONDON), { until: RISE_ON_THE_SOLSTICE }), {
        after: new Date('2026-06-20T12:00:00Z'),
        take: 5,
      }),
    ).toStrictEqual([RISE_ON_THE_SOLSTICE]);
  });
});

/*****************************************************************************************************************/

describe('sunrise() refusal of what it is handed', () => {
  it('refuses a latitude that is not on the Earth', () => {
    for (const latitude of [Number.NaN, 90.5, -91, Number.POSITIVE_INFINITY]) {
      expect(() => sunrise({ latitude, longitude: 0 })).toThrow(
        'sunrise() requires a latitude in degrees between -90 and 90',
      );
    }
  });

  it('refuses a longitude that is not on the Earth', () => {
    for (const longitude of [Number.NaN, 180.5, -181, Number.NEGATIVE_INFINITY]) {
      expect(() => sunrise({ latitude: 0, longitude })).toThrow(
        'sunrise() requires a longitude in degrees between -180 and 180',
      );
    }
  });

  it('refuses an elevation that is not a height', () => {
    for (const elevation of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => sunrise({ ...LONDON, elevation })).toThrow(
        'sunrise() requires a finite elevation in metres',
      );
    }
  });

  it('accepts the edges of the Earth and a place below sea level', () => {
    expect(() => sunrise({ latitude: -90, longitude: 180 })).not.toThrow();

    expect(() => sunrise({ latitude: 90, longitude: -180, elevation: -430 })).not.toThrow();
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => sunrise(LONDON).next(new Date(Number.NaN))).toThrow(
      'sunrise() requires a valid Date to advance from',
    );
  });
});

/*****************************************************************************************************************/

describe('sunrise() refusal of data without a type', () => {
  it('refuses a place whose coordinate is missing or null, rather than reading it as zero', () => {
    const missing: unknown[] = [{}, { latitude: null, longitude: 0 }, { longitude: 0 }];

    for (const place of missing) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      expect(() => sunrise(place as Observer)).toThrow(
        'sunrise() requires a latitude in degrees between -90 and 90',
      );
    }

    const misplaced: unknown[] = [{ latitude: 0 }, { latitude: 0, longitude: null }];

    for (const place of misplaced) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      expect(() => sunrise(place as Observer)).toThrow(
        'sunrise() requires a longitude in degrees between -180 and 180',
      );
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => sunrise({ ...LONDON, elevation: null } as unknown as Observer)).toThrow(
      'sunrise() requires a finite elevation in metres',
    );
  });
});

/*****************************************************************************************************************/
