import type { ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/format";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "accent";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground-strong",
  success: "bg-success-subtle text-on-success-subtle",
  warning: "bg-warning-subtle text-on-warning-subtle",
  destructive: "bg-destructive-subtle text-on-destructive-subtle",
  info: "bg-info-subtle text-on-info-subtle",
  accent: "bg-accent-subtle text-on-accent-subtle",
};

export function Badge({
  variant = "neutral",
  children,
  ...rest
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  "aria-label"?: string;
  title?: string;
}) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

/**
 * One mapping for every status string in the product. Without it each screen
 * invents its own colour for EXPIRED.
 */
const STATUS_VARIANT: Record<keyof typeof STATUS_LABEL, BadgeVariant> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
  ACTIVE: "success",
  REVOKED: "destructive",
  PENDING: "warning",
  PROCESSING: "warning",
  READY: "success",
  ERRORED: "destructive",
  PAID: "success",
  REFUND_REQUESTED: "warning",
  REFUNDED: "neutral",
  CANCELLED: "neutral",
  FAILED: "destructive",
  EXPIRED: "neutral",
  BLOCKED: "destructive",
};

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABEL }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
  );
}
