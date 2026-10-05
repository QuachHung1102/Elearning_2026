import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';
import { isProductionEnv } from '../src/config/production.js';
import { PG_SESSION_OPTIONS } from '../src/prisma/pg-session.js';
import { seedCatalog } from './seed-catalog.js';
import { seedLearning } from './seed-learning.js';

if (isProductionEnv(process.env)) {
  throw new Error('Refusing to seed a production database');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, ...PG_SESSION_OPTIONS }),
});
const verifiedAt = new Date('2026-09-01T00:00:00.000Z');

const users = [
  {
    email: 'admin@elearning.local',
    password: 'Demo!Admin123',
    displayName: 'Quản trị viên',
    role: UserRole.ADMIN,
    emailVerifiedAt: verifiedAt,
  },
  {
    email: 'student1@elearning.local',
    password: 'Demo!Student123',
    displayName: 'Học viên một',
    role: UserRole.STUDENT,
    emailVerifiedAt: null,
  },
  {
    email: 'student2@elearning.local',
    password: 'Demo!Student123',
    displayName: 'Học viên hai',
    role: UserRole.STUDENT,
    emailVerifiedAt: null,
  },
  {
    email: 'student3@elearning.local',
    password: 'Demo!Student123',
    displayName: 'Học viên ba',
    role: UserRole.STUDENT,
    // No enrollment: the demo buyer, and checkout needs a verified email.
    emailVerifiedAt: verifiedAt,
  },
  {
    email: 'instructor@elearning.local',
    password: 'Demo!Instructor123',
    displayName: 'Giảng viên demo',
    role: UserRole.INSTRUCTOR,
    emailVerifiedAt: verifiedAt,
  },
] as const;

try {
  const passwordHashes = new Map<string, string>();
  for (const user of users) {
    let passwordHash = passwordHashes.get(user.password);
    if (!passwordHash) {
      passwordHash = await hashPassword(user.password);
      passwordHashes.set(user.password, passwordHash);
    }
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      update: {
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  }
  process.stdout.write(`Seeded ${users.length} demo accounts\n`);
  await seedCatalog(prisma);
  await seedLearning(prisma);
  const instructor = await prisma.user.findUniqueOrThrow({
    where: { email: 'instructor@elearning.local' },
    select: { id: true },
  });
  await prisma.course.updateMany({
    where: {
      slug: {
        in: ['kien-truc-backend-voi-nestjs', 'lap-trinh-di-dong-voi-react-native'],
      },
    },
    data: { instructorId: instructor.id },
  });
} finally {
  await prisma.$disconnect();
}
