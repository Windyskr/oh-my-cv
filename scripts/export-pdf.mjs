import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { startLocalServer } from "./local-build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const argument = process.argv[2];
if (argument === "--help" || process.argv.length > 3) {
  console.log("Usage: pnpm export:pdf [output.pdf]\nDefault: output/pdf/resume.pdf");
  process.exit(argument === "--help" ? 0 : 1);
}
const output = resolve(process.cwd(), argument || "output/pdf/resume.pdf");
let service;
let logFile;
const stopService = () => {
  if (!service?.pid) return;
  try {
    if (process.platform === "win32") service.kill();
    else process.kill(-service.pid, "SIGTERM");
  } catch {
    /* The process may have exited already. */
  }
  service = undefined;
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopService();
    process.exit(130);
  });
}

const isReady = async (base) => {
  try {
    const response = await fetch(`${base}/api/local-resume`, {
      signal: AbortSignal.timeout(1500)
    });
    return (
      response.ok && response.headers.get("content-type")?.includes("application/json")
    );
  } catch {
    return false;
  }
};

const freePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });

try {
  let base = (process.env.RESUME_PDF_SERVER_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );
  const address = new URL(base);
  if (
    address.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(address.hostname)
  ) {
    throw new Error("RESUME_PDF_SERVER_URL must point to a local HTTP service.");
  }
  if (!(await isReady(base))) {
    if (process.env.RESUME_PDF_SERVER_URL)
      throw new Error(`Local service is unavailable: ${base}`);
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    await mkdir(resolve(root, "logs"), { recursive: true });
    logFile = await open(resolve(root, "logs/pdf-export-server.log"), "a");
    service = await startLocalServer({
      port,
      detached: process.platform !== "win32",
      stdio: ["ignore", logFile.fd, logFile.fd]
    });
    let startupError;
    service.once("error", (error) => {
      startupError = error;
    });
    console.log("Starting the local PDF service…");
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (startupError) throw startupError;
      if (service.exitCode !== null)
        throw new Error("Local service stopped; see logs/pdf-export-server.log");
      if (await isReady(base)) {
        ready = true;
        break;
      }
      await new Promise((done) => setTimeout(done, 500));
    }
    if (!ready)
      throw new Error("Local service startup timed out; see logs/pdf-export-server.log");
  }
  console.log("Generating PDF from the local resume files…");
  const response = await fetch(`${base}/api/export-pdf`, {
    method: "POST",
    signal: AbortSignal.timeout(150000)
  });
  if (!response.ok)
    throw new Error(`PDF export failed (${response.status}): ${await response.text()}`);
  const pdf = Buffer.from(await response.arrayBuffer());
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("The service did not return a PDF.");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, pdf);
  console.log(`Saved: ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  stopService();
  await logFile?.close();
}
