/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { at, preview, type Schedule } from '../src/index';

/*****************************************************************************************************************/

// A conforming schedule over a fixed list of instants, as in schedule.spec.ts.
const listed = (...instants: number[]): Schedule => {
  return {
    next: after => {
      const found = instants.find(instant => instant > after.getTime());

      return found === undefined ? null : new Date(found);
    },
  };
};

// A deliberately broken schedule whose occurrence never advances.
const stuck: Schedule = { next: () => new Date(1_000) };

/*****************************************************************************************************************/

describe('preview', () => {
  it('walks the next occurrences, each becoming the cursor for the one after it', () => {
    const occurrences = preview(listed(1_000, 2_000, 3_000), { after: new Date(0), take: 3 });

    expect(occurrences).toStrictEqual([new Date(1_000), new Date(2_000), new Date(3_000)]);
  });

  it('returns fewer when the schedule exhausts first', () => {
    expect(preview(listed(1_000, 2_000), { after: new Date(0), take: 5 })).toHaveLength(2);
  });

  it('previews a one shot as a single occurrence', () => {
    const occurrences = preview(at(new Date(9_000)).once(), { after: new Date(0), take: 3 });

    expect(occurrences).toStrictEqual([new Date(9_000)]);
  });

  it('is exclusive of the instant walked from', () => {
    expect(preview(listed(1_000), { after: new Date(1_000), take: 3 })).toStrictEqual([]);
  });
});

/*****************************************************************************************************************/

describe('preview defensiveness', () => {
  it.each([
    [0, 0],
    [-3, 0],
    [2.9, 2],
    [Number.POSITIVE_INFINITY, 0],
  ])('clamps a take of %d to %d occurrences', (take, expected) => {
    expect(preview(listed(1_000, 2_000, 3_000), { after: new Date(0), take })).toHaveLength(
      expected,
    );
  });

  it('refuses an invalid after Date loudly', () => {
    expect(() => preview(listed(1_000), { after: new Date('not a date'), take: 1 })).toThrow(
      'preview() requires a valid after Date',
    );
  });

  it('says so loudly when a schedule fails to advance, rather than looping forever', () => {
    expect(() => preview(stuck, { after: new Date(1_000), take: 2 })).toThrow(
      'preview() was handed a schedule whose occurrences do not advance',
    );
  });
});

/*****************************************************************************************************************/
