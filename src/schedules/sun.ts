/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { getSunrise } from '@observerly/astrometry/sun';

import { MAXIMUM_INSTANT_IN_MILLISECONDS, MILLISECONDS_IN_DAY } from './constants';

import type { Schedule } from './contract';

/*****************************************************************************************************************/

// Schedules keyed to the Sun as seen from a place on Earth, resolved by observerly's own astrometry to the
// standard almanac convention: the upper limb of the Sun touching the horizon, refraction and the height of
// the observer included. The Sun keeps its own calendar, so these schedules are walked a day at a time rather
// than derived, each UTC day asked for its event until one lies strictly after the instant given.

/*****************************************************************************************************************/

// A place on Earth to see the Sun from: latitude and longitude in degrees, north and east positive, and an
// elevation above sea level in metres, sea level when omitted. Height brings the horizon down, and with it
// the sunrise forward.
export type Observer = {
  latitude: number;
  longitude: number;
  elevation?: number;
};

/*****************************************************************************************************************/

// How many days the walk asks before calling the schedule exhausted: a year and change, which reaches the
// next sunrise from anywhere the Sun rises at least once a year, as it does everywhere. Within a tenth of a
// degree of the poles, though, astrometry's day-by-day search steps over the one crossing of the horizon in
// some years, and at the poles themselves it finds none, so a gap longer than this reads as exhaustion and
// the walk ends rather than searching on forever.
const SEARCH_LIMIT_IN_DAYS = 400;

/*****************************************************************************************************************/

// astrometry resolves a date's event about the solar transit nearest the date's mean solar noon, which for an
// observer at the far west falls a full day past the date's midnight, and it refuses a date whose search
// leaves the range a Date can hold. Asked for the last day of that range by an observer more than 150 degrees
// west, it throws; asked for the day before, it never does. So the walk keeps two days clear of either end,
// one more than the calendar walks keep, and surrenders those days at the end of the year 275760 deliberately,
// as they do, rather than resolving the edge by a strategy of its own.
const HORIZON_IN_MILLISECONDS = MAXIMUM_INSTANT_IN_MILLISECONDS - 2 * MILLISECONDS_IN_DAY;

/*****************************************************************************************************************/

// The event astrometry resolves for a UTC date as seen by an observer, or null on a day the Sun never
// crosses the horizon.
type Resolve = (date: Date, observer: Observer) => Date | null;

/*****************************************************************************************************************/

// The observer as astrometry will see it, read once so the schedule stays pure however the object it was
// built from is changed afterwards, an elevation left out read as sea level. A place that is not on Earth, or
// a coordinate that is not a number at all, as data read without a type may carry, is refused here, loudly,
// because astrometry answers what it cannot place with silence, which would be a schedule that never fires
// and never says why. Only a finite number passes: a comparison lets a missing value through, and a null
// counts as zero.
const observerOf = (observer: Observer, method: string): Observer => {
  const { latitude, longitude, elevation = 0 } = observer;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError(`${method} requires a latitude in degrees between -90 and 90`);
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError(`${method} requires a longitude in degrees between -180 and 180`);
  }

  if (!Number.isFinite(elevation)) {
    throw new RangeError(`${method} requires a finite elevation in metres`);
  }

  return { latitude, longitude, elevation };
};

/*****************************************************************************************************************/

// The schedule of an event for an observer: each next occurrence the first the days yield strictly after the
// instant. The days are asked from the UTC day before the instant's, since an observer far east of Greenwich
// sees the Sun rise before the UTC date astrometry files that sunrise under, and a day's event never precedes
// the day before's, so the first found after the instant is the next.
const walk = (resolve: Resolve, method: string, observer: Observer): Schedule => {
  const place = observerOf(observer, method);

  return {
    next: after => {
      const reached = after.getTime();

      if (Number.isNaN(reached)) {
        throw new RangeError(`${method} requires a valid Date to advance from`);
      }

      const start = Math.floor(reached / MILLISECONDS_IN_DAY) - 1;

      for (let day = start; day < start + SEARCH_LIMIT_IN_DAYS; day += 1) {
        const midnight = day * MILLISECONDS_IN_DAY;

        // Nothing past the horizon can be asked for, so nothing past it can follow.
        if (midnight > HORIZON_IN_MILLISECONDS) {
          return null;
        }

        // A day before the horizon cannot be asked for either, but the days after it can.
        if (midnight < -HORIZON_IN_MILLISECONDS) {
          continue;
        }

        // A day without the event reads as NaN, which lies after nothing, so the walk moves past it without
        // a case of its own.
        const instant = resolve(new Date(midnight), place)?.getTime() ?? Number.NaN;

        if (instant > reached) {
          return new Date(instant);
        }
      }

      return null;
    },
  };
};

/*****************************************************************************************************************/

// The sunrises seen from a place on Earth, each the instant the upper limb of the Sun touches the horizon as
// it rises, on the days it does: none through a polar day or a polar night, when the Sun stays above the
// horizon or below it, and at the poles none at all, where the schedule exhausts rather than searches on.
export const sunrise = (observer: Observer): Schedule => walk(getSunrise, 'sunrise()', observer);

/*****************************************************************************************************************/
