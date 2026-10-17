import { parseResumeId } from "../../../utils/localResumePaths";
import { readLocalResume, withLocalResume } from "../../../utils/localResume";
import { listResumeHistory, validHistoryId } from "../../../utils/resumeHistory";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  const before = getQuery(event).before;
  if (before !== undefined && (typeof before !== "string" || !validHistoryId(before))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid history cursor" });
  }
  setHeader(event, "Cache-Control", "no-store");
  return withLocalResume(
    async () => {
      const current = await readLocalResume();
      return {
        ...(await listResumeHistory(before as string | undefined)),
        currentRevision: current.revision
      };
    },
    parseResumeId(getQuery(event).resumeId)
  );
});
