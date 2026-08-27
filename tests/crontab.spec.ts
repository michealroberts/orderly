/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { parseCron } from '../src/index';

/*****************************************************************************************************************/

describe('parseCron across whole expressions', () => {
  it('expands the run always expression to every value of every field', () => {
    const parsed = parseCron('* * * * *');

    expect(parsed.minutes).toHaveLength(60);

    expect(parsed.hours).toHaveLength(24);

    expect(parsed.daysOfMonth).toHaveLength(31);

    expect(parsed.months).toHaveLength(12);

    expect(parsed.daysOfWeek).toStrictEqual([1, 2, 3, 4, 5, 6, 7]);

    expect(parsed.daysOfMonthRestricted).toBe(false);

    expect(parsed.daysOfWeekRestricted).toBe(false);
  });

  it('reads a daily nine in the morning expression', () => {
    const parsed = parseCron('0 9 * * *');

    expect(parsed.minutes).toStrictEqual([0]);

    expect(parsed.hours).toStrictEqual([9]);
  });

  it('survives surrounding and repeated whitespace', () => {
    expect(parseCron('  0   9 * * *  ').hours).toStrictEqual([9]);
  });
});

/*****************************************************************************************************************/

describe('parseCron across lists, ranges and steps', () => {
  it('expands a step over the whole field', () => {
    expect(parseCron('*/15 * * * *').minutes).toStrictEqual([0, 15, 30, 45]);
  });

  it('expands a stepped range from its low end', () => {
    expect(parseCron('10-40/10 * * * *').minutes).toStrictEqual([10, 20, 30, 40]);
  });

  it('merges lists and ranges, deduplicated and ascending', () => {
    expect(parseCron('30,10,1-3,2-4 * * * *').minutes).toStrictEqual([1, 2, 3, 4, 10, 30]);
  });

  it('keeps a single value as itself', () => {
    expect(parseCron('* * 15 * *').daysOfMonth).toStrictEqual([15]);
  });
});

/*****************************************************************************************************************/

describe('parseCron across names', () => {
  it('reads month names in any casing', () => {
    expect(parseCron('0 0 * JAN,jul *').months).toStrictEqual([1, 7]);
  });

  it('reads month name ranges', () => {
    expect(parseCron('0 0 * MAR-MAY *').months).toStrictEqual([3, 4, 5]);
  });

  it('reads weekday name ranges into Monday first numbering', () => {
    expect(parseCron('0 0 * * MON-FRI').daysOfWeek).toStrictEqual([1, 2, 3, 4, 5]);
  });

  it('reads the names carrying the letters of Quartz extensions', () => {
    expect(parseCron('0 0 * JUL *').months).toStrictEqual([7]);

    expect(parseCron('0 0 * * WED').daysOfWeek).toStrictEqual([3]);
  });
});

/*****************************************************************************************************************/

describe('parseCron across weekday numbering', () => {
  it('reads 1 as Sunday, the way Cloudflare counts, normalized to 7', () => {
    expect(parseCron('0 0 * * 1').daysOfWeek).toStrictEqual([7]);
  });

  it('reads 7 as Saturday, normalized to 6', () => {
    expect(parseCron('0 0 * * 7').daysOfWeek).toStrictEqual([6]);
  });

  it('reads the full digit range as every weekday', () => {
    expect(parseCron('0 0 * * 1-7').daysOfWeek).toStrictEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

/*****************************************************************************************************************/

describe('parseCron day restriction flags', () => {
  it('marks a written day of month as restricted', () => {
    const parsed = parseCron('0 0 1 * *');

    expect(parsed.daysOfMonthRestricted).toBe(true);

    expect(parsed.daysOfWeekRestricted).toBe(false);
  });

  it('marks a written day of week as restricted', () => {
    const parsed = parseCron('0 0 * * MON');

    expect(parsed.daysOfMonthRestricted).toBe(false);

    expect(parsed.daysOfWeekRestricted).toBe(true);
  });

  it('marks both days as restricted when both are written', () => {
    const parsed = parseCron('0 0 13 * FRI');

    expect(parsed.daysOfMonthRestricted).toBe(true);

    expect(parsed.daysOfWeekRestricted).toBe(true);
  });

  it('marks a written full range as restricted, exactly as classic cron reads it', () => {
    const parsed = parseCron('0 0 1-31 * *');

    expect(parsed.daysOfMonth).toHaveLength(31);

    expect(parsed.daysOfMonthRestricted).toBe(true);
  });
});

/*****************************************************************************************************************/

describe('parseCron defensiveness', () => {
  it.each([[''], ['* * * *'], ['* * * * * *']])(
    'refuses "%s" for not having five fields',
    expression => {
      expect(() => parseCron(expression)).toThrow(RangeError);
    },
  );

  it.each([
    ['60 * * * *'],
    ['* 24 * * *'],
    ['* * 0 * *'],
    ['* * 32 * *'],
    ['* * * 0 *'],
    ['* * * 13 *'],
    ['* * * * 8'],
  ])('refuses "%s" for a value outside its field', expression => {
    expect(() => parseCron(expression)).toThrow(RangeError);
  });

  it.each([
    ['40-10 * * * *'],
    ['1-2-3 * * * *'],
    ['*/0 * * * *'],
    ['5/15 * * * *'],
    ['*/5/2 * * * *'],
    ['1,,5 * * * *'],
    ['a * * * *'],
    ['1.5 * * * *'],
    ['-5 * * * *'],
    ['1- * * * *'],
    ['0 0 * * MONDAY'],
  ])('refuses the malformed expression "%s" loudly', expression => {
    expect(() => parseCron(expression)).toThrow(RangeError);
  });
});

/*****************************************************************************************************************/

describe('parseCron refusal wording', () => {
  it('refuses 0 in the day of week field, explaining the Sunday first counting', () => {
    expect(() => parseCron('0 0 * * 0')).toThrow(/1 through 7, with 1 meaning Sunday/u);
  });

  it('quotes the original token when a range side is missing', () => {
    expect(() => parseCron('-5 * * * *')).toThrow(/"-5"/u);

    expect(() => parseCron('1- * * * *')).toThrow(/"1-"/u);
  });

  it.each([['0 9 L * *'], ['59 23 LW * *'], ['0 10 * * MON#2'], ['0 0 ? * *'], ['0 0 15W * *']])(
    'refuses the Quartz extension in "%s" by name',
    expression => {
      expect(() => parseCron(expression)).toThrow(/not supported/u);
    },
  );
});

/*****************************************************************************************************************/
