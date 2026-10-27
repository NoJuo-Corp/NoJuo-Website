/*
 * The API, as plain Request -> Response functions (the route files only re-export them), so the same
 * code runs under Next.js and in the tests.
 *
 *   Website (cookie session, same-origin only):  /api/auth/*
 *   Devices such as HorizonOS (bearer token):    /api/v1/*
 */
import {
  AuthError, authenticate, changePassword, createSession, createUser, deleteAccount, listSessions, revokeSessionById, revokeToken,
  validateLabel, verifyLogin,
} from "./auth";
import { bearer, clearCookie, clientIp, cookieFrom, errorResponse, json, limit, readJson, requireSameOrigin, sessionCookie } from "./http";

async function guardSignup(req: Request) {
  await limit(`signup:${clientIp(req)}`, 5, 3600);
}

async function guardLogin(req: Request, username: unknown) {
  await limit(`login-ip:${clientIp(req)}`, 30, 900);
  if (typeof username === "string") await limit(`login-user:${username.toLowerCase().slice(0, 64)}`, 10, 900);
}

function webLabel(req: Request): string {
  return validateLabel((req.headers.get("user-agent") ?? "").slice(0, 60), "Browser");
}

/* ---- Website ------------------------------------------------------------------------------------- */

export async function webSignup(req: Request): Promise<Response> {
  try {
    requireSameOrigin(req);
    const body = await readJson(req);
    await guardSignup(req);
    const user = await createUser(body.username, body.password, body.displayName);
    const { token, expiresAt } = await createSession(user.id, "web", webLabel(req));
    return json({ user }, { status: 201, cookies: [sessionCookie(token, expiresAt)] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function webLogin(req: Request): Promise<Response> {
  try {
    requireSameOrigin(req);
    const body = await readJson(req);
    await guardLogin(req, body.username);
    const user = await verifyLogin(body.username, body.password);
    const { token, expiresAt } = await createSession(user.id, "web", webLabel(req));
    return json({ user }, { cookies: [sessionCookie(token, expiresAt)] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function webLogout(req: Request): Promise<Response> {
  try {
    requireSameOrigin(req);
    const token = cookieFrom(req);
    if (token) await revokeToken(token);
    return json({ ok: true }, { cookies: [clearCookie()] });
  } catch (e) {
    return errorResponse(e);
  }
}

async function webAuth(req: Request) {
  requireSameOrigin(req);
  const auth = await authenticate(cookieFrom(req), "web");
  if (!auth) throw new AuthError(401, "not_signed_in", "Sign in first.");
  return auth;
}

export async function webSessions(req: Request): Promise<Response> {
  try {
    const auth = await webAuth(req);
    return json({ sessions: await listSessions(auth.user.id), current: auth.session.id });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function webRevoke(req: Request): Promise<Response> {
  try {
    const auth = await webAuth(req);
    const body = await readJson(req);
    const id = Number(body.id);
    if (!Number.isSafeInteger(id)) throw new AuthError(400, "invalid_id", "id must be a number.");
    const removed = await revokeSessionById(auth.user.id, id);
    const cookies = removed && id === auth.session.id ? [clearCookie()] : [];
    return json({ ok: removed }, { cookies });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function webPassword(req: Request): Promise<Response> {
  try {
    const auth = await webAuth(req);
    const body = await readJson(req);
    await limit(`password:${auth.user.id}`, 10, 900);
    await changePassword(auth.user.id, body.current, body.next, auth.session.id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function webDeleteAccount(req: Request): Promise<Response> {
  try {
    const auth = await webAuth(req);
    const body = await readJson(req);
    await limit(`password:${auth.user.id}`, 10, 900);
    await deleteAccount(auth.user.id, body.password);
    return json({ ok: true }, { cookies: [clearCookie()] });
  } catch (e) {
    return errorResponse(e);
  }
}

/* ---- Devices (HorizonOS) --------------------------------------------------------------------------- */

export async function deviceSignup(req: Request): Promise<Response> {
  try {
    const body = await readJson(req);
    await guardSignup(req);
    const user = await createUser(body.username, body.password, body.displayName);
    const { token, expiresAt } = await createSession(user.id, "device", validateLabel(body.device, "Device"));
    return json({ user, token, expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function deviceToken(req: Request): Promise<Response> {
  try {
    const body = await readJson(req);
    await guardLogin(req, body.username);
    const user = await verifyLogin(body.username, body.password);
    const { token, expiresAt } = await createSession(user.id, "device", validateLabel(body.device, "Device"));
    return json({ user, token, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function deviceMe(req: Request): Promise<Response> {
  try {
    const auth = await authenticate(bearer(req), "device");
    if (!auth) throw new AuthError(401, "invalid_token", "The token is missing, expired or revoked.");
    return json({ user: auth.user, session: auth.session });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function deviceLogout(req: Request): Promise<Response> {
  try {
    const token = bearer(req);
    if (!token || !(await authenticate(token, "device"))) throw new AuthError(401, "invalid_token", "The token is missing, expired or revoked.");
    await revokeToken(token);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
