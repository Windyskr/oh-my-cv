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
      v-if="fileEditor"
      class="local-sync-status flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
      role="status"
    >
      <span>{{ fileEditor.saveStatus.value }}</span>
      <span
        v-if="fileEditor.state.value.filePath"
        class="text-xs text-muted-foreground break-all"
        >文件目录：{{ fileEditor.state.value.filePath }}</span
      >
      <UiButton
        v-if="fileEditor.state.value.conflict"
        variant="outline"
        size="sm"
        @click="fileEditor.useFiles"
        >{{
          useRuntimeConfig().public.cloudStorage ? "使用云端内容" : "使用文件内容"
        }}</UiButton
      >
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
import { removeCss } from "@ohmycv/dynamic-css";
import { isInteger } from "@renovamen/utils";

const route = useRoute();
const { data } = useDataStore();

definePageMeta({ key: (route) => route.path });
const fileEditor =
  (useRuntimeConfig().public.localFeatures || useRuntimeConfig().public.cloudStorage) &&
  isInteger(route.params.id, { allowString: true }) &&
  Number(route.params.id) > 0
    ? useFileResumeEditor(Number(route.params.id))
    : null;
// Static deployments keep browser storage; local deployments edit the same files as agents.
onMounted(() => {
  if (fileEditor) return;
  if (isInteger(route.params.id, { allowString: true })) {
    storageService.switchToResume(Number(route.params.id));
  }
});

onBeforeUnmount(() => {
  removeCss("ohmycv-css-editor-preview");
  removeCss("ohmycv-toolbar-preview");
});

// Toogle toolbar
const { width } = useWindowSize();
const isToolbarOpen = ref(width.value > 1024);
</script>

<style scoped>
@media print {
  .local-sync-status {
    display: none;
  }
}
</style>
