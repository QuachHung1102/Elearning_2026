import { EventEmitter } from 'node:events';
import { requestLog } from './request-log.middleware.js';

function run(request: object, statusCode = 200) {
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const response = Object.assign(new EventEmitter(), { statusCode });
    const next = vi.fn();
    requestLog(request as never, response as never, next);
    const before = out.mock.calls.length;
    response.emit('finish');
    return {
      nextCalled: next.mock.calls.length,
      loggedBeforeFinish: before,
      lines: out.mock.calls.map(([line]) => JSON.parse(String(line))),
    };
  } finally {
    out.mockRestore();
  }
}

describe('requestLog', () => {
  it('writes one line when the response is done, and lets the request go on at once', () => {
    const { nextCalled, loggedBeforeFinish, lines } = run({
      method: 'POST',
      path: '/api/v1/auth/login',
      requestId: 'req-12345678',
      auth: { user: { id: 'user-1' } },
    });

    expect(nextCalled).toBe(1);
    expect(loggedBeforeFinish).toBe(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      evt: 'http',
      requestId: 'req-12345678',
      method: 'POST',
      path: '/api/v1/auth/login',
      status: 200,
      userId: 'user-1',
    });
    expect(lines[0].ms).toEqual(expect.any(Number));
  });

  it('names no user for a request nobody signed', () => {
    const { lines } = run({ method: 'GET', path: '/api/v1/courses', requestId: 'req-12345678' }, 404);

    expect(lines[0].status).toBe(404);
    expect(lines[0]).not.toHaveProperty('userId');
  });

  // The signed media URL carries its signature in the query string, a reset link its token.
  it('logs the path, never the query string, headers or body', () => {
    const { lines } = run({
      method: 'GET',
      path: '/api/v1/media/local/videos/x.mp4',
      url: '/api/v1/media/local/videos/x.mp4?exp=1&sig=SECRET-SIGNATURE',
      originalUrl: '/api/v1/media/local/videos/x.mp4?exp=1&sig=SECRET-SIGNATURE',
      headers: {
        cookie: 'elearning_session=SECRET-JWT',
        authorization: 'Bearer SECRET-JWT',
        'user-agent': 'SECRET-PLAIN-HEADER',
      },
      // Redaction would hide a password; the point is that the body is not read at all.
      body: { password: 'SECRET-PASSWORD', email: 'SECRET-PLAIN-BODY@example.com' },
      requestId: 'req-12345678',
    });

    expect(JSON.stringify(lines)).not.toContain('SECRET');
    expect(lines[0].path).toBe('/api/v1/media/local/videos/x.mp4');
  });
});
