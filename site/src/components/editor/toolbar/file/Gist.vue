<template>
  <UiDialog :open="open" @update:open="setOpen">
    <UiDialogTrigger as-child>
      <UiButton
        id="open-gist-sync"
        class="gap-x-1.5 w-full h-8 justify-start"
        variant="ghost"
        size="sm"
      >
        <span i-tabler:brand-github text-base />{{ $t("gist.title") }}
      </UiButton>
    </UiDialogTrigger>
    <UiDialogContent
      class="sm:max-w-160 max-h-[90vh] overflow-y-auto"
      @interact-outside="busy && $event.preventDefault()"
      @escape-key-down="busy && $event.preventDefault()"
    >
      <UiDialogHeader>
        <UiDialogTitle>{{ $t("gist.title") }}</UiDialogTitle>
        <UiDialogDescription>{{ $t("gist.description") }}</UiDialogDescription>
      </UiDialogHeader>
      <fieldset :disabled="busy" class="space-y-5 min-w-0">
        <div
          class="grid grid-cols-2 gap-2"
          role="group"
          :aria-label="$t('gist.setup_mode')"
        >
          <UiButton
            id="gist-mode-pat"
            :variant="mode === 'pat' ? 'default' : 'outline'"
            :aria-pressed="mode === 'pat'"
            @click="mode = 'pat'"
            >{{ $t("gist.mode_pat") }}</UiButton
          >
          <UiButton
            id="gist-mode-restore"
            :variant="mode === 'restore' ? 'default' : 'outline'"
            :aria-pressed="mode === 'restore'"
            @click="mode = 'restore'"
            >{{ $t("gist.mode_restore") }}</UiButton
          >
        </div>
        <div v-if="mode === 'pat'" class="space-y-3">
          <p class="text-sm text-muted-foreground">{{ $t("gist.pat_only_help") }}</p>
          <label for="gist-token" class="block text-sm font-medium">GitHub PAT</label>
          <div class="flex gap-2">
            <UiInput
              id="gist-token"
              v-model="token"
              :type="showToken ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              :placeholder="$t('gist.token_placeholder')"
            />
            <UiButton
              id="gist-toggle-token"
              variant="outline"
              size="icon"
              class="shrink-0"
              :aria-label="$t(showToken ? 'gist.hide_token' : 'gist.show_token')"
              :aria-pressed="showToken"
              @click="showToken = !showToken"
              ><span :class="showToken ? 'i-lucide:eye-off' : 'i-lucide:eye'"
            /></UiButton>
          </div>
          <details class="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <summary class="cursor-pointer font-medium text-foreground">
              {{ $t("gist.pat_help_title") }}
            </summary>
            <a
              class="block mt-3 text-primary underline"
              href="https://github.com/settings/tokens/new?scopes=gist&description=Oh%20My%20CV"
              target="_blank"
              rel="noopener noreferrer"
              >{{ $t("gist.create_token") }} ↗</a
            >
            <ol class="list-decimal pl-5 mt-2 space-y-1">
              <li>{{ $t("gist.token_step_name") }}</li>
              <li>{{ $t("gist.token_step_scope") }}</li>
              <li>{{ $t("gist.token_step_copy") }}</li>
            </ol>
          </details>
          <p v-if="syncUrl" class="text-xs text-muted-foreground break-all">
            {{ $t("gist.current_target") }} {{ syncUrl }}
          </p>
          <details class="text-xs text-muted-foreground">
            <summary class="cursor-pointer">{{ $t("gist.legacy_setup") }}</summary>
            <label for="gist-id" class="block mt-3 mb-2">{{ $t("gist.address") }}</label>
            <UiInput
              id="gist-id"
              v-model="gistId"
              :placeholder="$t('gist.address_placeholder')"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="!!addressError"
            />
            <p v-if="addressError" class="mt-2 text-destructive">{{ addressError }}</p>
          </details>
        </div>
        <div v-else class="space-y-3">
          <label for="gist-restore-code" class="block text-sm font-medium">{{
            $t("gist.restore_code_label")
          }}</label>
          <UiInput
            id="gist-restore-code"
            v-model="restoreCode"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="$t('gist.restore_code_placeholder')"
          />
          <p class="text-xs text-muted-foreground">{{ $t("gist.restore_code_help") }}</p>
          <UiButton
            id="gist-restore-config"
            class="w-full"
            :disabled="!restoreCode.trim()"
            @click="restoreConfiguration"
            >{{ $t("gist.restore_and_download") }}</UiButton
          >
        </div>
        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm"
            ><input id="gist-remember" v-model="remember" type="checkbox" />{{
              $t("gist.remember")
            }}</label
          >
          <p class="text-xs text-muted-foreground">
            {{ $t(remember ? "gist.token_persistent" : "gist.token_session") }}
          </p>
        </div>
        <div v-if="mode === 'pat'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="rounded-md border p-3 space-y-2">
            <p class="text-xs font-medium">{{ $t("gist.upload_direction") }}</p>
            <p class="text-xs text-muted-foreground">
              {{ $t(syncUrl ? "gist.upload_help" : "gist.create_help") }}
            </p>
            <UiButton
              id="gist-upload"
              class="w-full"
              :disabled="!token.trim() || !!addressError"
              @click="upload"
              >{{ $t(syncUrl ? "gist.upload" : "gist.create_upload") }}</UiButton
            >
          </div>
          <div class="rounded-md border p-3 space-y-2">
            <p class="text-xs font-medium">{{ $t("gist.download_direction") }}</p>
            <p class="text-xs text-muted-foreground">{{ $t("gist.download_help") }}</p>
            <UiButton
              id="gist-download"
              class="w-full"
              variant="outline"
              :disabled="!syncUrl"
              @click="download"
              >{{ $t("gist.download") }}</UiButton
            >
          </div>
        </div>
        <section
          v-if="syncCode"
          id="gist-sync-code-panel"
          class="rounded-md border bg-muted/50 p-3 space-y-3"
        >
          <h3 class="text-sm font-semibold">{{ $t("gist.backup_code_title") }}</h3>
          <p class="text-xs text-muted-foreground">{{ $t("gist.backup_code_help") }}</p>
          <div class="flex gap-2">
            <UiInput
              id="gist-sync-code"
              :model-value="syncCode"
              readonly
              :type="showSyncCode ? 'text' : 'password'"
              :aria-label="$t('gist.backup_code_title')"
              autocomplete="off"
              spellcheck="false"
            />
            <UiButton
              id="gist-toggle-sync-code"
              variant="outline"
              size="icon"
              class="shrink-0"
              :aria-label="
                $t(showSyncCode ? 'gist.hide_sync_code' : 'gist.show_sync_code')
              "
              :aria-pressed="showSyncCode"
              @click="showSyncCode = !showSyncCode"
              ><span :class="showSyncCode ? 'i-lucide:eye-off' : 'i-lucide:eye'"
            /></UiButton>
          </div>
          <UiButton
            id="gist-copy-sync-code"
            class="w-full"
            variant="outline"
            @click="copySyncCode"
            >{{ $t(copied ? "gist.copied" : "gist.copy_sync_code") }}</UiButton
          >
          <p class="text-xs text-muted-foreground">{{ $t("gist.sync_code_privacy") }}</p>
        </section>
        <details class="text-xs text-muted-foreground">
          <summary class="cursor-pointer">{{ $t("gist.sync_notes") }}</summary>
          <p class="mt-2">{{ $t("gist.secret_help") }}</p>
        </details>
        <UiButton id="gist-forget" variant="ghost" size="sm" @click="forget">{{
          $t("gist.forget")
        }}</UiButton>
      </fieldset>
      <p v-if="busy" role="status" class="text-sm">{{ $t("gist.working") }}</p>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <p v-if="message" role="status" class="text-sm">{{ message }}</p>
      <a
        v-if="gistLink"
        :href="gistLink"
        class="text-sm text-primary underline"
        target="_blank"
        rel="noopener noreferrer"
        >{{ $t("gist.open") }}</a
      >
      <div v-if="pending" class="rounded-md border p-3 space-y-3 text-sm">
        <p class="font-medium">{{ pending.resume.name }}</p>
        <p>{{ $t("gist.confirm_download") }}</p>
        <div class="flex gap-2">
          <UiButton id="gist-apply" :disabled="busy" @click="applyDownload">{{
            $t("gist.replace")
          }}</UiButton>
          <UiButton variant="outline" :disabled="busy" @click="pending = null">{{
            $t("gist.cancel")
          }}</UiButton>
        </div>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>

<script setup lang="ts">
import { GistError, downloadGist, getGist, parseGistId, uploadGist } from "~/utils/gist";
import { encodeGistSyncCode, decodeGistSyncCode } from "~/utils/gistSyncCode";
import type { DbResumeEmpty } from "~/utils/storage/db";
import { withOptionalLayoutStyles } from "~/utils/layoutSettings";

const { t } = useI18n();
const { data, setData, setAndSyncToMonaco } = useDataStore();
const { styles, setStyle } = useStyleStore();
const local = useLocalResume();
const isLocal = local.isFileEditor;
const open = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");
// Shared in-memory credentials survive closing this dialog, but not a page reload.
const token = useState("gist-token", () => "");
const gistId = useState("gist-id", () => "");
const remember = useState("gist-remember", () => false);
const gistLink = ref("");
const mode = ref<"pat" | "restore">("pat");
const restoreCode = ref("");
const showToken = ref(false);
const showSyncCode = ref(false);
const copied = ref(false);
const syncUrl = computed(() => {
  if (!gistId.value.trim()) return "";
  try {
    return `https://gist.github.com/${parseGistId(gistId.value)}`;
  } catch {
    return "";
  }
});
const addressError = computed(() =>
  gistId.value.trim() && !syncUrl.value ? t("gist.address_invalid") : ""
);
const syncCode = computed(() => {
  if (!token.value.trim() || !syncUrl.value) return "";
  try {
    return encodeGistSyncCode({ pat: token.value.trim(), gistId: gistId.value });
  } catch {
    return "";
  }
});
const copySyncCode = async () => {
  error.value = "";
  try {
    await navigator.clipboard.writeText(syncCode.value);
    copied.value = true;
  } catch {
    error.value = t("gist.errors.clipboard");
  }
};
const pending = ref<{ resume: DbResumeEmpty; id: string } | null>(null);
const storageKey = "ohmycv-gist-settings";

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (typeof saved.id === "string" && !gistId.value) gistId.value = saved.id;
    if (typeof saved.token === "string" && !token.value) {
      token.value = saved.token;
      remember.value = true;
    }
  } catch {
    // The dialog remains usable when browser storage is unavailable.
  }
});

watch([token, gistId, remember], () => {
  pending.value = null;
  gistLink.value = "";
  copied.value = false;
  error.value = "";
  message.value = "";
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        id: gistId.value,
        ...(remember.value && token.value ? { token: token.value } : {})
      })
    );
  } catch {
    error.value = t("gist.errors.storage");
  }
});

const setOpen = (value: boolean) => {
  if (busy.value) return;
  open.value = value;
  if (!value) {
    pending.value = null;
    showToken.value = false;
    showSyncCode.value = false;
    restoreCode.value = "";
  }
};

const forget = () => {
  mode.value = "pat";
  restoreCode.value = "";
  showSyncCode.value = false;
  showToken.value = false;
  remember.value = false;
  token.value = "";
  gistId.value = "";
  gistLink.value = "";
  pending.value = null;
  message.value = "";
  error.value = "";
};

const run = async (action: () => Promise<void>) => {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    await action();
  } catch (failure) {
    error.value = t(
      `gist.errors.${failure instanceof GistError ? failure.code : "request_failed"}`
    );
  } finally {
    busy.value = false;
  }
};

const snapshot = (): DbResumeEmpty =>
  JSON.parse(
    JSON.stringify({
      name: data.resumeName,
      markdown: data.markdown,
      css: data.css,
      styles
    })
  );

const upload = () =>
  run(async () => {
    pending.value = null;
    if (isLocal.value && !(await local.save())) throw new GistError("local_save");
    const id = gistId.value.trim() ? parseGistId(gistId.value) : "";
    if (id) {
      const existing = await getGist(token.value, id);
      if (
        !window.confirm(
          t(existing.public ? "gist.confirm_public_upload" : "gist.confirm_upload")
        )
      )
        return;
    }
    const gist = await uploadGist(token.value, id, snapshot());
    gistId.value = `https://gist.github.com/${gist.id}`;
    await nextTick();
    gistLink.value = `https://gist.github.com/${gist.id}`;
    message.value = t("gist.uploaded");
  });

const download = () =>
  run(async () => {
    pending.value = null;
    const { resume, gist } = await downloadGist(token.value, gistId.value);
    gistId.value = `https://gist.github.com/${gist.id}`;
    await nextTick();
    pending.value = { resume, id: gist.id };
    gistLink.value = `https://gist.github.com/${gist.id}`;
  });

const restoreConfiguration = async () => {
  if (busy.value) return;
  try {
    const credentials = decodeGistSyncCode(restoreCode.value);
    token.value = credentials.pat;
    gistId.value = `https://gist.github.com/${credentials.gistId}`;
    await nextTick();
    restoreCode.value = "";
    showToken.value = false;
    showSyncCode.value = false;
    mode.value = "pat";
    await download();
  } catch {
    error.value = t("gist.errors.invalid_sync_code");
  }
};

const applyDownload = () =>
  run(async () => {
    if (!pending.value) return;
    // IndexedDB cannot clone Vue proxies from the pending download ref.
    const resume: DbResumeEmpty = JSON.parse(JSON.stringify(pending.value.resume));
    if (isLocal.value) {
      if (!(await local.importResume(resume))) throw new GistError("local_save");
    } else {
      // Preserve the current document as a separate resume before replacing it.
      if (!data.resumeId) throw new GistError("local_save");
      const current = await storageService.updateResume({
        id: data.resumeId,
        ...snapshot()
      });
      if (!current || !(await storageService.duplicateResume(data.resumeId)))
        throw new GistError("local_save");
      const saved = await storageService.updateResume({ id: data.resumeId, ...resume });
      if (!saved) throw new GistError("local_save");
      setData("resumeName", resume.name);
      setAndSyncToMonaco("markdown", resume.markdown);
      setAndSyncToMonaco("css", resume.css);
      for (const [key, value] of Object.entries(
        withOptionalLayoutStyles(resume.styles)
      )) {
        await setStyle(key as keyof typeof styles, value);
      }
    }
    pending.value = null;
    message.value = t("gist.downloaded");
  });
</script>
