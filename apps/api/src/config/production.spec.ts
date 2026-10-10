import { assertNoTestSettingsInProduction, isProductionEnv } from './production.js';

describe('isProductionEnv (REVIEW F-28)', () => {
  it('is true when NODE_ENV says production', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' })).toBe(true);
  });

  it.each([
    ['nothing is set', {}],
    ['NODE_ENV is development', { NODE_ENV: 'development' }],
    ['NODE_ENV is test', { NODE_ENV: 'test' }],
    ['NODE_ENV only resembles production', { NODE_ENV: 'production-preview' }],
  ])('is false when %s', (_label, env) => {
    expect(isProductionEnv(env)).toBe(false);
  });
});

describe('assertNoTestSettingsInProduction', () => {
  it('refuses a weakened password cost in production', () => {
    expect(() =>
      assertNoTestSettingsInProduction({ NODE_ENV: 'production', PASSWORD_HASH_COST: 'test' }),
    ).toThrow(/PASSWORD_HASH_COST/);
  });

  it('refuses it whatever the value, since none is meant to be there', () => {
    expect(() =>
      assertNoTestSettingsInProduction({ NODE_ENV: 'production', PASSWORD_HASH_COST: '' }),
    ).toThrow(/PASSWORD_HASH_COST/);
  });

  it('lets development and the tests have it', () => {
    expect(() => assertNoTestSettingsInProduction({ NODE_ENV: 'test', PASSWORD_HASH_COST: 'test' })).not.toThrow();
    expect(() => assertNoTestSettingsInProduction({ NODE_ENV: 'development', PASSWORD_HASH_COST: 'test' })).not.toThrow();
  });

  it('has nothing to say about a production without it', () => {
    expect(() => assertNoTestSettingsInProduction({ NODE_ENV: 'production' })).not.toThrow();
  });
});
