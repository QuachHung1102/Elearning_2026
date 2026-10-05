import { describe, expect, it } from "vitest";
import { messages } from "../messages/vi";
import { ApiError, errorMessage } from "./api";

describe("errorMessage", () => {
  it("words an API code through the shared catalogue", () => {
    expect(errorMessage(new ApiError(409, "SLUG_TAKEN"))).toBe(
      messages.SLUG_TAKEN,
    );
  });

  it("falls back to INTERNAL for an unknown code", () => {
    expect(errorMessage(new ApiError(500, "NOPE"))).toBe(messages.INTERNAL);
  });

  it("treats anything else as a network failure", () => {
    expect(errorMessage(new TypeError("fetch failed"))).toBe(
      messages.NETWORK_ERROR,
    );
  });
});
