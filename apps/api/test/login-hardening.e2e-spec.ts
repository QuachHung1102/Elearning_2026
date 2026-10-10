import { randomBytes, scryptSync } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { hashPassword } from '../src/auth/password.js';
import { PASSWORD, bootApp, cookieJar, createUser, truncateAll } from './support.js';

// Lets a test change something at the moment a hash has been computed and not yet stored.
const hooks = vi.hoisted(() => ({ afterHashing: undefined as undefined | (() => Promise<void>) }));
vi.mock('../src/auth/password.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/auth/password.js')>();
  return {
    ...original,
    hashPassword: async (password: string) => {
      const hash = await original.hashPassword(password);
      const hook = hooks.afterHashing;
      hooks.afterHashing = undefined;
      await hook?.();
      return hash;
    },
  };
});

/**
 * REVIEW F-11, API_CONTRACT.md §8: a login is limited per account as well as per
 * client address, and a password hash written with weaker parameters than
 * today's is replaced by a current one when its owner logs in.
 */
describe('login hardening (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: Awaited<ReturnType<typeof bootApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await bootApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  /** One CSRF pair serves every login of a test; each login gets an address of its own. */
  async function loginer() {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf');
    const cookie = cookieJar(csrf.headers['set-cookie']).join('; ');
    let address = 0;
    return (email: string, password: string) => {
      address += 1;
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Real-IP', `203.0.113.${address}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email, password });
    };
  }

  const wrong = 'not the password';

  describe('per account', () => {
    it('refuses the 11th attempt on one account in a quarter of an hour, whichever address it comes from', async () => {
      const user = await createUser(prisma, 'STUDENT');
      const login = await loginer();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect((await login(user.email, wrong)).status).toBe(401);
      }
      // Even the right password: it is the guessing that is being stopped.
      const refused = await login(user.email, PASSWORD);

      expect(refused.status).toBe(429);
      expect(refused.headers['retry-after']).toMatch(/^[1-9]\d*$/);
      expect(refused.body).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
    });

    it('leaves every other account alone', async () => {
      const [target, bystander] = [await createUser(prisma, 'STUDENT'), await createUser(prisma, 'STUDENT')];
      const login = await loginer();
      for (let attempt = 0; attempt < 11; attempt += 1) await login(target.email, wrong);

      expect((await login(bystander.email, PASSWORD)).status).toBe(200);
    });

    it('limits an address nobody registered in exactly the same way, so the limit says nothing about who has an account', async () => {
      const login = await loginer();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect((await login('nobody@example.com', wrong)).status).toBe(401);
      }

      expect((await login('nobody@example.com', wrong)).status).toBe(429);
    });

    it('counts an address written in another case as the same account', async () => {
      const user = await createUser(prisma, 'STUDENT');
      const login = await loginer();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await login(attempt % 2 ? user.email.toUpperCase() : user.email, wrong);
      }

      expect((await login(user.email.toUpperCase(), PASSWORD)).status).toBe(429);
    });

    it('starts counting again after a login that succeeds', async () => {
      const user = await createUser(prisma, 'STUDENT');
      const login = await loginer();
      for (let attempt = 0; attempt < 9; attempt += 1) await login(user.email, wrong);
      expect((await login(user.email, PASSWORD)).status).toBe(200);

      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect((await login(user.email, wrong)).status).toBe(401);
      }
      expect((await login(user.email, wrong)).status).toBe(429);
    });
  });

  describe('a hash written with the old fixed parameters', () => {
    /** As `hashPassword` wrote it before the parameters were part of the string. */
    function legacyHash(password: string) {
      const salt = randomBytes(16);
      const key = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
      return `scrypt-v1$${salt.toString('base64url')}$${key.toString('base64url')}`;
    }
    const storedHash = async (id: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { id }, omit: { passwordHash: false } })).passwordHash;

    async function legacyUser() {
      const user = await createUser(prisma, 'STUDENT');
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: legacyHash(PASSWORD) } });
      return user;
    }

    it('is replaced by one at the current strength when its owner logs in, and the password still works', async () => {
      const user = await legacyUser();
      const login = await loginer();

      expect((await login(user.email, PASSWORD)).status).toBe(200);

      expect(await storedHash(user.id)).toMatch(/^scrypt-v2\$10\$8\$1\$/);
      expect((await login(user.email, PASSWORD)).status).toBe(200);
      expect((await login(user.email, wrong)).status).toBe(401);
    });

    it('is not rewritten by a login when it is already current', async () => {
      const user = await createUser(prisma, 'STUDENT');
      const before = await storedHash(user.id);
      const login = await loginer();

      expect((await login(user.email, PASSWORD)).status).toBe(200);

      expect(await storedHash(user.id)).toBe(before);
    });

    it('is left alone when the password was wrong', async () => {
      const user = await legacyUser();
      const before = await storedHash(user.id);
      const login = await loginer();

      expect((await login(user.email, wrong)).status).toBe(401);

      expect(await storedHash(user.id)).toBe(before);
    });

    it('still logs its owner in when the upgrade cannot be stored', async () => {
      const user = await legacyUser();
      const before = await storedHash(user.id);
      const login = await loginer();
      hooks.afterHashing = async () => {
        throw new Error('the hash could not be computed');
      };

      expect((await login(user.email, PASSWORD)).status).toBe(200);

      expect(await storedHash(user.id)).toBe(before);
    });

    it('does not undo a password changed while the login was in flight', async () => {
      const user = await legacyUser();
      const login = await loginer();
      const newHash = await hashPassword('a password chosen a moment later');
      // The change lands after the old password was checked and before the upgrade is stored.
      hooks.afterHashing = async () => {
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
      };

      expect((await login(user.email, PASSWORD)).status).toBe(200);

      expect(await storedHash(user.id)).toBe(newHash);
    });
  });
});
