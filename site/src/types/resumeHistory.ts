import type { DbResumeEmpty } from "../utils/storage/db";

export type HistorySource = "initial" | "save" | "external" | "restore";
export type HistoryField = "name" | "markdown" | "css" | "styles";
export type HistoryEntry = {
  id: string;
  revision: string;
  createdAt: string;
  name: string;
  source: HistorySource;
  changes: HistoryField[];
  restoredFrom?: string;
};
export type HistoryVersion = HistoryEntry & { resume: DbResumeEmpty };
export type HistoryList = {
  versions: HistoryEntry[];
  total: number;
  nextBefore: string | null;
  currentRevision: string;
};
