import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function Signup() {
  if (await currentUser().catch(() => null)) redirect("/account");
  return (
    <div className="narrow" style={{ paddingTop: 56 }}>
      <h1>Create an account</h1>
      <AuthForm mode="signup" />
      <p>Already have one? <Link href="/login">Sign in</Link>. We do not ask for an email address, so there is no password reset: keep your password safe.</p>
    </div>
  );
}
