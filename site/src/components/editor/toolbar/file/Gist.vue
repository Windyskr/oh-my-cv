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
      class="sm:max-w-130 max-h-[90vh] overflow-y-auto"
      @interact-outside="busy && $event.preventDefault()"
      @escape-key-down="busy && $event.preventDefault()"
    >
      <UiDialogHeader>
        <UiDialogTitle>{{ $t("gist.title") }}</UiDialogTitle>
        <UiDialogDescription>{{ $t("gist.description") }}</UiDialogDescription>
      </UiDialogHeader>
      <fieldset :disabled="busy" class="space-y-4 min-w-0">
        <div class="space-y-2">
          <label for="gist-token" class="text-sm font-medium">GitHub Token</label>
          <UiInput
            id="gist-token"
            v-model="token"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="github_pat_… / ghp_…"
          />
          <a
            class="text-xs text-primary underline"
            href="https://github.com/settings/tokens/new?scopes=gist&description=Oh%20My%20CV"
            target="_blank"
            rel="noopener noreferrer"
            >{{ $t("gist.create_token") }}</a
          >
          <p class="text-xs text-muted-foreground">{{ $t("gist.token_help") }}</p>
          <label class="flex items-center gap-2 text-sm">
            <input id="gist-remember" v-model="remember" type="checkbox" />{{
              $t("gist.remember")
            }}
          </label>
        </div>
        <div class="space-y-2">
          <label for="gist-id" class="text-sm font-medium">{{
            $t("gist.address")
          }}</label>
          <UiInput
            id="gist-id"
            v-model="gistId"
            placeholder="https://gist.github.com/…"
            autocomplete="off"
            spellcheck="false"
          />
          <p class="text-xs text-muted-foreground">{{ $t("gist.address_help") }}</p>
        </div>
        <p class="text-xs text-muted-foreground">{{ $t("gist.secret_help") }}</p>
        <div class="flex flex-wrap gap-2">
          <UiButton id="gist-upload" :disabled="!token.trim()" @click="upload">{{
            $t("gist.upload")
          }}</UiButton>
          <UiButton
            id="gist-download"
            variant="outline"
            :disabled="!gistId.trim()"
            @click="download"
            >{{ $t("gist.download") }}</UiButton
          >
          <UiButton variant="ghost" @click="forget">{{ $t("gist.forget") }}</UiButton>
        </div>
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
import type { DbResumeEmpty } from "~/utils/storage/db";
import { withOptionalLayoutStyles } from "~/utils/layoutSettings";

const { t } = useI18n();
const route = useRoute();
const { data, setData, setAndSyncToMonaco } = useDataStore();
const { styles, setStyle } = useStyleStore();
const local = useLocalResume();
const isLocal = computed(() => route.path.replace(/\/$/, "").endsWith("/local"));
const open = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");
// Shared in-memory credentials survive closing this dialog, but not a page reload.
const token = useState("gist-token", () => "");
const gistId = useState("gist-id", () => "");
const remember = useState("gist-remember", () => false);
const gistLink = ref("");
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
  if (!value) pending.value = null;
};

const forget = () => {
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
    gistId.value = gist.id;
    await nextTick();
    gistLink.value = `https://gist.github.com/${gist.id}`;
    message.value = t("gist.uploaded");
  });

const download = () =>
  run(async () => {
    pending.value = null;
    const { resume, gist } = await downloadGist(token.value, gistId.value);
    pending.value = { resume, id: gist.id };
    gistLink.value = `https://gist.github.com/${gist.id}`;
  });

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
