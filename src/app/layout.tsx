import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "NoJuo", template: "%s | NoJuo" },
  description: "NoJuo builds software: HorizonOS, KopaQop, Snow Code and Mooste.",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await currentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="brand">NoJuo</Link>
            <nav className="main" aria-label="Main">
              <Link href="/#products">Products</Link>
              <Link href="/about">About</Link>
              <Link href="/developers">Developers</Link>
              {auth ? <Link href="/account">{auth.user.displayName}</Link> : <Link href="/login">Sign in</Link>}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site">
          <div className="wrap">
            <span>&copy; {new Date().getFullYear()} NoJuo</span>
            <span><Link href="/privacy">Privacy</Link></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
