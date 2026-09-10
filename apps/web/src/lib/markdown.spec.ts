import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown strips", () => {
  it.each([
    ["a script tag", "<script>alert(1)</script>", "alert(1)"],
    ["an inline handler", '<img src=x onerror=alert(1)>', "onerror"],
    ["a javascript: link", "[x](javascript:alert(1))", "javascript:"],
    ["an svg handler", "<svg onload=alert(1)></svg>", "onload"],
    ["an iframe", '<iframe src="https://evil.example"></iframe>', "<iframe"],
    [
      "an entity-encoded javascript scheme",
      '<a href="&#106;avascript:alert(1)">x</a>',
      "avascript:",
    ],
    ["a data: URI link", '<a href="data:text/html,<b>x</b>">x</a>', "data:"],
    [
      "a protocol-relative link",
      '<a href="//evil.example/steal">x</a>',
      "evil.example",
    ],
    ["a style attribute", '<p style="position:fixed">x</p>', "style="],
  ])("%s", (_label, source, forbidden) => {
    expect(renderMarkdown(source)).not.toContain(forbidden);
  });

  it("keeps no script tag even when the markdown is nested in a list", () => {
    expect(renderMarkdown("- item\n- <script>alert(1)</script>")).not.toContain(
      "<script",
    );
  });
});

describe("renderMarkdown keeps", () => {
  it("an https link, and hardens it", () => {
    const html = renderMarkdown("[Trang chủ](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
  });

  it("a mailto link", () => {
    expect(renderMarkdown("<hoc@example.com>")).toContain("mailto:");
  });

  it.each([
    ["bold", "**đậm**", "<strong>đậm</strong>"],
    ["a list", "- một\n- hai", "<ul>"],
    ["inline code", "`const x = 1`", "<code>"],
    ["a heading", "## Tiêu đề", "<h2>Tiêu đề</h2>"],
    ["a blockquote", "> trích dẫn", "<blockquote>"],
  ])("%s", (_label, source, expected) => {
    expect(renderMarkdown(source)).toContain(expected);
  });

  it("Vietnamese text unchanged", () => {
    expect(renderMarkdown("Lập trình với React")).toContain(
      "Lập trình với React",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
