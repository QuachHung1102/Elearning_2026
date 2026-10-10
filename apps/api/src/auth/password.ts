import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

type Params = { ln: number; r: number; p: number };

/**
 * scrypt at N=2^15, r=8, p=3 (REVIEW F-11). OWASP asks for N=2^17, r=8, p=1
 * (128 MiB) and lists this among the equally strong combinations, for a quarter
 * of the memory. Measured on a Ryzen 5 5600X, Node 24: 157 ms and 32 MiB, against
 * 238 ms and 128 MiB, and 28 ms and 16 MiB for what this used to be.
 * The parameters are written into every hash, so they can be raised later and
 * old hashes are replaced as their owners log in (`needsRehash`).
 */
const CURRENT: Params =
  // Only `.env.test` sets it: 721 derivations at full cost doubled the e2e suite
  // (103 s to 205 s). `assertNoTestSettingsInProduction` keeps it out of production.
  process.env.PASSWORD_HASH_COST === 'test'
    ? { ln: 10, r: 8, p: 1 }
    : { ln: 15, r: 8, p: 3 };

/** The hashes written before the parameters were part of the string. */
const LEGACY: Params = { ln: 14, r: 8, p: 1 };

/** A stored hash that asks for more than this is refused, not derived. */
const MAX_MEMORY = 256 * 1024 * 1024;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

const memory = ({ ln, r }: Params) => 128 * 2 ** ln * r;

function deriveKey(
  password: string,
  salt: Buffer,
  { ln, r, p }: Params,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: 2 ** ln, r, p, maxmem: 2 * MAX_MEMORY },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

type Parsed = { version: 1 | 2; params: Params; salt: Buffer; key: Buffer };

/** `scrypt-v1$salt$key` or `scrypt-v2$ln$r$p$salt$key`; `null` for anything else. */
function parse(encoded: string): Parsed | null {
  const parts = encoded.split('$');
  let version: 1 | 2;
  let params: Params;
  let saltAndKey: string[];

  if (parts[0] === 'scrypt-v1' && parts.length === 3) {
    version = 1;
    params = LEGACY;
    saltAndKey = parts.slice(1);
  } else if (parts[0] === 'scrypt-v2' && parts.length === 6) {
    version = 2;
    const [ln, r, p] = parts.slice(1, 4).map((part) => Number(part));
    if (![ln, r, p].every((value) => Number.isInteger(value) && value >= 1)) {
      return null;
    }
    params = { ln, r, p };
    saltAndKey = parts.slice(4);
  } else {
    return null;
  }

  const [encodedSalt, encodedKey] = saltAndKey;
  if (
    memory(params) > MAX_MEMORY ||
    !BASE64URL.test(encodedSalt) ||
    !BASE64URL.test(encodedKey)
  ) {
    return null;
  }

  const salt = Buffer.from(encodedSalt, 'base64url');
  const key = Buffer.from(encodedKey, 'base64url');
  if (salt.length !== SALT_LENGTH || key.length !== KEY_LENGTH) return null;

  return { version, params, salt, key };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, CURRENT);
  const { ln, r, p } = CURRENT;

  return `scrypt-v2$${ln}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parse(encodedHash);
  if (!parsed) return false;

  const actualKey = await deriveKey(password, parsed.salt, parsed.params);
  return timingSafeEqual(actualKey, parsed.key);
}

/**
 * True for a hash in the old format, whatever its strength (its parameters are
 * not in the string, so it cannot be tuned), and for one written with weaker
 * parameters than today's. A stronger one is left alone: raising the cost must
 * not undo a cost that was raised further.
 */
export function needsRehash(encodedHash: string): boolean {
  const parsed = parse(encodedHash);
  return (
    !parsed ||
    parsed.version !== 2 ||
    parsed.params.ln < CURRENT.ln ||
    parsed.params.r < CURRENT.r ||
    parsed.params.p < CURRENT.p
  );
}
