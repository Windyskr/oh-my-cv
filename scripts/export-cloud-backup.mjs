import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)), "resumes");
const output = resolve(process.argv[2] || "output/migration/resumes-cloud.json");
const records = [];
const readDirectory = async (directory, sourceId, deleted = false) => {
  let json;
  try {
    json = JSON.parse(await readFile(resolve(directory, "resume.ohmycv.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const saved = Object.values(json.data)[0];
  const resume = {
    name: saved.name,
    markdown: await readFile(resolve(directory, "resume.md"), "utf8"),
    css: await readFile(resolve(directory, "resume.css"), "utf8"),
    styles: saved.styles
  };
  let entries = [];
  try {
    entries = JSON.parse(
      await readFile(resolve(directory, ".history/index.json"), "utf8")
    ).entries;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const history = [];
  for (const entry of entries) {
    if (!/^[a-f\d]{64}$/.test(entry.revision))
      throw new Error("Invalid history revision");
    history.push({
      id: entry.id,
      source: entry.source,
      changes: entry.changes,
      restoredFrom: entry.restoredFrom,
      createdAt: entry.createdAt,
      resume: JSON.parse(
        await readFile(
          resolve(directory, ".history/snapshots", entry.revision + ".json"),
          "utf8"
        )
      )
    });
  }
  records.push({
    sourceId,
    resume,
    history,
    deleted,
    createdAt: saved.created_at,
    updatedAt: saved.updated_at
  });
};
await readDirectory(root, "filesystem:1");
for (const [folder, deleted] of [
  ["library", false],
  [".trash", true]
]) {
  let names = [];
  try {
    names = await readdir(resolve(root, folder));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const name of names) {
    if (!(await stat(resolve(root, folder, name))).isDirectory()) continue;
    await readDirectory(
      resolve(root, folder, name),
      `${deleted ? "trash" : "filesystem"}:${name}`,
      deleted
    );
  }
}
let activeSourceId;
try {
  activeSourceId =
    "filesystem:" +
    JSON.parse(await readFile(resolve(root, ".active-resume.json"), "utf8")).id;
} catch {}
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify({
    format: "ohmycv-cloud-backup",
    version: 1,
    activeSourceId,
    resumes: records
  }),
  { mode: 0o600 }
);
console.log(
  `Saved ${records.length} resumes and ${records.reduce((count, item) => count + item.history.length, 0)} historical versions to ${output}`
);
