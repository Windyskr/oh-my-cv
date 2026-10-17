import type { Env } from "./types";
import { ApiError, json, bodyJson, numberId } from "./types";
import { authRoute, authenticate, rateLimit, requireWrite } from "./auth";
import { resumeRoute, importResume, getResumeRow, asResume } from "./resumes";
import { tokensRoute } from "./tokens";
import { openapi } from "./openapi";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    try {
      if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
      if (path === "/api/openapi.json" && request.method === "GET")
        return json(openapi(url.origin));
      if (path === "/api/health" && request.method === "GET") {
        await env.DB.prepare("SELECT 1").first();
        return json({ ok: true, storage: "d1" });
      }
      if (path.startsWith("/api/auth/")) return await authRoute(request, env, path);
      const actor = await authenticate(request, env);
      await rateLimit(
        env,
        `${request.method === "GET" ? "read" : "write"}:${actor.user.id}`,
        request.method === "GET" ? 600 : 120
      );
      if (path === "/api/v1/active-resume") {
        if (request.method === "POST") {
          requireWrite(actor);
          const data = await bodyJson(request, 1024);
          const id = numberId(String(data.id));
          await getResumeRow(env, actor, id);
          await env.DB.prepare(
            "INSERT INTO user_settings(user_id,active_resume_id) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET active_resume_id=excluded.active_resume_id"
          )
            .bind(actor.user.id, id)
            .run();
          return json({ ok: true });
        }
        if (request.method === "GET") {
          const selected = await env.DB.prepare(
            "SELECT active_resume_id FROM user_settings WHERE user_id=?"
          )
            .bind(actor.user.id)
            .first<{ active_resume_id: number | null }>();
          const id = selected?.active_resume_id;
          if (!id) throw new ApiError(404, "Open a resume in the editor first");
          return json(asResume(await getResumeRow(env, actor, id)));
        }
        throw new ApiError(405, "Method not allowed");
      }
      if (path.startsWith("/api/v1/tokens"))
        return await tokensRoute(request, env, actor, path);
      if (path === "/api/v1/import" && request.method === "POST")
        return await importResume(request, env, actor);
      if (path.startsWith("/api/v1/resumes"))
        return await resumeRoute(request, env, actor, url);
      throw new ApiError(404, "API route not found");
    } catch (error) {
      if (error instanceof ApiError)
        return json(
          { error: error.message, statusCode: error.status },
          error.status,
          error.status === 429 ? { "Retry-After": "60" } : undefined
        );
      console.error(
        "Cloud API failure",
        error instanceof Error ? error.message : "Unknown failure"
      );
      return json(
        {
          error: "Server request failed; your existing data is preserved",
          statusCode: 500
        },
        500
      );
    }
  },
  async scheduled(_event: unknown, env: Env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now),
      env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(now)
    ]);
  }
};
