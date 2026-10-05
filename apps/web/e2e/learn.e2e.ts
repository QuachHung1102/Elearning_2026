import { expect, test } from "@playwright/test";
import { ACCOUNTS, REACT_COURSE, fillSignIn } from "./support";

test("a guest signs in from a course page, learns, and the progress is saved", async ({
  page,
}) => {
  await page.goto(`/courses/${REACT_COURSE}`);
  await page.getByRole("link", { name: "Đăng nhập để đăng ký học" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await fillSignIn(page, ACCOUNTS.student2);

  // Back on the course page, which now knows the learner is enrolled.
  await expect(page).toHaveURL(`/courses/${REACT_COURSE}`);
  await page.getByRole("link", { name: "Vào học" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/learn/${REACT_COURSE}/[0-9a-f-]{36}$`),
  );

  // The player got a signed playback URL from the API and the file loads.
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /\/api\/v1\/media\/local\/videos\//);
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThan(0);

  const done = page.getByRole("button", {
    name: "Đã hoàn thành, bấm để bỏ đánh dấu",
  });
  await page
    .getByRole("button", { name: "Đánh dấu hoàn thành", exact: true })
    .click();
  await expect(done).toBeVisible();

  // Saved on the server, not just on screen.
  await page.reload();
  await expect(done).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText(/^1\/\d+ bài$/),
  ).toBeVisible();
});
