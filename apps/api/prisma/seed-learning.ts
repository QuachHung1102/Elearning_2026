import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  EnrollmentSource,
  EnrollmentStatus,
} from '../src/generated/prisma/enums.js';

const GRANTED_AT = new Date('2026-09-01T03:00:00.000Z');
const C1 = 'lap-trinh-web-voi-react-va-nextjs';
const C2 = 'typescript-cho-nguoi-da-biet-javascript';

const ENROLLMENTS = [
  { email: 'student1@elearning.local', slug: C1 },
  { email: 'student1@elearning.local', slug: C2 },
  { email: 'student2@elearning.local', slug: C1 },
] as const;

const COMPLETED_LESSONS = 8;
const IN_PROGRESS_POSITION_SECONDS = 42;

/**
 * Written directly, not through EnrollmentService: seed data is not an admin
 * action, so it leaves no audit rows (DATA_MODEL.md §Dữ liệu seed). Re-running
 * puts every seeded row back to the same state, ACTIVE included.
 */
export async function seedLearning(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@elearning.local' },
  });

  for (const { email, slug } of ENROLLMENTS) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const course = await prisma.course.findUniqueOrThrow({ where: { slug } });
    const state = {
      status: EnrollmentStatus.ACTIVE,
      source: EnrollmentSource.MANUAL_GRANT,
      grantedById: admin.id,
      grantedAt: GRANTED_AT,
      revokedAt: null,
    };
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      create: { userId: user.id, courseId: course.id, ...state },
      update: state,
    });
  }

  // student1 on C1: the first eight lessons in curriculum order are done and
  // the ninth is half-watched, with the newest `updatedAt` so it is the
  // `resumeLessonId` the player jumps to.
  const student1 = await prisma.user.findUniqueOrThrow({
    where: { email: 'student1@elearning.local' },
  });
  const lessons = await prisma.lesson.findMany({
    where: { section: { course: { slug: C1 } } },
    orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
    take: COMPLETED_LESSONS + 1,
  });
  for (const [index, lesson] of lessons.entries()) {
    const done = index < COMPLETED_LESSONS;
    const at = new Date(GRANTED_AT.getTime() + (index + 1) * 3_600_000);
    const state = {
      lastPositionSeconds: done
        ? lesson.durationSeconds
        : Math.min(IN_PROGRESS_POSITION_SECONDS, lesson.durationSeconds),
      completedAt: done ? at : null,
      createdAt: at,
      updatedAt: at,
    };
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: student1.id, lessonId: lesson.id } },
      create: { userId: student1.id, lessonId: lesson.id, ...state },
      update: state,
    });
  }

  // The counter is a real number at all times: recount rather than trusting
  // whatever earlier runs or manual grants left behind.
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      _count: {
        select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } },
      },
    },
  });
  for (const course of courses) {
    await prisma.course.update({
      where: { id: course.id },
      data: { enrollmentCount: course._count.enrollments },
    });
  }

  process.stdout.write(
    `Seeded ${ENROLLMENTS.length} enrollments, ${lessons.length} lesson progress rows\n`,
  );
}
