import { Buffer } from "node:buffer";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { ApiError, json, bodyJson } from "./types";
import type { Env, Actor, User } from "./types";

const cookieName = "ohmycv_session";
export const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newSecret = () => randomBytes(32).toString("base64url");
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key))
    )
  );
const passwordHash = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
};
const verify = async (password: string, encoded: string) => {
  const [, salt, key] = encoded.split("$");
  const actual = await derive(password, salt || "0".repeat(32));
  const expected = Buffer.from(key || "0".repeat(128), "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
};
const validatePassword = (password: unknown): string => {
  if (typeof password !== "string" || password.length < 12 || password.length > 128)
    throw new ApiError(400, "Password must contain 12–128 characters");
  return password;
};
const username = (value: unknown) => {
  if (typeof value !== "string") throw new ApiError(400, "Username is required");
  const name = value.normalize("NFKC").trim();
  if (!/^[\p{L}\p{N}_-]{3,40}$/u.test(name))
    throw new ApiError(
      400,
      "Username must contain 3–40 letters, numbers, underscores or hyphens"
    );
  return { normalized: name.toLowerCase(), display: name };
};
export const rateLimit = async (
  env: Env,
  key: string,
  limit: number,
  windowMs = 60000
) => {
  const window = Math.floor(Date.now() / windowMs);
  const expires = (window + 1) * windowMs;
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count"
  )
    .bind(`${key}:${window}`, expires)
    .first<{ count: number }>();
  if (!row || row.count > limit)
    throw new ApiError(429, "Too many requests; please retry later");
};
export const assertOrigin = (request: Request, required = false) => {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || (required && !origin))
    throw new ApiError(403, "Invalid request origin");
};
const sessionCookie = (request: Request, value: string, seconds = 604800) =>
  `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
const cookieToken = (request: Request) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
export const authenticate = async (request: Request, env: Env): Promise<Actor> => {
  const bearer = request.headers.get("authorization");
  if (bearer) {
    if (!/^Bearer cv_api_[A-Za-z0-9_-]{43}$/.test(bearer))
      throw new ApiError(401, "Invalid API token");
    const row = await env.DB.prepare(
      "SELECT users.id,users.username,users.display_name,t.id AS token_id,t.scope,t.resume_id FROM api_tokens t JOIN users ON users.id=t.owner_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?"
    )
      .bind(hashSecret(bearer.slice(7)), Date.now())
      .first<
        User & {
          token_id: string;
          scope: "read" | "read-write";
          resume_id: number | null;
        }
      >();
    if (!row) throw new ApiError(401, "Invalid or expired API token");
    await env.DB.prepare("UPDATE api_tokens SET last_used_at=? WHERE id=?")
      .bind(Date.now(), row.token_id)
      .run();
    return { user: row, kind: "token", scope: row.scope, resumeId: row.resume_id };
  }
  const secret = cookieToken(request);
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret))
    throw new ApiError(401, "Please sign in");
  const tokenHash = hashSecret(secret);
  const user = await env.DB.prepare(
    "SELECT u.id,u.username,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?"
  )
    .bind(tokenHash, Date.now())
    .first<User>();
  if (!user) throw new ApiError(401, "Session expired; please sign in again");
  if (!["GET", "HEAD"].includes(request.method)) assertOrigin(request, true);
  return {
    user,
    kind: "session",
    scope: "read-write",
    resumeId: null,
    sessionHash: tokenHash
  };
};
export const requireWrite = (actor: Actor) => {
  if (actor.scope !== "read-write")
    throw new ApiError(403, "This API token is read-only");
};
export const requireSession = (actor: Actor) => {
  if (actor.kind !== "session")
    throw new ApiError(403, "Use the website session to manage your account");
};
export const allowResume = (actor: Actor, id: number) => {
  if (actor.resumeId !== null && actor.resumeId !== id)
    throw new ApiError(404, "Resume not found");
};
const issueSession = async (request: Request, env: Env, user: User) => {
  const secret = newSecret();
  await env.DB.prepare(
    "INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)"
  )
    .bind(hashSecret(secret), user.id, Date.now() + 604800000, Date.now())
    .run();
  return json({ user }, 200, { "Set-Cookie": sessionCookie(request, secret) });
};
export const authRoute = async (request: Request, env: Env, path: string) => {
  if (
    ["/api/auth/login", "/api/auth/register"].includes(path) &&
    request.method === "POST"
  ) {
    assertOrigin(request);
    const data = await bodyJson(request, 4096);
    const name = username(data.username);
    const password = validatePassword(data.password);
    const ip = hashSecret(request.headers.get("cf-connecting-ip") || "local");
    await rateLimit(
      env,
      `${path}:${ip}`,
      path.endsWith("register") ? 5 : 10,
      path.endsWith("register") ? 3600000 : 60000
    );
    await rateLimit(env, `login-user:${name.normalized}`, 20);
    if (path.endsWith("register")) {
      const existing = await env.DB.prepare("SELECT id FROM users WHERE username=?")
        .bind(name.normalized)
        .first<User>();
      if (existing) throw new ApiError(409, "Username is unavailable");
      const user = {
        id: crypto.randomUUID(),
        username: name.normalized,
        display_name: name.display
      };
      const hashed = await passwordHash(password);
      try {
        await env.DB.prepare(
          "INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,?,?)"
        )
          .bind(user.id, user.username, user.display_name, hashed, Date.now())
          .run();
      } catch (error) {
        if (String(error).includes("UNIQUE"))
          throw new ApiError(409, "Username is unavailable");
        throw error;
      }
      return issueSession(request, env, user);
    }
    const stored = await env.DB.prepare(
      "SELECT id,username,display_name,password_hash FROM users WHERE username=?"
    )
      .bind(name.normalized)
      .first<User & { password_hash: string }>();
    const valid = await verify(
      password,
      stored?.password_hash || "scrypt-v1$" + "0".repeat(32) + "$" + "0".repeat(128)
    );
    if (!stored || !valid) throw new ApiError(401, "Invalid username or password");
    return issueSession(request, env, {
      id: stored.id,
      username: stored.username,
      display_name: stored.display_name
    });
  }
  const actor = await authenticate(request, env);
  if (path === "/api/auth/me" && request.method === "GET")
    return json({ user: actor.user });
  requireSession(actor);
  if (path === "/api/auth/logout" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(actor.sessionHash)
      .run();
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, "", 0) });
  }
  if (path === "/api/auth/password" && request.method === "PUT") {
    const data = await bodyJson(request, 4096);
    const next = validatePassword(data.newPassword);
    if (typeof data.password !== "string")
      throw new ApiError(400, "Current password is required");
    const user = await env.DB.prepare("SELECT password_hash FROM users WHERE id=?")
      .bind(actor.user.id)
      .first<{ password_hash: string }>();
    if (!user || !(await verify(data.password, user.password_hash)))
      throw new ApiError(401, "Current password is incorrect");
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(
        await passwordHash(next),
        actor.user.id
      ),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(actor.user.id)
    ]);
    return issueSession(request, env, actor.user);
  }
  throw new ApiError(404, "API route not found");
};
