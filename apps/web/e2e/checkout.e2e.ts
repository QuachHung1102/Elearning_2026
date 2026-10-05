import { expect, test } from "@playwright/test";
import { ACCOUNTS, PANDAS_COURSE, signIn } from "./support";

test("demo checkout: the learner pays, an admin confirms, the course is theirs", async ({
  browser,
}) => {
  // Two people, two browsers: nothing is shared but the server.
  const learnerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const learner = await learnerContext.newPage();
  const admin = await adminContext.newPage();

  await signIn(learner, ACCOUNTS.student3, `/courses/${PANDAS_COURSE}`);
  const title = (await learner.getByRole("heading", { level: 1 }).textContent())!;
  await learner.getByRole("button", { name: /^Đăng ký học/ }).click();
  await expect(learner).toHaveURL(`/checkout/${PANDAS_COURSE}`);
  await expect(learner.getByText("Chế độ demo")).toBeVisible();

  await signIn(admin, ACCOUNTS.admin);
  await admin.goto("/admin/orders");
  const order = admin
    .getByRole("row")
    .filter({ hasText: ACCOUNTS.student3.email })
    .filter({ hasText: title });
  await order.getByRole("button", { name: /^Xác nhận thanh toán/ }).click();
  await expect(
    order.getByRole("button", { name: /^Xác nhận thanh toán/ }),
  ).toHaveCount(0);

  // The checkout page polls the order every 3 s and turns into the receipt.
  await expect(
    learner.getByRole("heading", { name: "Thanh toán thành công" }),
  ).toBeVisible({ timeout: 20_000 });

  await learner.goto("/my-courses");
  await expect(learner.getByRole("heading", { name: title })).toBeVisible();

  await learnerContext.close();
  await adminContext.close();
});
