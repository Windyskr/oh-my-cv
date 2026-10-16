import { access } from "node:fs/promises";
import { constants } from "node:fs";
import puppeteer from "puppeteer-core";
import type { LocalResume } from "./localResume";

let exporting = false;

const findChrome = async () => {
  const candidates = [
    process.env.RESUME_PDF_CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter((path): path is string => !!path);
  for (const path of candidates) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      /* Check the next installed executable. */
    }
  }
  throw createError({
    statusCode: 503,
    statusMessage: "Chrome is unavailable; set RESUME_PDF_CHROME_PATH"
  });
};

export const exportResumePdf = async (resume: LocalResume, port: number) => {
  if (exporting) {
    throw createError({
      statusCode: 429,
      statusMessage: "A PDF export is already running"
    });
  }
  exporting = true;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath: await findChrome(),
      headless: true,
      timeout: 30000,
      args: [
        "--disable-dev-shm-usage",
        ...(process.env.RESUME_PDF_NO_SANDBOX === "1" ? ["--no-sandbox"] : [])
      ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 1300, deviceScaleFactor: 1 });
    await page.emulateMediaType("print");
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await page.evaluateOnNewDocument((snapshot) => {
      (window as unknown as { __RESUME_EXPORT__: LocalResume }).__RESUME_EXPORT__ =
        snapshot;
    }, resume);
    await page.goto(`http://127.0.0.1:${port}/pdf-render`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    const state = await page.waitForFunction(
      () => {
        const status = document.documentElement.dataset;
        return status.pdfReady === "true" || !!status.pdfError;
      },
      { timeout: 60000 }
    );
    await state.dispose();
    const error = await page.evaluate(() => document.documentElement.dataset.pdfError);
    if (error) throw new Error(error);
    await page.evaluate((name) => {
      document.title = name;
    }, resume.name);
    const pdf = await page.pdf({
      format: resume.styles.paper === "letter" ? "letter" : "A4",
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      waitForFonts: true,
      timeout: 30000
    });
    return Buffer.from(pdf);
  } catch (error) {
    console.error("PDF export failed:", error);
    throw createError({
      statusCode: 503,
      statusMessage:
        "PDF export failed; check the local server log and Chrome configuration"
    });
  } finally {
    try {
      await browser?.close();
    } finally {
      exporting = false;
    }
  }
};
