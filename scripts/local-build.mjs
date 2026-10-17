import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const cacheDirectory = resolve(projectRoot, ".cache");
const metadataPath = resolve(cacheDirectory, "local-build.json");
const lockPath = resolve(cacheDirectory, "local-build.lock");
const entry = resolve(projectRoot, "site/.output-local/server/index.mjs");

const inputs = async () => {
  const files = [];
  const visit = async (path) => {
    let info;
    try {
      info = await stat(path);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (info.isDirectory()) {
      const children = await readdir(path, { withFileTypes: true });
      await Promise.all(
        children
          .filter(
            (child) =>
              !child.isSymbolicLink() &&
              !["node_modules", "dist", ".cache"].includes(child.name)
          )
          .map((child) => visit(resolve(path, child.name)))
      );
    } else {
      files.push([relative(projectRoot, path), info.size, info.mtimeMs]);
    }
  };
  await Promise.all(
    [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "site/package.json",
      "site/nuxt.config.ts",
      "site/unocss.config.ts",
      "site/.env",
      "site/configs",
      "site/src",
      "site/public",
      "packages",
      "scripts"
    ].map((path) => visit(resolve(projectRoot, path)))
  );
  return JSON.stringify(files.sort((a, b) => a[0].localeCompare(b[0])));
};

const isCurrent = async (snapshot) => {
  try {
    await access(entry);
    return JSON.parse(await readFile(metadataPath, "utf8")).inputs === snapshot;
  } catch {
    return false;
  }
};

const acquireBuildLock = async () => {
  const started = Date.now();
  while (Date.now() - started < 300000) {
    try {
      const file = await open(lockPath, "wx");
      await file.writeFile(String(process.pid));
      await file.close();
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner;
      try {
        owner = Number(await readFile(lockPath, "utf8"));
      } catch {
        continue;
      }
      if (owner > 0) {
        try {
          process.kill(owner, 0);
        } catch (failure) {
          if (failure.code === "ESRCH") {
            await unlink(lockPath).catch(() => {});
            continue;
          }
        }
      }
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  throw new Error(
    "Local build is busy; check .cache/local-build.lock and running build processes."
  );
};

const run = (args, env = {}) =>
  new Promise((done, reject) => {
    const child = spawn("pnpm", args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, NUXT_TELEMETRY_DISABLED: "1", ...env }
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? done() : reject(new Error(`Build failed (${signal || code}).`))
    );
  });

export const ensureLocalBuild = async () => {
  let snapshot = await inputs();
  if (await isCurrent(snapshot)) return entry;
  await mkdir(cacheDirectory, { recursive: true });
  await acquireBuildLock();
  try {
    snapshot = await inputs();
    if (await isCurrent(snapshot)) return entry;
    console.log("Building the local app; subsequent starts reuse this build…");
    await run(["build:pkg"]);
    await run(["--filter", "site", "exec", "nuxt", "build"], {
      RESUME_LOCAL_BUILD: "1",
      NITRO_PRESET: "node-server"
    });
    // Leave the build uncached if source files changed while it was compiling.
    if ((await inputs()) === snapshot) {
      await writeFile(metadataPath, JSON.stringify({ inputs: snapshot }) + "\n");
    }
    return entry;
  } finally {
    await unlink(lockPath).catch(() => {});
  }
};

export const startLocalServer = async ({
  host = "127.0.0.1",
  port = 3000,
  stdio = "inherit",
  detached = false
} = {}) => {
  const serverEntry = await ensureLocalBuild();
  return spawn(process.execPath, [serverEntry], {
    cwd: resolve(projectRoot, "site"),
    stdio,
    detached,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NITRO_HOST: host,
      NITRO_PORT: String(port),
      NUXT_LOCAL_FILES_ENABLED: "true",
      NUXT_PUBLIC_LOCAL_FEATURES: "true"
    }
  });
};

export const localBuildInputs = inputs;
