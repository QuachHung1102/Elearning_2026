import { describe, expect, it } from "vitest";
import { translate } from "./translations";
describe("interface translations", () => {
  it("keeps source-language copy and never translates unknown authored content", () => {
    expect(translate("vi", "Đăng nhập")).toBe("Đăng nhập");
    expect(translate("en", "Một tên bài học do người dạy đặt")).toBe(
      "Một tên bài học do người dạy đặt",
    );
  });
  it("uses explicit translations before the shared dictionary", () => {
    expect(translate("en", "Đăng nhập")).toBe("Log in");
    expect(translate("en", "Đăng nhập", "Enter your classroom")).toBe(
      "Enter your classroom",
    );
  });
  it("localizes retry timing without losing the remaining time", () => {
    expect(translate("en", "Thử lại sau 17 giây")).toBe(
      "Try again in 17 seconds",
    );
  });
});
