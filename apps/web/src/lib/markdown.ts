import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * The single sanitising step in the system. The API stores and returns raw
 * Markdown (API_CONTRACT.md §5.3); sanitising in two places means two rule
 * sets that will drift apart.
 *
 * This is an allowlist, not a denylist. A hand-rolled filter that strips
 * `<script>` and `onerror=` still lets through `javascript:` hrefs,
 * `<svg onload>`, mutation XSS and entity-encoded payloads.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "em",
    "del",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Reject a protocol-relative `//evil.example` href as well.
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "nofollow noopener noreferrer",
        target: "_blank",
      },
    }),
  },
};

export function renderMarkdown(source: string): string {
  const html = marked.parse(source ?? "", { async: false, gfm: true });
  return sanitizeHtml(html, OPTIONS);
}
