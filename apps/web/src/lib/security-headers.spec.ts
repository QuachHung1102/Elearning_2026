import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

type Header = { key: string; value: string };

const value = (headers: Header[], key: string) =>
  headers.find((header) => header.key === key)?.value;

/** The sources one CSP directive allows, e.g. `directive(csp, "img-src")`. */
const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([first]) => first === name)
    ?.slice(1);

const csp = (headers: Header[]) => value(headers, "Content-Security-Policy")!;

describe("securityHeaders (ROADMAP A5.1, REVIEW F-20)", () => {
  it("forbids framing, sniffing and leaking the path to other sites", () => {
    const headers = securityHeaders({ dev: false });

    expect(value(headers, "X-Frame-Options")).toBe("DENY");
    expect(value(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(value(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(directive(csp(headers), "frame-ancestors")).toEqual(["'none'"]);
  });

  it("keeps everything on this origin, and closes the doors that need no key", () => {
    const policy = csp(securityHeaders({ dev: false }));

    expect(directive(policy, "default-src")).toEqual(["'self'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
    expect(directive(policy, "script-src")).not.toContain("https:");
    expect(policy).not.toMatch(/\*/);
  });

  it("allows eval and websockets only for the dev server", () => {
    const dev = csp(securityHeaders({ dev: true }));
    const production = csp(securityHeaders({ dev: false }));

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(production).not.toContain("unsafe-eval");
    expect(production).not.toContain("ws:");
  });

  it("pins the browser to HTTPS only in production", () => {
    expect(value(securityHeaders({ dev: true }), "Strict-Transport-Security")).toBeUndefined();
    expect(value(securityHeaders({ dev: false }), "Strict-Transport-Security")).toBe(
      "max-age=31536000",
    );
  });

  it("lets images, video and HLS come from the storage hosts it is told about, and nothing else", () => {
    const policy = csp(
      securityHeaders({
        dev: false,
        mediaOrigins: "https://media.example.com, https://customer-abc.cloudflarestream.com",
      }),
    );
    const hosts = ["https://media.example.com", "https://customer-abc.cloudflarestream.com"];

    for (const name of ["img-src", "media-src", "connect-src"]) {
      expect(directive(policy, name)).toEqual(expect.arrayContaining(hosts));
    }
    for (const name of ["default-src", "script-src", "style-src", "font-src", "frame-ancestors"]) {
      expect(directive(policy, name)).not.toEqual(expect.arrayContaining(hosts));
    }
  });

  it("is applied to every page by next.config, and left to the API on /api", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/((?!api/).*)");
    expect(rules[0].headers.map(({ key }) => key)).toEqual(
      securityHeaders({ dev: false }).map(({ key }) => key),
    );
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("refuses a media origin that could add a directive or a wildcard to the policy", () => {
    for (const bad of [
      "https://a.example.com; script-src https://evil.example",
      "https://*.example.com",
      "example.com",
      "'unsafe-inline'",
    ]) {
      expect(() => securityHeaders({ dev: false, mediaOrigins: bad })).toThrow(
        /CSP_MEDIA_ORIGINS/,
      );
    }
  });
});
