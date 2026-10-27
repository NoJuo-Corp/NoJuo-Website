/*
 * Accounts and sessions. Passwords are hashed with scrypt (Node's built-in, no native modules, so it
 * runs on Vercel unchanged); session and device tokens are random and only their SHA-256 is stored.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const N = 16384, R = 8, P = 1, KEYLEN = 64;
export const WEB_SESSION_DAYS = 30;
export const DEVICE_TOKEN_DAYS = 180;
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 200; // scrypt cost grows with input size

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface SessionInfo {
  id: number;
  kind: "web" | "device";
  label: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/* ---- Validation ----------------------------------------------------------------------------- */

const USERNAME = /^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/;
const RESERVED = new Set(["admin", "administrator", "root", "system", "support", "nojuo", "horizon", "security", "null"]);

export function validateUsername(value: unknown): string {
  if (typeof value !== "string" || !USERNAME.test(value))
    throw new AuthError(400, "invalid_username", "Usernames are 3-24 characters: letters, digits, _ and -, starting with a letter or digit.");
  if (RESERVED.has(value.toLowerCase())) throw new AuthError(400, "reserved_username", "That username is reserved.");
  return value;
}

export function validatePassword(value: unknown, username?: string): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD)
    throw new AuthError(400, "weak_password", `Passwords need at least ${MIN_PASSWORD} characters.`);
  if (value.length > MAX_PASSWORD) throw new AuthError(400, "invalid_password", `Passwords can be at most ${MAX_PASSWORD} characters.`);
  if (username && value.toLowerCase() === username.toLowerCase())
    throw new AuthError(400, "weak_password", "The password cannot be the username.");
  return value;
}

export function validateLabel(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new AuthError(400, "invalid_label", "label must be text.");
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60);
  return clean || fallback;
}

/* ---- Passwords -------------------------------------------------------------------------------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (!Number.isInteger(n) || n > 1 << 20 || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(parts[4], "base64"), expected = Buffer.from(parts[5], "base64");
  const actual = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Verifying against this when the user does not exist keeps the response time the same.
let dummy: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword("not-a-real-password"));
}

/* ---- Tokens ------------------------------------------------------------------------------------ */

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ---- Accounts ----------------------------------------------------------------------------------- */

function toUser(row: Record<string, unknown>): PublicUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function createUser(usernameIn: unknown, passwordIn: unknown, displayNameIn?: unknown): Promise<PublicUser> {
  const username = validateUsername(usernameIn);
  const password = validatePassword(passwordIn, username);
  let displayName = username;
  if (displayNameIn !== undefined && displayNameIn !== null && displayNameIn !== "") {
    if (typeof displayNameIn !== "string") throw new AuthError(400, "invalid_display_name", "displayName must be text.");
    // eslint-disable-next-line no-control-regex
    displayName = displayNameIn.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 40) || username;
  }
  const sql = await getSql();
  const hash = await hashPassword(password);
  const rows = await sql`
    INSERT INTO users (username, username_lower, display_name, password_hash)
    VALUES (${username}, ${username.toLowerCase()}, ${displayName}, ${hash})
    ON CONFLICT (username_lower) DO NOTHING
    RETURNING id, username, display_name, created_at`;
  if (!rows.length) throw new AuthError(409, "username_taken", "That username is taken.");
  return toUser(rows[0]);
}

export async function verifyLogin(usernameIn: unknown, passwordIn: unknown): Promise<PublicUser> {
  const fail = new AuthError(401, "invalid_credentials", "Wrong username or password.");
  if (typeof usernameIn !== "string" || typeof passwordIn !== "string" || passwordIn.length > MAX_PASSWORD || usernameIn.length > 64)
    throw fail;
  const sql = await getSql();
  const rows = await sql`SELECT id, username, display_name, created_at, password_hash FROM users WHERE username_lower = ${usernameIn.toLowerCase()}`;
  const ok = await verifyPassword(passwordIn, rows.length ? String(rows[0].password_hash) : await dummyHash());
  if (!rows.length || !ok) throw fail;
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${rows[0].id}`;
  return toUser(rows[0]);
}

/* ---- Sessions ------------------------------------------------------------------------------------ */

/** Creates a session or device token; the plain token is returned once and never stored. */
export async function createSession(userId: number, kind: "web" | "device", label: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const days = kind === "web" ? WEB_SESSION_DAYS : DEVICE_TOKEN_DAYS;
  const expiresAt = new Date(Date.now() + days * 86400_000);
  const sql = await getSql();
  await sql`INSERT INTO sessions (user_id, token_hash, kind, label, expires_at) VALUES (${userId}, ${hashToken(token)}, ${kind}, ${label}, ${expiresAt.toISOString()})`;
  // Keep the table small: drop this user's expired sessions now and then.
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND expires_at < now()`;
  return { token, expiresAt };
}

export interface Authenticated {
  user: PublicUser;
  session: SessionInfo;
}

export async function authenticate(token: string | undefined | null, kind?: "web" | "device"): Promise<Authenticated | null> {
  if (!token || token.length > 128) return null;
  const sql = await getSql();
  const rows = await sql`
    SELECT s.id AS sid, s.kind, s.label, s.created_at AS s_created, s.last_used_at, s.expires_at,
           u.id, u.username, u.display_name, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()`;
  if (!rows.length) return null;
  const r = rows[0];
  if (kind && r.kind !== kind) return null;
  // Touch at most once a minute.
  if (Date.now() - new Date(r.last_used_at as string).getTime() > 60_000)
    await sql`UPDATE sessions SET last_used_at = now() WHERE id = ${r.sid}`;
  return {
    user: toUser(r),
    session: {
      id: Number(r.sid),
      kind: r.kind as "web" | "device",
      label: String(r.label),
      createdAt: new Date(r.s_created as string).toISOString(),
      lastUsedAt: new Date(r.last_used_at as string).toISOString(),
      expiresAt: new Date(r.expires_at as string).toISOString(),
    },
  };
}

export async function revokeToken(token: string): Promise<void> {
  const sql = await getSql();
  await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
}

export async function listSessions(userId: number): Promise<SessionInfo[]> {
  const sql = await getSql();
  const rows = await sql`SELECT id, kind, label, created_at, last_used_at, expires_at FROM sessions WHERE user_id = ${userId} AND expires_at > now() ORDER BY last_used_at DESC`;
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind as "web" | "device",
    label: String(r.label),
    createdAt: new Date(r.created_at as string).toISOString(),
    lastUsedAt: new Date(r.last_used_at as string).toISOString(),
    expiresAt: new Date(r.expires_at as string).toISOString(),
  }));
}

export async function revokeSessionById(userId: number, sessionId: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql`DELETE FROM sessions WHERE id = ${sessionId} AND user_id = ${userId} RETURNING id`;
  return rows.length > 0;
}

export async function changePassword(userId: number, current: unknown, next: unknown, keepSessionId: number): Promise<void> {
  const sql = await getSql();
  const rows = await sql`SELECT username, password_hash FROM users WHERE id = ${userId}`;
  if (!rows.length) throw new AuthError(404, "no_user", "No such account.");
  if (typeof current !== "string" || current.length > MAX_PASSWORD || !(await verifyPassword(current, String(rows[0].password_hash))))
    throw new AuthError(403, "invalid_credentials", "The current password is wrong.");
  const password = validatePassword(next, String(rows[0].username));
  await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${userId}`;
  // Everything else is signed out: a stolen session does not survive a password change.
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND id <> ${keepSessionId}`;
}

export async function deleteAccount(userId: number, password: unknown): Promise<void> {
  const sql = await getSql();
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
  if (!rows.length) return;
  if (typeof password !== "string" || password.length > MAX_PASSWORD || !(await verifyPassword(password, String(rows[0].password_hash))))
    throw new AuthError(403, "invalid_credentials", "The password is wrong.");
  await sql`DELETE FROM users WHERE id = ${userId}`; // sessions go with it (ON DELETE CASCADE)
}
