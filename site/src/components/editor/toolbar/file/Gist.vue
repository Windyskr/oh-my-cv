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
      <fieldset :disabled="busy" class="space-y-6 min-w-0">
        <section class="space-y-3" aria-labelledby="gist-token-title">
          <h3 id="gist-token-title" class="flex items-center gap-2 text-sm font-semibold">
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >1</span
            >
            {{ $t("gist.access_title") }}
          </h3>
          <div class="rounded-md bg-muted p-3 space-y-2 text-sm">
            <a
              class="text-primary underline font-medium"
              href="https://github.com/settings/tokens/new?scopes=gist&description=Oh%20My%20CV"
              target="_blank"
              rel="noopener noreferrer"
              >{{ $t("gist.create_token") }} ↗</a
            >
            <ol class="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
              <li>{{ $t("gist.token_step_name") }}</li>
              <li>{{ $t("gist.token_step_scope") }}</li>
              <li>{{ $t("gist.token_step_copy") }}</li>
            </ol>
          </div>
          <div class="space-y-2">
            <label for="gist-token" class="text-sm font-medium">{{
              $t("gist.token_label")
            }}</label>
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
              >
                <span :class="showToken ? 'i-lucide:eye-off' : 'i-lucide:eye'" />
              </UiButton>
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input id="gist-remember" v-model="remember" type="checkbox" />{{
              $t("gist.remember")
            }}
          </label>
          <p class="text-xs text-muted-foreground">
            {{ $t(remember ? "gist.token_persistent" : "gist.token_session") }}
          </p>
          <details class="text-xs text-muted-foreground">
            <summary class="cursor-pointer">{{ $t("gist.other_token") }}</summary>
            <p class="mt-2">{{ $t("gist.token_help") }}</p>
          </details>
        </section>
        <section class="space-y-3" aria-labelledby="gist-address-title">
          <h3
            id="gist-address-title"
            class="flex items-center gap-2 text-sm font-semibold"
          >
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >2</span
            >
            {{ $t("gist.location_title") }}
          </h3>
          <div class="text-xs text-muted-foreground space-y-1.5">
            <p>
              <strong class="text-foreground">{{ $t("gist.first_device") }}</strong>
              {{ $t("gist.first_device_help") }}
            </p>
            <p>
              <strong class="text-foreground">{{ $t("gist.another_device") }}</strong>
              {{ $t("gist.another_device_help") }}
            </p>
          </div>
          <div class="space-y-2">
            <label for="gist-id" class="text-sm font-medium">{{
              $t("gist.address")
            }}</label>
            <div class="flex gap-2">
              <UiInput
                id="gist-id"
                v-model="gistId"
                :placeholder="$t('gist.address_placeholder')"
                autocomplete="off"
                spellcheck="false"
                :aria-invalid="!!addressError"
                aria-describedby="gist-address-status"
              />
              <UiButton
                v-if="syncUrl"
                id="gist-copy-address"
                variant="outline"
                class="shrink-0"
                @click="copyAddress"
                >{{ $t(copied ? "gist.copied" : "gist.copy_address") }}</UiButton
              >
            </div>
            <p
              id="gist-address-status"
              class="text-xs"
              :class="addressError ? 'text-destructive' : 'text-muted-foreground'"
            >
              {{ addressError || $t(syncUrl ? "gist.target_set" : "gist.target_new") }}
            </p>
          </div>
        </section>
        <section class="space-y-3" aria-labelledby="gist-action-title">
          <h3
            id="gist-action-title"
            class="flex items-center gap-2 text-sm font-semibold"
          >
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >3</span
            >
            {{ $t("gist.action_title") }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <p v-if="!token.trim()" class="text-xs text-muted-foreground">
                {{ $t("gist.upload_needs_token") }}
              </p>
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
              <p v-if="!syncUrl" class="text-xs text-muted-foreground">
                {{ $t("gist.download_needs_address") }}
              </p>
            </div>
          </div>
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
const showToken = ref(false);
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
const copyAddress = async () => {
  try {
    await navigator.clipboard.writeText(syncUrl.value);
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
  }
};

const forget = () => {
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
