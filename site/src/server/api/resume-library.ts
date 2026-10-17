import { withLocalResume } from "../utils/localResume";
import { parseResumeId } from "../utils/localResumePaths";
import {
  activateLibraryResume,
  createLibraryResume,
  deleteLibraryResume,
  importBrowserResumes,
  libraryResume,
  listLibraryResumes,
  updateLibraryResume
} from "../utils/resumeLibrary";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  setHeader(event, "Cache-Control", "no-store");
  const origin = getHeader(event, "origin");
  if (event.method !== "GET" && origin && origin !== getRequestURL(event).origin)
    throw createError({ statusCode: 403 });
  const body = event.method === "GET" ? null : await readBody(event);
  return withLocalResume(async () => {
    if (event.method === "GET") {
      const id = getQuery(event).id;
      return id === undefined ? listLibraryResumes() : libraryResume(parseResumeId(id));
    }
    if (event.method === "POST") {
      if (body?.action === "activate")
        return activateLibraryResume(parseResumeId(String(body.id)));
      if (body?.action === "import") {
        if (
          typeof body.client !== "string" ||
          !/^[a-f\d-]{36}$/.test(body.client) ||
          !Array.isArray(body.resumes)
        )
          throw createError({ statusCode: 400 });
        await importBrowserResumes(body.client, body.resumes);
        return { ok: true };
      }
      return createLibraryResume(
        body?.resume,
        Number.isSafeInteger(body?.resume?.id) && body.resume.id > 0
          ? body.resume.id
          : undefined
      );
    }
    const id = parseResumeId(String(body?.id));
    if (event.method === "PUT") {
      if (typeof body.revision !== "string") throw createError({ statusCode: 400 });
      return updateLibraryResume(id, body.revision, body.resume);
    }
    if (event.method === "DELETE") return deleteLibraryResume(id);
    throw createError({ statusCode: 405 });
  }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw createError({ statusCode: 404, statusMessage: "Resume not found" });
    throw error;
  });
});
