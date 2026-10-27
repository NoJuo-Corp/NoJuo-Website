# NoJuo site

Company website and account backend for NoJuo (HorizonOS, KopaQop, Snow Code, Mooste).
Next.js 16 (App Router) + TypeScript, Postgres on Neon, hosted on Vercel's free tier.

## Run locally

    npm install
    npm run dev        # no DATABASE_URL needed: uses an in-memory PGlite database
    npm test           # API tests (PGlite)
    npm run typecheck

The dev database is wiped whenever the server restarts.

## Deploy on Vercel (free)

1. Push this folder to a Git repository and import it at vercel.com/new.
2. In the project, open **Storage -> Create Database -> Neon (Postgres)** and connect it.
   Vercel adds `DATABASE_URL` to the project's environment.
3. Set `NEXT_PUBLIC_SITE_URL` (for example `https://nojuo.vercel.app`) in Settings -> Environment Variables.
4. Create the tables once, from your computer, with the same URL:

       DATABASE_URL="postgres://..." npm run db:migrate

5. Deploy. `GET /api/health` should answer `{ "ok": true }`.

Without `DATABASE_URL` a production build refuses to start the database on purpose.

## Security notes

Passwords: scrypt. Sessions: random tokens, only their SHA-256 is stored; cookie `__Host-nj_session`
(HttpOnly, Secure, SameSite=Lax). Writes need a same-origin request and a JSON body (8 KiB max).
Signup and login are rate limited per IP and per username. Security headers and CSP: `next.config.mjs`.

## HorizonOS sign-in

The OS tool `account` (`account login <user> <password> [-s server]`, `whoami`, `logout`) talks to
`/api/v1/*` (documented at `/developers`) and stores a device token in `C:\Horizon\Settings\account.ini`.
Set `kDefaultServer` in `user/tools/account.cpp` to your real Vercel URL.
