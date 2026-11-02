/** Add the authored project lessons to the isolated review DB. No production seed. */
import 'dotenv/config';
import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  CourseLevel,
  VideoProvider,
  VideoAssetStatus,
  CourseStatus,
  LessonType,
  StorageProvider,
  EnrollmentStatus,
  EnrollmentSource,
} from '../src/generated/prisma/client.js';
import { PG_SESSION_OPTIONS } from '../src/prisma/pg-session.js';
import { buildSearchText } from '../src/catalog/search-text.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const connectionString = process.env.DATABASE_URL ?? '';
const target = new URL(connectionString);
if (
  process.env.NODE_ENV === 'production' ||
  target.hostname !== '127.0.0.1' ||
  target.port !== '55435' ||
  target.pathname !== '/template1'
) {
  throw new Error(
    'This script only writes to the isolated CodingBuddy review database.',
  );
}
type Project = {
  slug: string;
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  categoryName: string;
  categorySlug: string;
  outcomes: string[];
  requirements: string[];
  section: string;
  lessons: {
    title: string;
    file: string;
    video?: string;
    durationSeconds?: number;
  }[];
  downloads: string[];
  priceVnd: number;
  availability: 'available' | 'planned';
  publicTrial: boolean;
  level: CourseLevel;
  milestones?: string[];
};
const projects = JSON.parse(
  await readFile(
    resolve(root, 'apps/web/src/content/project-courses.json'),
    'utf8',
  ),
) as Project[];
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, ...PG_SESSION_OPTIONS }),
});
const storageRoot = resolve(
  process.cwd(),
  process.env.STORAGE_LOCAL_DIR ?? '.storage',
);
try {
  // Retire old demo and foundation offerings without deleting enrollments/progress.
  await prisma.course.updateMany({
    where: {
      slug: { notIn: projects.map((project) => project.slug) },
      status: CourseStatus.PUBLISHED,
    },
    data: { status: CourseStatus.ARCHIVED, archivedAt: new Date() },
  });
  for (const project of projects) {
    const category = await prisma.category.upsert({
      where: { slug: project.categorySlug },
      create: {
        slug: project.categorySlug,
        name: project.categoryName,
        position: 9,
      },
      update: {},
    });
    const planned = project.availability === 'planned';
    const description = planned
      ? `## Dự án đang chuẩn bị\n\n${project.subtitle.vi}\n\nHọc phí dự kiến: ${project.priceVnd.toLocaleString('vi-VN')}₫. Chưa mở đăng ký học; nội dung chi tiết và tài liệu sẽ được bổ sung trước khi mở lớp.\n\n## Phạm vi dự kiến\n\n${project.outcomes.map((line) => `- ${line}`).join('\n')}\n\n## Các mốc thực hiện\n\n${(project.milestones ?? []).map((line, i) => `${i + 1}. ${line}`).join('\n')}`
      : !project.publicTrial
        ? `## Học qua dự án\n\n${project.subtitle.vi}\n\nĐăng ký trực tiếp qua Zalo của Hải Nam. Khóa học hiện gồm ${project.lessons.length} bài đọc thực hành bằng tiếng Việt: chuẩn bị dữ liệu, xây logic xử lý và tạo báo cáo HTML. Mỗi bài có mã Python chạy bằng thư viện chuẩn, dữ liệu mẫu, bài tập và cách tự kiểm tra. Video sẽ được bổ sung sau.\n\n## Phiên bản bạn xây dựng\n\nBắt đầu với công cụ chạy cục bộ bằng CSV và Python, sau đó xuất một báo cáo HTML có thể mở bằng trình duyệt. Giao diện nâng cao là hướng mở rộng; không cần chờ video để làm các bài đọc hiện có.\n\n## Cách tham gia\n\nNhắn tên khóa học và email tài khoản cho Nam. Sau khi xác nhận đăng ký, Nam cấp quyền học cho tài khoản đó; tiến độ được lưu trong Khóa học của tôi.`
      : `## Dự án học thử miễn phí\n\n${project.subtitle.vi}\n\nBốn video hướng dẫn của Hải Nam, bài đọc thực hành và mã nguồn. Mở cho mọi người, không cần tài khoản.\n\n[Học ngay miễn phí](/trial/books)\n\n## Cách học\n\nXem một phần, dừng video để làm thử, rồi đọc ghi chú và kiểm tra kết quả.\n\n## Mã nguồn\n\n${project.downloads.map((file) => `- [${file}](/downloads/projects/${file})`).join('\n')}`;
    const data = {
      title: project.title.vi,
      subtitle: project.subtitle.vi,
      description,
      searchText: buildSearchText(
        project.title.vi + ' ' + project.title.en.replace(/-/g, ' '),
        project.subtitle.vi + ' ' + project.subtitle.en,
      ),
      categoryId: category.id,
      level: project.level,
      language: 'vi',
      learningOutcomes: project.outcomes,
      requirements: project.requirements,
      targetAudience: [
        'Bạn 10–15 tuổi muốn làm một dự án nhỏ có ích',
        'Người học muốn thực hành và giải thích được điều mình viết',
      ],
      priceVnd: project.priceVnd,
      compareAtPriceVnd: null,
      status: CourseStatus.PUBLISHED,
      archivedAt: null,
      lessonCount: project.lessons.length,
      totalDurationSeconds: project.lessons.reduce(
        (total, lesson) => total + (lesson.durationSeconds ?? 0),
        0,
      ),
      ratingAverage: null,
      ratingCount: 0,
      demoStats: false,
    };
    const course = await prisma.course.upsert({
      where: { slug: project.slug },
      create: { slug: project.slug, ...data, publishedAt: new Date() },
      update: data,
    });
    const section = await prisma.section.upsert({
      where: { courseId_position: { courseId: course.id, position: 1 } },
      create: { courseId: course.id, position: 1, title: project.section },
      update: { title: project.section },
    });
    for (const [index, entry] of project.lessons.entries()) {
      const content = await readFile(
        resolve(root, 'content/project-lessons', entry.file),
        'utf8',
      );
      const video = entry.video
        ? await prisma.videoAsset.upsert({
            where: {
              provider_externalId: {
                provider: VideoProvider.DEMO,
                externalId: `books/lesson-${String(index + 1).padStart(2, '0')}`,
              },
            },
            create: {
              provider: VideoProvider.DEMO,
              externalId: `books/lesson-${String(index + 1).padStart(2, '0')}`,
              status: VideoAssetStatus.READY,
              durationSeconds: entry.durationSeconds ?? 0,
            },
            update: {
              status: VideoAssetStatus.READY,
              durationSeconds: entry.durationSeconds ?? 0,
            },
          })
        : null;
      const lessonData = {
        title: entry.title,
        type: entry.video ? LessonType.VIDEO : LessonType.ARTICLE,
        videoAssetId: video?.id ?? null,
        content,
        isPreview: project.publicTrial,
        durationSeconds: entry.durationSeconds ?? 0,
      };
      const lesson = await prisma.lesson.upsert({
        where: {
          sectionId_position: { sectionId: section.id, position: index + 1 },
        },
        create: { sectionId: section.id, position: index + 1, ...lessonData },
        update: lessonData,
      });
      if (index !== project.lessons.length - 1) continue;
      for (const [position, file] of project.downloads.entries()) {
        const source = resolve(
          root,
          'apps/web/public/downloads/projects',
          file,
        );
        const objectKey = `lessons/${lesson.id}/resources/${file}`;
        const destination = resolve(storageRoot, objectKey);
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(source, destination);
        const contentType = file.endsWith('.html')
          ? 'text/html'
          : file.endsWith('.csv')
            ? 'text/csv'
            : 'text/plain';
        const resource = {
          storage: StorageProvider.DEMO,
          objectKey,
          filename: file,
          contentType,
          sizeBytes: (await stat(source)).size,
        };
        await prisma.lessonResource.upsert({
          where: {
            lessonId_position: { lessonId: lesson.id, position: position + 1 },
          },
          create: { lessonId: lesson.id, position: position + 1, ...resource },
          update: resource,
        });
      }
    }
    // Like seed-learning.ts: review fixtures are not a real admin action.
    // Preserve existing progress; give the documented demo learner full access.
    const student = await prisma.user.findUnique({
      where: { email: 'student1@elearning.local' },
    });
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@elearning.local' },
    });
    if (student && admin && project.publicTrial) {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: student.id, courseId: course.id } },
        create: {
          userId: student.id,
          courseId: course.id,
          status: EnrollmentStatus.ACTIVE,
          source: EnrollmentSource.MANUAL_GRANT,
          grantedById: admin.id,
        },
        update: {},
      });
      await prisma.course.update({
        where: { id: course.id },
        data: {
          enrollmentCount: await prisma.enrollment.count({
            where: { courseId: course.id, status: EnrollmentStatus.ACTIVE },
          }),
        },
      });
    }
    console.log(
      `Local project ready: ${project.slug} (${project.priceVnd} VND, ${project.availability})`,
    );
  }
} finally {
  await prisma.$disconnect();
}
