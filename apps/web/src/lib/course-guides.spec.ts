import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoursePublicGuide } from "@/components/catalog/course-public-guide";
import { courseGuide, courseGuides } from "./course-guides";
import { projectCourses } from "./project-courses";

describe("public course previews", () => {
  it("covers the entire catalog in both languages", () => {
    expect(Object.keys(courseGuides).sort()).toEqual(
      projectCourses.map((course) => course.slug).sort(),
    );
    for (const project of projectCourses) {
      for (const locale of ["vi", "en"] as const) {
        const guide = courseGuide(project.slug, locale)!;
        expect(guide.introduction).toHaveLength(3);
        expect(guide.whyThisProject).toHaveLength(2);
        expect(guide.outcomes.length).toBeGreaterThanOrEqual(6);
        expect(guide.requirements).toHaveLength(3);
        expect(guide.audience).toHaveLength(3);
        expect(guide.faq).toHaveLength(3);
        expect(guide.practice.questions).toHaveLength(3);
        expect(guide.chapters.length).toBeGreaterThanOrEqual(3);
        expect(guide.scenario.length).toBeGreaterThan(100);
        if (project.availability === "available") {
          expect(guide.chapters).toHaveLength(project.lessons.length);
        }
      }
    }
  });

  it.each(projectCourses.map((project) => [project.slug, project] as const))(
    "keeps %s as a preview without code, solutions or private lesson links",
    (_slug, project) => {
      for (const locale of ["vi", "en"] as const) {
        const guide = courseGuide(project.slug, locale)!;
        const html = renderToStaticMarkup(
          createElement(CoursePublicGuide, {
            guide,
            locale,
            planned: project.availability === "planned",
          }),
        );
        expect(html).not.toContain("<pre");
        expect(html).not.toContain("<code");
        expect(html).not.toContain("/learn/");
        expect(html).not.toContain("/downloads/");
        expect(html).not.toContain("playback-token");
        expect(html).not.toContain("def analyse(");
        expect(html).not.toContain("def load_rows(");
        expect(html).not.toContain("```python");
        expect(html).toContain(`data-project-reason="${locale}"`);
        expect(html).toContain(
          locale === "vi" ? "Vì sao có dự án này?" : "Why this project?",
        );
        expect(html).toContain(
          project.availability === "planned"
            ? locale === "vi"
              ? "Các phần dự kiến"
              : "Planned project outline"
            : locale === "vi"
              ? "Phạm vi của phiên bản hiện có"
              : "What the current version covers",
        );
      }
    },
  );

  it("does not silently substitute a different course for an unknown slug", () => {
    expect(courseGuide("missing-project", "vi")).toBeNull();
    expect(courseGuide("missing-project", "en")).toBeNull();
  });
});
