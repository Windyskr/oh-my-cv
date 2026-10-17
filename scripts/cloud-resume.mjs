import { readFile } from "node:fs/promises";
const base = (
  process.env.OHMYCV_API_URL || "https://ohmycv-auth.ccgslb.workers.dev"
).replace(/\/$/, "");
const token = process.env.OHMYCV_API_TOKEN;
if (!token)
  throw new Error("Set OHMYCV_API_TOKEN to the API token created in Account settings");
const args = process.argv.slice(2);
const command = args[0] || "current";
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const request = async (path, options = {}) => {
  const response = await fetch(base + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error}`);
  return result;
};
if (command === "list")
  console.log(JSON.stringify(await request("/api/v1/resumes"), null, 2));
else {
  const id = value("--id");
  if (id && !/^[1-9]\d*$/.test(id)) throw new Error("Invalid resume ID");
  const current = await request(id ? `/api/v1/resumes/${id}` : "/api/v1/active-resume");
  if (command === "get" || command === "current")
    console.log(JSON.stringify(current, null, 2));
  else if (command === "patch") {
    const patch = {};
    const json = value("--json");
    if (json) Object.assign(patch, JSON.parse(await readFile(json, "utf8")));
    for (const key of ["markdown", "css"]) {
      const path = value("--" + key);
      if (path) patch[key] = await readFile(path, "utf8");
    }
    if (!Object.keys(patch).length)
      throw new Error("Pass --markdown file.md, --css file.css, or --json patch.json");
    const saved = await request(`/api/v1/resumes/${current.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "If-Match": `"${current.revision}"`
      },
      body: JSON.stringify(patch)
    });
    console.log(
      JSON.stringify(
        { id: saved.id, name: saved.name, revision: saved.revision },
        null,
        2
      )
    );
  } else
    throw new Error(
      "Commands: current, list, get [--id N], patch [--id N] --markdown file.md / --css file.css / --json patch.json"
    );
}
