import { notFound, redirect } from "next/navigation";

type ErrorBody = {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
  requestId?: string;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let sessionRedirectPending = false;

function apiUrl(path: string): string {
  const normalized = path.startsWith("/api/v1") ? path : `/api/v1${path}`;
  if (typeof window !== "undefined") return normalized;
  return `${(process.env.API_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "")}${normalized}`;
}

function csrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((value) => value.startsWith("elearning_csrf="))
    ?.split("=")[1];
}

async function renewCsrf(signal: AbortSignal): Promise<string | undefined> {
  const response = await fetch(apiUrl("/auth/csrf"), {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as { csrfToken?: string };
  return body.csrfToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  retriedCsrf = false,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const timeout = AbortSignal.timeout(10_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  const headers = new Headers(init.headers);

  if (!SAFE_METHODS.has(method)) {
    headers.set("Content-Type", "application/json");
    const token = csrfCookie() ?? (await renewCsrf(signal));
    if (token) headers.set("X-CSRF-Token", decodeURIComponent(token));
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR");
  }

  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    const error = (body ?? {}) as ErrorBody;
    if (error.code === "CSRF_INVALID" && !retriedCsrf) {
      await renewCsrf(signal);
      return apiFetch<T>(path, init, true);
    }
    if (
      response.status === 401 &&
      error.code === "UNAUTHENTICATED" &&
      typeof window !== "undefined" &&
      !sessionRedirectPending
    ) {
      sessionRedirectPending = true;
      window.dispatchEvent(
        new CustomEvent("elearning:session-expired", {
          detail: `${window.location.pathname}${window.location.search}`,
        }),
      );
    }
    throw new ApiError(
      response.status,
      error.code ?? "INTERNAL",
      error.details,
      error.requestId,
      Number(response.headers.get("Retry-After")) || undefined,
    );
  }
  return body as T;
}

export async function requireAuth(
  response: Response,
  pathname: string,
  courseSlug?: string,
): Promise<Response> {
  if (response.status === 401) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  if (response.status === 403) {
    const body = (await response.clone().json()) as ErrorBody;
    if (body.code === "NOT_ENROLLED" && courseSlug) {
      redirect(`/courses/${courseSlug}?denied=1`);
    }
    notFound();
  }
  if (response.status === 404) notFound();
  return response;
}
