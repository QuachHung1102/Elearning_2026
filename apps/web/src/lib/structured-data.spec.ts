import { describe, expect, it } from "vitest";
import type { CourseDetail } from "./catalog";
import { courseJsonLd, jsonLdScript, plainText } from "./structured-data";

const course = {
  id: "c1",
  slug: "typescript-cho-nguoi-da-biet-javascript",
  title: "TypeScript cho người đã biết JavaScript",
  subtitle: "Kiểu dữ liệu tĩnh cho dự án thật",
  description: "## Bạn sẽ học\n\nKiểu **cơ bản** và [kiểu nâng cao](https://example.com/x).",
  coverUrl: "https://cdn.example.com/covers/ts.png",
  priceVnd: 499_000,
  compareAtPriceVnd: 790_000,
  level: "BEGINNER",
  language: "vi",
  lessonCount: 12,
  totalDurationSeconds: 3 * 3600 + 25 * 60 + 50,
  enrollmentCount: 40,
  ratingAverage: 4.6,
  ratingCount: 128,
  demoStats: false,
  category: null,
  instructorName: null,
} as unknown as CourseDetail;

const SITE = "https://learn.example.com";

describe("courseJsonLd (ROADMAP §9, T4.7)", () => {
  it("describes the course the way schema.org's Course wants it", () => {
    expect(courseJsonLd(course, SITE)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Course",
      name: "TypeScript cho người đã biết JavaScript",
      description: "Kiểu dữ liệu tĩnh cho dự án thật",
      url: `${SITE}/courses/typescript-cho-nguoi-da-biet-javascript`,
      inLanguage: "vi",
      image: "https://cdn.example.com/covers/ts.png",
      educationalLevel: "Beginner",
      timeRequired: "PT3H25M",
      provider: { "@type": "Organization", name: "E-learning", sameAs: SITE },
      offers: {
        "@type": "Offer",
        price: 499000,
        priceCurrency: "VND",
        category: "Paid",
        url: `${SITE}/courses/typescript-cho-nguoi-da-biet-javascript`,
      },
    });
  });

  it("falls back to the start of the description when there is no subtitle", () => {
    const data = courseJsonLd({ ...course, subtitle: null }, SITE);

    expect(data.description).toBe("Bạn sẽ học Kiểu cơ bản và kiểu nâng cao.");
  });

  it("calls a course with no price free", () => {
    expect(courseJsonLd({ ...course, priceVnd: 0 }, SITE).offers).toMatchObject({ price: 0, category: "Free" });
  });

  it("leaves out what the course does not have", () => {
    const data = courseJsonLd(
      { ...course, coverUrl: null, level: "ALL_LEVELS", totalDurationSeconds: 0 },
      SITE,
    );

    expect(data).not.toHaveProperty("image");
    expect(data).not.toHaveProperty("educationalLevel");
    expect(data).not.toHaveProperty("timeRequired");
  });

  it("reports a rating only when it is a real one", () => {
    expect(courseJsonLd(course, SITE).aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.6,
      ratingCount: 128,
    });
    // A seeded demo rating must never reach a search engine.
    expect(courseJsonLd({ ...course, demoStats: true }, SITE)).not.toHaveProperty("aggregateRating");
    // Nobody rated it, or nobody can say what the average is: nothing to report either way.
    expect(courseJsonLd({ ...course, ratingCount: 0 }, SITE)).not.toHaveProperty("aggregateRating");
    expect(courseJsonLd({ ...course, ratingAverage: null }, SITE)).not.toHaveProperty("aggregateRating");
  });
});

describe("plainText", () => {
  it("drops the markup, keeps the words", () => {
    expect(plainText("# Tiêu đề\n\n> Trích dẫn với `mã` và ![ảnh](x.png) **đậm** _nghiêng_.")).toBe(
      "Tiêu đề Trích dẫn với mã và đậm nghiêng.",
    );
  });

  it("cuts a long text at a word, with an ellipsis", () => {
    // 25 characters end inside the third word: the cut goes back to the second.
    expect(plainText("abcdefghij ".repeat(20), 25)).toBe("abcdefghij abcdefghij…");
  });

  it("leaves a text that fits alone, and cuts a single long word where it must", () => {
    expect(plainText("Ngắn gọn thôi", 50)).toBe("Ngắn gọn thôi");
    expect(plainText("x".repeat(80), 10)).toBe("xxxxxxxxxx…");
  });
});

describe("jsonLdScript", () => {
  it("cannot be closed early by a title that says </script>", () => {
    const html = jsonLdScript({ name: "</script><script>alert(1)</script>" });

    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<");
    expect(JSON.parse(html).name).toBe("</script><script>alert(1)</script>");
  });

  // U+2028 and U+2029 end a line in a script. Built from char codes: typed as
  // escapes into a source file they turn into the characters themselves.
  it("escapes the characters that end a line in a script", () => {
    const [separator, paragraph] = [String.fromCharCode(0x2028), String.fromCharCode(0x2029)];
    const name = `a${separator}b${paragraph}c & d`;

    const html = jsonLdScript({ name });

    expect(html).not.toContain(separator);
    expect(html).not.toContain(paragraph);
    expect(html).not.toContain("&");
    expect(JSON.parse(html).name).toBe(name);
  });
});
