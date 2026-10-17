import { parseResumeId } from "../../../utils/localResumePaths";
import {
  readLocalResume,
  writeLocalResume,
  withLocalResume
} from "../../../utils/localResume";
import { readResumeHistory } from "../../../utils/resumeHistory";
import { validateResume } from "../../../utils/validateResume";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  const origin = getHeader(event, "origin");
  if (origin && origin !== getRequestURL(event).origin)
    throw createError({ statusCode: 403, statusMessage: "Invalid origin" });
  const body = await readBody(event);
  if (!body || typeof body.id !== "string" || typeof body.revision !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Invalid restore request" });
  }
  setHeader(event, "Cache-Control", "no-store");
  return withLocalResume(
    async () => {
      const current = await readLocalResume();
      if (current.revision !== body.revision)
        throw createError({ statusCode: 409, statusMessage: "Local files have changed" });
      const version = await readResumeHistory(body.id);
      const resume = validateResume(version.resume);
      await writeLocalResume(resume, current.json, "restore", version.id);
      const saved = await readLocalResume();
      return { ...saved.resume, revision: saved.revision };
    },
    parseResumeId(getQuery(event).resumeId)
  );
});
