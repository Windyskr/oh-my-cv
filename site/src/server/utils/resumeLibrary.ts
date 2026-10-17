import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  localResumeDirectory,
  resumeLibraryDirectory,
  resumeDirectory,
  withResumeDirectory
} from "./localResumePaths";
import { readLocalResume, writeLocalResume } from "./localResume";
import { validateResume } from "./validateResume";
import type { DbResumeEmpty, DbResume } from "../../utils/storage/db";

export const libraryResume = (id: number) =>
  withResumeDirectory(resumeDirectory(id), async () => {
    const current = await readLocalResume();
    const metadata = Object.values(current.json.data)[0];
    const stamps = await Promise.all(
      ["resume.md", "resume.css", "resume.ohmycv.json"].map((file) =>
        stat(resolve(resumeDirectory(id), file))
      )
    );
    const timestamp = (value: string | undefined, fallback: number) => {
      const number = Number(value) || Date.parse(value || "");
      return Number.isFinite(number) ? number : fallback;
    };
    return {
      ...current.resume,
      id,
      revision: current.revision,
      filePath: resumeDirectory(id),
      created_at: String(timestamp(metadata.created_at, stamps[2].birthtimeMs)),
      updated_at: String(
        Math.floor(
          Math.max(
            timestamp(metadata.updated_at, 0),
            ...stamps.map((info) => info.mtimeMs)
          )
        )
      )
    };
  });

export const listLibraryResumes = async () => {
  await mkdir(resumeLibraryDirectory, { recursive: true });
  const ids = [
    1,
    ...(await readdir(resumeLibraryDirectory, { withFileTypes: true }))
      .filter(
        (item) =>
          item.isDirectory() &&
          /^[1-9]\d*$/.test(item.name) &&
          Number.isSafeInteger(Number(item.name))
      )
      .map((item) => Number(item.name))
  ];
  const resumes = [];
  for (const id of ids) {
    try {
      resumes.push(await libraryResume(id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return resumes.sort((a, b) => Number(b.updated_at) - Number(a.updated_at));
};

const atomicJson = async (path: string, value: unknown) => {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(temporary, path);
};

export const createLibraryResume = async (value: unknown, preferredId?: number) => {
  const resume = validateResume(value);
  const existing = new Set((await listLibraryResumes()).map((item) => item.id));
  let id =
    preferredId && preferredId !== 1 && !existing.has(preferredId)
      ? preferredId
      : Date.now();
  while (existing.has(id)) id++;
  const directory = resumeDirectory(id);
  await mkdir(directory, { recursive: true });
  const timestamp = String(Date.now());
  await withResumeDirectory(directory, () =>
    writeLocalResume(resume, {
      version: "v1",
      data: { [id]: { ...resume, created_at: timestamp, updated_at: timestamp } }
    })
  );
  return libraryResume(id);
};

export const updateLibraryResume = async (
  id: number,
  revision: string,
  updates: Partial<DbResumeEmpty>
) =>
  withResumeDirectory(resumeDirectory(id), async () => {
    const current = await readLocalResume();
    if (current.revision !== revision)
      throw createError({
        statusCode: 409,
        statusMessage: "Resume files have changed; reload before saving"
      });
    await writeLocalResume(
      validateResume({ ...current.resume, ...updates }),
      current.json
    );
    return libraryResume(id);
  });

export const deleteLibraryResume = async (id: number) => {
  const current = await libraryResume(id);
  const trash = resolve(localResumeDirectory, ".trash", `${id}-${randomUUID()}`);
  await mkdir(resolve(localResumeDirectory, ".trash"), { recursive: true });
  if (id !== 1) await rename(resumeDirectory(id), trash);
  else {
    await mkdir(trash);
    for (const name of ["resume.md", "resume.css", "resume.ohmycv.json", ".history"]) {
      try {
        await rename(resolve(localResumeDirectory, name), resolve(trash, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  return current;
};

export const importBrowserResumes = async (client: string, items: DbResume[]) => {
  const path = resolve(localResumeDirectory, ".browser-imports.json");
  let receipts: Record<string, number> = {};
  try {
    receipts = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const item of items) {
    if (!Number.isSafeInteger(item.id) || item.id < 0)
      throw createError({ statusCode: 400, statusMessage: "Invalid browser resume ID" });
    const key = `${client}:${item.id}`;
    if (receipts[key]) continue;
    const resume = validateResume(item);
    const existing = (await listLibraryResumes()).find(
      (candidate) => candidate.id === item.id
    );
    const same =
      existing && JSON.stringify(validateResume(existing)) === JSON.stringify(resume);
    const saved = same ? existing : await createLibraryResume(resume, item.id);
    receipts[key] = saved.id;
    await atomicJson(path, receipts);
  }
};

export const activateLibraryResume = async (id: number) => {
  const resume = await libraryResume(id);
  await atomicJson(resolve(localResumeDirectory, ".active-resume.json"), {
    id,
    name: resume.name,
    directory: resume.filePath,
    markdown: resolve(resume.filePath, "resume.md"),
    css: resolve(resume.filePath, "resume.css"),
    settings: resolve(resume.filePath, "resume.ohmycv.json"),
    updatedAt: new Date().toISOString()
  });
  return { ok: true };
};

export const activeLibraryResume = async () => {
  try {
    const active = JSON.parse(
      await readFile(resolve(localResumeDirectory, ".active-resume.json"), "utf8")
    );
    if (Number.isSafeInteger(active.id) && active.id > 0)
      return await libraryResume(active.id);
  } catch (error) {
    if (
      !(error instanceof SyntaxError) &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    )
      throw error;
  }
  const resumes = await listLibraryResumes();
  const resume = resumes.find((item) => item.id === 1) || resumes[0];
  if (!resume)
    throw createError({
      statusCode: 404,
      statusMessage: "No resume is available for export"
    });
  return resume;
};
