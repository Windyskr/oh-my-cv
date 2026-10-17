import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { DbResumeEmpty, StorageJson } from "../../utils/storage/db";
import {
  getResumeDirectory,
  resumeDirectory,
  withResumeDirectory
} from "./localResumePaths";
import { recordResumeHistory } from "./resumeHistory";
import type { HistorySource } from "../../types/resumeHistory";

export type LocalResume = DbResumeEmpty;

const resumeRevision = (resume: LocalResume) =>
  createHash("sha256").update(JSON.stringify(resume)).digest("hex");
let queue = Promise.resolve();

export const withLocalResume = <T>(operation: () => Promise<T>, id = 1): Promise<T> => {
  const result = queue.then(() => withResumeDirectory(resumeDirectory(id), operation));
  queue = result.then(
    () => {},
    () => {}
  );
  return result;
};

export const readLocalResume = async () => {
  const directory = getResumeDirectory();
  const [markdown, css, settings] = await Promise.all([
    readFile(resolve(directory, "resume.md"), "utf8"),
    readFile(resolve(directory, "resume.css"), "utf8"),
    readFile(resolve(directory, "resume.ohmycv.json"), "utf8")
  ]);
  const json = JSON.parse(settings) as StorageJson;
  const saved = Object.values(json.data)[0] as LocalResume;
  const resume = { name: saved.name, markdown, css, styles: saved.styles };
  const revision = resumeRevision(resume);
  await recordResumeHistory(resume, revision, "external");
  return { resume, revision, json };
};

export const writeLocalResume = async (
  resume: LocalResume,
  json: StorageJson,
  source: HistorySource = "save",
  restoredFrom?: string
) => {
  const directory = getResumeDirectory();
  // Save the complete target snapshot before changing any of the working files.
  await recordResumeHistory(resume, resumeRevision(resume), source, restoredFrom);
  const saved = Object.values(json.data)[0] as LocalResume & { updated_at: string };
  Object.assign(saved, resume, { updated_at: new Date().toISOString() });
  const files = [
    ["resume.md", resume.markdown],
    ["resume.css", resume.css],
    ["resume.ohmycv.json", JSON.stringify(json, null, 2) + "\n"]
  ];
  for (const [filename, content] of files) {
    const target = resolve(directory, filename);
    await writeFile(`${target}.tmp`, content, "utf8");
    await rename(`${target}.tmp`, target);
  }
};
