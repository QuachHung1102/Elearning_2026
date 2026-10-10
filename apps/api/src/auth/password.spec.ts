import { randomBytes, scryptSync } from 'node:crypto';
import { hashPassword, needsRehash, verifyPassword } from './password.js';

const PASSWORD = 'correct horse battery staple';

/** A hash written the way this module used to: fixed parameters, none in the string. */
function legacyHash(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt-v1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** A current-format hash at parameters of the caller's choosing. */
function hashWith(password: string, ln: number, r: number, p: number): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, {
    N: 2 ** ln,
    r,
    p,
    maxmem: 512 * 1024 * 1024,
  });
  return `scrypt-v2$${ln}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

describe('password hashing', () => {
  it('only verifies the original password', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).not.toContain(PASSWORD);
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, 'invalid')).resolves.toBe(false);
  });

  // REVIEW F-11: N=2^14 with p=1 is under what OWASP asks of scrypt. N=2^15, r=8,
  // p=3 is one of its equivalent combinations for a quarter of the memory of its
  // first choice (measured: 157 ms and 32 MiB, against 238 ms and 128 MiB).
  it('writes its parameters into the hash, at the strength OWASP lists for scrypt', async () => {
    const [version, ln, r, p, salt, key, ...rest] = (await hashPassword(PASSWORD)).split('$');

    expect({ version, ln, r, p }).toEqual({ version: 'scrypt-v2', ln: '15', r: '8', p: '3' });
    expect(salt).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(key).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(rest).toEqual([]);
  });

  it('salts every hash', async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it('still verifies a hash written with the old fixed parameters', async () => {
    const hash = legacyHash(PASSWORD);

    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('verifies a hash at whatever parameters it carries', async () => {
    const hash = hashWith(PASSWORD, 14, 8, 5);

    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it.each([
    ['an unknown version', 'scrypt-v9$15$8$3$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)],
    ['a missing part', 'scrypt-v2$15$8$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)],
    ['an extra part', 'scrypt-v2$15$8$3$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86) + '$x'],
    ['a cost that is not a number', 'scrypt-v2$high$8$3$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)],
    ['a zero block size', 'scrypt-v2$15$0$3$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)],
    ['a zero parallelism', 'scrypt-v2$15$8$0$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)],
    // Read from our own database, but a hash that asks for a terabyte must not be derived.
    ['a cost that would need a terabyte', 'scrypt-v2$30$8$3$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86)],
    ['a salt of the wrong length', 'scrypt-v2$15$8$3$AAAA$' + 'A'.repeat(86)],
    ['a key of the wrong length', 'scrypt-v2$15$8$3$AAAAAAAAAAAAAAAAAAAAAA$AAAA'],
    ['characters outside base64url', 'scrypt-v2$15$8$3$AAAAAAAAAAAAAAAAAAAA+/$' + 'A'.repeat(86)],
    ['nothing', ''],
  ])('refuses %s', async (_label, hash) => {
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(false);
  });
});

describe('PASSWORD_HASH_COST=test (only .env.test sets it)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function passwordModule(cost: string) {
    vi.resetModules();
    vi.stubEnv('PASSWORD_HASH_COST', cost);
    return import('./password.js');
  }

  it('hashes at a cost the e2e suite can afford: 721 derivations at full cost doubled its time', async () => {
    const { hashPassword } = await passwordModule('test');

    expect((await hashPassword(PASSWORD)).startsWith('scrypt-v2$10$8$1$')).toBe(true);
  });

  it('still migrates a hash in the old format, though that is stronger than this', async () => {
    const { needsRehash } = await passwordModule('test');

    expect(needsRehash(legacyHash(PASSWORD))).toBe(true);
  });

  it('honours no other value', async () => {
    const { hashPassword } = await passwordModule('fast');

    expect((await hashPassword(PASSWORD)).startsWith('scrypt-v2$15$8$3$')).toBe(true);
  });
});

describe('needsRehash', () => {
  it('is true for a hash with the old fixed parameters', () => {
    expect(needsRehash(legacyHash(PASSWORD))).toBe(true);
  });

  it('is false for a hash written now', async () => {
    expect(needsRehash(await hashPassword(PASSWORD))).toBe(false);
  });

  it.each([
    ['cost', 14, 8, 3],
    ['block size', 15, 4, 3],
    ['parallelism', 15, 8, 2],
  ])('is true when the %s is below the current one', (_label, ln, r, p) => {
    expect(needsRehash(hashWith(PASSWORD, ln, r, p))).toBe(true);
  });

  it.each([
    ['cost', 16, 8, 3],
    ['parallelism', 15, 8, 4],
  ])('is false when the %s is above it: a stronger hash is not weakened', (_label, ln, r, p) => {
    expect(needsRehash(hashWith(PASSWORD, ln, r, p))).toBe(false);
  });

  it('is true for something that is not a hash at all', () => {
    expect(needsRehash('invalid')).toBe(true);
  });
});
