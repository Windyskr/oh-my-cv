import { parseResume } from "./parseResume";
import type { DbResumeEmpty } from "./storage/db";

export const GIST_FILENAME = "resume.ohmycv.json";
export type GistDocument = {
  id: string;
  html_url: string;
  updated_at: string;
  public: boolean;
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
};

export class GistError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export const parseGistId = (input: string) => {
  const value = input.trim();
  if (/^[a-f\d]{5,64}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol === "https:" &&
      url.hostname === "gist.github.com" &&
      parts.length <= 2 &&
      /^[a-f\d]{5,64}$/i.test(parts[parts.length - 1])
    )
      return parts[parts.length - 1];
  } catch {
    // Accept only a GitHub Gist URL or hexadecimal ID.
  }
  throw new GistError("invalid_id");
};

const request = async (token: string, id = "", body?: object) => {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/gists${id ? `/${id}` : ""}`, {
      method: body ? (id ? "PATCH" : "POST") : "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw new GistError("network");
  }
  if (!response.ok) {
    throw new GistError(
      response.status === 401
        ? "unauthorized"
        : response.status === 403 || response.status === 429
          ? "forbidden"
          : response.status === 404
            ? "not_found"
            : "request_failed"
    );
  }
  const gist = (await response.json()) as GistDocument;
  if (!gist.id || !/^[a-f\d]{5,64}$/i.test(gist.id) || !gist.files)
    throw new GistError("invalid_data");
  return gist;
};

export const getGist = (token: string, id: string) => request(token, parseGistId(id));

export const uploadGist = (token: string, id: string, resume: DbResumeEmpty) => {
  if (!token.trim()) throw new GistError("token_required");
  return request(token, id ? parseGistId(id) : "", {
    ...(id ? {} : { public: false }),
    description: "Oh My CV resume",
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify({ format: "ohmycv-gist", version: 1, resume }, null, 2)
      }
    }
  });
};

export const downloadGist = async (token: string, id: string) => {
  const gist = await getGist(token, id);
  const file = gist.files[GIST_FILENAME];
  if (!file) throw new GistError("missing_file");
  let content = file.content;
  if (file.truncated) {
    // GitHub truncates API file content above 1 MB. Never send the token to a raw URL.
    try {
      const url = new URL(file.raw_url || "");
      if (url.protocol !== "https:" || url.hostname !== "gist.githubusercontent.com")
        throw new Error();
      const response = await fetch(url, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error();
      content = await response.text();
    } catch {
      throw new GistError("network");
    }
  }
  try {
    const json = JSON.parse(content || "");
    if (json.format !== "ohmycv-gist" || json.version !== 1) throw new Error();
    return { gist, resume: parseResume(json.resume) };
  } catch {
    throw new GistError("invalid_data");
  }
};
