<template>
  <div
    class="resume-render"
    :id="`resume-${id}`"
    ref="target"
    :style="{
      '--resume-margin-top': `${margins.top}px`,
      '--resume-margin-left': `${styles.marginH}px`
    }"
  />
</template>

<script lang="ts" setup>
import DOMPurify from "dompurify";
import { layoutFieldKeys } from "~/utils/layoutSettings";
import { resolveResumeMargins } from "~/utils/resumeMargins";
import { useSmartPages } from "@ohmycv/vue-smart-pages";
import type { ResumeStyles } from "~/composables/stores/style";

const props = defineProps<{
  id: string | number;
  markdown: string;
  css?: string;
  styles: ResumeStyles;
}>();

const constant = useConstant();
const target = ref<HTMLElement>();

const size = computed(() => ({
  height: constant.PAPER.sizeToPx(props.styles.paper, "h"),
  width: constant.PAPER.SIZES[props.styles.paper].w
}));
const margins = computed(() => resolveResumeMargins(props.styles));
const html = computed(() => {
  const content = markdownService.renderResume(props.markdown);
  return import.meta.client ? DOMPurify.sanitize(content) : content;
});

const { render } = useSmartPages(target, html, size, margins, {
  beforeRender: async () => {
    // Wait for the fonts to be loaded
    await googleFontsService.presetObserver(props.styles);
  },
  watchThrottledOptions: {
    throttle: 200
  }
});

watchThrottled(
  () => [
    props.styles.lineHeight,
    props.styles.paragraphSpace,
    ...layoutFieldKeys.map((key) => props.styles[key]),
    props.styles.fontSize,
    props.css,
    props.styles.fontCJK,
    props.styles.fontEN
  ],
  render,
  {
    throttle: 200,
    leading: false
  }
);

defineExpose({
  render
});
</script>
