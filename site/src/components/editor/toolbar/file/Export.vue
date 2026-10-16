<template>
  <UiTooltipProvider :delay-duration="0">
    <UiTooltip>
      <UiTooltipTrigger as-child>
        <UiButton
          class="gap-x-1.5 w-full h-8 justify-start"
          variant="ghost"
          size="sm"
          :disabled="exporting"
          @click="exportPDF"
        >
          <span i-mdi:file-pdf text-base />
          {{ exporting ? "正在生成 PDF…" : $t("toolbar.file.export_pdf.title") }}
        </UiButton>
      </UiTooltipTrigger>
      <UiTooltipContent
        v-if="!backendExport"
        side="bottom"
        class="w-54 p-0 rounded border-destructive/60"
      >
        <UiAlert variant="destructive" class="border-none rounded-none">
          <UiAlertTitle>
            {{ $t("toolbar.file.export_pdf.alert.title") }}
            <span class="text-foreground font-normal text-xs">
              (<SharedIssueLink issue="13" />, <SharedIssueLink issue="16" />)
            </span>
          </UiAlertTitle>
          <UiAlertDescription>
            <div v-html="$t('toolbar.file.export_pdf.alert.content')" />
          </UiAlertDescription>
        </UiAlert>
      </UiTooltipContent>
    </UiTooltip>
  </UiTooltipProvider>

  <p v-if="exportError" class="px-2 py-1 text-xs text-destructive" role="alert">
    {{ exportError }}
  </p>

  <UiButton
    class="gap-x-1.5 w-full h-8 justify-start"
    variant="ghost"
    size="sm"
    @click="exportMd"
  >
    <span i-ri:markdown-fill text-base />
    {{ $t("toolbar.file.export_md") }}
  </UiButton>
</template>

<script lang="ts" setup>
import { downloadFile } from "@renovamen/utils";

const { data } = useDataStore();
const { styles } = useStyleStore();
const backendExport = useRuntimeConfig().public.localFeatures;
const exporting = ref(false);
const exportError = ref("");
const saveName = computed(() => data.resumeName.trim().replace(/\s+/g, "_"));

// Export as PDF
const exportPDF = async () => {
  if (!backendExport) {
    const title = document.title;
    document.title = saveName.value;
    window.print();
    document.title = title;
    return;
  }
  if (exporting.value) return;
  exporting.value = true;
  exportError.value = "";
  try {
    const pdf = await $fetch<Blob>("/api/export-pdf", {
      method: "POST",
      responseType: "blob",
      timeout: 150000,
      body: {
        name: data.resumeName,
        markdown: data.markdown,
        css: data.css,
        styles: toRaw(styles)
      }
    });
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${saveName.value || "resume"}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    exportError.value = "PDF 生成失败，请稍后重试或查看本地服务日志。";
  } finally {
    exporting.value = false;
  }
};

// Export as Markdown
const exportMd = () => {
  downloadFile(`${saveName.value}.md`, data.markdown);
};
</script>
