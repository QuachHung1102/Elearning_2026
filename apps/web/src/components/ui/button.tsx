import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  "primary" | "accent" | "outline" | "ghost" | "destructive";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary-strong bg-primary-strong text-primary-foreground hover:border-primary-hover hover:bg-primary-hover",
  accent:
    "border-accent bg-accent text-accent-foreground hover:border-accent-hover hover:bg-accent-hover",
  outline:
    "border-input bg-card text-card-foreground hover:border-primary hover:text-primary-text",
  ghost:
    "border-transparent bg-transparent text-card-foreground hover:bg-muted",
  destructive:
    "border-destructive bg-destructive text-destructive-foreground hover:border-destructive-hover hover:bg-destructive-hover",
};

const sizes = {
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: keyof typeof sizes = "md",
  extra = "",
): string {
  return `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold transition-colors duration-[var(--duration-fast)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin"
          strokeWidth={1.75}
        />
      )}
      {children}
    </button>
  );
}
