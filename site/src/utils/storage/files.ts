import * as localForage from "localforage";
import type {
  DbResume,
  DbResumeEmpty,
  DbResumeUpdate,
  DbService,
  DbServiceResponse
} from "./db";

export class FileResumeDbService implements DbService {
  private ready?: Promise<void>;
  private revisions = new Map<number, string>();
  constructor(private browser: DbService) {}

  public initialize() {
    if (!this.ready)
      this.ready = this.migrate().catch((error) => {
        this.ready = undefined;
        throw error;
      });
    return this.ready;
  }
  private async migrate() {
    const { data, error } = await this.browser.queryAll();
    if (error) throw new Error(error.message);
    if (!data?.length) return;
    const key = "ohmycv-file-library-client";
    let client = await localForage.getItem<string>(key);
    if (!client) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
        ""
      );
      client = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      await localForage.setItem(key, client);
    }
    await $fetch("/api/resume-library", {
      method: "POST",
      body: { action: "import", client, resumes: data },
      retry: false
    });
  }
  private async request<T>(action: () => Promise<T>): DbServiceResponse<T> {
    try {
      await this.initialize();
      return { data: await action(), error: null };
    } catch {
      return {
        data: null,
        error: {
          message:
            "File storage failed. Existing resumes are preserved; refresh and retry."
        }
      };
    }
  }
  private remember(resume: DbResume & { revision: string }) {
    this.revisions.set(resume.id, resume.revision);
    return resume;
  }
  public queryAll() {
    return this.request(async () =>
      (
        await $fetch<(DbResume & { revision: string })[]>("/api/resume-library", {
          cache: "no-store"
        })
      ).map((item) => this.remember(item))
    );
  }
  public queryById(id: number) {
    return this.request(async () => {
      try {
        return this.remember(
          await $fetch<DbResume & { revision: string }>("/api/resume-library", {
            query: { id },
            cache: "no-store"
          })
        );
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) return null;
        throw error;
      }
    });
  }
  public update(data: DbResumeUpdate) {
    return this.request(async () => {
      const revision = this.revisions.get(data.id);
      if (!revision) throw new Error("Load the resume before updating it");
      return this.remember(
        await $fetch<DbResume & { revision: string }>("/api/resume-library", {
          method: "PUT",
          body: { id: data.id, revision, resume: data },
          retry: false
        })
      );
    });
  }
  public create(data: DbResumeEmpty | DbResume) {
    return this.request(async () =>
      this.remember(
        await $fetch<DbResume & { revision: string }>("/api/resume-library", {
          method: "POST",
          body: { resume: data },
          retry: false
        })
      )
    );
  }
  public delete(id: number) {
    return this.request(() =>
      $fetch<DbResume>("/api/resume-library", {
        method: "DELETE",
        body: { id },
        retry: false
      })
    );
  }
}
