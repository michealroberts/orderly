/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The crontab notation, parsed the way Cloudflare's cron triggers read it: five fields, minute, hour, day of
// month, month and day of week, with lists, ranges, steps, JAN through DEC and SUN through SAT. Day of week
// digits count 1 through 7 from Sunday, as Cloudflare counts them, and are normalized here to the module's
// Monday first numbering. The Quartz extensions L, W, # and ? are refused loudly rather than misread, and a
// parsed expression is data, not a schedule: the cron constructor turns it into one.

/*****************************************************************************************************************/

// A cron expression expanded to the exact values each field allows. Arrays are ascending, deduplicated and
// never empty.
export type ParsedCron = {
  // Minutes of the hour, 0 through 59.
  minutes: number[];
  // Hours of the day, 0 through 23.
  hours: number[];
  // Days of the month, 1 through 31.
  daysOfMonth: number[];
  // Months of the year, 1 through 12.
  months: number[];
  // Days of the week, normalized to 1 through 7 with Monday first, the numbering WallClock reads.
  daysOfWeek: number[];
  // Whether the day of month field was written as anything other than the lone *. Even a full range like 1-31
  // counts as written, exactly as classic cron reads it: once both day fields are written, a day matches when
  // either does, so a schedule needs to know how each was written, not just what it expanded to.
  daysOfMonthRestricted: boolean;
  // Whether the day of week field was written as anything other than the lone *.
  daysOfWeekRestricted: boolean;
};

/*****************************************************************************************************************/

// Each field speaks its own name in every refusal, so a five field expression pinpoints its own mistake.
type FieldSpecification = {
  name: string;
  minimum: number;
  maximum: number;
  names: Record<string, number>;
  // Spoken after the allowed range in refusals when the counting needs explaining, as Sunday first does.
  counting?: string;
};

/*****************************************************************************************************************/

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

// Cloudflare's numbering: Sunday is 1 and Saturday is 7, unlike the Unix crontab where Sunday is 0.
const WEEKDAY_NAMES: Record<string, number> = {
  SUN: 1,
  MON: 2,
  TUE: 3,
  WED: 4,
  THU: 5,
  FRI: 6,
  SAT: 7,
};

/*****************************************************************************************************************/

const MINUTE_FIELD: FieldSpecification = { name: 'minute', minimum: 0, maximum: 59, names: {} };

const HOUR_FIELD: FieldSpecification = { name: 'hour', minimum: 0, maximum: 23, names: {} };

const DAY_OF_MONTH_FIELD: FieldSpecification = {
  name: 'day of month',
  minimum: 1,
  maximum: 31,
  names: {},
};

const MONTH_FIELD: FieldSpecification = {
  name: 'month',
  minimum: 1,
  maximum: 12,
  names: MONTH_NAMES,
};

const DAY_OF_WEEK_FIELD: FieldSpecification = {
  name: 'day of week',
  minimum: 1,
  maximum: 7,
  names: WEEKDAY_NAMES,
  counting: 'with 1 meaning Sunday, as Cloudflare counts',
};

/*****************************************************************************************************************/

// The shapes the Quartz extensions take, checked only after a token fails to read as a name or a number, so
// names carrying their letters, JUL and WED among them, are never mistaken for them.
const QUARTZ_SHAPES = /^(?:l|lw|\d+w|\d+l|[a-z]{3}#\d+|\d+#\d+|\?)$/iu;

const valueOf = (token: string, field: FieldSpecification): number => {
  const named = field.names[token.toUpperCase()];

  if (named !== undefined) {
    return named;
  }

  if (!/^\d+$/u.test(token)) {
    if (QUARTZ_SHAPES.test(token)) {
      throw new RangeError(
        `the Quartz extensions L, W, # and ? are not supported: got "${token}" in the ${field.name} field`,
      );
    }

    throw new RangeError(`the ${field.name} field cannot read "${token}"`);
  }

  const value = Number(token);

  if (value < field.minimum || value > field.maximum) {
    const counting = field.counting === undefined ? '' : `, ${field.counting}`;

    throw new RangeError(
      `the ${field.name} field allows ${field.minimum} through ${field.maximum}${counting}: got "${token}"`,
    );
  }

  return value;
};

/*****************************************************************************************************************/

const spanOf = (body: string, field: FieldSpecification): [number, number] => {
  if (body === '*') {
    return [field.minimum, field.maximum];
  }

  const pieces = body.split('-');

  if (pieces.length === 1) {
    const value = valueOf(body, field);

    return [value, value];
  }

  if (pieces.length !== 2) {
    throw new RangeError(
      `a cron range takes a single dash: got "${body}" in the ${field.name} field`,
    );
  }

  const start = pieces[0] ?? '';

  const end = pieces[1] ?? '';

  if (start === '' || end === '') {
    throw new RangeError(
      `a cron range needs a value on both sides of its dash: got "${body}" in the ${field.name} field`,
    );
  }

  const low = valueOf(start, field);

  const high = valueOf(end, field);

  if (low > high) {
    throw new RangeError(`a cron range runs low to high: got "${body}" in the ${field.name} field`);
  }

  return [low, high];
};

/*****************************************************************************************************************/

const strideOf = (step: string, field: FieldSpecification, atom: string): number => {
  if (!/^\d+$/u.test(step) || Number(step) < 1) {
    throw new RangeError(
      `a cron step must be a whole number of at least one: got "${atom}" in the ${field.name} field`,
    );
  }

  return Number(step);
};

/*****************************************************************************************************************/

// One entry of a field's comma list: *, a value or a range, each with an optional step, expanded to the values
// it names. A step needs something spanning more than one value before its slash, or it could only misread.
const expandAtom = (atom: string, field: FieldSpecification): number[] => {
  const pieces = atom.split('/');

  if (pieces.length > 2) {
    throw new RangeError(
      `a cron step takes a single slash: got "${atom}" in the ${field.name} field`,
    );
  }

  const body = pieces[0] ?? '';

  const step = pieces[1];

  if (step !== undefined && body !== '*' && !body.includes('-')) {
    throw new RangeError(
      `a cron step needs * or a range before the slash: got "${atom}" in the ${field.name} field`,
    );
  }

  const stride = step === undefined ? 1 : strideOf(step, field, atom);

  const [low, high] = spanOf(body, field);

  const values: number[] = [];

  for (let value = low; value <= high; value += stride) {
    values.push(value);
  }

  return values;
};

/*****************************************************************************************************************/

const parseField = (text: string, field: FieldSpecification): number[] => {
  const values = new Set<number>();

  for (const atom of text.split(',')) {
    if (atom === '') {
      throw new RangeError(
        `a cron list cannot hold an empty entry: got "${text}" in the ${field.name} field`,
      );
    }

    for (const value of expandAtom(atom, field)) {
      values.add(value);
    }
  }

  return [...values].toSorted((first, second) => first - second);
};

/*****************************************************************************************************************/

// From Cloudflare's Sunday first numbering to the module's Monday first numbering WallClock reads.
const mondayFirst = (sundayFirst: number): number => (sundayFirst === 1 ? 7 : sundayFirst - 1);

/*****************************************************************************************************************/

export const parseCron = (expression: string): ParsedCron => {
  const trimmed = expression.trim();

  const fields = trimmed === '' ? [] : trimmed.split(/\s+/u);

  if (fields.length !== 5) {
    throw new RangeError(
      `a cron expression needs five fields, minute, hour, day of month, month and day of week: got ${fields.length}`,
    );
  }

  const dayOfMonthField = fields[2] ?? '';

  const dayOfWeekField = fields[4] ?? '';

  return {
    minutes: parseField(fields[0] ?? '', MINUTE_FIELD),
    hours: parseField(fields[1] ?? '', HOUR_FIELD),
    daysOfMonth: parseField(dayOfMonthField, DAY_OF_MONTH_FIELD),
    months: parseField(fields[3] ?? '', MONTH_FIELD),
    daysOfWeek: parseField(dayOfWeekField, DAY_OF_WEEK_FIELD)
      .map(value => mondayFirst(value))
      .toSorted((first, second) => first - second),
    daysOfMonthRestricted: dayOfMonthField !== '*',
    daysOfWeekRestricted: dayOfWeekField !== '*',
  };
};

/*****************************************************************************************************************/
