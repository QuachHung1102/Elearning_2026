import { describe, expect, it } from "vitest";
import { forwardVisitor, internalApiSecret } from "./internal-api";

const SECRET = "s".repeat(32);
const proxied = { TRUST_X_REAL_IP: "true", INTERNAL_API_SECRET: SECRET };

// T4.17: the API limits each visitor, not this server.
describe("forwardVisitor", () => {
  it("names the visitor the reverse proxy saw, with the secret", () => {
    const headers = forwardVisitor(
      new Headers(),
      new Headers({ "x-real-ip": "203.0.113.7" }),
      proxied,
    );
    expect(headers.get("x-visitor-ip")).toBe("203.0.113.7");
    expect(headers.get("x-internal-api-secret")).toBe(SECRET);
  });

  it("drops what the browser sent in its own name (the /api rewrite copies its headers)", () => {
    const browser = new Headers({
      "x-visitor-ip": "198.51.100.1",
      "x-internal-api-secret": "guess",
    });
    const headers = forwardVisitor(new Headers(browser), browser, {});
    expect(headers.has("x-visitor-ip")).toBe(false);
    expect(headers.has("x-internal-api-secret")).toBe(false);
  });

  it("overwrites a browser-sent visitor IP with the proxy's", () => {
    const browser = new Headers({
      "x-visitor-ip": "198.51.100.1",
      "x-real-ip": "203.0.113.7",
    });
    const headers = forwardVisitor(new Headers(browser), browser, proxied);
    expect(headers.get("x-visitor-ip")).toBe("203.0.113.7");
  });

  it("forwards nothing without a trusted proxy, where X-Real-IP is client-supplied", () => {
    const headers = forwardVisitor(
      new Headers(),
      new Headers({ "x-real-ip": "203.0.113.7" }),
      { INTERNAL_API_SECRET: SECRET },
    );
    expect(headers.has("x-visitor-ip")).toBe(false);
    expect(headers.has("x-internal-api-secret")).toBe(false);
  });
});

describe("internalApiSecret", () => {
  it("falls back to the API's development value", () => {
    expect(internalApiSecret({})).toBe("dev-internal-api-secret-not-a-secret");
  });

  it("is required once X-Real-IP is trusted, the only case it is sent", () => {
    expect(() => internalApiSecret({ TRUST_X_REAL_IP: "true" })).toThrow(
      /INTERNAL_API_SECRET/,
    );
  });
});
