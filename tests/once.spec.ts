/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, expectTypeOf, it } from 'vitest';

import { at, type Anchor } from '../src/index';

/*****************************************************************************************************************/

const instant = 1_900_000_000_123;

/*****************************************************************************************************************/

describe('at().once()', () => {
  it('fires once at exactly the anchored instant, to the millisecond', () => {
    const schedule = at(new Date(instant)).once();

    expect(schedule.next(new Date(0))).toStrictEqual(new Date(instant));

    expect(schedule.next(new Date(instant - 1))).toStrictEqual(new Date(instant));
  });

  it('exhausts once the instant has passed: re-arming from the fired occurrence returns null', () => {
    const schedule = at(new Date(instant)).once();

    expect(schedule.next(new Date(instant))).toBeNull();

    expect(schedule.next(new Date(instant + 1))).toBeNull();
  });

  it('refuses an invalid Date loudly at construction', () => {
    expect(() => at(new Date('not a date'))).toThrow('at() requires a valid Date');
  });

  it('is an anchor, not a schedule: the sentence must be finished', () => {
    expectTypeOf<Anchor>().not.toHaveProperty('next');

    expectTypeOf(at(new Date(instant)).once().next).toBeFunction();
  });
});

/*****************************************************************************************************************/

describe('at().once() immutability', () => {
  it('is unaffected by mutation of the Date it was given', () => {
    const date = new Date(instant);

    const schedule = at(date).once();

    date.setTime(0);

    expect(schedule.next(new Date(0))).toStrictEqual(new Date(instant));
  });

  it('is unaffected by mutation of a Date it returned', () => {
    const schedule = at(new Date(instant)).once();

    const first = schedule.next(new Date(0));

    first?.setTime(0);

    expect(schedule.next(new Date(0))).toStrictEqual(new Date(instant));
  });
});

/*****************************************************************************************************************/
