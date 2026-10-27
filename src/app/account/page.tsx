import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeleteAccountForm, PasswordForm, RevokeButton, SignOutButton } from "@/components/AccountActions";
import { listSessions } from "@/lib/auth";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default async function Account() {
  const auth = await currentUser();
  if (!auth) redirect("/login");
  const sessions = await listSessions(auth.user.id);
  return (
    <div className="wrap" style={{ paddingTop: 56, maxWidth: 760 }}>
      <h1>{auth.user.displayName}</h1>
      <p style={{ color: "var(--muted)" }}>@{auth.user.username} &middot; member since {fmt(auth.user.createdAt).slice(0, 10)}</p>
      <p><SignOutButton /></p>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Browsers and devices</h2>
        <p style={{ color: "var(--muted)" }}>Where your account is signed in. Remove anything you do not recognise; a removed device must sign in again.</p>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.label}{s.id === auth.session.id ? " (this browser)" : ""}</td>
                <td>{s.kind === "device" ? "Device" : "Browser"}</td>
                <td>{fmt(s.lastUsedAt)}</td>
                <td><RevokeButton id={s.id} current={s.id === auth.session.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Change password</h2>
        <PasswordForm />
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Delete account</h2>
        <p style={{ color: "var(--muted)" }}>Removes your account and signs out every browser and device.</p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
