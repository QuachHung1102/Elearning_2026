import {
  assertDriverValuesAreKnown,
  assertNoDemoDriversInProduction,
  REAL_DRIVER,
} from './drivers.js';

describe('driver configuration', () => {
  it('rejects an unknown driver in development', () => {
    expect(() =>
      assertDriverValuesAreKnown({
        NODE_ENV: 'development',
        VIDEO_DRIVER: 'cloudfare',
      }),
    ).toThrow(/cloudfare/);
  });

  it.each(['', 'DEMO', 'demo ', 'true', undefined])(
    'rejects VIDEO_DRIVER=%j in production',
    (value) => {
      expect(() =>
        assertNoDemoDriversInProduction({
          NODE_ENV: 'production',
          ...REAL_DRIVER,
          VIDEO_DRIVER: value,
        }),
      ).toThrow(/VIDEO_DRIVER/);
    },
  );
});
