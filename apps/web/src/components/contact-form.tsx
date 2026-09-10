"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/session";
import { t } from "@/messages/vi";
import { Button, buttonClass } from "./ui/button";
import { Alert, ErrorSummary, focusValidation } from "./ui/feedback";
import { Field } from "./ui/field";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contactFields = {
  name: { id: "contact-name", label: "Họ tên" },
  email: { id: "contact-email", label: "Email" },
  message: { id: "contact-message", label: "Nội dung" },
};

export function ContactForm({
  user,
  courseSlug,
}: {
  user: User | null;
  courseSlug?: string;
}) {
  const [values, setValues] = useState({
    name: user?.displayName ?? "",
    email: user?.email ?? "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function change(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const name = values.name.trim();
    if (name.length < 2 || name.length > 80)
      nextErrors.name = "Họ tên cần từ 2 đến 80 ký tự.";
    if (!values.email) nextErrors.email = "Nhập email của bạn.";
    else if (!emailPattern.test(values.email))
      nextErrors.email = "Email không hợp lệ.";
    if (values.message.length < 10)
      nextErrors.message = "Viết ít nhất 10 ký tự.";
    else if (values.message.length > 2000)
      nextErrors.message = "Nội dung không được quá 2.000 ký tự.";
    setErrors(nextErrors);
    setFailure("");
    if (Object.keys(nextErrors).length) {
      focusValidation(event.currentTarget, Object.keys(nextErrors).length);
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: values.email,
          message: values.message,
          ...(courseSlug ? { courseSlug } : {}),
        }),
      });
      setSent(true);
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.code === "RATE_LIMITED"
          ? t(error.code)
          : "Không gửi được liên hệ. Thử lại sau ít phút.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="grid max-w-xl gap-5">
        <Alert variant="success" title="Đã gửi liên hệ">
          Chúng tôi sẽ trả lời qua email trong vòng 24 giờ.
        </Alert>
        <Link className={buttonClass("primary", "lg")} href="/">
          Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <form className="grid max-w-xl gap-6" onSubmit={submit} noValidate>
      {courseSlug && (
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground-strong">
          Khóa học quan tâm: <strong>{courseSlug}</strong>.{" "}
          <Link
            href="/courses"
            className="inline-flex min-h-11 items-center font-semibold text-primary-text hover:underline"
          >
            Đổi
          </Link>
        </div>
      )}
      {failure && (
        <Alert variant="destructive" title={failure}>
          <p>Nội dung bạn đã nhập vẫn được giữ nguyên.</p>
          <Button className="mt-3" type="submit" variant="outline">
            Thử lại
          </Button>
        </Alert>
      )}
      <ErrorSummary errors={errors} fields={contactFields} />
      <Field id="contact-name" label="Họ tên" required error={errors.name}>
        <input
          id="contact-name"
          className="control"
          autoComplete="name"
          minLength={2}
          maxLength={80}
          value={values.name}
          onChange={(event) => change("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
        />
      </Field>
      <Field id="contact-email" label="Email" required error={errors.email}>
        <input
          id="contact-email"
          className="control"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          maxLength={320}
          value={values.email}
          onChange={(event) => change("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
        />
      </Field>
      <Field
        id="contact-message"
        label="Nội dung"
        required
        error={errors.message}
        hint={`${values.message.length}/2.000 ký tự`}
      >
        <textarea
          id="contact-message"
          className="control min-h-40 resize-y"
          minLength={10}
          maxLength={2000}
          value={values.message}
          onChange={(event) => change("message", event.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={
            errors.message ? "contact-message-error" : "contact-message-hint"
          }
        />
      </Field>
      <Button type="submit" size="lg" loading={busy}>
        Gửi liên hệ
      </Button>
    </form>
  );
}
