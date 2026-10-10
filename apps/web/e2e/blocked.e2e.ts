import { expect, test } from "@playwright/test";
import { REACT_COURSE, runId } from "./support";

type Outline = {
  sections: { lessons: { id: string; title: string; isPreview: boolean }[] }[];
};

test("a new learner without the course is kept out of a paid lesson", async ({
  page,
  request,
}) => {
  // The public outline names every lesson; take one that is not "Học thử".
  const outline = (await (
    await request.get(`/api/v1/courses/${REACT_COURSE}`)
  ).json()) as Outline;
  const paid = outline.sections
    .flatMap((section) => section.lessons)
    .find((lesson) => !lesson.isPreview)!;

  // N5.4: a guessed lesson URL tells a stranger nothing.
  const anonymous = await request.get(`/api/v1/lessons/${paid.id}/content`);
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.text()).not.toContain(paid.title);

  await page.goto(`/register?next=/courses/${REACT_COURSE}`);
  await page.locator("#register-name").fill("Học viên e2e");
  await page.locator("#register-email").fill(`e2e-${runId()}@example.com`);
  await page.locator("#register-password").fill("E2e!Password123");
  await page.locator("#register-confirm").fill("E2e!Password123");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page).toHaveURL(`/courses/${REACT_COURSE}`);
  await expect(page.getByRole("button", { name: /^Đăng ký học/ })).toBeVisible();

  const playbackRequests: string[] = [];
  page.on("request", (sent) => {
    if (sent.url().includes("/playback-token")) playbackRequests.push(sent.url());
  });

  await page.goto(`/learn/${REACT_COURSE}/${paid.id}`);
  await expect(page).toHaveURL(`/courses/${REACT_COURSE}?denied=1`);
  await expect(page.getByText("Bạn chưa có quyền học khóa này.")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(playbackRequests).toEqual([]);
});
