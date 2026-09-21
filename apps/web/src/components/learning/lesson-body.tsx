"use client";

import { Download, FileText } from "lucide-react";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { ApiError, apiFetch } from "@/lib/api";
import { formatBytes, type Resource, type SignedDownload } from "@/lib/learning";
import { t } from "@/messages/vi";

const WIDE = "(min-width: 1024px)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const TABS = [
  { key: "content", label: "Nội dung" },
  { key: "resources", label: "Tài liệu" },
] as const;

/**
 * Lesson text and resources (UX_PLAN.md §7.2): tabs "Nội dung" / "Tài liệu"
 * under 1024px, both stacked from 1024px. With no resources there is nothing
 * to switch to, so there are no tabs at all.
 */
export function LessonBody({
  lessonId,
  content,
  resources,
}: {
  lessonId: string;
  content: ReactNode;
  resources: Resource[];
}) {
  const [active, setActive] = useState<"content" | "resources">("content");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // From 1024px both parts are stacked and the tablist is hidden, so the
  // panels must not claim tab roles pointing at tabs no one can reach.
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  const panel = (key: (typeof TABS)[number]["key"]) =>
    wide
      ? {}
      : {
          role: "tabpanel",
          "aria-labelledby": `${lessonId}-tab-${key}`,
        };

  if (resources.length === 0) return <div>{content}</div>;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = active === "content" ? "resources" : "content";
    setActive(next);
    tabs.current[next === "content" ? 0 : 1]?.focus();
  }

  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Nội dung bài học"
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-border lg:hidden"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.key}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${lessonId}-tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`${lessonId}-panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => setActive(tab.key)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold ${active === tab.key ? "border-primary text-primary-text" : "border-transparent text-muted-foreground-strong hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        {...panel("content")}
        id={`${lessonId}-panel-content`}
        className={active === "content" ? "block" : "hidden lg:block"}
      >
        {content}
      </div>
      <section
        {...panel("resources")}
        id={`${lessonId}-panel-resources`}
        className={`grid gap-3 ${active === "resources" ? "" : "hidden lg:grid"}`}
      >
        <h2 className="hidden text-xl font-semibold lg:block">Tài liệu bài học</h2>
        <ResourceList lessonId={lessonId} resources={resources} />
      </section>
    </div>
  );
}

/**
 * `ResourceList`: every click asks for a fresh signed URL and follows it, so
 * the link cannot have expired by the time it is used.
 */
function ResourceList({
  lessonId,
  resources,
}: {
  lessonId: string;
  resources: Resource[];
}) {
  const [pending, setPending] = useState<string | null>(null);

  async function download(resource: Resource) {
    setPending(resource.id);
    try {
      const signed = await apiFetch<SignedDownload>(
        `/lessons/${lessonId}/resources/${resource.id}/download`,
      );
      window.location.assign(signed.url);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "INTERNAL";
      // SIGNATURE_INVALID never arrives here: only the signed file URL answers
      // it, and each click signs a fresh one (recorded deviation, API §2.5b).
      if (code !== "UNAUTHENTICATED") showToast(t(code), "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="grid list-none gap-2 p-0">
      {resources.map((resource) => (
        <li
          key={resource.id}
          className="panel flex flex-wrap items-center gap-3 p-3"
        >
          <FileText
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <span className="min-w-0 flex-1">
            <span className="block break-all font-medium">{resource.filename}</span>
            <span className="text-sm text-muted-foreground">
              {formatBytes(resource.sizeBytes)}
            </span>
          </span>
          <Button
            variant="outline"
            loading={pending === resource.id}
            onClick={() => download(resource)}
          >
            <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Tải xuống
            <span className="sr-only">: {resource.filename}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
