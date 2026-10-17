import { PRINT_BOTTOM } from "../composables/constant/variables/render";
import type { ResumeStyles } from "../composables/stores/style";

export const resolveResumeMargins = (styles: ResumeStyles) => ({
  top: styles.marginTop ?? styles.marginV,
  bottom: styles.marginBottom ?? Math.max(styles.marginV - 10, PRINT_BOTTOM),
  left: styles.marginH,
  right: styles.marginH
});
