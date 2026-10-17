<template>
  <main id="pdf-export-page" :style="historyId ? { zoom: previewScale } : undefined">
    <p v-if="renderError" role="alert">{{ renderError }}</p>
    <SharedResumeRender
      v-else-if="resume"
      ref="preview"
      id="preview"
      :markdown="resume.markdown"
      :css="resume.css"
      :styles="resume.styles"
    />
    <p v-else-if="historyId">{{ $t("history.loading") }}</p>
    <p v-else>请通过导出按钮或 pnpm export:pdf 生成 PDF。</p>
  </main>
</template>

<script lang="ts" setup>
import type { DbResumeEmpty } from "~/utils/storage/db";
import type { HistoryVersion } from "~/types/resumeHistory";

const route = useRoute();
const { t } = useI18n();
const historyId = computed(() =>
  typeof route.query.history === "string" ? route.query.history : ""
);
const resume = shallowRef<DbResumeEmpty>();
const preview = ref<{ render: () => Promise<void> }>();
const renderError = ref("");
const { width } = useWindowSize();
const { PAPER } = useConstant();
const previewScale = computed(() =>
  Math.min(
    1,
    Math.max(
      0.2,
      (width.value - 16) / PAPER.sizeToPx(resume.value?.styles.paper || "A4", "w")
    )
  )
);

onMounted(async () => {
  try {
    let snapshot = (window as unknown as { __RESUME_EXPORT__?: DbResumeEmpty })
      .__RESUME_EXPORT__;
    if (!snapshot && historyId.value) {
      const version = await $fetch<HistoryVersion>(
        `/api/local-resume/history/${encodeURIComponent(historyId.value)}`,
        { cache: "no-store" }
      );
      snapshot = version.resume;
    }
    if (!snapshot) return;
    document.documentElement.classList.remove("dark");
    document.title = snapshot.name;
    for (const font of [snapshot.styles.fontEN, snapshot.styles.fontCJK]) {
      await googleFontsService.resolve(font);
    }
    dynamicCssService.injectCssEditor(snapshot.css);
    dynamicCssService.injectToolbar(snapshot.styles);
    resume.value = snapshot;
    await nextTick();
    await preview.value!.render();
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.querySelectorAll<HTMLImageElement>("#resume-preview img")).map(
        async (image) => {
          if (!image.complete) await image.decode();
          if (!image.naturalWidth) throw new Error("A resume image could not be loaded");
        }
      )
    );
    // Repaginate after fonts and image dimensions are known.
    await preview.value!.render();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    document.documentElement.dataset.pdfReady = "true";
  } catch (error) {
    if (historyId.value) renderError.value = t("history.load_failed");
    document.documentElement.dataset.pdfError =
      error instanceof Error ? error.message : String(error);
  }
});
</script>

<style>
body:has(#pdf-export-page) {
  margin: 0;
  background: white;
}
#pdf-export-page #resume-preview {
  gap: 0;
}
@media print {
  #pdf-export-page {
    margin: 0;
    padding: 0;
  }
}
</style>
