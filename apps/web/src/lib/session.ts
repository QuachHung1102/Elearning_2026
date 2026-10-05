import { cache } from "react";
import { cookies, headers as requestHeaders } from "next/headers";
import { ApiError } from "./api";
import { forwardVisitor } from "./internal-api";
import { API_ORIGIN } from "./site";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  status: "ACTIVE" | "BLOCKED";
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export async function serverFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cookie = (await cookies()).toString();
  const headers = forwardVisitor(
    new Headers(init.headers),
    await requestHeaders(),
  );
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${API_ORIGIN}/api/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

export const getSession = cache(async (): Promise<User | null> => {
  const response = await serverFetch("/auth/me");
  if (response.status === 401) return null;
  if (!response.ok) {
    const body = (await response.json()) as {
      code?: string;
      requestId?: string;
    };
    throw new ApiError(
      response.status,
      body.code ?? "INTERNAL",
      undefined,
      body.requestId,
    );
  }
  return ((await response.json()) as { user: User }).user;
});
