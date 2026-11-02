import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("API response handling", () => {
  it("accepts the contact API's empty 202 after fetching CSRF", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/auth/csrf")
      ? Response.json({ csrfToken: "fixture" }) : new Response(null, { status: 202 })));
    await expect(apiFetch("/contact", { method: "POST", body: "{}" })).resolves.toBeUndefined();
  });
  it("keeps 204 responses valid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(apiFetch("/fixture")).resolves.toBeUndefined();
  });
  it("preserves successful JSON and structured errors", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ code: "NOT_FOUND" }, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    await expect(apiFetch("/fixture")).resolves.toEqual({ ok: true });
    await expect(apiFetch("/fixture")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
  it("converts proxy HTML errors into an API error rather than a JSON exception", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<h1>Bad Gateway</h1>", { status: 502 })));
    await expect(apiFetch("/fixture")).rejects.toMatchObject({ status: 502, code: "INTERNAL" });
  });
});
