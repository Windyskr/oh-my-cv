import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
const base = (
  process.env.OHMYCV_API_URL || "https://ohmycv-auth.ccgslb.workers.dev"
).replace(/\/$/, "");
const token = process.env.OHMYCV_API_TOKEN;
if (!token) throw new Error("Set OHMYCV_API_TOKEN to read the resume for PDF export");
const args = process.argv.slice(2);
const idIndex = args.indexOf("--id");
const id = idIndex >= 0 ? args[idIndex + 1] : undefined;
if (id && !/^[1-9]\d*$/.test(id)) throw new Error("Invalid resume ID");
const output = resolve(
  args.find(
    (arg, index) => !arg.startsWith("--") && (idIndex < 0 || index !== idIndex + 1)
  ) || "output/pdf/resume.pdf"
);
const response = await fetch(
  base + (id ? "/api/v1/resumes/" + id : "/api/v1/active-resume"),
  { headers: { Authorization: "Bearer " + token } }
);
const resume = await response.json();
if (!response.ok) throw new Error("Cannot read the cloud resume: " + resume.error);
const candidates = [
  process.env.RESUME_PDF_CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);
let executablePath;
for (const path of candidates) {
  try {
    await access(path, constants.X_OK);
    executablePath = path;
    break;
  } catch {}
}
if (!executablePath) throw new Error("Chrome is unavailable; set RESUME_PDF_CHROME_PATH");
const puppeteer = createRequire(new URL("../site/package.json", import.meta.url))(
  "puppeteer-core"
);
const browserEnv = { ...process.env };
delete browserEnv.OHMYCV_API_TOKEN;
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  env: browserEnv,
  args: [
    "--disable-dev-shm-usage",
    ...(process.env.RESUME_PDF_NO_SANDBOX === "1" ? ["--no-sandbox"] : [])
  ]
});
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((snapshot) => {
    window.__RESUME_EXPORT__ = snapshot;
  }, resume);
  await page.goto(base + "/pdf-render", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.pdfReady === "true" ||
      !!document.documentElement.dataset.pdfError,
    { timeout: 90000 }
  );
  const error = await page.evaluate(() => document.documentElement.dataset.pdfError);
  if (error) throw new Error("PDF rendering failed: " + error);
  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, pdf, { mode: 0o600 });
  console.log("Saved cloud resume PDF: " + output);
} finally {
  await browser.close();
}
