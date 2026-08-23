/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { add, subtract } from '../src/index';

/*****************************************************************************************************************/

const anchor = new Date('2026-09-01T09:30:00.000Z');

/*****************************************************************************************************************/

describe('date arithmetic', () => {
  it('adds a span to an instant', () => {
    expect(add(anchor, { hours: 1 })).toStrictEqual(new Date('2026-09-01T10:30:00.000Z'));

    expect(add(anchor, { days: 1, minutes: 30 })).toStrictEqual(
      new Date('2026-09-02T10:00:00.000Z'),
    );
  });

  it('subtracts a span from an instant', () => {
    expect(subtract(anchor, { hours: 1 })).toStrictEqual(new Date('2026-09-01T08:30:00.000Z'));

    expect(subtract(anchor, { minutes: 90 })).toStrictEqual(new Date('2026-09-01T08:00:00.000Z'));
  });

  it('mirrors: subtracting a span always undoes adding it', () => {
    const span = { days: 2, hours: 3, minutes: 4, seconds: 5, milliseconds: 6 };

    expect(subtract(add(anchor, span), span)).toStrictEqual(anchor);
  });

  it('accepts fractional spans', () => {
    expect(add(anchor, { days: 0.5 })).toStrictEqual(new Date('2026-09-01T21:30:00.000Z'));
  });

  it('never mutates the Date it was given', () => {
    const date = new Date(anchor);

    add(date, { hours: 5 });

    subtract(date, { hours: 5 });

    expect(date).toStrictEqual(anchor);
  });
});

/*****************************************************************************************************************/

describe('date arithmetic defensiveness', () => {
  it('treats a negative span as empty, in line with duration normalization', () => {
    expect(add(anchor, { minutes: -5 })).toStrictEqual(anchor);

    expect(subtract(anchor, { minutes: -5 })).toStrictEqual(anchor);
  });

  it('refuses an invalid Date loudly', () => {
    expect(() => add(new Date('not a date'), { hours: 1 })).toThrow(
      'date arithmetic requires a valid Date',
    );
  });

  it('refuses an instant outside the range a Date can hold loudly', () => {
    expect(() => add(new Date(8.64e15), { days: 365 })).toThrow(
      'date arithmetic produced an instant outside the range a Date can hold',
    );
  });
});

/*****************************************************************************************************************/
