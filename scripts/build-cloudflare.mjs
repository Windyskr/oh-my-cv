import { spawn } from "node:child_process";
import { rm, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(projectRoot, "site/.output/public");
const siteUrl = new URL(
  process.env.NUXT_SITE_URL ||
    process.env.CF_PAGES_URL ||
    "https://ohmycv-windyskr.pages.dev"
).origin;
const env = {
  ...process.env,
  NODE_ENV: "production",
  RESUME_LOCAL_BUILD: "0",
  NUXT_LOCAL_FILES_ENABLED: "false",
  NUXT_PUBLIC_LOCAL_FEATURES: "false",
  NUXT_SITE_URL: siteUrl,
  NITRO_PRESET: "static",
  NUXT_TELEMETRY_DISABLED: "1"
};

const run = (args) =>
  new Promise((done, reject) => {
    const child = spawn("pnpm", args, { cwd: projectRoot, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? done() : reject(new Error(`Build failed (${signal || code}).`))
    );
  });

await run(["build:pkg"]);
await run(["build"]);
await access(resolve(output, "200.html"));

// Only editor routes need the client-side fallback; missing assets retain a 404.
const redirects = ["", "/en", "/sp", "/zh-cn"].flatMap((prefix) => [
  `${prefix}/editor/* /200 200`,
  `${prefix}/local ${prefix}/dashboard 302`,
  `${prefix}/local/ ${prefix}/dashboard 302`,
  `${prefix}/pdf-render ${prefix}/dashboard 302`
]);
await writeFile(resolve(output, "_redirects"), redirects.join("\n") + "\n");
await writeFile(
  resolve(output, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap_index.xml\n`
);
// CNAME belongs to the upstream GitHub Pages deployment.
await rm(resolve(output, "CNAME"), { force: true });
console.log(`Cloudflare Pages files are ready: ${output}`);
