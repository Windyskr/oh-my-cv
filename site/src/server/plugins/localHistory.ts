import { watch, type FSWatcher } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import {
  localResumeDirectory,
  resumeLibraryDirectory,
  resumeDirectory
} from "../utils/localResumePaths";
import { readLocalResume, withLocalResume } from "../utils/localResume";

export default defineNitroPlugin(async (nitroApp) => {
  if (!useRuntimeConfig().localFilesEnabled) return;
  await mkdir(resumeLibraryDirectory, { recursive: true });
  const watchers = new Map<number, FSWatcher>();
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const pending = new Set<Promise<unknown>>();
  let closed = false;
  const capture = (id: number) => {
    if (closed) return;
    const action = withLocalResume(readLocalResume, id).catch((error) => {
      if (error.code !== "ENOENT")
        console.error("Could not record resume history:", error);
    });
    pending.add(action);
    void action.finally(() => pending.delete(action));
  };
  const attach = (id: number, directory: string) => {
    if (watchers.has(id)) return;
    const watcher = watch(directory, (_event, filename) => {
      if (
        !filename ||
        !["resume.md", "resume.css", "resume.ohmycv.json"].includes(filename.toString())
      )
        return;
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => capture(id), 300)
      );
    });
    watcher.on("error", (error) => console.error("Resume file watcher failed:", error));
    watchers.set(id, watcher);
    capture(id);
  };
  const refresh = async () => {
    if (closed) return;
    const ids = new Set(
      (await readdir(resumeLibraryDirectory, { withFileTypes: true }))
        .filter((item) => item.isDirectory() && /^[1-9]\d*$/.test(item.name))
        .map((item) => Number(item.name))
    );
    for (const id of ids) attach(id, resumeDirectory(id));
    for (const [id, watcher] of watchers)
      if (id !== 1 && !ids.has(id)) {
        watcher.close();
        watchers.delete(id);
        clearTimeout(timers.get(id));
      }
  };
  attach(1, localResumeDirectory);
  await refresh();
  const libraryWatcher = watch(resumeLibraryDirectory, () => {
    void refresh().catch((error) =>
      console.error("Resume library watcher failed:", error)
    );
  });
  nitroApp.hooks.hook("close", async () => {
    closed = true;
    libraryWatcher.close();
    for (const watcher of watchers.values()) watcher.close();
    for (const timer of timers.values()) clearTimeout(timer);
    await Promise.allSettled([...pending]);
  });
});
