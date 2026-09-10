export type PositionUpdate = { id: string; position: number };

/**
 * `(scopeId, position)` is unique and PostgreSQL uniques are not DEFERRABLE,
 * so assigning the final positions directly collides mid-transaction. Park
 * every row on a distinct negative position first, then write the real ones.
 *
 * The offset `-1` matters: a row moving to position 0 would be written as
 * `-0`, which PostgreSQL stores as `0` and which collides with whatever holds
 * 0 today. With `-(index + 1) - 1` the parking range is `[-(n+1), -2]` and
 * never touches 0, whatever base the caller counts from.
 *
 * DATA_MODEL.md §Section writes phase two as one `position = -position - 1`
 * UPDATE; Prisma's `updateMany` cannot reference a column on the right-hand
 * side, so phase two is written per id instead. Same end state, no raw SQL.
 */
export function reorderSteps(
  orderedIds: string[],
): [PositionUpdate[], PositionUpdate[]] {
  const park = orderedIds.map((id, index) => ({
    id,
    position: -(index + 1) - 1,
  }));
  const settle = orderedIds.map((id, index) => ({ id, position: index + 1 }));
  return [park, settle];
}

/** True when `orderedIds` is a permutation of `currentIds`. */
export function isSameSet(currentIds: string[], orderedIds: string[]): boolean {
  if (currentIds.length !== orderedIds.length) return false;
  const current = new Set(currentIds);
  return (
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => current.has(id))
  );
}
