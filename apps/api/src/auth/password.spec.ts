import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('only verifies the original password', async () => {
    const password = 'correct horse battery staple';
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
    await expect(verifyPassword(password, 'invalid')).resolves.toBe(false);
  });
});
