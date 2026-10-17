export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = Record<string, unknown>>(
    statements: Statement[]
  ): Promise<{ results: T[]; meta: { changes: number } }[]>;
}
export interface Env {
  DB: Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
export type User = { id: string; username: string; display_name: string };
export type Actor = {
  user: User;
  kind: "session" | "token";
  sessionHash?: string;
  scope: "read" | "read-write";
  resumeId: number | null;
};
export type ResumeRow = {
  id: number;
  owner_id: string;
  name: string;
  document: string;
  revision: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  source_id?: string | null;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export const json = (value: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...Object.fromEntries(new Headers(headers))
    }
  });
export const bodyJson = async (
  request: Request,
  maximum = 1900000
): Promise<Record<string, unknown>> => {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Content-Type must be application/json");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing JSON body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new ApiError(413, "Request body is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
};
export const numberId = (value: string) => {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new ApiError(400, "Invalid resume ID");
  return Number(value);
};
