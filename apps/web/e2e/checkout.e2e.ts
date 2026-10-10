import { expect, test } from "@playwright/test";
import { ACCOUNTS, PANDAS_COURSE, signIn } from "./support";

test("demo checkout: the learner presses Thanh toán and the course is theirs", async ({
  page: learner,
}) => {
  await signIn(learner, ACCOUNTS.student3, `/courses/${PANDAS_COURSE}`);
  const title = (await learner.getByRole("heading", { level: 1 }).textContent())!;
  await learner.getByRole("button", { name: /^Đăng ký học/ }).click();
  await expect(learner).toHaveURL(`/checkout/${PANDAS_COURSE}`);
  await expect(learner.getByText("Chế độ demo")).toBeVisible();

  // The button runs the same signed confirmation a real payment does, then the
  // panel reads the stored order and turns into the receipt.
  await learner.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await expect(
    learner.getByRole("heading", { name: "Thanh toán thành công" }),
  ).toBeVisible({ timeout: 20_000 });

  await learner.goto("/my-courses");
  await expect(learner.getByRole("heading", { name: title })).toBeVisible();
});
