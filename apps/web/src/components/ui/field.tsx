"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor={id}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
            <span className="sr-only"> bắt buộc</span>
          </>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={1.75}
          />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  showStrength?: boolean;
};

export function PasswordInput({
  id,
  label,
  error,
  showStrength = false,
  value,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const password = typeof value === "string" ? value : "";
  const score = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strength = ["", "Yếu", "Vừa", "Khá", "Tốt"][score];

  return (
    <Field id={String(id)} label={label} required error={error}>
      <div className="relative">
        <input
          {...props}
          id={id}
          value={value}
          type={visible ? "text" : "password"}
          className="control pr-12"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" strokeWidth={1.75} />
          ) : (
            <Eye aria-hidden="true" className="size-5" strokeWidth={1.75} />
          )}
        </button>
      </div>
      {showStrength && password && (
        <div className="grid gap-1" aria-live="polite">
          <meter
            className="h-1 w-full accent-primary-strong"
            min="0"
            max="4"
            value={score}
          />
          <span className="text-xs text-muted-foreground">
            Độ mạnh: {strength}
          </span>
        </div>
      )}
    </Field>
  );
}
