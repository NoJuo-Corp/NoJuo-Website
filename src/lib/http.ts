import { AuthError } from "./auth";
import { hit } from "./rate";

export const COOKIE = "__Host-nj_session";

export function json(body: unknown, init: ResponseInit & { cookies?: string[] } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  for (const c of init.cookies ?? []) headers.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) return json({ error: error.code, message: error.message }, { status: error.status });
  console.error("unhandled error", error);
  return json({ error: "server_error", message: "Something went wrong." }, { status: 500 });
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

/** JSON body, at most 8 KiB, as an object. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) throw new AuthError(415, "unsupported_media_type", "Send JSON (Content-Type: application/json).");
  const text = await req.text();
  if (text.length > 8192) throw new AuthError(413, "too_large", "The request is too large.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AuthError(400, "invalid_json", "The body is not valid JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AuthError(400, "invalid_json", "The body must be a JSON object.");
  return value as Record<string, unknown>;
}

/** Cookie-authenticated POSTs must come from this site (SameSite=Lax is the second line of defence). */
export function requireSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client; it has no ambient cookies to abuse
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try {
    ok = new URL(origin).host === host;
  } catch {
    ok = false;
  }
  if (!ok) throw new AuthError(403, "bad_origin", "Cross-site request refused.");
}

export async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const r = await hit(key, max, windowSeconds);
  if (!r.allowed) {
    const e = new AuthError(429, "rate_limited", `Too many attempts. Try again in ${r.retryAfter} seconds.`);
    throw e;
  }
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  const m = h && /^Bearer\s+([A-Za-z0-9_-]{20,128})$/.exec(h);
  return m ? m[1] : null;
}

export function sessionCookie(token: string, expires: Date): string {
  return `${COOKIE}=${token}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}

export function cookieFrom(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return null;
}
