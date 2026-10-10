import { expect, type Page } from "@playwright/test";

/** Seeded accounts and courses (`apps/api/prisma/seed.ts`, `seed-catalog.ts`). */
export const ACCOUNTS = {
  admin: { email: "admin@elearning.local", password: "Demo!Admin123" },
  // Enrolled in REACT_COURSE with no progress after the reset.
  student2: { email: "student2@elearning.local", password: "Demo!Student123" },
  // Verified email and no enrollment: the demo buyer.
  student3: { email: "student3@elearning.local", password: "Demo!Student123" },
  instructor: {
    email: "instructor@elearning.local",
    password: "Demo!Instructor123",
  },
} as const;

export const REACT_COURSE = "lap-trinh-web-voi-react-va-nextjs";
export const PANDAS_COURSE = "phan-tich-du-lieu-voi-python-va-pandas";

/** Unique per run; the `e2e-` prefix is what global setup deletes. */
export function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Signs in through the form and waits for the full-page redirect it ends with. */
export async function signIn(
  page: Page,
  account: { email: string; password: string },
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await fillSignIn(page, account);
  if (next) await expect(page).toHaveURL(next);
  else await expect(page).not.toHaveURL(/\/login/);
}

export async function fillSignIn(
  page: Page,
  account: { email: string; password: string },
): Promise<void> {
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}
