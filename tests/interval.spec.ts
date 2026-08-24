/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { every, preview } from '../src/index';

/*****************************************************************************************************************/

describe('every in minutes', () => {
  it('rounds an unaligned instant up to the next tick', () => {
    expect(every(5).minutes().next(new Date('2026-01-15T12:03:21Z'))).toStrictEqual(
      new Date('2026-01-15T12:05:00Z'),
    );
  });

  it('advances strictly past an instant already on a tick', () => {
    expect(every(5).minutes().next(new Date('2026-01-15T12:05:00Z'))).toStrictEqual(
      new Date('2026-01-15T12:10:00Z'),
    );
  });

  it('aligns to the epoch, not to when the schedule was built', () => {
    expect(every(5).minutes().next(new Date('1970-01-01T00:00:00.001Z'))).toStrictEqual(
      new Date('1970-01-01T00:05:00Z'),
    );
  });

  it('computes the same series from independent constructions', () => {
    const after = new Date('2026-06-01T09:17:43Z');

    expect(every(15).minutes().next(after)).toStrictEqual(every(15).minutes().next(after));
  });

  it('ticks into the next minute from the last millisecond of this one', () => {
    expect(every(1).minutes().next(new Date('2026-01-15T12:04:59.999Z'))).toStrictEqual(
      new Date('2026-01-15T12:05:00Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('every in hours', () => {
  it('rounds an unaligned instant up to the next hour', () => {
    expect(every(1).hours().next(new Date('2026-01-15T12:30:00Z'))).toStrictEqual(
      new Date('2026-01-15T13:00:00Z'),
    );
  });

  it('lands six hour ticks on their epoch aligned UTC boundaries', () => {
    expect(every(6).hours().next(new Date('2026-01-15T13:00:00Z'))).toStrictEqual(
      new Date('2026-01-15T18:00:00Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('every with fractional counts', () => {
  it('reads half a minute as a thirty second cadence', () => {
    expect(every(0.5).minutes().next(new Date('2026-01-15T12:00:10Z'))).toStrictEqual(
      new Date('2026-01-15T12:00:30Z'),
    );
  });

  it('reads one and a half hours as ninety minutes', () => {
    const after = new Date('2026-01-15T12:00:00Z');

    expect(every(1.5).hours().next(after)).toStrictEqual(every(90).minutes().next(after));
  });
});

/*****************************************************************************************************************/

describe('every under preview', () => {
  it('walks successive ticks, each strictly after the one before', () => {
    expect(
      preview(every(15).minutes(), { after: new Date('2026-01-15T12:00:00Z'), take: 3 }),
    ).toStrictEqual([
      new Date('2026-01-15T12:15:00Z'),
      new Date('2026-01-15T12:30:00Z'),
      new Date('2026-01-15T12:45:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('every at the end of time', () => {
  it('still returns the last tick a Date can hold', () => {
    expect(
      every(5)
        .minutes()
        .next(new Date(8_640_000_000_000_000 - 1)),
    ).toStrictEqual(new Date(8_640_000_000_000_000));
  });

  it('exhausts once the next tick would leave the range a Date can hold', () => {
    expect(every(5).minutes().next(new Date(8_640_000_000_000_000))).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('every defensiveness', () => {
  it.each([[0], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'refuses a count of %p loudly',
    count => {
      expect(() => every(count)).toThrow(RangeError);
    },
  );

  it('refuses a period that floors to nothing', () => {
    expect(() => every(0.000_000_1).minutes()).toThrow(RangeError);
  });

  it('refuses a finite count whose period overflows what a number can hold', () => {
    expect(() => every(Number.MAX_VALUE).minutes()).toThrow(RangeError);
  });

  it('refuses a period past what a number can count exactly', () => {
    expect(() => every(2 ** 53).minutes()).toThrow(RangeError);
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => every(5).minutes().next(new Date(Number.NaN))).toThrow(RangeError);
  });
});

/*****************************************************************************************************************/
