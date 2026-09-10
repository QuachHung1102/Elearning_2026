"use client";

import { LEARNER_HOME } from "@/lib/routes";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { t } from "@/messages/vi";
import { Button, buttonClass } from "./ui/button";
import {
  Alert,
  ErrorState,
  ErrorSummary,
  focusValidation,
} from "./ui/feedback";
import { Field, PasswordInput } from "./ui/field";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loginFields = {
  email: { id: "login-email", label: "Email" },
  password: { id: "login-password", label: "Mật khẩu" },
};
const registerFields = {
  displayName: { id: "register-name", label: "Tên hiển thị" },
  email: { id: "register-email", label: "Email" },
  password: { id: "register-password", label: "Mật khẩu" },
  confirm: { id: "register-confirm", label: "Xác nhận mật khẩu" },
};
const resetFields = {
  password: { id: "reset-password", label: "Mật khẩu mới" },
  confirm: { id: "reset-confirm", label: "Xác nhận mật khẩu" },
};

function apiMessage(error: unknown): string {
  return error instanceof ApiError ? t(error.code) : t("NETWORK_ERROR");
}

export function DemoNotice() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <Alert variant="info" title="Đang chạy ở chế độ demo">
      Email được ghi vào hộp thư trên máy. Quản trị viên có thể xem tại{" "}
      <Link
        className="inline-flex min-h-11 items-center font-semibold underline"
        href="/api/v1/dev/mail"
      >
        hộp thư dev
      </Link>
      .
    </Alert>
  );
}

export function LoginForm({
  next,
  passwordChanged = false,
}: {
  next: string;
  passwordChanged?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!email) nextErrors.email = "Nhập email của bạn.";
    else if (!emailPattern.test(email))
      nextErrors.email = "Email không hợp lệ.";
    if (!password) nextErrors.password = "Nhập mật khẩu.";
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) {
      focusValidation(event.currentTarget, Object.keys(nextErrors).length);
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        setRemaining(error.retryAfterSeconds ?? 60);
      }
      setMessage(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={submit} noValidate>
      {passwordChanged && (
        <Alert variant="success" title="Đã đổi mật khẩu">
          Mọi phiên cũ đã được đăng xuất. Đăng nhập lại bằng mật khẩu mới.
        </Alert>
      )}
      {message && <Alert variant="destructive" title={message} />}
      <ErrorSummary errors={errors} fields={loginFields} />
      <Field id="login-email" label="Email" required error={errors.email}>
        <input
          id="login-email"
          className="control"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "login-email-error" : undefined}
        />
      </Field>
      <div className="grid gap-2">
        <PasswordInput
          id="login-password"
          label="Mật khẩu"
          autoComplete="current-password"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Link
          className="inline-flex min-h-11 items-center justify-self-end text-sm font-semibold text-primary-text hover:underline"
          href="/forgot-password"
        >
          Quên mật khẩu
        </Link>
      </div>
      <Button type="submit" size="lg" loading={busy} disabled={remaining > 0}>
        {remaining > 0 ? `Thử lại sau ${remaining} giây` : "Đăng nhập"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-primary-text hover:underline"
          href={`/register?next=${encodeURIComponent(next)}`}
        >
          Đăng ký
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState({
    displayName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function change(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const name = values.displayName.trim();
    if (!name) nextErrors.displayName = "Nhập tên hiển thị.";
    else if (name.length < 2 || name.length > 80)
      nextErrors.displayName = "Tên hiển thị cần từ 2 đến 80 ký tự.";
    if (!values.email) nextErrors.email = "Nhập email của bạn.";
    else if (!emailPattern.test(values.email))
      nextErrors.email = "Email không hợp lệ.";
    if (values.password.length < 8)
      nextErrors.password = "Mật khẩu cần ít nhất 8 ký tự.";
    else if (values.password.length > 128)
      nextErrors.password = "Mật khẩu không được quá 128 ký tự.";
    if (values.confirm !== values.password)
      nextErrors.confirm = "Hai mật khẩu chưa khớp.";
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) {
      focusValidation(event.currentTarget, Object.keys(nextErrors).length);
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          displayName: name,
          email: values.email,
          password: values.password,
        }),
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        setErrors({ email: t(error.code) });
      } else {
        setMessage(apiMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={submit} noValidate>
      {message && <Alert variant="destructive" title={message} />}
      <ErrorSummary errors={errors} fields={registerFields} />
      <Field
        id="register-name"
        label="Tên hiển thị"
        required
        error={errors.displayName}
      >
        <input
          id="register-name"
          className="control"
          autoComplete="name"
          minLength={2}
          maxLength={80}
          value={values.displayName}
          onChange={(event) => change("displayName", event.target.value)}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={
            errors.displayName ? "register-name-error" : undefined
          }
        />
      </Field>
      <Field id="register-email" label="Email" required error={errors.email}>
        <input
          id="register-email"
          className="control"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          maxLength={320}
          value={values.email}
          onChange={(event) => change("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "register-email-error" : undefined}
        />
      </Field>
      <PasswordInput
        id="register-password"
        label="Mật khẩu"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        value={values.password}
        onChange={(event) => change("password", event.target.value)}
        error={errors.password}
        showStrength
      />
      <PasswordInput
        id="register-confirm"
        label="Xác nhận mật khẩu"
        autoComplete="new-password"
        value={values.confirm}
        onChange={(event) => change("confirm", event.target.value)}
        error={errors.confirm}
      />
      <Button type="submit" size="lg" loading={busy}>
        Tạo tài khoản
      </Button>
      <p className="text-sm text-muted-foreground">
        Khi tạo tài khoản, bạn đồng ý với{" "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-primary-text hover:underline"
          href="/terms"
        >
          Điều khoản sử dụng
        </Link>{" "}
        và{" "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-primary-text hover:underline"
          href="/privacy"
        >
          Chính sách bảo mật
        </Link>
        .
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-primary-text hover:underline"
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return setError("Nhập email của bạn.");
    if (!emailPattern.test(email)) return setError("Email không hợp lệ.");
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await apiFetch("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (caught) {
      setMessage(apiMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-5">
        <Alert variant="success" title="Kiểm tra hộp thư của bạn">
          Nếu email này đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu.
          Liên kết dùng được trong 60 phút.
        </Alert>
        <DemoNotice />
        <Link href="/login" className={buttonClass("outline", "lg")}>
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-6" onSubmit={submit} noValidate>
      {message && <Alert variant="destructive" title={message} />}
      <Field id="forgot-email" label="Email" required error={error}>
        <input
          id="forgot-email"
          className="control"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "forgot-email-error" : undefined}
        />
      </Field>
      <Button type="submit" size="lg" loading={busy}>
        Gửi liên kết đặt lại
      </Button>
      <Link
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary-text hover:underline"
        href="/login"
      >
        Quay lại đăng nhập
      </Link>
      <DemoNotice />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (password.length < 8)
      nextErrors.password = "Mật khẩu cần ít nhất 8 ký tự.";
    else if (password.length > 128)
      nextErrors.password = "Mật khẩu không được quá 128 ký tự.";
    if (confirm !== password) nextErrors.confirm = "Hai mật khẩu chưa khớp.";
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) {
      focusValidation(event.currentTarget, Object.keys(nextErrors).length);
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setComplete(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "TOKEN_INVALID")
        setInvalid(true);
      else setMessage(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (complete) {
    return (
      <div className="grid gap-5">
        <Alert variant="success" title="Đã đặt lại mật khẩu">
          Mọi phiên đăng nhập cũ đã bị đăng xuất. Đăng nhập lại bằng mật khẩu
          mới.
        </Alert>
        <Link href="/login" className={buttonClass("primary", "lg")}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (invalid) {
    return (
      <ErrorState
        title="Liên kết đã hết hạn hoặc đã được dùng"
        description="Liên kết chỉ dùng được một lần và có hạn 60 phút."
        actions={
          <Link href="/forgot-password" className={buttonClass("primary")}>
            Xin liên kết mới
          </Link>
        }
      />
    );
  }

  return (
    <form className="grid gap-6" onSubmit={submit} noValidate>
      {message && <Alert variant="destructive" title={message} />}
      <ErrorSummary errors={errors} fields={resetFields} />
      <PasswordInput
        id="reset-password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        showStrength
      />
      <PasswordInput
        id="reset-confirm"
        label="Xác nhận mật khẩu"
        autoComplete="new-password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={errors.confirm}
      />
      <Button type="submit" size="lg" loading={busy}>
        Đặt mật khẩu mới
      </Button>
    </form>
  );
}

export function VerifyEmail({ token }: { token: string }) {
  const started = useRef(false);
  const [state, setState] = useState<
    "pending" | "success" | "invalid" | "error"
  >("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void apiFetch("/auth/verify-email/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setState("success"))
      .catch((error) => {
        if (error instanceof ApiError && error.code === "TOKEN_INVALID")
          setState("invalid");
        else {
          setMessage(apiMessage(error));
          setState("error");
        }
      });
  }, [token]);

  if (state === "pending") {
    return (
      <div className="grid justify-items-center gap-4 py-10" role="status">
        <MailCheck
          aria-hidden="true"
          className="size-10 text-primary-text"
          strokeWidth={1.75}
        />
        <p className="font-semibold">Đang xác minh…</p>
      </div>
    );
  }
  if (state === "success") {
    return (
      <div className="grid gap-5">
        <Alert variant="success" title="Email đã được xác minh">
          Bạn có thể bắt đầu học ngay.
        </Alert>
        <Link href={LEARNER_HOME} className={buttonClass("primary", "lg")}>
          Về khóa học của tôi
        </Link>
      </div>
    );
  }
  if (state === "invalid") {
    return (
      <ErrorState
        title="Liên kết đã hết hạn hoặc đã được dùng"
        description="Liên kết chỉ dùng được một lần và có hạn 24 giờ."
        actions={<ResendVerificationButton />}
      />
    );
  }
  return <Alert variant="destructive" title={message} />;
}

export function ResendVerificationButton() {
  const router = useRouter();
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [remaining]);

  return (
    <div className="grid gap-3">
      <Button
        variant="outline"
        loading={busy}
        disabled={remaining > 0}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await apiFetch("/auth/verify-email/request", { method: "POST" });
            setRemaining(120);
            setMessage("Đã gửi lại email xác minh.");
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              router.push("/login");
              return;
            }
            setMessage(apiMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {remaining > 0
          ? `Gửi lại sau ${remaining} giây`
          : "Gửi lại email xác minh"}
      </Button>
      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
