import { requestContext } from './request-context.js';

const REDACTED = '[redacted]';
const TRUNCATED = '[truncated]';
const MAX_DEPTH = 6;

// A key that names a credential, whatever it holds. `\bsig\b`, `\bmac\b`: short
// enough to match `mac` and `sig` but not `macro` or `signal`.
const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|jwt|signature|\bsig\b|\bmac\b|key[12]\b|api-?key|hash|credential/i;
// A JWT under any name: the session cookie's value, a token pasted into a message.
const JWT = /^eyJ[\w-]*\.[\w-]*\.[\w-]*$/;

/**
 * A copy of `value` that cannot leak a credential, for a log line. Nothing in
 * this API logs a request's body, headers or query string (`requestLog` writes
 * the path only); this is the net under whoever adds a field later.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return JWT.test(value) ? REDACTED : value;
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= MAX_DEPTH) return TRUNCATED;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? REDACTED : redact(item, depth + 1),
    ]),
  );
}

/**
 * One JSON line per event: stdout for information, stderr for errors. It picks
 * up the id of the request it happens in (`requestContext`), so a line written
 * deep in a service still leads back to the `X-Request-Id` the client saw.
 * Logging never fails the work it describes.
 */
export function logEvent(
  event: Record<string, unknown>,
  level: 'info' | 'error' = 'info',
): void {
  try {
    const line = {
      time: new Date().toISOString(),
      level,
      requestId: requestContext.getStore()?.requestId,
      ...(redact(event) as Record<string, unknown>),
    };
    (level === 'error' ? process.stderr : process.stdout).write(
      `${JSON.stringify(line)}\n`,
    );
  } catch {
    // A value JSON cannot hold (a BigInt): drop the line, keep the request.
  }
}
