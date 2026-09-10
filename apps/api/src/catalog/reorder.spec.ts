import { isSameSet, reorderSteps } from './reorder.js';

/**
 * Simulates one scope of a table with `@@unique([scopeId, position])`: every
 * write is rejected if another row already sits on that position, exactly the
 * way PostgreSQL rejects it inside the transaction.
 */
function applyInsideTransaction(
  rows: Map<string, number>,
  updates: { id: string; position: number }[],
): void {
  for (const update of updates) {
    for (const [id, position] of rows) {
      if (id !== update.id && position === update.position) {
        throw new Error(
          `unique violation: position ${position} already taken by ${id}`,
        );
      }
    }
    rows.set(update.id, update.position);
  }
}

describe('reorderSteps', () => {
  it('leaves 1..n contiguous with no duplicate', () => {
    const rows = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const [park, settle] = reorderSteps(['c', 'a', 'b']);
    applyInsideTransaction(rows, park);
    applyInsideTransaction(rows, settle);

    expect([...rows.entries()].sort()).toEqual([
      ['a', 2],
      ['b', 3],
      ['c', 1],
    ]);
    const positions = [...rows.values()].sort((left, right) => left - right);
    expect(positions).toEqual([1, 2, 3]);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('survives a swap of two neighbours, which is where a one-phase write breaks', () => {
    const rows = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const [park, settle] = reorderSteps(['b', 'a']);
    expect(() => {
      applyInsideTransaction(rows, park);
      applyInsideTransaction(rows, settle);
    }).not.toThrow();
    expect(rows.get('b')).toBe(1);
  });

  it('parks every row away from zero and away from every other row', () => {
    const [park] = reorderSteps(['a', 'b', 'c']);
    const parked = park.map((update) => update.position);
    expect(parked.every((position) => position < 0)).toBe(true);
    expect(new Set(parked).size).toBe(parked.length);
    expect(parked).not.toContain(0);
  });

  it('proves the naive one-phase write does collide', () => {
    const rows = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const [, settle] = reorderSteps(['b', 'a']);
    expect(() => applyInsideTransaction(rows, settle)).toThrow(
      /unique violation/,
    );
  });
});

describe('isSameSet', () => {
  it('accepts a permutation', () => {
    expect(isSameSet(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it.each([
    [['a', 'b'], ['a']],
    [['a', 'b'], ['a', 'c']],
    [['a', 'b'], ['a', 'a']],
  ])('rejects %j reordered as %j', (current, ordered) => {
    expect(isSameSet(current, ordered)).toBe(false);
  });
});
