"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  FileText,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "./language-provider";
import { filterResources, practiceResources } from "@/lib/workshop";

export function ProjectWorkshop({ full = false }: { full?: boolean }) {
  const { locale, text } = useLanguage();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"result" | "code">("result");
  const resources = filterResources(practiceResources, query, topic, locale);
  const current = practiceResources.find(
    (resource) => resource.id === selected,
  );
  const topics = [
    ["all", text("Tất cả", "All topics")],
    ["python", "Python"],
    ["web", "Web"],
    ["thinking", text("Tư duy", "Thinking")],
  ];
  const example = `const results = resources.filter((resource) => {\n  const title = resource.title.toLowerCase();\n  return title.includes(search.toLowerCase());\n});`;

  return (
    <div className={`project-workshop ${full ? "workshop-full" : ""}`}>
      <div className="workshop-rail">
        <div className="rail-heading">
          <BookOpen size={20} aria-hidden="true" />
          <span>
            {text("Một dự án cho lớp mình", "A project for our classroom")}
          </span>
        </div>
        <h2>
          {text("Thư viện\ntài liệu nhỏ", "The little\nresource library")}
        </h2>
        <p>
          {text(
            "Giúp một người bạn tìm đúng tài liệu, nhanh hơn.",
            "Help a classmate find the right resource a little faster.",
          )}
        </p>
        <div className="project-steps">
          <span>
            <Check size={15} aria-hidden="true" />{" "}
            {text("Một nhu cầu cụ thể", "A specific need")}
          </span>
          <span>
            <Check size={15} aria-hidden="true" />{" "}
            {text("Một danh sách gọn gàng", "A small, organized list")}
          </span>
          <span>
            <Check size={15} aria-hidden="true" />{" "}
            {text("Một cách tìm dễ dùng", "An easier way to find things")}
          </span>
        </div>
        <div className="rail-bottom">
          <span>{text("Bài thực hành mở", "An open practice project")}</span>
          <Code2 aria-hidden="true" size={22} />
        </div>
      </div>
      <div className="workshop-app">
        <div className="workshop-top">
          <span className="project-document">
            <span className="document-dot" />{" "}
            {text("Tài liệu của lớp", "Classroom resources")}
          </span>
          <div
            className="workshop-tabs"
            role="group"
            aria-label={text("Chế độ xem", "View")}
          >
            <button
              type="button"
              aria-pressed={view === "result"}
              onClick={() => setView("result")}
            >
              {text("Kết quả", "Result")}
            </button>
            <button
              type="button"
              aria-pressed={view === "code"}
              onClick={() => setView("code")}
            >
              {text("Cách lọc", "The filter")}
            </button>
          </div>
        </div>
        {view === "code" ? (
          <div className="workshop-code">
            <p>
              {text(
                "Tìm từ khóa trong từng tiêu đề",
                "Look for a keyword in each title",
              )}
            </p>
            <pre>
              <code>{example}</code>
            </pre>
            <p>
              {text(
                "Đây là phiên bản rút gọn của thao tác lọc. Thử tìm kiếm ở tab Kết quả để thấy ý tưởng này hoạt động.",
                "This is a simplified version of the filter. Try a search in the Result tab to see the idea in action.",
              )}
            </p>
            <button
              className="inline-link"
              onClick={() => setView("result")}
              type="button"
            >
              {text("Quay lại thử", "Try it out")}{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className="library-intro">
              <h3>{text("Cần tìm một bài học?", "Looking for a lesson?")}</h3>
              <p>
                {text(
                  "Một vài ghi chú để bắt đầu. Chọn một mục để đọc và thử làm.",
                  "A few notes to get started. Choose one to read and try.",
                )}
              </p>
            </div>
            <label className="library-search">
              <Search size={19} aria-hidden="true" />
              <span className="sr-only">
                {text("Tìm trong tài liệu", "Search resources")}
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text(
                  "Ví dụ: biến, HTML, sửa lỗi…",
                  "Try variables, HTML, debugging…",
                )}
              />
            </label>
            <div
              className="library-topics"
              role="group"
              aria-label={text("Chủ đề tài liệu", "Resource topic")}
            >
              {topics.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={topic === id}
                  onClick={() => setTopic(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="library-results" aria-live="polite">
              <p className="library-count">
                {resources.length}{" "}
                {text("ghi chú", resources.length === 1 ? "note" : "notes")}
              </p>
              {resources.length ? (
                <ul>
                  {resources.map((resource) => (
                    <li key={resource.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((previous) =>
                            previous === resource.id ? null : resource.id,
                          )
                        }
                        aria-expanded={selected === resource.id}
                        className="resource-row"
                      >
                        <span
                          className={`resource-icon topic-${resource.topic}`}
                        >
                          <FileText aria-hidden="true" size={21} />
                        </span>
                        <span className="resource-row-copy">
                          <strong>{resource.title[locale]}</strong>
                          <span>{resource.description[locale]}</span>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="library-empty">
                  <Search size={25} aria-hidden="true" />
                  <strong>
                    {text("Chưa có ghi chú phù hợp", "No matching notes yet")}
                  </strong>
                  <p>
                    {text(
                      "Thử một từ ngắn hơn hoặc chọn tất cả chủ đề.",
                      "Try a shorter word, or choose all topics.",
                    )}
                  </p>
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => {
                      setQuery("");
                      setTopic("all");
                    }}
                  >
                    {text("Xem lại tất cả", "Show all notes")}
                  </button>
                </div>
              )}
            </div>
            {current && (
              <section
                className="resource-reading"
                aria-label={current.title[locale]}
              >
                <div>
                  <span>{text("Đọc & thử làm", "Read & try")}</span>
                  <button
                    type="button"
                    aria-label={text("Đóng ghi chú", "Close note")}
                    onClick={() => setSelected(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <h4>{current.title[locale]}</h4>
                <p>{current.note[locale]}</p>
                <aside>
                  <strong>{text("Đến lượt bạn", "Your turn")}</strong>
                  <p>{current.exercise[locale]}</p>
                </aside>
              </section>
            )}
          </>
        )}
        {!full && (
          <div className="workshop-open">
            <span>
              {text(
                "Bạn đang dùng thử một dự án thật.",
                "You’re trying a working project.",
              )}
            </span>
            <Link href="/workshop">
              {text("Mở bài thực hành", "Open the practice lesson")}{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
