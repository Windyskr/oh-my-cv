import { ApiError, json, bodyJson } from "./types";
import type { Env, Actor } from "./types";
import { requireSession, newSecret, hashSecret } from "./auth";
import { getResumeRow } from "./resumes";
export const tokensRoute = async (
  request: Request,
  env: Env,
  actor: Actor,
  path: string
) => {
  requireSession(actor);
  if (path === "/api/v1/tokens" && request.method === "GET")
    return json(
      (
        await env.DB.prepare(
          "SELECT id,name,scope,resume_id,created_at,expires_at,last_used_at,revoked_at FROM api_tokens WHERE owner_id=? ORDER BY created_at DESC"
        )
          .bind(actor.user.id)
          .all()
      ).results
    );
  if (path === "/api/v1/tokens" && request.method === "POST") {
    const data = await bodyJson(request, 4096);
    if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 80)
      throw new ApiError(400, "Token name must contain 1–80 characters");
    if (data.scope !== "read" && data.scope !== "read-write")
      throw new ApiError(400, "Invalid token scope");
    const days = Number(data.days || 30);
    if (!Number.isInteger(days) || days < 1 || days > 365)
      throw new ApiError(400, "Token expiry must be 1–365 days");
    const resumeId =
      data.resumeId === null || data.resumeId === undefined
        ? null
        : Number(data.resumeId);
    if (resumeId !== null) {
      if (!Number.isSafeInteger(resumeId) || resumeId < 1)
        throw new ApiError(400, "Invalid resume ID");
      await getResumeRow(env, actor, resumeId);
    }
    const id = crypto.randomUUID();
    const secret = "cv_api_" + newSecret();
    const now = Date.now();
    const expires = now + days * 86400000;
    await env.DB.prepare(
      "INSERT INTO api_tokens(id,owner_id,name,token_hash,scope,resume_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)"
    )
      .bind(
        id,
        actor.user.id,
        data.name.trim(),
        hashSecret(secret),
        data.scope,
        resumeId,
        now,
        expires
      )
      .run();
    return json(
      {
        id,
        token: secret,
        name: data.name.trim(),
        scope: data.scope,
        resumeId,
        expiresAt: expires
      },
      201
    );
  }
  const match = /^\/api\/v1\/tokens\/([a-f\d-]{36})$/.exec(path);
  if (match && request.method === "DELETE") {
    await env.DB.prepare("UPDATE api_tokens SET revoked_at=? WHERE id=? AND owner_id=?")
      .bind(Date.now(), match[1], actor.user.id)
      .run();
    return json({ ok: true });
  }
  throw new ApiError(404, "API route not found");
};
