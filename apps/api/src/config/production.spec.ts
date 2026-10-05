import { assertNoTestSettingsInProduction, isProductionEnv } from './production.js';

describe('isProductionEnv (REVIEW F-28)', () => {
  it.each([
    ['NODE_ENV says production', { NODE_ENV: 'production' }],
    [
      'Railway names the environment production, whatever NODE_ENV says',
      { NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'production' },
    ],
    [
      'Railway names it production and NODE_ENV is unset',
      { RAILWAY_ENVIRONMENT_NAME: 'production' },
    ],
  ])('is true when %s', (_label, env) => {
    expect(isProductionEnv(env)).toBe(true);
  });

  it.each([
    ['nothing is set', {}],
    ['NODE_ENV is development', { NODE_ENV: 'development' }],
    ['NODE_ENV is test', { NODE_ENV: 'test' }],
    [
      'Railway names a staging environment',
      { NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'staging' },
    ],
    ['the Railway name only resembles production', { RAILWAY_ENVIRONMENT_NAME: 'production-preview' }],
  ])('is false when %s', (_label, env) => {
    expect(isProductionEnv(env)).toBe(false);
  });
});

describe('assertNoTestSettingsInProduction', () => {
  it.each([
    ['NODE_ENV says production', { NODE_ENV: 'production' }],
    ['Railway names the environment production', { RAILWAY_ENVIRONMENT_NAME: 'production' }],
  ])('refuses a weakened password cost when %s', (_label, env) => {
    expect(() => assertNoTestSettingsInProduction({ ...env, PASSWORD_HASH_COST: 'test' })).toThrow(
      /PASSWORD_HASH_COST/,
    );
  });

  it('refuses it whatever the value, since none is meant to be there', () => {
    expect(() =>
      assertNoTestSettingsInProduction({ NODE_ENV: 'production', PASSWORD_HASH_COST: '' }),
    ).toThrow(/PASSWORD_HASH_COST/);
  });

  it('lets development and the tests have it', () => {
    expect(() => assertNoTestSettingsInProduction({ NODE_ENV: 'test', PASSWORD_HASH_COST: 'test' })).not.toThrow();
    expect(() => assertNoTestSettingsInProduction({ RAILWAY_ENVIRONMENT_NAME: 'staging', PASSWORD_HASH_COST: 'test' })).not.toThrow();
  });

  it('has nothing to say about a production without it', () => {
    expect(() => assertNoTestSettingsInProduction({ NODE_ENV: 'production' })).not.toThrow();
  });
});
