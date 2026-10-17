import { GistError, parseGistId } from "./gist";

export type GistCredentials = { pat: string; gistId: string };

const validPat = (pat: unknown): pat is string =>
  typeof pat === "string" &&
  pat.length > 0 &&
  pat.length <= 1024 &&
  !/[\s\x00-\x1f\x7f]/.test(pat);

export const encodeGistSyncCode = ({ pat, gistId }: GistCredentials) => {
  if (!validPat(pat)) throw new GistError("invalid_sync_code");
  const payload = JSON.stringify({
    provider: "github-gist",
    version: 1,
    pat,
    gistId: parseGistId(gistId)
  });
  return btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
};

export const decodeGistSyncCode = (input: string): GistCredentials => {
  try {
    const code = input.replace(/\s/g, "");
    if (code.length > 8192 || !/^[A-Za-z\d+/]+={0,2}$/.test(code)) throw new Error();
    const bytes = Uint8Array.from(atob(code), (character) => character.charCodeAt(0));
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (
      value?.provider !== "github-gist" ||
      value.version !== 1 ||
      !validPat(value.pat) ||
      typeof value.gistId !== "string"
    )
      throw new Error();
    return { pat: value.pat, gistId: parseGistId(value.gistId) };
  } catch {
    throw new GistError("invalid_sync_code");
  }
};
