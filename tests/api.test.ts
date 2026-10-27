import assert from "node:assert/strict";
import { test } from "node:test";
import * as h from "../src/lib/handlers";
import { getSql } from "../src/lib/db";
import { hashToken } from "../src/lib/auth";

const HOST = "nojuo.test";
let ipCounter = 0;
const nextIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

function post(path: string, body: unknown, extra: Record<string, string> = {}, ip = nextIp()) {
  return new Request(`https://${HOST}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, "x-forwarded-for": ip, ...extra },
    body: JSON.stringify(body),
  });
}
function get(path: string, extra: Record<string, string> = {}) {
  return new Request(`https://${HOST}${path}`, { headers: { host: HOST, ...extra } });
}
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];
const PASSWORD = "correct horse battery";

test("web signup, session cookie, sessions list, logout", async () => {
  const res = await h.webSignup(post("/api/auth/signup", { username: "Ada", password: PASSWORD, displayName: "Ada L." }));
  assert.equal(res.status, 201);
  const setCookie = res.headers.get("set-cookie")!;
  assert.match(setCookie, /^__Host-nj_session=[A-Za-z0-9_-]{40,}; Path=\/; Expires=.*HttpOnly; Secure; SameSite=Lax$/);
  const body = await res.json();
  assert.equal(body.user.username, "Ada");
  assert.equal(body.user.displayName, "Ada L.");
  assert.equal(JSON.stringify(body).includes("password"), false);

  const cookie = cookieOf(res);
  const list = await h.webSessions(get("/api/auth/sessions", { cookie }));
  assert.equal(list.status, 200);
  assert.equal((await list.json()).sessions.length, 1);

  const out = await h.webLogout(post("/api/auth/logout", {}, { cookie }));
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
  assert.equal((await h.webSessions(get("/api/auth/sessions", { cookie }))).status, 401);
});

test("only the hash of a token is stored", async () => {
  const res = await h.deviceSignup(post("/api/v1/signup", { username: "hashcheck", password: PASSWORD, device: "PC" }));
  const { token } = await res.json();
  const sql = await getSql();
  const rows = await sql`SELECT token_hash FROM sessions WHERE token_hash = ${hashToken(token)}`;
  assert.equal(rows.length, 1);
  const leaked = await sql`SELECT 1 FROM sessions WHERE token_hash = ${token}`;
  assert.equal(leaked.length, 0);
  const pw = await sql`SELECT password_hash FROM users WHERE username_lower = 'hashcheck'`;
  assert.match(String(pw[0].password_hash), /^scrypt\$16384\$8\$1\$/);
  assert.equal(String(pw[0].password_hash).includes(PASSWORD), false);
});

test("usernames are unique ignoring case; invalid input is refused", async () => {
  assert.equal((await h.webSignup(post("/api/auth/signup", { username: "Grace", password: PASSWORD }))).status, 201);
  const dup = await h.webSignup(post("/api/auth/signup", { username: "gRACE", password: PASSWORD }));
  assert.equal(dup.status, 409);
  assert.equal((await dup.json()).error, "username_taken");
  for (const [username, password, code] of [
    ["ab", PASSWORD, "invalid_username"],
    ["has space", PASSWORD, "invalid_username"],
    ["x'; DROP TABLE users;--", PASSWORD, "invalid_username"],
    ["admin", PASSWORD, "reserved_username"],
    ["shortpw", "short", "weak_password"],
    ["samepassword", "samepassword", "weak_password"],
    ["longpw", "x".repeat(201), "invalid_password"],
  ] as const) {
    const r = await h.webSignup(post("/api/auth/signup", { username, password }));
    assert.equal(r.status, 400, `${username}`);
    assert.equal((await r.json()).error, code, `${username}`);
  }
  const sql = await getSql();
  assert.ok(Number((await sql`SELECT count(*)::int AS n FROM users`)[0].n) >= 2); // the table is still there
});

test("login: wrong password and unknown user look the same", async () => {
  await h.webSignup(post("/api/auth/signup", { username: "login1", password: PASSWORD }));
  const wrong = await h.webLogin(post("/api/auth/login", { username: "login1", password: "not the password" }));
  const none = await h.webLogin(post("/api/auth/login", { username: "nobody-here", password: "not the password" }));
  assert.equal(wrong.status, 401);
  assert.equal(none.status, 401);
  assert.deepEqual(await wrong.json(), await none.json());
  const ok = await h.webLogin(post("/api/auth/login", { username: "LOGIN1", password: PASSWORD }));
  assert.equal(ok.status, 200);
});

test("cross-site, non-JSON and oversized requests are refused", async () => {
  const cross = await h.webLogin(post("/api/auth/login", { username: "a", password: "b" }, { origin: "https://evil.example" }));
  assert.equal(cross.status, 403);
  const same = await h.webLogin(post("/api/auth/login", { username: "nobody", password: "b" }, { origin: `https://${HOST}` }));
  assert.equal(same.status, 401);
  const form = new Request(`https://${HOST}/api/auth/login`, { method: "POST", headers: { host: HOST, "content-type": "text/plain" }, body: "x" });
  assert.equal((await h.webLogin(form)).status, 415);
  const big = await h.webLogin(post("/api/auth/login", { username: "a".repeat(9000), password: "b" }));
  assert.equal(big.status, 413);
  const bad = new Request(`https://${HOST}/api/auth/login`, { method: "POST", headers: { host: HOST, "content-type": "application/json" }, body: "{" });
  assert.equal((await h.webLogin(bad)).status, 400);
});

test("rate limits: logins per user and signups per address", async () => {
  await h.webSignup(post("/api/auth/signup", { username: "limited", password: PASSWORD }));
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await h.webLogin(post("/api/auth/login", { username: "limited", password: "wrong wrong wrong" }))).status;
  assert.equal(last, 429);
  // The right password is refused while the limit holds: an attacker cannot just keep guessing.
  assert.equal((await h.webLogin(post("/api/auth/login", { username: "limited", password: PASSWORD }))).status, 429);

  const ip = "203.0.113.9";
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await h.webSignup(post("/api/auth/signup", { username: `bulk${i}`, password: PASSWORD }, {}, ip))).status);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429, 429]);
});

test("device flow for HorizonOS: signup, token, me, logout", async () => {
  const signup = await h.deviceSignup(post("/api/v1/signup", { username: "horizon1", password: PASSWORD, device: "Horizon PC" }));
  assert.equal(signup.status, 201);
  const first = await signup.json();
  assert.ok(first.token.length >= 40);

  const login = await h.deviceToken(post("/api/v1/token", { username: "horizon1", password: PASSWORD, device: "Laptop" }));
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.notEqual(token, first.token);

  const me = await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${token}` }));
  assert.equal(me.status, 200);
  const info = await me.json();
  assert.equal(info.user.username, "horizon1");
  assert.equal(info.session.label, "Laptop");
  assert.equal(info.session.kind, "device");

  assert.equal((await h.deviceMe(get("/api/v1/me"))).status, 401);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: "Bearer nonsense-token-nonsense-token" }))).status, 401);

  assert.equal((await h.deviceLogout(post("/api/v1/logout", {}, { authorization: `Bearer ${token}` }))).status, 200);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${token}` }))).status, 401);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${first.token}` }))).status, 200); // other device unaffected
});

test("a device token is not a web session and the reverse", async () => {
  const dev = await (await h.deviceSignup(post("/api/v1/signup", { username: "kinds1", password: PASSWORD }))).json();
  assert.equal((await h.webSessions(get("/api/auth/sessions", { cookie: `__Host-nj_session=${dev.token}` }))).status, 401);
  const web = await h.webLogin(post("/api/auth/login", { username: "kinds1", password: PASSWORD }));
  const token = cookieOf(web).split("=")[1];
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${token}` }))).status, 401);
});

test("password change signs out the other sessions", async () => {
  const a = await h.webSignup(post("/api/auth/signup", { username: "pwchange", password: PASSWORD }));
  const keep = cookieOf(a);
  const b = await h.webLogin(post("/api/auth/login", { username: "pwchange", password: PASSWORD }));
  const other = cookieOf(b);
  const dev = await (await h.deviceToken(post("/api/v1/token", { username: "pwchange", password: PASSWORD }))).json();

  const wrong = await h.webPassword(post("/api/auth/password", { current: "nope nope nope", next: "another long password" }, { cookie: keep }));
  assert.equal(wrong.status, 403);
  const weak = await h.webPassword(post("/api/auth/password", { current: PASSWORD, next: "short" }, { cookie: keep }));
  assert.equal(weak.status, 400);
  const ok = await h.webPassword(post("/api/auth/password", { current: PASSWORD, next: "another long password" }, { cookie: keep }));
  assert.equal(ok.status, 200);

  assert.equal((await h.webSessions(get("/api/auth/sessions", { cookie: keep }))).status, 200);
  assert.equal((await h.webSessions(get("/api/auth/sessions", { cookie: other }))).status, 401);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${dev.token}` }))).status, 401);
  assert.equal((await h.webLogin(post("/api/auth/login", { username: "pwchange", password: PASSWORD }))).status, 401);
  assert.equal((await h.webLogin(post("/api/auth/login", { username: "pwchange", password: "another long password" }))).status, 200);
});

test("revoking a device from the website; sessions of other users are out of reach", async () => {
  const me = cookieOf(await h.webSignup(post("/api/auth/signup", { username: "owner1", password: PASSWORD })));
  const dev = await (await h.deviceToken(post("/api/v1/token", { username: "owner1", password: PASSWORD, device: "Phone" }))).json();
  const list = await (await h.webSessions(get("/api/auth/sessions", { cookie: me }))).json();
  const deviceSession = list.sessions.find((s: { kind: string }) => s.kind === "device");
  assert.ok(deviceSession);

  const other = cookieOf(await h.webSignup(post("/api/auth/signup", { username: "owner2", password: PASSWORD })));
  const stolen = await h.webRevoke(post("/api/auth/revoke", { id: deviceSession.id }, { cookie: other }));
  assert.equal((await stolen.json()).ok, false);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${dev.token}` }))).status, 200);

  const mine = await h.webRevoke(post("/api/auth/revoke", { id: deviceSession.id }, { cookie: me }));
  assert.equal((await mine.json()).ok, true);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${dev.token}` }))).status, 401);
});

test("deleting the account removes it and its sessions", async () => {
  const cookie = cookieOf(await h.webSignup(post("/api/auth/signup", { username: "goner1", password: PASSWORD })));
  const dev = await (await h.deviceToken(post("/api/v1/token", { username: "goner1", password: PASSWORD }))).json();
  assert.equal((await h.webDeleteAccount(post("/api/auth/delete", { password: "wrong wrong wrong" }, { cookie }))).status, 403);
  assert.equal((await h.webDeleteAccount(post("/api/auth/delete", { password: PASSWORD }, { cookie }))).status, 200);
  assert.equal((await h.deviceMe(get("/api/v1/me", { authorization: `Bearer ${dev.token}` }))).status, 401);
  assert.equal((await h.webLogin(post("/api/auth/login", { username: "goner1", password: PASSWORD }))).status, 401);
  // The name can be registered again.
  assert.equal((await h.webSignup(post("/api/auth/signup", { username: "goner1", password: PASSWORD }))).status, 201);
});
