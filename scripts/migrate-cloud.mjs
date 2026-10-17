import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const username = option("--username")?.normalize("NFKC").trim().toLowerCase();
if (!username || !/^[\p{L}\p{N}_-]{3,40}$/u.test(username))
  throw new Error("Pass --username with the registered account username");
const base = (option("--url") || "https://ohmycv-auth.ccgslb.workers.dev").replace(
  /\/$/,
  ""
);
const bundle = JSON.parse(
  await readFile(
    resolve(option("--file") || "output/migration/resumes-cloud.json"),
    "utf8"
  )
);
if (bundle.format !== "ohmycv-cloud-backup" || bundle.version !== 1)
  throw new Error("Invalid migration backup");
const sql = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const execute = async (statement) => {
  const result = await new Promise((done, reject) => {
    const child = spawn(
      "pnpm",
      [
        "dlx",
        "wrangler@4.151.1",
        "d1",
        "execute",
        "DB",
        "--remote",
        "--command",
        statement,
        "--json"
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
    );
    let output = "",
      error = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (error += data));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? done(output)
        : reject(new Error("D1 migration command failed: " + error + output))
    );
  });
  const payload = result.match(/\[\s*\{[\s\S]*\}\s*\]/)?.[0];
  if (!payload) throw new Error("Cannot parse the D1 command response");
  return JSON.parse(payload);
};
let tokenId;
try {
  const rows = await execute(`SELECT id FROM users WHERE username=${sql(username)};`);
  const user = rows[0]?.results?.[0];
  if (!user)
    throw new Error("The account does not exist. Register it on the login page first.");
  tokenId = randomUUID();
  const token = "cv_api_" + randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  await execute(
    `INSERT INTO api_tokens(id,owner_id,name,token_hash,scope,created_at,expires_at) VALUES(${sql(tokenId)},${sql(user.id)},'Temporary data migration',${sql(hash)},'read-write',${now},${now + 3600000});`
  );
  const request = async (path, body, method = "POST") => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(base + path, {
        method,
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (response.status === 429) {
        await new Promise((done) => setTimeout(done, 61000));
        continue;
      }
      const value = await response.json();
      if (!response.ok)
        throw new Error("Import API failed (" + response.status + "): " + value.error);
      return value;
    }
    throw new Error("Import rate limit exceeded; rerun to continue");
  };
  const imported = new Map();
  let snapshots = 0;
  for (const item of bundle.resumes) {
    const saved = await request("/api/v1/import", {
      sourceId: item.sourceId,
      resume: item.resume,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
    imported.set(item.sourceId, saved.id);
    for (const version of item.history || []) {
      await request(`/api/v1/resumes/${saved.id}/history/import`, {
        sourceId: version.id,
        resume: version.resume,
        createdAt: version.createdAt,
        source: version.source,
        changes: version.changes,
        restoredFrom: version.restoredFrom
      });
      if (++snapshots % 10 === 0)
        console.log(`Imported ${snapshots} historical versions…`);
    }
    if (item.deleted) {
      try {
        const current = await request(`/api/v1/resumes/${saved.id}`, undefined, "GET");
        await request(
          `/api/v1/resumes/${saved.id}`,
          { revision: current.revision },
          "DELETE"
        );
      } catch (error) {
        if (!error.message.includes("(404)")) throw error;
      }
    }
  }
  if (imported.get(bundle.activeSourceId))
    await request("/api/v1/active-resume", { id: imported.get(bundle.activeSourceId) });
  console.log(
    `Migrated ${bundle.resumes.length} resumes and ${snapshots} historical versions to account ${username}.`
  );
} finally {
  if (tokenId)
    await execute(`DELETE FROM api_tokens WHERE id=${sql(tokenId)};`).catch(() => {});
}
