import { parseResume } from "../site/src/utils/parseResume";
import type { DbResumeEmpty } from "../site/src/utils/storage/db";
import { ApiError, json, bodyJson, numberId } from "./types";
import type { Env, Actor, ResumeRow } from "./types";
import { allowResume, requireWrite, hashSecret } from "./auth";

const document = (value: unknown): DbResumeEmpty => {
  let resume: DbResumeEmpty;
  try {
    resume = parseResume(value);
  } catch {
    throw new ApiError(400, "Invalid resume content or layout settings");
  }
  if (!resume.name.trim() || resume.name.length > 200)
    throw new ApiError(400, "Resume name must contain 1–200 characters");
  if (new TextEncoder().encode(JSON.stringify(resume)).length > 1500000)
    throw new ApiError(413, "Resume content exceeds 1.5 MB");
  return resume;
};
export const asResume = (row: ResumeRow) => ({
  ...JSON.parse(row.document),
  id: row.id,
  revision: String(row.revision),
  ...(row.source_id ? { sourceId: row.source_id } : {}),
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
  ...(row.deleted_at ? { deleted_at: String(row.deleted_at) } : {})
});
const metadata = (row: ResumeRow) => ({
  id: row.id,
  name: row.name,
  revision: String(row.revision),
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
  ...(row.deleted_at ? { deleted_at: String(row.deleted_at) } : {})
});
export const getResumeRow = async (
  env: Env,
  actor: Actor,
  id: number,
  deleted = false
) => {
  allowResume(actor, id);
  const row = await env.DB.prepare(
    `SELECT * FROM resumes WHERE id=? AND owner_id=?${deleted ? "" : " AND deleted_at IS NULL"}`
  )
    .bind(id, actor.user.id)
    .first<ResumeRow>();
  if (!row) throw new ApiError(404, "Resume not found");
  return row;
};
const revision = (request: Request, data: Record<string, unknown>) => {
  const raw = request.headers.get("if-match") || String(data.revision || "");
  const parsed = /^(?:"([1-9]\d*)"|([1-9]\d*))$/.exec(raw);
  if (!parsed)
    throw new ApiError(
      428,
      "Provide the current revision in If-Match or the JSON revision field"
    );
  const value = Number(parsed[1] || parsed[2]);
  if (!Number.isSafeInteger(value)) throw new ApiError(400, "Invalid revision");
  return value;
};
const historyObject = (
  row: {
    id: string;
    document?: string;
    name?: string;
    revision: number;
    source: string;
    created_at: number;
    changes?: string;
    restored_from?: string;
    original_id?: string;
  },
  full = false
) => ({
  id: row.id,
  revision: String(row.revision),
  name: row.name || JSON.parse(row.document!).name,
  createdAt: new Date(row.created_at).toISOString(),
  source: row.source,
  changes: row.changes ? JSON.parse(row.changes) : ["name", "markdown", "css", "styles"],
  ...(row.restored_from ? { restoredFrom: row.restored_from } : {}),
  ...(row.original_id ? { originalId: row.original_id } : {}),
  ...(full ? { resume: JSON.parse(row.document!) } : {})
});
export const createResume = async (
  env: Env,
  actor: Actor,
  value: unknown,
  dates?: { created: number; updated: number }
) => {
  requireWrite(actor);
  if (actor.resumeId !== null)
    throw new ApiError(403, "This token cannot create resumes");
  const resume = document(value);
  const now = Date.now();
  const result = await env.DB.batch<ResumeRow>([
    env.DB.prepare(
      "INSERT INTO resumes(owner_id,name,document,created_at,updated_at) VALUES(?,?,?,?,?) RETURNING *"
    ).bind(
      actor.user.id,
      resume.name,
      JSON.stringify(resume),
      dates?.created || now,
      dates?.updated || now
    ),
    env.DB.prepare(
      "INSERT INTO resume_history(id,resume_id,owner_id,document,revision,source,created_at) SELECT ?,id,owner_id,document,revision,'initial',updated_at FROM resumes WHERE id=last_insert_rowid()"
    ).bind(crypto.randomUUID())
  ]);
  return result[0].results[0];
};
const updateResume = async (
  env: Env,
  actor: Actor,
  id: number,
  expected: number,
  value: unknown,
  source = "save",
  deleted = false,
  restoredFrom: string | null = null
) => {
  requireWrite(actor);
  allowResume(actor, id);
  const resume = document(value);
  const now = Date.now();
  const body = JSON.stringify(resume);
  const current = await getResumeRow(env, actor, id, true);
  if (current.revision !== expected)
    throw new ApiError(409, "Resume changed; read the latest revision before updating");
  const previous = JSON.parse(current.document);
  const changes = JSON.stringify(
    ["name", "markdown", "css", "styles"].filter(
      (field) =>
        JSON.stringify(previous[field]) !==
        JSON.stringify((resume as unknown as Record<string, unknown>)[field])
    )
  );
  const result = await env.DB.batch<ResumeRow>([
    env.DB.prepare(
      "UPDATE resumes SET name=?,document=?,revision=revision+1,updated_at=?,deleted_at=? WHERE id=? AND owner_id=? AND revision=? RETURNING *"
    ).bind(resume.name, body, now, deleted ? now : null, id, actor.user.id, expected),
    env.DB.prepare(
      "INSERT OR IGNORE INTO resume_history(id,resume_id,owner_id,document,revision,source,created_at,changes,restored_from) SELECT ?,id,owner_id,document,revision,?,updated_at,?,? FROM resumes WHERE id=? AND owner_id=? AND revision=?"
    ).bind(
      crypto.randomUUID(),
      source,
      changes,
      restoredFrom,
      id,
      actor.user.id,
      expected + 1
    )
  ]);
  if (result[0].meta.changes !== 1)
    throw new ApiError(409, "Resume changed; read the latest revision before updating");
  return result[0].results[0];
};

export const resumeRoute = async (request: Request, env: Env, actor: Actor, url: URL) => {
  const path = url.pathname.replace(/\/$/, "");
  if (path === "/api/v1/resumes") {
    if (request.method === "POST")
      return json(asResume(await createResume(env, actor, await bodyJson(request))), 201);
    if (request.method !== "GET") throw new ApiError(405, "Method not allowed");
    const deleted = url.searchParams.get("deleted") === "true";
    const before = Number(url.searchParams.get("before") || Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(before) || before < 1)
      throw new ApiError(400, "Invalid cursor");
    const rows = await env.DB.prepare(
      `SELECT id,name,revision,created_at,updated_at,deleted_at FROM resumes WHERE owner_id=? AND deleted_at IS ${deleted ? "NOT " : ""}NULL AND id<? ${actor.resumeId !== null ? "AND id=?" : ""} ORDER BY id DESC LIMIT 101`
    )
      .bind(actor.user.id, before, ...(actor.resumeId !== null ? [actor.resumeId] : []))
      .all<ResumeRow>();
    const selected = rows.results.slice(0, 100);
    return json({
      resumes: selected.map(metadata),
      nextCursor: rows.results.length > 100 ? selected.at(-1)!.id : null
    });
  }
  const match = /^\/api\/v1\/resumes\/([^/]+)(.*)$/.exec(path);
  if (!match) throw new ApiError(404, "API route not found");
  const id = numberId(match[1]);
  const suffix = match[2];
  const row = await getResumeRow(
    env,
    actor,
    id,
    suffix.startsWith("/history") || suffix === "/undelete"
  );
  if (!suffix) {
    if (request.method === "GET") {
      if (request.headers.get("if-none-match") === `"${row.revision}"`)
        return new Response(null, {
          status: 304,
          headers: { ETag: `"${row.revision}"`, "Cache-Control": "no-store" }
        });
      return json(asResume(row), 200, { ETag: `"${row.revision}"` });
    }
    if (request.method === "DELETE") {
      const data = request.headers.get("content-type")?.includes("application/json")
        ? await bodyJson(request)
        : {};
      const next = await updateResume(
        env,
        actor,
        id,
        revision(request, data),
        JSON.parse(row.document),
        "save",
        true
      );
      return json(asResume(next));
    }
    if (request.method === "PATCH" || request.method === "PUT") {
      const data = await bodyJson(request);
      const current = JSON.parse(row.document);
      const value = {
        ...current,
        ...data,
        styles:
          data.styles && typeof data.styles === "object"
            ? { ...current.styles, ...(data.styles as object) }
            : data.styles === null
              ? null
              : current.styles
      };
      const next = await updateResume(
        env,
        actor,
        id,
        revision(request, data),
        value,
        actor.kind === "token" ? "external" : "save"
      );
      return json(asResume(next), 200, { ETag: `"${next.revision}"` });
    }
  }
  if (suffix === "/undelete" && request.method === "POST") {
    const data = await bodyJson(request);
    return json(
      asResume(
        await updateResume(
          env,
          actor,
          id,
          revision(request, data),
          JSON.parse(row.document),
          "restore"
        )
      )
    );
  }
  if (suffix === "/history" && request.method === "GET") {
    const before = url.searchParams.get("before");
    let ceiling = Number.MAX_SAFE_INTEGER;
    if (before) {
      const entry = await env.DB.prepare(
        "SELECT revision FROM resume_history WHERE id=? AND resume_id=? AND owner_id=?"
      )
        .bind(before, id, actor.user.id)
        .first<{ revision: number }>();
      if (!entry) throw new ApiError(404, "History cursor not found");
      ceiling = entry.revision;
    }
    const result = await env.DB.prepare(
      "SELECT id,revision,source,created_at,json_extract(document,'$.name') AS name,changes,restored_from,original_id FROM resume_history WHERE resume_id=? AND owner_id=? AND revision<? ORDER BY revision DESC LIMIT 51"
    )
      .bind(id, actor.user.id, ceiling)
      .all<{
        id: string;
        name: string;
        revision: number;
        source: string;
        created_at: number;
      }>();
    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM resume_history WHERE resume_id=? AND owner_id=?"
    )
      .bind(id, actor.user.id)
      .first<{ total: number }>();
    const selected = result.results.slice(0, 50);
    return json({
      versions: selected.map((item) => historyObject(item)),
      total: total?.total || 0,
      nextBefore: result.results.length > 50 ? selected.at(-1)!.id : null,
      currentRevision: String(row.revision)
    });
  }
  if (suffix === "/history/import" && request.method === "POST") {
    requireWrite(actor);
    const data = await bodyJson(request);
    if (typeof data.sourceId !== "string" || data.sourceId.length > 200)
      throw new ApiError(400, "sourceId is required");
    const resume = document(data.resume);
    const source =
      typeof data.source === "string" &&
      ["initial", "save", "external", "restore"].includes(data.source)
        ? data.source
        : "external";
    const fields = ["name", "markdown", "css", "styles"];
    if (
      data.changes !== undefined &&
      (!Array.isArray(data.changes) ||
        !data.changes.every((field) => fields.includes(field as string)))
    )
      throw new ApiError(400, "Invalid history changes");
    const changes = JSON.stringify(data.changes || fields);
    const restoredFrom =
      typeof data.restoredFrom === "string" && data.restoredFrom.length <= 200
        ? data.restoredFrom
        : null;
    const key = hashSecret(`${id}:${data.sourceId}`);
    const receipt = await env.DB.prepare(
      "SELECT history_id FROM history_receipts WHERE owner_id=? AND source_key=?"
    )
      .bind(actor.user.id, key)
      .first<{ history_id: string }>();
    if (receipt) {
      await env.DB.prepare(
        "UPDATE resume_history SET source=?,changes=?,restored_from=?,original_id=? WHERE id=? AND owner_id=? AND resume_id=?"
      )
        .bind(
          source,
          changes,
          restoredFrom,
          data.sourceId,
          receipt.history_id,
          actor.user.id,
          id
        )
        .run();
      return json({ id: receipt.history_id });
    }
    const date = typeof data.createdAt === "string" ? Date.parse(data.createdAt) : NaN;
    if (!Number.isFinite(date)) throw new ApiError(400, "Invalid history date");
    const historyId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO resume_history(id,resume_id,owner_id,document,revision,source,created_at,changes,restored_from,original_id) SELECT ?,?,?,?,MIN(COALESCE(MIN(revision),0),0)-1,?,?,?,?,? FROM resume_history WHERE resume_id=? AND owner_id=?"
      ).bind(
        historyId,
        id,
        actor.user.id,
        JSON.stringify(resume),
        source,
        date,
        changes,
        restoredFrom,
        data.sourceId,
        id,
        actor.user.id
      ),
      env.DB.prepare(
        "INSERT INTO history_receipts(owner_id,source_key,history_id) VALUES(?,?,?)"
      ).bind(actor.user.id, key, historyId)
    ]);
    return json({ id: historyId }, 201);
  }
  if (suffix === "/history/restore" && request.method === "POST") {
    const data = await bodyJson(request);
    const entry = await env.DB.prepare(
      "SELECT document FROM resume_history WHERE id=? AND resume_id=? AND owner_id=?"
    )
      .bind(data.id, id, actor.user.id)
      .first<{ document: string }>();
    if (!entry) throw new ApiError(404, "History version not found");
    return json(
      asResume(
        await updateResume(
          env,
          actor,
          id,
          revision(request, data),
          JSON.parse(entry.document),
          "restore",
          false,
          String(data.id)
        )
      )
    );
  }
  const historyMatch = /^\/history\/([a-f\d-]{36})$/.exec(suffix);
  if (historyMatch && request.method === "GET") {
    const entry = await env.DB.prepare(
      "SELECT * FROM resume_history WHERE id=? AND resume_id=? AND owner_id=?"
    )
      .bind(historyMatch[1], id, actor.user.id)
      .first<{
        id: string;
        document: string;
        revision: number;
        source: string;
        created_at: number;
      }>();
    if (!entry) throw new ApiError(404, "History version not found");
    return json(historyObject(entry, true));
  }
  throw new ApiError(405, "Method not allowed");
};

export const importResume = async (request: Request, env: Env, actor: Actor) => {
  requireWrite(actor);
  if (actor.resumeId !== null)
    throw new ApiError(403, "This token cannot import new resumes");
  const data = await bodyJson(request);
  const resume = document(data.resume);
  const source = typeof data.sourceId === "string" ? data.sourceId : "manual";
  const timestamp = (value: unknown, fallback: number) => {
    const parsed = Number(value) || Date.parse(String(value || ""));
    return Number.isFinite(parsed) && parsed > 0 && parsed < Date.now() + 86400000
      ? parsed
      : fallback;
  };
  const original = data.resume as Record<string, unknown>;
  const dates = {
    created: timestamp(data.createdAt || original.created_at, Date.now()),
    updated: timestamp(data.updatedAt || original.updated_at, Date.now())
  };
  const key = hashSecret(`${source}:${JSON.stringify(resume)}`);
  const receipt = await env.DB.prepare(
    "SELECT resume_id FROM import_receipts WHERE owner_id=? AND source_key=?"
  )
    .bind(actor.user.id, key)
    .first<{ resume_id: number }>();
  if (receipt) {
    await env.DB.prepare("UPDATE resumes SET source_id=? WHERE id=? AND owner_id=?")
      .bind(source, receipt.resume_id, actor.user.id)
      .run();
    return json({ id: receipt.resume_id, imported: false });
  }
  const saved = await createResume(env, actor, resume, dates);
  await env.DB.prepare("UPDATE resumes SET source_id=? WHERE id=? AND owner_id=?")
    .bind(source, saved.id, actor.user.id)
    .run();
  await env.DB.prepare(
    "INSERT INTO import_receipts(owner_id,source_key,resume_id) VALUES(?,?,?)"
  )
    .bind(actor.user.id, key, saved.id)
    .run();
  return json({ id: saved.id, imported: true }, 201);
};
