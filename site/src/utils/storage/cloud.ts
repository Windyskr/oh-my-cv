import type {
  DbService,
  DbResume,
  DbResumeEmpty,
  DbResumeUpdate,
  DbServiceResponse
} from "./db";
export class CloudResumeDbService implements DbService {
  private revisions = new Map<number, string>();
  private remember(resume: DbResume & { revision: string }) {
    this.revisions.set(resume.id, resume.revision);
    return resume;
  }
  private async request<T>(action: () => Promise<T>): DbServiceResponse<T> {
    try {
      return { data: await action(), error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message:
            (error as { data?: { error?: string } }).data?.error ||
            "云端请求失败，请稍后重试"
        }
      };
    }
  }
  public queryAll() {
    return this.request(async () => {
      const ids: number[] = [];
      let before: number | null = null;
      do {
        const result = await $fetch<{
          resumes: { id: number }[];
          nextCursor: number | null;
        }>("/api/v1/resumes", { query: before ? { before } : undefined });
        ids.push(...result.resumes.map((item) => item.id));
        before = result.nextCursor;
      } while (before);
      const resumes: DbResume[] = [];
      for (let index = 0; index < ids.length; index += 4) {
        resumes.push(
          ...(await Promise.all(
            ids
              .slice(index, index + 4)
              .map(async (id) =>
                this.remember(
                  await $fetch<DbResume & { revision: string }>(`/api/v1/resumes/${id}`)
                )
              )
          ))
        );
      }
      return resumes;
    });
  }
  public queryById(id: number) {
    return this.request(async () => {
      try {
        return this.remember(
          await $fetch<DbResume & { revision: string }>(`/api/v1/resumes/${id}`)
        );
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) return null;
        throw error;
      }
    });
  }
  public create(data: DbResumeEmpty | DbResume) {
    return this.request(async () =>
      this.remember(
        await $fetch<DbResume & { revision: string }>("/api/v1/resumes", {
          method: "POST",
          body: data,
          retry: false
        })
      )
    );
  }
  public update(data: DbResumeUpdate) {
    return this.request(async () => {
      const revision = this.revisions.get(data.id);
      if (!revision) throw new Error("Load the resume first");
      return this.remember(
        await $fetch<DbResume & { revision: string }>(`/api/v1/resumes/${data.id}`, {
          method: "PATCH",
          body: { ...data, revision },
          retry: false
        })
      );
    });
  }
  public delete(id: number) {
    return this.request(async () => {
      const current = this.remember(
        await $fetch<DbResume & { revision: string }>(`/api/v1/resumes/${id}`)
      );
      return $fetch<DbResume>(`/api/v1/resumes/${id}`, {
        method: "DELETE",
        headers: { "If-Match": `"${current.revision}"` },
        retry: false
      });
    });
  }
}
