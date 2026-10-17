import { withLocalResume } from "../../../utils/localResume";
import { readResumeHistory } from "../../../utils/resumeHistory";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  setHeader(event, "Cache-Control", "no-store");
  return withLocalResume(() => readResumeHistory(getRouterParam(event, "id") || ""));
});
