import { getResumeDirectory, parseResumeId } from "../utils/localResumePaths";
import { readLocalResume, withLocalResume } from "../utils/localResume";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  setHeader(event, "Cache-Control", "no-store");
  return withLocalResume(
    async () => {
      const { resume, revision } = await readLocalResume();
      return { ...resume, revision, filePath: getResumeDirectory() };
    },
    parseResumeId(getQuery(event).resumeId)
  );
});
