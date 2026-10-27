import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login() {
  if (await currentUser().catch(() => null)) redirect("/account");
  return (
    <div className="narrow" style={{ paddingTop: 56 }}>
      <h1>Sign in</h1>
      <AuthForm mode="login" />
      <p>New here? <Link href="/signup">Create an account</Link>.</p>
    </div>
  );
}
