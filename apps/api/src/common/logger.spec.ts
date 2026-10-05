import { logEvent, redact } from './logger.js';
import { requestContext } from './request-context.js';

/** What one `logEvent` wrote, and to which stream. */
function capture(write: () => void) {
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    write();
    const lines = (spy: typeof out) => spy.mock.calls.map(([line]) => String(line));
    return { stdout: lines(out), stderr: lines(err) };
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
}

describe('logEvent (ROADMAP §9, A5.7)', () => {
  it('writes one JSON line per event to stdout, with the time and the level', () => {
    const { stdout, stderr } = capture(() =>
      logEvent({ evt: 'checkout.created', purchaseId: 'p-1', appTransId: '260930_ab12cd34' }),
    );

    expect(stderr).toEqual([]);
    expect(stdout).toHaveLength(1);
    expect(stdout[0].endsWith('\n')).toBe(true);
    const line = JSON.parse(stdout[0]);
    expect(line).toMatchObject({
      level: 'info',
      evt: 'checkout.created',
      purchaseId: 'p-1',
      appTransId: '260930_ab12cd34',
    });
    expect(new Date(line.time).toISOString()).toBe(line.time);
  });

  it('sends errors to stderr', () => {
    const { stdout, stderr } = capture(() => logEvent({ evt: 'boom' }, 'error'));

    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr[0])).toMatchObject({ level: 'error', evt: 'boom' });
  });

  it('carries the id of the request it happens in, without being told', () => {
    const inside = capture(() =>
      requestContext.run({ requestId: 'req-12345678' }, () => logEvent({ evt: 'inside' })),
    );
    const outside = capture(() => logEvent({ evt: 'outside' }));

    expect(JSON.parse(inside.stdout[0]).requestId).toBe('req-12345678');
    expect(JSON.parse(outside.stdout[0])).not.toHaveProperty('requestId');
  });

  it('never fails the caller, even for a value JSON cannot hold', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => capture(() => logEvent({ evt: 'odd', circular, big: 10n }))).not.toThrow();
  });
});

describe('redact', () => {
  it.each([
    'password',
    'currentPassword',
    'passwordHash',
    'token',
    'accessToken',
    'authorization',
    'Authorization',
    'cookie',
    'set-cookie',
    'jwt',
    'secret',
    'clientSecret',
    'signature',
    'sig',
    'mac',
    'key1',
    'key2',
    'apiKey',
  ])('hides the value under %s', (key) => {
    expect(redact({ [key]: 'hunter2 is the value' })).toEqual({ [key]: '[redacted]' });
  });

  it('hides such a value at any depth, inside arrays too', () => {
    expect(
      redact({ request: { body: { email: 'a@b.c', password: 'hunter2' }, list: [{ token: 't' }] } }),
    ).toEqual({
      request: { body: { email: 'a@b.c', password: '[redacted]' }, list: [{ token: '[redacted]' }] },
    });
  });

  it('hides a value shaped like a JWT whatever it is called', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';

    expect(redact({ note: jwt, other: 'plain' })).toEqual({ note: '[redacted]', other: 'plain' });
  });

  it('leaves the ids an operator needs to follow a payment', () => {
    const event = { evt: 'payment.confirmed', purchaseId: 'p-1', appTransId: '260930_ab12cd34', userId: 'u-1', status: 'PAID' };

    expect(redact(event)).toEqual(event);
  });

  it('stops descending instead of looping on a cycle', () => {
    const cycle: Record<string, unknown> = { name: 'x' };
    cycle.self = cycle;

    expect(JSON.stringify(redact(cycle))).toContain('[truncated]');
  });
});
