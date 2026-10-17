import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { projectRoot, localBuildInputs } from "./local-build.mjs";
const siteUrl = new URL(
  process.env.NUXT_SITE_URL || "https://ohmycv-auth.ccgslb.workers.dev"
).origin;
let ready = false;
try {
  const cache = JSON.parse(
    await readFile(resolve(projectRoot, ".cache/auth-client.json"), "utf8")
  );
  await access(resolve(projectRoot, "site/.output/public/200.html"));
  ready = cache.inputs === (await localBuildInputs()) && cache.siteUrl === siteUrl;
} catch {}
if (!ready)
  await new Promise((done, reject) => {
    const child = spawn("pnpm", ["build:cloudflare"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, NUXT_SITE_URL: siteUrl }
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? done() : reject(new Error("Cloud client build failed"))
    );
  });
const args = process.argv.slice(2);
const port = args.includes("--port") ? args[args.indexOf("--port") + 1] : "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Invalid port");
const service = spawn(
  "pnpm",
  ["dlx", "wrangler@4.151.1", "dev", "--ip", "127.0.0.1", "--port", port],
  { cwd: projectRoot, stdio: "inherit", env: process.env }
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => service.kill(signal));
await new Promise((done, reject) => {
  service.once("error", reject);
  service.once("exit", (code) => {
    process.exitCode = code ?? 0;
    done();
  });
});
