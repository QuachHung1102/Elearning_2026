import { expect, test } from "@playwright/test";
import { ACCOUNTS, PANDAS_COURSE, signIn } from "./support";

test("paid enrollment opens public tutor contact details without creating an online payment", async ({
  page,
}) => {
  const paymentRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/v1\/checkout\//.test(request.url())
    )
      paymentRequests.push(request.url());
  });
  await page.goto("/courses/" + PANDAS_COURSE);
  const title = (await page
    .getByRole("heading", { level: 1 })
    .textContent())!.trim();
  await page
    .getByRole("link", { name: "Liên hệ đăng ký học", exact: true })
    .click();
  await expect(page).toHaveURL("/checkout/" + PANDAS_COURSE);
  await expect(
    page.getByRole("heading", { name: "Liên hệ Hải Nam", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nội dung đăng ký khóa học")).toHaveValue(
    new RegExp(PANDAS_COURSE),
  );
  await expect(
    page.getByRole("button", { name: "Sao chép tin nhắn", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thanh toán", exact: true }),
  ).toHaveCount(0);
  expect(paymentRequests).toEqual([]);

  // Opening the contact page is not an enrollment or a claim of payment.
  await signIn(page, ACCOUNTS.student3, "/courses/" + PANDAS_COURSE);
  await expect(
    page.getByRole("link", { name: "Liên hệ đăng ký học", exact: true }),
  ).toBeVisible();
  await page.goto("/my-courses");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  expect(paymentRequests).toEqual([]);
});
