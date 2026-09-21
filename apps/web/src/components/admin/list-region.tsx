"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState } from "@/components/ui/feedback";

type Content = { toolbar: ReactNode; children: ReactNode };

// The page may remount its toolbar on new filters (see audit-logs), and a
// successful retry unmounts the button that was pressed (a first-load retry
// even remounts this region, when the layout regains its shell). Either drops
// focus to <body>, so remember what had focus, outside the component, and put
// it back by id or on the heading (WCAG 2.4.3, UX_PLAN.md §8.3).
// ponytail: one pending focus per tab; fine while a page has one list region.
let focusId: string | undefined;

/**
 * A filtered admin list that keeps its place (UX_PLAN.md §6.1, §6.3).
 * Filtering or paging within the list runs as a transition, so the old rows
 * stay on screen at 60% with `aria-busy` instead of the route skeleton. The
 * page passes `failed` rather than throwing; a failed refetch then keeps the
 * last rows under an inline alert. Only a first load with nothing to keep
 * shows the full error state.
 *
 * Next.js keys page state without search params, so this state survives
 * `?page=` and filter changes.
 */
export function AdminListRegion({
  failed,
  errorTitle,
  header,
  toolbar,
  summary,
  children,
}: {
  failed: boolean;
  errorTitle: string;
  header: ReactNode;
  toolbar?: ReactNode;
  /** Result count, read out politely when a filter or page changes it. */
  summary?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState<Content | null>(
    failed ? null : { toolbar, children },
  );
  if (!failed && (shown?.toolbar !== toolbar || shown?.children !== children)) {
    setShown({ toolbar, children });
  }

  useEffect(() => {
    if (pending || focusId === undefined) return;
    const id = focusId;
    focusId = undefined;
    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }
    const target =
      (id && document.getElementById(id)) || document.querySelector("main h1");
    if (target instanceof HTMLElement) target.focus();
  }, [pending]);

  const navigate = (href: string) => {
    focusId = document.activeElement?.id ?? "";
    startTransition(() => router.push(href));
  };
  // The pressed button is gone on success: land on the heading.
  const settle = (update: () => void) => {
    focusId = "";
    startTransition(update);
  };
  // Not `router.refresh()`: that also re-renders the admin layout, whose own
  // failure during the same outage would replace the old rows.
  const retry = () =>
    settle(() =>
      router.replace(`${window.location.pathname}${window.location.search}`, {
        scroll: false,
      }),
    );

  // Nothing on screen to keep: a full refresh also re-reads the admin
  // layout, which a first load during an outage rendered without its shell.
  const reload = () => settle(() => router.refresh());

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link = (event.target as Element).closest("a");
    if (!link || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || url.pathname !== pathname) {
      return;
    }
    // Capture runs before next/link's own handler, which then stands down.
    event.preventDefault();
    navigate(`${url.pathname}${url.search}`);
  }

  function onSubmit(event: FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement;
    // Attributes, not `form.action`: a control named "action" shadows it.
    const url = new URL(
      form.getAttribute("action") ?? "",
      window.location.href,
    );
    if (
      form.getAttribute("method")?.toLowerCase() !== "get" ||
      url.pathname !== pathname
    ) {
      return;
    }
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value) query.append(key, value);
    }
    navigate(query.size ? `${url.pathname}?${query}` : url.pathname);
  }

  if (!shown) {
    return (
      <ErrorState
        title={errorTitle}
        description="Đường truyền hoặc máy chủ đang có sự cố."
        actions={
          <Button onClick={reload} loading={pending}>
            Thử lại
          </Button>
        }
      />
    );
  }

  return (
    <div
      className="grid gap-6"
      onClickCapture={onClickCapture}
      onSubmit={onSubmit}
    >
      {header}
      <p role="status" className="sr-only">
        {failed ? "" : summary}
      </p>
      {shown.toolbar}
      {failed && (
        <Alert
          variant="warning"
          title="Không cập nhật được danh sách. Đang hiển thị dữ liệu cũ."
        >
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={retry}
            loading={pending}
          >
            Thử lại
          </Button>
        </Alert>
      )}
      <div
        aria-busy={pending || undefined}
        className={`grid gap-6 transition-opacity duration-[var(--duration-fast)] ${pending || failed ? "opacity-60" : ""}`}
      >
        {shown.children}
      </div>
    </div>
  );
}
