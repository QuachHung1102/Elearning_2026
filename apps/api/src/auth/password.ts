import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: 16_384, r: 8, p: 1 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);

  return `scrypt-v1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [version, encodedSalt, encodedKey, extra] = encodedHash.split('$');

  if (
    version !== 'scrypt-v1' ||
    !encodedSalt ||
    !encodedKey ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSalt) ||
    !/^[A-Za-z0-9_-]+$/.test(encodedKey)
  ) {
    return false;
  }

  const salt = Buffer.from(encodedSalt, 'base64url');
  const expectedKey = Buffer.from(encodedKey, 'base64url');

  if (salt.length !== SALT_LENGTH || expectedKey.length !== KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveKey(password, salt);
  return timingSafeEqual(actualKey, expectedKey);
}
