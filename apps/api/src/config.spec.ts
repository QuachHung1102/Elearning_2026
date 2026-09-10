import { loadConfig } from './config.js';

const valid = {
  DATABASE_URL: 'postgresql://localhost/test',
  AUTH_JWT_SECRET: 'a'.repeat(32),
};

describe('loadConfig', () => {
  it('fails with the missing variable name', () => {
    expect(() =>
      loadConfig({ AUTH_JWT_SECRET: valid.AUTH_JWT_SECRET }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      loadConfig({ ...valid, AUTH_JWT_SECRET: 'too-short' }),
    ).toThrow(/AUTH_JWT_SECRET/);
  });
});
