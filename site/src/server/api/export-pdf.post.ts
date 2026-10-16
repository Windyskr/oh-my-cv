import { readLocalResume, withLocalResume } from "../utils/localResume";
import { exportResumePdf } from "../utils/pdfExport";
import { validateResume } from "../utils/validateResume";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).localFilesEnabled) throw createError({ statusCode: 404 });
  const origin = getHeader(event, "origin");
  if (origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: "Invalid origin" });
  }
  const body = await readBody(event);
  const snapshot =
    body ?? (await withLocalResume(async () => (await readLocalResume()).resume));
  const resume = validateResume(snapshot);
  // Nuxt's development proxy uses a Unix socket, so localPort may be absent.
  const port = event.node.req.socket.localPort || Number(getRequestURL(event).port || 80);
  if (!port)
    throw createError({
      statusCode: 503,
      statusMessage: "Local server port is unavailable"
    });
  const pdf = await exportResumePdf(resume, port);
  const name = (resume.name.trim() || "resume").replace(/[\\/\r\n]/g, "_");
  setHeaders(event, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
    "Cache-Control": "no-store",
    "Content-Length": String(pdf.byteLength)
  });
  return pdf;
});
