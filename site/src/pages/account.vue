<template>
  <div>
    <SharedHeader />
    <main class="max-w-220 mx-auto p-5 space-y-8">
      <header class="flex justify-between items-center gap-3">
        <div>
          <h1 class="text-2xl font-bold">账户与 Agent API</h1>
          <p class="text-sm mt-2 text-muted-foreground">
            {{ auth.user.value?.display_name }} · 简历与历史记录保存在 Cloudflare 数据库
          </p>
        </div>
        <UiButton variant="outline" @click="logout">退出登录</UiButton>
      </header>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <p v-if="message" role="status" class="text-sm">{{ message }}</p>
      <section class="rounded-lg border p-5 space-y-4">
        <h2 class="text-lg font-semibold">创建 Agent API 令牌</h2>
        <p class="text-sm text-muted-foreground">
          令牌用于让 Agent
          读取或修改你的简历。可以限制权限、指定简历和有效期，并随时撤销。
        </p>
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="createToken">
          <div class="space-y-1">
            <label for="token-name" class="text-sm">用途名称</label
            ><UiInput
              id="token-name"
              v-model="tokenName"
              placeholder="例如：本地 Agent"
              maxlength="80"
              required
            />
          </div>
          <div class="space-y-1">
            <label for="token-scope" class="text-sm">权限</label
            ><select
              id="token-scope"
              v-model="tokenScope"
              class="h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="read-write">读取和修改</option>
              <option value="read">仅读取</option>
            </select>
          </div>
          <div class="space-y-1">
            <label for="token-resume" class="text-sm">可访问的简历</label
            ><select
              id="token-resume"
              v-model="tokenResume"
              class="h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="">我的全部简历</option>
              <option
                v-for="resume in resumes"
                :key="resume.id"
                :value="String(resume.id)"
              >
                {{ resume.name }} · {{ resume.id }}
              </option>
            </select>
          </div>
          <div class="space-y-1">
            <label for="token-days" class="text-sm">有效天数</label
            ><UiInput
              id="token-days"
              v-model="tokenDays"
              type="number"
              min="1"
              max="365"
              required
            />
          </div>
          <UiButton id="create-api-token" type="submit" :disabled="busy">{{
            busy ? "正在处理…" : "创建令牌"
          }}</UiButton>
        </form>
        <div v-if="newToken" class="rounded-md bg-muted p-3 space-y-2">
          <p class="text-sm font-medium">请复制保存，令牌只显示这一次。</p>
          <UiInput
            id="new-api-token"
            :model-value="newToken"
            :type="showToken ? 'text' : 'password'"
            readonly
            autocomplete="off"
          />
          <UiButton
            id="show-api-token"
            variant="ghost"
            size="sm"
            @click="showToken = !showToken"
            >{{ showToken ? "隐藏令牌" : "显示令牌" }}</UiButton
          >
          <UiButton
            id="copy-api-token"
            variant="outline"
            size="sm"
            @click="copy(newToken)"
            >复制 API 令牌</UiButton
          >
        </div>
        <div class="space-y-2">
          <div
            v-for="token in tokens"
            :key="token.id"
            class="rounded-md border p-3 flex justify-between gap-3 text-sm"
          >
            <div>
              <p class="font-medium">{{ token.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ token.scope === "read" ? "仅读取" : "读取和修改" }} ·
                {{ token.resume_id ? `简历 ${token.resume_id}` : "全部简历" }} ·
                {{
                  token.revoked_at
                    ? "已撤销"
                    : `到期：${new Date(token.expires_at).toLocaleDateString()}`
                }}
              </p>
            </div>
            <UiButton
              v-if="!token.revoked_at"
              variant="outline"
              size="sm"
              :disabled="busy"
              @click="revoke(token.id)"
              >撤销</UiButton
            >
          </div>
        </div>
      </section>
      <section class="rounded-lg border p-5 space-y-3">
        <h2 class="text-lg font-semibold">Agent 调用方式</h2>
        <p class="text-sm text-muted-foreground">
          先读取当前版本，再使用返回的 revision 修改。网页会自动读取 API 修改。
        </p>
        <pre
          class="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all"
          >{{ example }}</pre
        >
        <a
          :href="`${apiBase}/api/openapi.json`"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-primary underline"
          >查看 OpenAPI 接口文档</a
        >
      </section>
      <section class="rounded-lg border p-5 space-y-3">
        <h2 class="text-lg font-semibold">导入已有简历</h2>
        <p class="text-sm text-muted-foreground">
          支持原来的简历 JSON
          文件，以及包含本地历史记录的迁移备份。重复导入同一份备份会继续处理尚未完成的内容。
        </p>
        <input
          id="cloud-import-file"
          type="file"
          accept=".json,application/json"
          :disabled="busy"
          @change="importFile"
        /><UiButton
          id="import-browser-resumes"
          variant="outline"
          :disabled="busy"
          @click="importBrowser"
          >导入当前浏览器中的旧简历</UiButton
        >
        <p v-if="progress" role="status" class="text-sm">{{ progress }}</p>
      </section>
      <section class="rounded-lg border p-5 space-y-3">
        <h2 class="text-lg font-semibold">修改密码</h2>
        <form class="space-y-3" @submit.prevent="changePassword">
          <UiInput
            v-model="oldPassword"
            type="password"
            autocomplete="current-password"
            placeholder="当前密码"
            required
          /><UiInput
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            placeholder="新密码，12–128 个字符"
            minlength="12"
            maxlength="128"
            required
          /><UiButton variant="outline" type="submit" :disabled="busy"
            >修改密码并退出其他登录会话</UiButton
          >
        </form>
      </section>
    </main>
  </div>
</template>
<script setup lang="ts">
import type { DbResumeEmpty } from "~/utils/storage/db";
const auth = useCloudAuth();
const apiBase = ref("");
const error = ref("");
const message = ref("");
const busy = ref(false);
const progress = ref("");
const tokenName = ref("");
const tokenScope = ref("read-write");
const tokenResume = ref("");
const tokenDays = ref(30);
const newToken = ref("");
const showToken = ref(false);
const oldPassword = ref("");
const newPassword = ref("");
type Token = {
  id: string;
  name: string;
  scope: string;
  resume_id: number | null;
  expires_at: number;
  revoked_at: number | null;
};
const tokens = ref<Token[]>([]);
const resumes = ref<{ id: number; name: string }[]>([]);
const example = computed(
  () =>
    `export RESUME_API_TOKEN='你创建的 API 令牌'\n\ncurl '${apiBase.value}/api/v1/active-resume' \\\n  -H "Authorization: Bearer $RESUME_API_TOKEN"\n\ncurl '${apiBase.value}/api/v1/resumes/简历ID' \\\n  -H "Authorization: Bearer $RESUME_API_TOKEN"\n\ncurl -X PATCH '${apiBase.value}/api/v1/resumes/简历ID' \\\n  -H "Authorization: Bearer $RESUME_API_TOKEN" \\\n  -H 'Content-Type: application/json' \\\n  -H 'If-Match: "当前revision"' \\\n  --data '{"markdown":"修改后的完整 Markdown"}'`
);
const load = async () => {
  tokens.value = await $fetch<Token[]>("/api/v1/tokens");
  resumes.value = (
    await $fetch<{ resumes: { id: number; name: string }[] }>("/api/v1/resumes")
  ).resumes;
};
onMounted(async () => {
  apiBase.value = useRuntimeConfig().public.cloudApiBase || location.origin;
  try {
    await load();
  } catch {
    error.value = "读取账户信息失败，请重新登录后重试";
  }
});
const run = async (action: () => Promise<void>) => {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    await action();
  } catch (failure) {
    error.value =
      (failure as { data?: { error: string }; message?: string }).data?.error ||
      (failure as Error).message ||
      "请求失败，请重试";
  } finally {
    busy.value = false;
  }
};
const createToken = () =>
  run(async () => {
    const result = await $fetch<{ token: string }>("/api/v1/tokens", {
      method: "POST",
      body: {
        name: tokenName.value,
        scope: tokenScope.value,
        resumeId: tokenResume.value ? Number(tokenResume.value) : null,
        days: Number(tokenDays.value)
      },
      retry: false
    });
    showToken.value = false;
    newToken.value = result.token;
    tokenName.value = "";
    await load();
  });
const revoke = (id: string) =>
  run(async () => {
    await $fetch(`/api/v1/tokens/${id}`, { method: "DELETE", retry: false });
    await load();
    message.value = "令牌已撤销";
  });
const copy = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    message.value = "已复制";
  } catch {
    error.value = "无法自动复制，请点击“显示令牌”后手动复制";
  }
};
const logout = () =>
  run(async () => {
    newToken.value = "";
    await auth.logout();
  });
const changePassword = () =>
  run(async () => {
    await $fetch("/api/auth/password", {
      method: "PUT",
      body: { password: oldPassword.value, newPassword: newPassword.value },
      retry: false
    });
    oldPassword.value = "";
    newPassword.value = "";
    message.value = "密码已修改，其他登录会话已退出";
  });
const importBrowser = () =>
  run(async () => {
    const count = await storageService.importBrowserResumes();
    message.value = `已导入 ${count} 份简历`;
    await load();
  });
const importRequest = async <T,>(url: string, body: unknown): Promise<T> => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await $fetch<T>(url, { method: "POST", body, retry: false });
    } catch (failure) {
      if ((failure as { statusCode?: number }).statusCode !== 429 || attempt === 3)
        throw failure;
      progress.value = "请求较多，等待一分钟后继续导入…";
      await new Promise((resolve) => setTimeout(resolve, 61000));
    }
  }
  throw new Error("导入失败，请重新选择备份继续");
};
const importFile = (event: Event) =>
  run(async () => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (
      data.format === "ohmycv-cloud-backup" &&
      data.version === 1 &&
      Array.isArray(data.resumes)
    ) {
      let count = 0;
      const importedIds = new Map<string, number>();
      for (const item of data.resumes as {
        sourceId: string;
        deleted?: boolean;
        createdAt?: string;
        updatedAt?: string;
        resume: DbResumeEmpty;
        history: {
          id: string;
          createdAt: string;
          resume: DbResumeEmpty;
          source?: string;
          changes?: string[];
          restoredFrom?: string;
        }[];
      }[]) {
        progress.value = `正在导入简历 ${count + 1}/${data.resumes.length}…`;
        const saved = await importRequest<{ id: number }>("/api/v1/import", {
          sourceId: item.sourceId,
          resume: item.resume,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        });
        importedIds.set(item.sourceId, saved.id);
        let versions = 0;
        for (const version of item.history || []) {
          progress.value = `正在导入简历 ${count + 1}/${data.resumes.length} 的历史 ${++versions}/${item.history.length}…`;
          await importRequest(`/api/v1/resumes/${saved.id}/history/import`, {
            sourceId: version.id,
            resume: version.resume,
            createdAt: version.createdAt,
            source: version.source,
            changes: version.changes,
            restoredFrom: version.restoredFrom
          });
        }
        if (item.deleted) {
          try {
            const current = await $fetch<{ revision: string }>(
              `/api/v1/resumes/${saved.id}`
            );
            await $fetch(`/api/v1/resumes/${saved.id}`, {
              method: "DELETE",
              headers: { "If-Match": `"${current.revision}"` },
              retry: false
            });
          } catch (failure) {
            if ((failure as { statusCode?: number }).statusCode !== 404) throw failure;
          }
        }
        count++;
      }
      const activeId = importedIds.get(data.activeSourceId);
      if (activeId)
        await $fetch("/api/v1/active-resume", {
          method: "POST",
          body: { id: activeId },
          retry: false
        });
      message.value = `已导入 ${count} 份简历及历史记录`;
    } else {
      await storageService.importFromJson(JSON.stringify(data));
      message.value = "简历已导入";
    }
    progress.value = "";
    await load();
  });
</script>
