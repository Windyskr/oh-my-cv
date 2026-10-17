import { validOptionalLayoutStyles } from "./layoutSettings";
import type { DbResumeEmpty } from "./storage/db";

export const parseResume = (value: unknown): DbResumeEmpty => {
  const resume = value as DbResumeEmpty;
  const styles = resume?.styles;
  if (
    !resume ||
    ![resume.name, resume.markdown, resume.css].every(
      (item) => typeof item === "string"
    ) ||
    !styles ||
    ![
      styles.marginV,
      styles.marginH,
      styles.fontSize,
      styles.lineHeight,
      styles.paragraphSpace
    ].every((item) => Number.isFinite(item) && item >= 0) ||
    styles.fontSize === 0 ||
    styles.lineHeight === 0 ||
    !validOptionalLayoutStyles(styles) ||
    !["A4", "letter"].includes(styles.paper) ||
    typeof styles.themeColor !== "string" ||
    ![styles.fontCJK, styles.fontEN].every(
      (font) =>
        font &&
        typeof font.name === "string" &&
        (font.fontFamily === undefined || typeof font.fontFamily === "string")
    )
  ) {
    throw new Error("Invalid resume data");
  }
  return { name: resume.name, markdown: resume.markdown, css: resume.css, styles };
};
