import { parseResume } from "../../utils/parseResume";

export const validateResume = (value: unknown) => {
  try {
    return parseResume(value);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid resume data" });
  }
};
