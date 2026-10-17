<template>
  <div class="flex w-72 h-full">
    <div
      id="toolbar"
      class="pane-container overflow-y-scroll hide-scrollbar bg-background"
      lt-lg="bg-accent rounded-none"
    >
      <template v-for="(tool, i) in tools" :key="tool.id">
        <component :is="tool.component" :id="`toolbar-${tool.id}`" />
        <UiSeparator v-if="i < tools.length - 1" class="w-[calc(100%-32px)] mx-auto" />
      </template>
    </div>

    <div flex="center col none gap-1" border="l dashed lg:none" w-10 bg-accent>
      <template v-for="tool in tools" :key="tool.id">
        <UiTooltipProvider :delay-duration="0">
          <UiTooltip>
            <UiTooltipTrigger as-child>
              <UiButton
                size="round"
                variant="ghost-secondary"
                @click="scrollTo(tool.id)"
                :aria-label="getTooltip(tool.id)"
              >
                <span :class="[tool.icon, ' size-4']" />
              </UiButton>
            </UiTooltipTrigger>
            <UiTooltipContent side="left">
              {{ getTooltip(tool.id) }}
            </UiTooltipContent>
          </UiTooltip>
        </UiTooltipProvider>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  EditorToolbarFile,
  EditorToolbarPaper,
  EditorToolbarThemeColor,
  EditorToolbarFontFamily,
  EditorToolbarFontSize,
  EditorToolbarMargins,
  EditorToolbarParagraphSpace,
  EditorToolbarHeadingSpacing,
  EditorToolbarImagePosition,
  EditorToolbarHeaderLayout,
  EditorToolbarTextSpacing,
  EditorToolbarLineHeight,
  EditorToolbarCorrectCase
} from "#components";

const tools = [
  {
    id: "file",
    icon: "i-carbon:import-export",
    component: EditorToolbarFile
  },
  {
    id: "paper_size",
    icon: "i-majesticons:paper-fold-line",
    component: EditorToolbarPaper
  },
  {
    id: "theme_color",
    icon: "i-material-symbols:palette-outline",
    component: EditorToolbarThemeColor
  },
  {
    id: "font_family",
    icon: "i-material-symbols:font-download-outline",
    component: EditorToolbarFontFamily
  },
  {
    id: "font_size",
    icon: "i-ri:font-size-2",
    component: EditorToolbarFontSize
  },
  {
    id: "margins",
    icon: "i-radix-icons:margin",
    component: EditorToolbarMargins
  },
  {
    id: "header_layout",
    icon: "i-lucide:contact",
    component: EditorToolbarHeaderLayout
  },
  {
    id: "image_position",
    icon: "i-lucide:move",
    component: EditorToolbarImagePosition
  },
  {
    id: "paragraph_spacing",
    icon: "i-icon-park-outline:paragraph-break-two",
    component: EditorToolbarParagraphSpace
  },
  {
    id: "heading_spacing",
    icon: "i-icon-park-outline:paragraph-break-two",
    component: EditorToolbarHeadingSpacing
  },
  {
    id: "line_height",
    icon: "i-ic:round-format-line-spacing",
    component: EditorToolbarLineHeight
  },
  {
    id: "text_spacing",
    icon: "i-lucide:list",
    component: EditorToolbarTextSpacing
  },
  {
    id: "correct_case",
    icon: "i-icon-park-outline:check-correct",
    component: EditorToolbarCorrectCase
  }
];

const scrollTo = (id: string) => {
  const toolbar = document.querySelector<HTMLElement>("#toolbar");
  const section = document.querySelector<HTMLElement>(`#toolbar-${id}`);

  if (!toolbar || !section) return;

  toolbar.scrollTo({
    // offsetTop - header height
    top: section.offsetTop - 48,
    behavior: "smooth"
  });
};

const { t } = useI18n();

const getTooltip = (id: string) => {
  const key = `toolbar.${id}`;
  return [
    "file",
    "correct_case",
    "font_family",
    "margins",
    "heading_spacing",
    "image_position",
    "header_layout",
    "text_spacing"
  ].includes(id)
    ? t(`${key}.title`)
    : t(key);
};
</script>
