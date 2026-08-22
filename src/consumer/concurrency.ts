/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/consumer
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// A bounded pool: at most limit items in flight, started in array order, every item awaited. With a limit of 1
// this is strictly serial. The limit is floored and never allowed below 1, and a limit that is not finite means
// everything at once.
export const forEachConcurrently = async <Item>(
  items: readonly Item[],
  limit: number,
  work: (item: Item) => Promise<void>,
): Promise<void> => {
  const bounded = Number.isFinite(limit) ? Math.max(Math.floor(limit), 1) : items.length;

  let index = 0;

  const worker = async (): Promise<void> => {
    while (index < items.length) {
      const item = items[index];

      index += 1;

      if (item !== undefined) {
        // The await in this loop is the mechanism, not a mistake: each worker deliberately runs its items one
        // after another, and the concurrency comes from the number of workers, not from batching promises.
        // oxlint-disable-next-line no-await-in-loop
        await work(item);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(bounded, items.length) }, () => worker()));
};

/*****************************************************************************************************************/
