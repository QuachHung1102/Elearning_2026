import { describe, expect, it } from "vitest";
import { passwordError } from "./password";

describe("passwordError", () => {
  it("accepts 8 to 128 characters", () => {
    expect(passwordError("a".repeat(8))).toBeUndefined();
    expect(passwordError("a".repeat(128))).toBeUndefined();
  });

  it("rejects too short and too long", () => {
    expect(passwordError("a".repeat(7))).toBe("Mật khẩu cần ít nhất 8 ký tự.");
    expect(passwordError("a".repeat(129))).toBe(
      "Mật khẩu không được quá 128 ký tự.",
    );
  });
});
