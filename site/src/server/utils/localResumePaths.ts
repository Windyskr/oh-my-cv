import { resolve } from "node:path";

export const localResumeDirectory = resolve(process.cwd(), "../resumes");
export const localHistoryDirectory = resolve(localResumeDirectory, ".history");
