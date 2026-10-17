import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "node:path";

export const localResumeDirectory = resolve(process.cwd(), "../resumes");
export const resumeLibraryDirectory = resolve(localResumeDirectory, "library");
const context = new AsyncLocalStorage<string>();

export const parseResumeId = (value: unknown) => {
  if (value === undefined) return 1;
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw createError({ statusCode: 400, statusMessage: "Invalid resume ID" });
  return Number(value);
};
export const resumeDirectory = (id: number) =>
  id === 1 ? localResumeDirectory : resolve(resumeLibraryDirectory, String(id));
export const getResumeDirectory = () => context.getStore() || localResumeDirectory;
export const getHistoryDirectory = () => resolve(getResumeDirectory(), ".history");
export const withResumeDirectory = <T>(directory: string, action: () => T) =>
  context.run(directory, action);
