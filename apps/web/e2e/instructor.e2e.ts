import { expect, test } from "@playwright/test";
import { ACCOUNTS, runId, signIn } from "./support";

// A 1×1 PNG: the cover only has to be an image the upload accepts.
const COVER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("an instructor builds a course, publishes it, and it is public", async ({
  page,
  browser,
}) => {
  const title = `E2E khóa học ${runId()}`;
  const lessonTitle = "Bài mở đầu";

  await signIn(page, ACCOUNTS.instructor);
  await expect(page).toHaveURL("/instructor");
  await page.goto("/instructor/courses/new");
  await page.locator("#title").fill(title);
  await page.locator("#categoryId").selectOption({ label: "Lập trình web" });
  await page.getByRole("button", { name: "Tạo bản nháp" }).click();
  await expect(page).toHaveURL(/\/instructor\/courses\/[0-9a-f-]{36}$/);
  const courseUrl = page.url();
  const slug = await page.locator("#slug").inputValue();
  expect(slug).toMatch(/^e2e-/);

  // Everything the publish checklist asks for (publish-validation.ts).
  await page.locator("#cover").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: COVER,
  });
  await expect(page.getByText("Đã tải ảnh bìa lên.")).toBeVisible();
  await page
    .locator("#description")
    .fill(
      "Khóa học do bộ kiểm thử e2e tạo ra. ".repeat(8) +
        "Mô tả cần dài ít nhất hai trăm ký tự để được xuất bản.",
    );
  await page.locator("#priceVnd").fill("199000");
  await page.locator("#learningOutcomes").fill("Tạo khóa học\nXuất bản khóa học");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã lưu khóa học")).toBeVisible();

  await page.getByRole("link", { name: "Chương trình học" }).click();
  await page.getByRole("button", { name: "Thêm chương" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#dialog-title").fill("Chương 1");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("heading", { name: "Chương 1" })).toBeVisible();

  await page.getByRole("button", { name: "Thêm bài học" }).click();
  await dialog.locator("#dialog-title").fill(lessonTitle);
  await dialog.locator("#dialog-type").selectOption("ARTICLE");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await page.getByRole("link", { name: lessonTitle }).click();

  await page.locator("#content").fill("Nội dung **bài đọc** đầu tiên.");
  await page.getByRole("checkbox", { name: /Cho học thử/ }).check();
  await page.getByRole("button", { name: "Lưu bài học" }).click();
  await expect(page.getByText("Đã lưu bài học")).toBeVisible();

  await page.goto(courseUrl);
  await page.getByRole("button", { name: "Xuất bản" }).click();
  await expect(page.getByText("Đã xuất bản khóa học")).toBeVisible();

  // Public: a stranger with no session sees the page and its curriculum.
  const guest = await browser.newPage();
  await guest.goto(`/courses/${slug}`);
  await expect(guest.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(guest.getByText(lessonTitle)).toBeVisible();
  await guest.close();
});
