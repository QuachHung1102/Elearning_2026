import { PrismaService } from '../src/prisma/prisma.service.js';

// The adapter writes a Date as UTC wall-clock text with no offset, which the
// server reads in the session TimeZone. Pin a non-UTC default for the role so
// this spec fails on any server (CI's Postgres is UTC by default) once the
// connection stops forcing UTC.
describe('database session time zone (REVIEW F-01)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const setup = new PrismaService();
    await setup.$executeRawUnsafe(
      `ALTER ROLE CURRENT_USER SET timezone = 'Asia/Bangkok'`,
    );
    await setup.$disconnect();
    prisma = new PrismaService(); // new pool, so new sessions see the default
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`ALTER ROLE CURRENT_USER RESET timezone`);
    await prisma.$disconnect();
  });

  it('runs every connection in UTC whatever the role default is', async () => {
    const [{ tz }] = await prisma.$queryRaw<{ tz: string }[]>`
      SELECT current_setting('TimeZone') AS tz`;
    expect(tz).toBe('UTC');
  });

  it('stores a Date at the instant it names', async () => {
    const sent = new Date('2026-01-01T00:00:00.000Z');
    const [{ epoch }] = await prisma.$queryRaw<{ epoch: number }[]>`
      SELECT extract(epoch FROM (${sent}::timestamptz))::float8 AS epoch`;
    expect(epoch).toBe(sent.getTime() / 1000);
  });
});
