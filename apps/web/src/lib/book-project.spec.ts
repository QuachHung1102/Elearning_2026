import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BookTrialPage from "@/app/(marketing)/workshop/page";
import { getLocale } from "./locale";

vi.mock("./locale", () => ({ getLocale: vi.fn(async () => "vi") }));

describe("free project written companion", () => {
  it.each(["vi", "en"] as const)(
    "offers complete code and visible lessons in the %s interface",
    async (locale) => {
      vi.mocked(getLocale).mockResolvedValue(locale);
      const html = renderToStaticMarkup(await BookTrialPage());
      expect(html).toContain('id="source-code"');
      expect(html).toContain('id="getting-started"');
      expect(html).toContain('id="project-brief"');
      expect(html).toContain(`data-project-reason="${locale}"`);
      expect(html).toContain("def find_available(");
      expect(html).toContain("def save_books(");
      expect(html).toContain("python book-sharing.py");
      expect(html).toContain("/downloads/projects/book-sharing-project.zip");
      expect(html).toContain("/downloads/projects/book-sharing-starter.py");
      expect(html).toContain("/downloads/projects/books.example.json");
      expect(html.match(/<video /g)).toHaveLength(4);
      expect(
        html.match(/<details class="panel trial-notes" open=""/g),
      ).toHaveLength(4);
      expect(html).toContain(
        locale === "vi" ? "Đọc mã nguồn ngay" : "Read the complete code",
      );
      expect(html).not.toContain("def analyse(");
      expect(html).not.toContain("/api/v1/lessons/");
    },
  );
});
