import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { getHistoryDirectory } from "./localResumePaths";
import type { LocalResume } from "./localResume";
import type {
  HistoryEntry,
  HistoryField,
  HistorySource,
  HistoryVersion
} from "../../types/resumeHistory";

const indexPath = () => resolve(getHistoryDirectory(), "index.json");
const snapshotsPath = () => resolve(getHistoryDirectory(), "snapshots");
const caches = new Map<string, { entries?: HistoryEntry[]; stamp: string }>();
const cache = () => {
  const directory = getHistoryDirectory();
  if (!caches.has(directory)) caches.set(directory, { stamp: "" });
  return caches.get(directory)!;
};

const withHistoryLock = async <T>(action: () => Promise<T>): Promise<T> => {
  const localHistoryDirectory = getHistoryDirectory();
  await mkdir(localHistoryDirectory, { recursive: true, mode: 0o700 });
  const lockPath = resolve(localHistoryDirectory, "write.lock");
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(String(process.pid));
        return await action();
      } finally {
        await handle.close();
        await unlink(lockPath).catch(() => {});
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = Number(await readFile(lockPath, "utf8").catch(() => ""));
      if (owner > 0) {
        try {
          process.kill(owner, 0);
        } catch (failure) {
          if ((failure as NodeJS.ErrnoException).code === "ESRCH") {
            await unlink(lockPath).catch(() => {});
            continue;
          }
        }
      }
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  throw new Error("Resume history is busy; retry after the current save completes");
};

const loadEntries = async () => {
  const state = cache();
  try {
    const info = await stat(indexPath());
    const stamp = `${info.ino}:${info.size}:${info.mtimeMs}`;
    if (state.entries && stamp === state.stamp) return state.entries;
    const index = JSON.parse(await readFile(indexPath(), "utf8")) as {
      version: number;
      entries: HistoryEntry[];
    };
    if (index.version !== 1 || !Array.isArray(index.entries))
      throw new Error("Invalid history index");
    state.entries = index.entries;
    state.stamp = stamp;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    state.entries = [];
    state.stamp = "";
  }
  return state.entries;
};

const atomicWrite = async (path: string, content: string) => {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
};

const readSnapshot = async (revision: string): Promise<LocalResume> => {
  if (!/^[a-f0-9]{64}$/.test(revision)) throw new Error("Invalid history revision");
  return JSON.parse(await readFile(resolve(snapshotsPath(), `${revision}.json`), "utf8"));
};

// Called under withLocalResume so recording and restoring share the save queue.
export const recordResumeHistory = async (
  resume: LocalResume,
  revision: string,
  source: HistorySource,
  restoredFrom?: string
) => {
  const current = await loadEntries();
  if (current[0]?.revision === revision) return current[0];
  return withHistoryLock(async () => {
    const current = await loadEntries();
    if (current[0]?.revision === revision) return current[0];
    await mkdir(snapshotsPath(), { recursive: true, mode: 0o700 });
    const snapshotPath = resolve(snapshotsPath(), `${revision}.json`);
    try {
      await access(snapshotPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await atomicWrite(snapshotPath, JSON.stringify(resume, null, 2) + "\n");
    }
    const previous = current[0] ? await readSnapshot(current[0].revision) : undefined;
    const fields: HistoryField[] = ["name", "markdown", "css", "styles"];
    const changes = fields.filter(
      (field) =>
        !previous || JSON.stringify(previous[field]) !== JSON.stringify(resume[field])
    );
    const entry: HistoryEntry = {
      id: randomUUID(),
      revision,
      createdAt: new Date().toISOString(),
      name: resume.name,
      source: current.length ? source : "initial",
      changes,
      ...(restoredFrom ? { restoredFrom } : {})
    };
    const next = [entry, ...current];
    await atomicWrite(
      indexPath(),
      JSON.stringify({ version: 1, entries: next }, null, 2) + "\n"
    );
    cache().entries = next;
    cache().stamp = "";
    return entry;
  });
};

export const validHistoryId = (id: string) =>
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);

export const listResumeHistory = async (before?: string) => {
  const all = await loadEntries();
  const offset = before ? all.findIndex((entry) => entry.id === before) + 1 : 0;
  if (before && offset === 0)
    throw createError({ statusCode: 404, statusMessage: "History cursor not found" });
  const versions = all.slice(offset, offset + 50);
  return {
    versions,
    total: all.length,
    nextBefore: offset + versions.length < all.length ? versions.at(-1)!.id : null
  };
};

export const readResumeHistory = async (id: string): Promise<HistoryVersion> => {
  if (!validHistoryId(id))
    throw createError({ statusCode: 400, statusMessage: "Invalid history ID" });
  const entry = (await loadEntries()).find((item) => item.id === id);
  if (!entry)
    throw createError({ statusCode: 404, statusMessage: "History version not found" });
  return { ...entry, resume: await readSnapshot(entry.revision) };
};
