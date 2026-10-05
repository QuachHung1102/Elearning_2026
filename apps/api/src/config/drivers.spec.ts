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

  it('rejects demo drivers when only Railway says production (N5.2, REVIEW F-28)', () => {
    expect(() =>
      assertNoDemoDriversInProduction({ RAILWAY_ENVIRONMENT_NAME: 'production' }),
    ).toThrow(/VIDEO_DRIVER/);
  });

  it('lets a Railway staging environment keep its demo drivers', () => {
    expect(() =>
      assertNoDemoDriversInProduction({ RAILWAY_ENVIRONMENT_NAME: 'staging' }),
    ).not.toThrow();
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
