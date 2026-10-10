// Server only: the proxy, `serverFetch` and next.config read it. The secret is
// not NEXT_PUBLIC_, so a client bundle importing this would only see undefined.

type Env = Partial<Record<string, string>>;

// The API's own fallback outside production (apps/api/src/config.ts).
const DEV_SECRET = "dev-internal-api-secret-not-a-secret";

/** Proves to the API that a forwarded visitor IP comes from this server. */
export function internalApiSecret(env: Env = process.env): string {
  const secret = env.INTERNAL_API_SECRET;
  if (secret) return secret;
  // The only case where the secret is sent: the fallback would not match a
  // production API, and every visitor would silently share one bucket again.
  if (env.TRUST_X_REAL_IP === "true") {
    throw new Error("INTERNAL_API_SECRET is required with TRUST_X_REAL_IP");
  }
  return DEV_SECRET;
}

/**
 * Every call this server makes to the API comes from one address, so the API
 * would rate-limit all visitors as one (T4.17). This names the visitor behind
 * `incoming` on `target`, which the API trusts only with the secret.
 *
 * Both headers are dropped first: the `/api/*` rewrite copies the browser's own.
 */
export function forwardVisitor(
  target: Headers,
  incoming: Headers,
  env: Env = process.env,
): Headers {
  target.delete("x-visitor-ip");
  target.delete("x-internal-api-secret");
  // TRUST_X_REAL_IP says a reverse proxy in front of this server overwrites
  // X-Real-IP; anywhere else the client wrote it. Nothing forwarded means the
  // API limits this server, as before.
  const ip =
    env.TRUST_X_REAL_IP === "true" ? incoming.get("x-real-ip") : null;
  if (ip) {
    target.set("x-visitor-ip", ip);
    target.set("x-internal-api-secret", internalApiSecret(env));
  }
  return target;
}
