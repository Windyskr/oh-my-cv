import { watch } from "node:fs";
import { mkdir as createDirectory } from "node:fs/promises";
import { localResumeDirectory } from "../utils/localResumePaths";
import { readLocalResume, withLocalResume } from "../utils/localResume";

export default defineNitroPlugin(async (nitroApp) => {
  if (!useRuntimeConfig().localFilesEnabled) return;
  await createDirectory(localResumeDirectory, { recursive: true });
  let closed = false;
  let timer: ReturnType<typeof setTimeout>;
  let pending: Promise<unknown> | undefined;
  const capture = () => {
    if (closed) return;
    pending = withLocalResume(readLocalResume).catch((error) => {
      if (error.code !== "ENOENT")
        console.error("Could not record resume history:", error);
    });
  };
  const names = new Set(["resume.md", "resume.css", "resume.ohmycv.json"]);
  const watcher = watch(localResumeDirectory, (_event, filename) => {
    if (!filename || !names.has(filename.toString())) return;
    clearTimeout(timer);
    timer = setTimeout(capture, 300);
  });
  watcher.on("error", (error) => console.error("Resume history watcher failed:", error));
  capture();
  nitroApp.hooks.hook("close", async () => {
    closed = true;
    clearTimeout(timer);
    watcher.close();
    await pending;
  });
});
