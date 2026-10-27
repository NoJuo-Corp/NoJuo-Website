"use client";

import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (mode === "signup" && password !== String(form.get("confirm") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password,
          ...(mode === "signup" && form.get("displayName") ? { displayName: form.get("displayName") } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      window.location.assign("/account");
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Username
        <input name="username" type="text" autoComplete="username" required minLength={3} maxLength={24} autoCapitalize="none" spellCheck={false} />
        {mode === "signup" && <span className="hint">3-24 characters: letters, digits, _ and -</span>}
      </label>
      {mode === "signup" && (
        <label>
          Display name <span className="hint">(optional)</span>
          <input name="displayName" type="text" autoComplete="nickname" maxLength={40} />
        </label>
      )}
      <label>
        Password
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 10 : 1} maxLength={200} />
        {mode === "signup" && <span className="hint">At least 10 characters. A few random words work well.</span>}
      </label>
      {mode === "signup" && (
        <label>
          Repeat password
          <input name="confirm" type="password" autoComplete="new-password" required maxLength={200} />
        </label>
      )}
      <p className="error" role="alert">{error}</p>
      <button className="btn" type="submit" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
    </form>
  );
}
