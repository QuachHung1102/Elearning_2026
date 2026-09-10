import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  CourseLevel,
  CourseStatus,
  LessonType,
  StorageProvider,
  VideoAssetStatus,
  VideoProvider,
} from '../src/generated/prisma/enums.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { buildSearchText } from '../src/catalog/search-text.js';

const PUBLISHED_AT = new Date('2026-09-01T02:00:00.000Z');
const ARCHIVED_AT = new Date('2026-09-05T02:00:00.000Z');

const CATEGORIES = [
  { position: 1, slug: 'lap-trinh-web', name: 'Lập trình web', icon: 'code-xml' },
  { position: 2, slug: 'lap-trinh-di-dong', name: 'Lập trình di động', icon: 'smartphone' },
  { position: 3, slug: 'du-lieu-va-ai', name: 'Dữ liệu và AI', icon: 'brain-circuit' },
  { position: 4, slug: 'thiet-ke', name: 'Thiết kế', icon: 'palette' },
  { position: 5, slug: 'marketing', name: 'Marketing', icon: 'megaphone' },
  { position: 6, slug: 'kinh-doanh', name: 'Kinh doanh', icon: 'briefcase' },
  { position: 7, slug: 'ngoai-ngu', name: 'Ngoại ngữ', icon: 'languages' },
  { position: 8, slug: 'ky-nang-mem', name: 'Kỹ năng mềm', icon: 'users' },
] as const;

type CourseSeed = {
  key: string;
  slug: string;
  title: string;
  categorySlug: string;
  level: CourseLevel;
  priceVnd: number;
  compareAtPriceVnd: number | null;
  status: CourseStatus;
  ratingAverage: string | null;
  ratingCount: number;
  color: [number, number, number];
  /** Lessons per section; length is the section count. */
  lessonsPerSection: number[];
  /** The last lesson of the first N sections is an ARTICLE. */
  articleSections: number;
  /** Sections whose first lesson is a preview. */
  previewSections: number[];
  topics: string[];
  resources: number;
};

const COURSES: CourseSeed[] = [
  {
    key: 'c1',
    slug: 'lap-trinh-web-voi-react-va-nextjs',
    title: 'Lập trình web với React và Next.js',
    categorySlug: 'lap-trinh-web',
    level: CourseLevel.INTERMEDIATE,
    priceVnd: 899_000,
    compareAtPriceVnd: 1_490_000,
    status: CourseStatus.PUBLISHED,
    ratingAverage: '4.8',
    ratingCount: 312,
    color: [13, 148, 136],
    lessonsPerSection: [5, 5, 5, 5, 4],
    articleSections: 3,
    previewSections: [1, 2],
    topics: [
      'Bắt đầu',
      'Thành phần và trạng thái',
      'Định tuyến và layout',
      'Kết nối dữ liệu',
      'Đưa sản phẩm lên môi trường thật',
    ],
    resources: 6,
  },
  {
    key: 'c2',
    slug: 'typescript-cho-nguoi-da-biet-javascript',
    title: 'TypeScript cho người đã biết JavaScript',
    categorySlug: 'lap-trinh-web',
    level: CourseLevel.BEGINNER,
    priceVnd: 499_000,
    compareAtPriceVnd: 790_000,
    status: CourseStatus.PUBLISHED,
    ratingAverage: '4.6',
    ratingCount: 128,
    color: [15, 118, 110],
    lessonsPerSection: [4, 4, 4],
    articleSections: 2,
    previewSections: [1],
    topics: ['Kiểu cơ bản', 'Kiểu nâng cao', 'Áp dụng vào dự án thật'],
    resources: 2,
  },
  {
    key: 'c3',
    slug: 'phan-tich-du-lieu-voi-python-va-pandas',
    title: 'Phân tích dữ liệu với Python và Pandas',
    categorySlug: 'du-lieu-va-ai',
    level: CourseLevel.BEGINNER,
    priceVnd: 590_000,
    compareAtPriceVnd: null,
    status: CourseStatus.PUBLISHED,
    ratingAverage: '4.7',
    ratingCount: 95,
    color: [3, 105, 161],
    lessonsPerSection: [4, 4, 4],
    articleSections: 2,
    previewSections: [1],
    topics: ['Làm quen dữ liệu', 'Làm sạch và biến đổi', 'Trực quan hóa'],
    resources: 2,
  },
  {
    key: 'c4',
    slug: 'thiet-ke-giao-dien-voi-figma',
    title: 'Thiết kế giao diện với Figma',
    categorySlug: 'thiet-ke',
    level: CourseLevel.ALL_LEVELS,
    priceVnd: 690_000,
    compareAtPriceVnd: 990_000,
    status: CourseStatus.PUBLISHED,
    ratingAverage: '4.5',
    ratingCount: 64,
    color: [217, 119, 6],
    lessonsPerSection: [4, 4, 4],
    articleSections: 2,
    previewSections: [1],
    topics: ['Nền tảng Figma', 'Hệ thống thiết kế', 'Bàn giao cho lập trình'],
    resources: 2,
  },
  {
    key: 'c5',
    slug: 'kien-truc-backend-voi-nestjs',
    title: 'Kiến trúc backend với NestJS',
    categorySlug: 'lap-trinh-web',
    level: CourseLevel.ADVANCED,
    priceVnd: 1_290_000,
    compareAtPriceVnd: null,
    status: CourseStatus.DRAFT,
    ratingAverage: null,
    ratingCount: 0,
    color: [71, 85, 105],
    lessonsPerSection: [2],
    articleSections: 0,
    previewSections: [],
    topics: ['Module và tiêm phụ thuộc'],
    resources: 0,
  },
  {
    key: 'c6',
    slug: 'lap-trinh-di-dong-voi-react-native',
    title: 'Lập trình di động với React Native',
    categorySlug: 'lap-trinh-di-dong',
    level: CourseLevel.INTERMEDIATE,
    priceVnd: 790_000,
    compareAtPriceVnd: null,
    status: CourseStatus.ARCHIVED,
    ratingAverage: '4.3',
    ratingCount: 41,
    color: [124, 45, 18],
    lessonsPerSection: [3, 3],
    articleSections: 1,
    previewSections: [1],
    topics: ['Dựng ứng dụng đầu tiên', 'Điều hướng và trạng thái'],
    resources: 0,
  },
];

const AUDIENCE: Record<CourseLevel, string[]> = {
  BEGINNER: [
    'Người mới bắt đầu, chưa có kinh nghiệm trong lĩnh vực này',
    'Sinh viên muốn có một lộ trình học rõ ràng',
    'Người đi làm muốn chuyển hướng nghề nghiệp',
  ],
  INTERMEDIATE: [
    'Người đã biết cơ bản và muốn làm được sản phẩm hoàn chỉnh',
    'Lập trình viên muốn hệ thống lại kiến thức rời rạc',
    'Người chuẩn bị nhận dự án thật đầu tiên',
  ],
  ADVANCED: [
    'Người đã đi làm và chịu trách nhiệm về kiến trúc hệ thống',
    'Trưởng nhóm kỹ thuật cần chuẩn hóa cách làm cho cả nhóm',
    'Người muốn đi sâu vào các quyết định đánh đổi',
  ],
  ALL_LEVELS: [
    'Người mới bắt đầu muốn có nền tảng vững',
    'Người đã có kinh nghiệm muốn cập nhật cách làm mới',
    'Người làm nghề tự do cần một quy trình lặp lại được',
  ],
};

function description(course: CourseSeed): string {
  const bullets = course.topics
    .map((topic) => `- ${topic}: học qua ví dụ chạy được, không dừng ở lý thuyết.`)
    .join('\n');
  return `## Khóa học này dạy gì

Khóa **${course.title}** đi từ nền tảng tới một sản phẩm chạy thật. Mỗi chương kết thúc bằng một phần việc bạn tự làm được, và toàn bộ ví dụ đều lấy từ tình huống thực tế thay vì bài tập giả định.

${bullets}

Sau khóa học, bạn có một sản phẩm hoàn chỉnh trong hồ sơ năng lực và một cách làm lặp lại được cho những dự án tiếp theo.`;
}

function requirements(course: CourseSeed): string[] {
  return [
    'Máy tính cá nhân và kết nối internet',
    course.level === CourseLevel.ADVANCED
      ? 'Đã có kinh nghiệm lập trình ít nhất một năm'
      : 'Không cần kiến thức nền — khóa học bắt đầu từ đầu',
  ];
}

/**
 * Deterministic 16:9 solid-colour PNG so seeded courses have a real cover
 * behind a real object key. A published course with no cover would contradict
 * the publish gate the same seed data is meant to demonstrate.
 */
function solidPng(width: number, height: number, rgb: [number, number, number]) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const shade = 1 - (y / height) * 0.35;
      raw[row + 1 + x * 3] = Math.round(rgb[0] * shade);
      raw[row + 2 + x * 3] = Math.round(rgb[1] * shade);
      raw[row + 3 + x * 3] = Math.round(rgb[2] * shade);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

/** Stable uuid from a string, so re-seeding reuses the same object keys. */
function stableUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  const bytes = hex.split('');
  bytes[12] = '4';
  bytes[16] = '8';
  const value = bytes.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const storageRoot = resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_DIR ?? '.storage',
  );

  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category },
      update: { name: category.name, icon: category.icon, position: category.position },
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  let videoAssets = 0;
  let lessonRows = 0;
  let resourceRows = 0;

  for (const course of COURSES) {
    const coverKey = `public/courses/${stableUuid(`course:${course.slug}`)}/cover/${stableUuid(`cover:${course.slug}`)}.png`;
    const coverPath = resolve(storageRoot, coverKey);
    await mkdir(dirname(coverPath), { recursive: true });
    await writeFile(coverPath, solidPng(640, 360, course.color));

    const subtitle = `Khóa học ${course.title} dành cho người muốn đi từ nền tảng tới sản phẩm chạy thật.`;
    const data = {
      title: course.title,
      subtitle,
      description: description(course),
      searchText: buildSearchText(course.title, subtitle),
      categoryId: categoryIdBySlug.get(course.categorySlug)!,
      level: course.level,
      priceVnd: course.priceVnd,
      compareAtPriceVnd: course.compareAtPriceVnd,
      status: course.status,
      coverImageStorage: StorageProvider.DEMO,
      coverImageKey: coverKey,
      learningOutcomes: course.topics.map(
        (topic) => `Hiểu và áp dụng ${topic.toLowerCase()}`,
      ),
      requirements: requirements(course),
      targetAudience: AUDIENCE[course.level],
      // Only the rating pair is invented; enrollmentCount is always the real
      // number of ACTIVE enrollments and stays at 0 until they exist.
      ratingAverage: course.ratingAverage,
      ratingCount: course.ratingCount,
      demoStats: true,
      publishedAt:
        course.status === CourseStatus.DRAFT ? null : PUBLISHED_AT,
      archivedAt:
        course.status === CourseStatus.ARCHIVED ? ARCHIVED_AT : null,
    };
    const row = await prisma.course.upsert({
      where: { slug: course.slug },
      create: { slug: course.slug, ...data },
      update: data,
    });

    let lessonNumber = 0;
    let totalDurationSeconds = 0;
    let lessonCount = 0;
    const lessonIds: string[] = [];

    for (const [index, lessons] of course.lessonsPerSection.entries()) {
      const position = index + 1;
      const section = await prisma.section.upsert({
        where: { courseId_position: { courseId: row.id, position } },
        create: {
          courseId: row.id,
          position,
          title: `Chương ${position}: ${course.topics[index]}`,
        },
        update: { title: `Chương ${position}: ${course.topics[index]}` },
      });

      for (let lesson = 1; lesson <= lessons; lesson += 1) {
        lessonNumber += 1;
        const isArticle = lesson === lessons && position <= course.articleSections;
        const isPreview = lesson === 1 && course.previewSections.includes(position);
        const durationSeconds = isArticle
          ? 0
          : 180 + ((lessonNumber * 37 + course.key.charCodeAt(1) * 13) % 721);

        let videoAssetId: string | null = null;
        if (!isArticle) {
          const externalId = `demo/${course.key}-s${position}-l${lesson}`;
          const asset = await prisma.videoAsset.upsert({
            where: {
              provider_externalId: {
                provider: VideoProvider.DEMO,
                externalId,
              },
            },
            create: {
              provider: VideoProvider.DEMO,
              externalId,
              status: VideoAssetStatus.READY,
              durationSeconds,
            },
            update: {
              status: VideoAssetStatus.READY,
              durationSeconds,
            },
          });
          videoAssetId = asset.id;
          videoAssets += 1;
        }

        const title = `Bài ${lessonNumber}: ${course.topics[index]}${lesson === 1 ? '' : ` (phần ${lesson})`}`;
        const lessonRow = await prisma.lesson.upsert({
          where: { sectionId_position: { sectionId: section.id, position: lesson } },
          create: {
            sectionId: section.id,
            position: lesson,
            title,
            type: isArticle ? LessonType.ARTICLE : LessonType.VIDEO,
            content: isArticle
              ? `## Tổng kết chương ${position}\n\nBạn vừa đi qua **${course.topics[index]}**. Trước khi sang chương sau, hãy tự làm lại phần việc của chương này một lần nữa mà không mở lại bài giảng.`
              : null,
            isPreview,
            durationSeconds,
            videoAssetId,
          },
          update: {
            title,
            type: isArticle ? LessonType.ARTICLE : LessonType.VIDEO,
            isPreview,
            durationSeconds,
            videoAssetId,
          },
        });
        lessonIds.push(lessonRow.id);
        lessonCount += 1;
        lessonRows += 1;
        totalDurationSeconds += durationSeconds;
      }
    }

    for (let index = 0; index < course.resources; index += 1) {
      const lessonId = lessonIds[index % lessonIds.length];
      const objectKey = `lessons/${lessonId}/resources/${stableUuid(`resource:${course.slug}:${index}`)}-tai-lieu-${index + 1}.pdf`;
      const filename = `tai-lieu-${index + 1}.pdf`;
      const path = resolve(storageRoot, objectKey);
      await mkdir(dirname(path), { recursive: true });
      const pdf = Buffer.from(
        `%PDF-1.4\n% Tài liệu demo của khóa ${course.title}\n`,
        'utf8',
      );
      await writeFile(path, pdf);
      await prisma.lessonResource.upsert({
        where: {
          storage_objectKey: { storage: StorageProvider.DEMO, objectKey },
        },
        create: {
          lessonId,
          storage: StorageProvider.DEMO,
          objectKey,
          filename,
          contentType: 'application/pdf',
          sizeBytes: pdf.byteLength,
          position: index + 1,
        },
        update: { filename, sizeBytes: pdf.byteLength, lessonId },
      });
      resourceRows += 1;
    }

    await prisma.course.update({
      where: { id: row.id },
      data: { lessonCount, totalDurationSeconds },
    });
  }

  process.stdout.write(
    `Seeded ${CATEGORIES.length} categories, ${COURSES.length} courses, ${lessonRows} lessons, ${videoAssets} video assets, ${resourceRows} resources\n`,
  );
}
