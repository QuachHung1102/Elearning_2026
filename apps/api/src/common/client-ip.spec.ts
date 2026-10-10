import type { Request } from 'express';
import { clientIp } from './client-ip.js';

const SECRET = 'internal-secret-at-least-32-bytes-long';

function fakeRequest(headers: Record<string, string>): Request {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    ip: '10.0.0.5',
    socket: { remoteAddress: '10.0.0.5' },
    get: (name: string) => lower[name.toLowerCase()],
  } as unknown as Request;
}

// T4.17: the Next server fetches for its visitors, so without this every
// visitor shares the Next server's bucket.
describe('clientIp', () => {
  it('trusts the visitor IP the Next server forwards with the shared secret', () => {
    const request = fakeRequest({
      'X-Internal-Api-Secret': SECRET,
      'X-Visitor-Ip': '203.0.113.7',
    });
    expect(clientIp(request, SECRET)).toBe('203.0.113.7');
  });

  it('ignores a visitor IP sent without the secret', () => {
    const request = fakeRequest({ 'X-Visitor-Ip': '203.0.113.7' });
    expect(clientIp(request, SECRET)).toBe('10.0.0.5');
  });

  it.each([
    ['a wrong secret', 'internal-secret-at-least-32-bytes-lonG'],
    ['a prefix of the secret', SECRET.slice(0, 10)],
    ['an empty secret', ''],
  ])('ignores a visitor IP sent with %s', (_label, sent) => {
    const request = fakeRequest({
      'X-Internal-Api-Secret': sent,
      'X-Visitor-Ip': '203.0.113.7',
    });
    expect(clientIp(request, SECRET)).toBe('10.0.0.5');
  });

  it('ignores a forwarded value that is not an IP', () => {
    const request = fakeRequest({
      'X-Internal-Api-Secret': SECRET,
      'X-Visitor-Ip': 'not-an-ip',
    });
    expect(clientIp(request, SECRET)).toBe('10.0.0.5');
  });
});
