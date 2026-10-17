<template>
  <UiDialog v-if="isLocal" :open="open" @update:open="setOpen">
    <UiDialogTrigger as-child>
      <UiButton
        id="open-resume-history"
        class="gap-x-1.5 w-full h-8 justify-start"
        variant="ghost"
        size="sm"
      >
        <span i-lucide:history text-base />{{ $t("history.trigger") }}
      </UiButton>
    </UiDialogTrigger>
    <UiDialogContent class="max-w-[min(1120px,95vw)] h-[85vh] flex flex-col">
      <UiDialogHeader>
        <UiDialogTitle>{{ $t("history.title") }}</UiDialogTitle>
        <UiDialogDescription>{{ $t("history.description") }}</UiDialogDescription>
      </UiDialogHeader>
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="text-muted-foreground">{{
          $t("history.total", { count: total })
        }}</span>
        <UiButton
          id="refresh-resume-history"
          variant="outline"
          size="sm"
          :disabled="loading || restoringVersion"
          @click="loadHistory(false)"
        >
          {{ $t("history.refresh") }}
        </UiButton>
      </div>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <div class="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 flex-1 min-h-0">
        <div
          class="overflow-y-auto max-h-40 md:max-h-none space-y-2 pr-1"
          :aria-label="$t('history.versions')"
        >
          <p v-if="loading && !versions.length" class="text-sm">
            {{ $t("history.loading") }}
          </p>
          <p v-else-if="!versions.length" class="text-sm text-muted-foreground">
            {{ $t("history.empty") }}
          </p>
          <button
            v-for="version in versions"
            :key="version.id"
            type="button"
            :data-history-id="version.id"
            :aria-pressed="selectedId === version.id"
            :disabled="loading || restoringVersion"
            class="w-full rounded-md border p-3 text-left text-sm hover:bg-accent disabled:opacity-50"
            :class="
              selectedId === version.id ? 'border-primary bg-accent' : 'border-border'
            "
            @click="selectVersion(version.id)"
          >
            <span class="block font-semibold">{{ formatDate(version.createdAt) }}</span>
            <span class="block mt-1 text-xs text-muted-foreground">
              {{ $t(`history.sources.${version.source}`) }}
              <span v-if="version.id === currentVersionId">
                · {{ $t("history.current") }}</span
              >
            </span>
            <span class="block mt-1 text-xs">{{
              version.changes.map((field) => $t(`history.fields.${field}`)).join(" · ")
            }}</span>
          </button>
          <UiButton
            v-if="nextBefore"
            class="w-full"
            variant="outline"
            size="sm"
            :disabled="loading || restoringVersion"
            @click="loadHistory(true)"
          >
            {{ $t("history.more") }}
          </UiButton>
        </div>
        <div class="flex flex-col min-h-0 min-w-0 gap-3">
          <div v-if="selectedVersion" class="flex items-center justify-between gap-2">
            <div class="min-w-0 text-sm">
              <p class="truncate font-semibold">{{ selectedVersion.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(selectedVersion.createdAt) }}
              </p>
            </div>
            <UiButton
              id="restore-resume-history"
              size="sm"
              :disabled="
                loading ||
                restoringVersion ||
                snapshotLoading ||
                selectedVersion.revision === currentRevision
              "
              @click="restore"
            >
              {{ restoringVersion ? $t("history.restoring") : $t("history.restore") }}
            </UiButton>
          </div>
          <div
            ref="previewPane"
            class="flex-1 min-h-0 overflow-auto rounded-md border bg-secondary p-3"
            :aria-label="$t('history.preview')"
          >
            <p v-if="snapshotLoading" class="text-sm">{{ $t("history.loading") }}</p>
            <iframe
              v-else-if="selectedVersion"
              :key="selectedVersion.id"
              id="history-version-preview"
              :src="previewUrl"
              :title="$t('history.preview')"
              class="w-full h-full min-h-80 border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>

<script lang="ts" setup>
import type { HistoryEntry, HistoryList, HistoryVersion } from "~/types/resumeHistory";

const { t, locale } = useI18n();
const { state, save, restoreHistory, isFileEditor, endpoint } = useLocalResume();
const isLocal = isFileEditor;
const open = ref(false);
const loading = ref(false);
const snapshotLoading = ref(false);
const restoringVersion = ref(false);
const error = ref("");
const versions = ref<HistoryEntry[]>([]);
const selectedId = ref("");
const selectedVersion = shallowRef<HistoryVersion>();
const currentRevision = ref("");
const currentVersionId = computed(
  () => versions.value.find((version) => version.revision === currentRevision.value)?.id
);
const total = ref(0);
const nextBefore = ref<string | null>(null);
const previewPane = ref<HTMLElement>();
const previewUrl = computed(() =>
  selectedVersion.value
    ? `/pdf-render?history=${selectedVersion.value.id}${state.value.documentId ? `&resumeId=${state.value.documentId}` : ""}`
    : ""
);
let selectionGeneration = 0;
let listGeneration = 0;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat(locale.value === "sp" ? "es" : locale.value, {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(date));

const clearPreview = () => {
  selectionGeneration++;
  selectedVersion.value = undefined;
};

const selectVersion = async (id: string) => {
  if (restoringVersion.value) return;
  const generation = ++selectionGeneration;
  selectedId.value = id;
  selectedVersion.value = undefined;
  snapshotLoading.value = true;
  error.value = "";
  try {
    const version = await $fetch<HistoryVersion>(endpoint(`/history/${id}`), {
      cache: "no-store"
    });
    if (!open.value || generation !== selectionGeneration) return;
    selectedVersion.value = version;
    if (previewPane.value) previewPane.value.scrollTop = 0;
  } catch {
    if (generation === selectionGeneration) error.value = t("history.load_failed");
  } finally {
    if (generation === selectionGeneration) snapshotLoading.value = false;
  }
};

const loadHistory = async (more = false) => {
  if (more && !nextBefore.value) return;
  const generation = ++listGeneration;
  loading.value = true;
  error.value = "";
  try {
    if (!more) await save();
    const result = await $fetch<HistoryList>(endpoint("/history"), {
      query: more ? { before: nextBefore.value! } : undefined,
      cache: "no-store"
    });
    if (!open.value || generation !== listGeneration) return;
    versions.value = more ? [...versions.value, ...result.versions] : result.versions;
    total.value = result.total;
    nextBefore.value = result.nextBefore;
    currentRevision.value = result.currentRevision;
    if (!more && result.versions.length) await selectVersion(result.versions[0].id);
  } catch {
    if (generation === listGeneration) error.value = t("history.load_failed");
  } finally {
    if (generation === listGeneration) loading.value = false;
  }
};

const setOpen = (value: boolean) => {
  if (restoringVersion.value) return;
  open.value = value;
  if (value) void loadHistory();
  else {
    listGeneration++;
    clearPreview();
  }
};

const restore = async () => {
  if (!selectedVersion.value || restoringVersion.value) return;
  restoringVersion.value = true;
  error.value = "";
  try {
    if (await restoreHistory(selectedVersion.value.id)) {
      restoringVersion.value = false;
      setOpen(false);
    } else {
      error.value = state.value.conflict
        ? t("history.conflict")
        : t("history.restore_failed");
    }
  } finally {
    restoringVersion.value = false;
  }
};

watch(
  () => state.value.revision,
  (revision) => {
    currentRevision.value = revision;
  }
);
onBeforeUnmount(() => {
  listGeneration++;
  clearPreview();
});
</script>
