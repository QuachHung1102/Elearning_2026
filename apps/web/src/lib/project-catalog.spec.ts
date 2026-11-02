import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EnrollCta } from "@/components/catalog/enroll-cta";
import { projectCourses } from "./project-courses";

describe("project catalog access and readiness", () => {
  it("offers exactly one public trial and nine paid project outlines", () => {
    const trials = projectCourses.filter((course) => course.publicTrial);
    const paid = projectCourses.filter((course) => !course.publicTrial);
    expect(trials).toHaveLength(1);
    expect(trials[0].priceVnd).toBe(0);
    expect(trials[0].lessons).toHaveLength(4);
    expect(new Set(trials[0].lessons.map((lesson) => lesson.video)).size).toBe(
      4,
    );
    expect(paid).toHaveLength(9);
    expect(paid.filter((course) => course.availability === "available")).toHaveLength(5);
    for (const course of paid) {
      expect([100000, 150000, 200000]).toContain(course.priceVnd);
      expect(course.lessons).toHaveLength(course.availability === "available" ? 3 : 0);
      expect(course.milestones?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("lets a guest open the whole book trial without authentication", () => {
    const html = renderToStaticMarkup(
      createElement(EnrollCta, {
        courseId: "book-trial",
        slug: "python-tu-sach-lop-minh",
        priceVnd: 0,
        archived: false,
      }),
    );
    expect(html).toContain('href="/workshop"');
    expect(html).not.toContain("/login");
    expect(html).not.toContain("/checkout");
  });

  it("opens direct enrollment for each of the five written courses", () => {
    for (const course of projectCourses.filter((item) => !item.publicTrial && item.availability === "available")) {
      const html = renderToStaticMarkup(createElement(EnrollCta, {courseId: course.slug, slug: course.slug, priceVnd: course.priceVnd, archived: false}));
      expect(html).toContain(`/checkout/${course.slug}`);
      expect(html).toContain("Liên hệ đăng ký học");
      expect(html).not.toContain("Lessons are in preparation");
    }
  });

  it("shows a project inquiry rather than selling unfinished lessons", () => {
    const course = projectCourses.find((item) => item.availability === "planned")!;
    const html = renderToStaticMarkup(
      createElement(EnrollCta, {
        courseId: "planned",
        slug: course.slug,
        priceVnd: course.priceVnd,
        archived: false,
      }),
    );
    expect(html).toContain("Hỏi Nam về dự án");
    expect(html).toContain("Dự án sắp có");
    expect(html).not.toContain("/learn/");
    expect(html).not.toContain("Liên hệ đăng ký học");
  });
});
