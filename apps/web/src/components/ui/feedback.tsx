import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Info,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type ErrorField = { id: string; label: string };

export function focusValidation(form: HTMLFormElement, count: number) {
  requestAnimationFrame(() => {
    form
      .querySelector<HTMLElement>(
        count > 1 ? "[data-error-summary]" : "[aria-invalid='true']",
      )
      ?.focus();
  });
}

export function ErrorSummary({
  errors,
  fields,
}: {
  errors: Record<string, string>;
  fields: Record<string, ErrorField>;
}) {
  const entries = Object.entries(errors);
  if (entries.length < 2) return null;
  return (
    <div
      data-error-summary
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-destructive/30 bg-destructive-subtle p-4 text-on-destructive-subtle"
    >
      <p className="font-semibold">
        Vui lòng kiểm tra lại {entries.length} trường
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {entries.map(([name, message]) => (
          <li key={name}>
            <a
              className="inline-flex min-h-11 items-center underline"
              href={`#${fields[name].id}`}
            >
              {fields[name].label}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const alertStyles = {
  info: "border-info/30 bg-info-subtle text-on-info-subtle",
  success: "border-success/30 bg-success-subtle text-on-success-subtle",
  warning: "border-warning/30 bg-warning-subtle text-on-warning-subtle",
  destructive:
    "border-destructive/30 bg-destructive-subtle text-on-destructive-subtle",
};

const alertIcons = {
  info: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  destructive: CircleX,
};

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: keyof typeof alertStyles;
  title: string;
  children?: ReactNode;
}) {
  const Icon = alertIcons[variant];
  return (
    <div
      className={`flex gap-3 rounded-lg border p-4 ${alertStyles[variant]}`}
      role={variant === "destructive" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0"
        strokeWidth={1.75}
      />
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  actions,
  heading: Heading = "h1",
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  /** `h2` when the page around it already has its own h1. */
  heading?: "h1" | "h2";
}) {
  return (
    <section
      className="mx-auto grid max-w-prose justify-items-start gap-4 py-12"
      aria-labelledby="error-title"
    >
      <AlertCircle
        aria-hidden="true"
        className="size-10 text-destructive"
        strokeWidth={1.75}
      />
      <Heading id="error-title" tabIndex={-1} className="text-3xl font-semibold">
        {title}
      </Heading>
      <p className="text-muted-foreground">{description}</p>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = SearchX,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** A search that found nothing by default; a list with nothing in it yet says so. */
  icon?: LucideIcon;
}) {
  return (
    <section className="grid justify-items-start gap-3 rounded-lg bg-muted p-6">
      <Icon
        aria-hidden="true"
        className="size-10 text-muted-foreground-strong"
        strokeWidth={1.75}
      />
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && (
        <p className="text-muted-foreground-strong">{description}</p>
      )}
      {action}
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />
  );
}
