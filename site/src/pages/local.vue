<template>
  <div id="editor-page" class="flex flex-col">
    <SharedHeader>
      <template #tail>
        <UiButton
          variant="ghost-secondary"
          size="round"
          @click="isToolbarOpen = !isToolbarOpen"
          :aria-label="isToolbarOpen ? $t('close_toolbar') : $t('open_toolbar')"
        >
          <span
            :class="[
              'size-4.5',
              isToolbarOpen
                ? 'i-tabler:layout-sidebar-right-collapse'
                : 'i-tabler:layout-sidebar-right-expand'
            ]"
          />
        </UiButton>
      </template>
    </SharedHeader>

    <div
      class="local-sync-status flex items-center gap-3 px-4 py-2 text-sm"
      role="status"
    >
      <span>{{ saveStatus }}</span>
      <UiButton v-if="state.conflict" variant="outline" size="sm" @click="useFiles">
        使用文件内容
      </UiButton>
    </div>
    <div class="workspace flex pb-2 min-h-0">
      <SplitterGroup id="splitter-editor" direction="horizontal" class="px-3">
        <SplitterPanel id="code-pane">
          <EditorCode v-if="data.loaded" />
          <div v-else class="flex flex-col gap-y-2 h-full">
            <UiSkeleton class="h-10 bg-secondary" />
            <UiSkeleton class="flex-1 bg-secondary" />
          </div>
        </SplitterPanel>

        <SplitterResizeHandle
          id="code-preview-handle"
          class="w-3 relative after:(content-[''] absolute bg-gray-400/40 w-1 h-10 rounded-full inset-0 m-auto)"
        />

        <SplitterPanel id="preview-pane">
          <EditorPreview v-if="data.loaded" />
          <UiSkeleton v-else class="size-full bg-secondary" />
        </SplitterPanel>
      </SplitterGroup>

      <div
        v-if="isToolbarOpen"
        id="tools-pane"
        lt-lg="fixed z-10 max-w-full h-full right-0 top-12 pb-10"
      >
        <EditorToolbar v-if="data.loaded" />
        <UiSkeleton v-else class="h-full w-62 bg-secondary mr-10" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { LocalResume } from "~/composables/localResume";
import { onBeforeRouteLeave } from "vue-router";

const { data, setData } = useDataStore();
const { state, content, dirty, matches, apply, save } = useLocalResume();
const { width } = useWindowSize();
const isToolbarOpen = ref(width.value > 1024);
let active = false;
let timer: ReturnType<typeof setTimeout>;
let saveTimer: ReturnType<typeof setTimeout>;
let retryDelay = 2000;

const saveStatus = computed(() => {
  if (state.value.conflict || state.value.failed) return state.value.message;
  if (state.value.applying) return "正在同步文件…";
  if (state.value.saving || dirty.value) return "正在自动保存…";
  return state.value.message;
});

const autoSave = async () => {
  if (!active || !dirty.value || state.value.applying || state.value.conflict) return;
  const saved = await save();
  if (saved) retryDelay = 2000;
  else if (active && dirty.value && state.value.failed && !state.value.conflict) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autoSave, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }
};

watch(
  [
    content,
    () => state.value.baseline,
    () => state.value.saving,
    () => state.value.applying,
    () => state.value.conflict
  ],
  () => {
    clearTimeout(saveTimer);
    if (
      active &&
      dirty.value &&
      !state.value.saving &&
      !state.value.applying &&
      !state.value.conflict
    ) {
      saveTimer = setTimeout(autoSave, state.value.failed ? retryDelay : 500);
    }
  },
  { flush: "post" }
);

const refresh = async () => {
  const startedRevision = state.value.revision;
  try {
    const resume = await $fetch<LocalResume>("/api/local-resume", { cache: "no-store" });
    if (
      !active ||
      state.value.saving ||
      state.value.applying ||
      startedRevision !== state.value.revision
    )
      return;
    if (resume.revision !== state.value.revision) {
      if (dirty.value && !matches(resume)) {
        state.value.conflict = true;
        state.value.message =
          "本地文件也有修改。请导出当前编辑备份，再选择使用文件内容。";
      } else {
        await apply(resume);
      }
    }
  } catch {
    if (active) state.value.message = "读取失败，正在重试；当前编辑内容仍然保留。";
  } finally {
    if (active) timer = setTimeout(refresh, 1000);
  }
};

const useFiles = async () => {
  if (dirty.value && !window.confirm("当前未保存的编辑将被文件内容替换。是否继续？"))
    return;
  try {
    const resume = await $fetch<LocalResume>("/api/local-resume", { cache: "no-store" });
    await apply(resume);
  } catch {
    state.value.message = "读取失败，请重试。";
  }
};

const beforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
};

const saveWhenHidden = () => {
  if (document.visibilityState === "hidden") {
    clearTimeout(saveTimer);
    void autoSave();
  }
};

onBeforeRouteLeave(async () => {
  clearTimeout(saveTimer);
  await save();
  if (dirty.value) return window.confirm("当前修改尚未保存。是否离开页面？");
});

onMounted(() => {
  setData("loaded", false);
  state.value.revision = "";
  state.value.baseline = "";
  state.value.conflict = false;
  state.value.failed = false;
  state.value.message = "正在读取本地简历…";
  active = true;
  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("visibilitychange", saveWhenHidden);
  refresh();
});

onBeforeUnmount(() => {
  active = false;
  clearTimeout(timer);
  clearTimeout(saveTimer);
  window.removeEventListener("beforeunload", beforeUnload);
  document.removeEventListener("visibilitychange", saveWhenHidden);
});
</script>

<style scoped>
@media print {
  .local-sync-status {
    display: none;
  }
}
</style>
