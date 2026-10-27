"use client";

import { useState } from "react";

async function call(path: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: data.message ?? "Something went wrong." };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

export function SignOutButton() {
  return (
    <button
      className="btn secondary"
      onClick={async () => {
        await call("/api/auth/logout", {});
        window.location.assign("/");
      }}
    >
      Sign out
    </button>
  );
}

export function RevokeButton({ id, current }: { id: number; current: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await call("/api/auth/revoke", { id });
        window.location.assign(current ? "/" : "/account");
      }}
    >
      {current ? "Sign out" : "Remove"}
    </button>
  );
}

export function PasswordForm() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        const r = await call("/api/auth/password", { current: data.get("current"), next: data.get("next") });
        setBusy(false);
        setMessage({ ok: r.ok, text: r.ok ? "Password changed. Your other sessions and devices were signed out." : r.message ?? "" });
        if (r.ok) form.reset();
      }}
    >
      <label>
        Current password
        <input name="current" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      <label>
        New password <span className="hint">(at least 10 characters)</span>
        <input name="next" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </label>
      {message && <p className={message.ok ? "ok" : "error"} role="status">{message.text}</p>}
      <button className="btn" disabled={busy} type="submit">Change password</button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm("Delete your account? This cannot be undone.")) return;
        const data = new FormData(e.currentTarget);
        const r = await call("/api/auth/delete", { password: data.get("password") });
        if (r.ok) window.location.assign("/");
        else setError(r.message ?? "");
      }}
    >
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      <p className="error" role="alert">{error}</p>
      <button className="btn danger" type="submit">Delete my account</button>
    </form>
  );
}
