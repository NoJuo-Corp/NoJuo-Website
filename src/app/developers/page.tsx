import type { Metadata } from "next";

export const metadata: Metadata = { title: "Developers" };

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-site.vercel.app";

export default function Developers() {
  return (
    <div className="narrow" style={{ paddingTop: 56 }}>
      <h1>Account API</h1>
      <p>Devices such as HorizonOS sign in with a username and password and get a long-lived bearer token. Send it as <code>Authorization: Bearer &lt;token&gt;</code>. Tokens last 180 days, can be revoked on the account page, and are stored on our side only as a hash. All bodies are JSON.</p>

      <h2>Sign in</h2>
      <pre>{`POST ${base}/api/v1/token
{"username": "ada", "password": "...", "device": "Horizon PC"}

200 {"user": {"id": 1, "username": "ada", "displayName": "Ada", "createdAt": "..."},
     "token": "…", "expiresAt": "…"}
401 {"error": "invalid_credentials", "message": "..."}
429 {"error": "rate_limited", "message": "..."}`}</pre>

      <h2>Create an account</h2>
      <pre>{`POST ${base}/api/v1/signup
{"username": "ada", "password": "at least 10 characters", "displayName": "Ada", "device": "Horizon PC"}

201 same shape as sign in`}</pre>

      <h2>Who am I</h2>
      <pre>{`GET ${base}/api/v1/me
Authorization: Bearer <token>

200 {"user": {...}, "session": {"id": 3, "kind": "device", "label": "Horizon PC", ...}}
401 {"error": "invalid_token", ...}`}</pre>

      <h2>Sign out</h2>
      <pre>{`POST ${base}/api/v1/logout
Authorization: Bearer <token>

200 {"ok": true}`}</pre>

      <p>Errors always have the form <code>{`{"error": "code", "message": "text"}`}</code>. Sign-in attempts are limited per address and per username.</p>
    </div>
  );
}
