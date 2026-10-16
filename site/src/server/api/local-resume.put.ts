import { readLocalResume, writeLocalResume, withLocalResume } from "../utils/localResume";
import { validateResume } from "../utils/validateResume";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  const origin = getHeader(event, "origin");
  if (origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: "Invalid origin" });
  }
  const body = await readBody(event);
  if (!body || typeof body.revision !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Invalid resume revision" });
  }
  const resume = validateResume(body);
  setHeader(event, "Cache-Control", "no-store");
  return withLocalResume(async () => {
    const current = await readLocalResume();
    if (body.revision !== current.revision) {
      throw createError({ statusCode: 409, statusMessage: "Local files have changed" });
    }
    await writeLocalResume(resume, current.json);
    const saved = await readLocalResume();
    return { ...saved.resume, revision: saved.revision };
  });
});
