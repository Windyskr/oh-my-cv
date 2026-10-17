<template>
  <EditorToolbarBox :text="$t('toolbar.image_position.title')" icon="i-lucide:move">
    <p class="mb-4 text-xs text-muted-foreground">
      {{ $t("toolbar.image_position.help") }}
    </p>
    <div class="space-y-5">
      <div v-for="image in images" :key="image.id" class="space-y-3">
        <h3 class="font-semibold">{{ $t(image.label) }}</h3>
        <p v-if="!present[image.id]" class="text-xs text-muted-foreground">
          {{ $t("toolbar.image_position.missing") }}
        </p>
        <div
          v-for="field in image.fields"
          :key="field.key"
          class="flex items-center justify-between gap-2"
        >
          <label :for="field.id" class="text-xs">{{ $t(field.label) }}</label>
          <div class="flex items-center gap-1.5 shrink-0">
            <input
              :id="field.id"
              type="number"
              min="-200"
              max="200"
              step="0.1"
              :disabled="!present[image.id]"
              :value="effective(field.key)"
              class="h-8 w-18 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
              @input="update(field.key, $event)"
              @blur="restoreInput(field.key, $event)"
            />
            <span class="text-xs text-muted-foreground">px</span>
          </div>
        </div>
        <EditorToolbarLayoutFields
          :fields="image.sizeFields"
          :disabled="!present[image.id]"
          :show-reset="false"
        />
        <UiButton
          variant="ghost"
          size="sm"
          class="w-full"
          :disabled="!present[image.id]"
          @click="reset(image)"
        >
          {{ $t("toolbar.image_position.reset") }}
        </UiButton>
      </div>
    </div>
  </EditorToolbarBox>
</template>

<script lang="ts" setup>
import { useMutationObserver, useResizeObserver } from "@vueuse/core";

type Offset = "photoOffsetX" | "photoOffsetY" | "logoOffsetX" | "logoOffsetY";
const { styles, setStyle } = useStyleStore();
const target = shallowRef<HTMLElement | null>(null);
const measured = reactive({
  photoOffsetX: 0,
  photoOffsetY: 0,
  logoOffsetX: 0,
  logoOffsetY: 0
});
const present = reactive({ photo: false, logo: false });
const images = [
  {
    id: "photo",
    selector: ".resume-photo",
    label: "toolbar.image_position.photo",
    sizeFields: ["photoWidth", "photoHeight"],
    fields: [
      {
        key: "photoOffsetX",
        id: "photo-offset-x",
        label: "toolbar.image_position.horizontal"
      },
      {
        key: "photoOffsetY",
        id: "photo-offset-y",
        label: "toolbar.image_position.vertical"
      }
    ]
  },
  {
    id: "logo",
    selector: ".university-logo",
    label: "toolbar.image_position.logo",
    sizeFields: ["logoWidth"],
    fields: [
      {
        key: "logoOffsetX",
        id: "logo-offset-x",
        label: "toolbar.image_position.horizontal"
      },
      {
        key: "logoOffsetY",
        id: "logo-offset-y",
        label: "toolbar.image_position.vertical"
      }
    ]
  }
] as const;
const effective = (key: Offset) => styles[key] ?? measured[key];
const round = (value: number) => Math.round(value * 10) / 10;

const measure = () => {
  for (const image of images) {
    const element = target.value?.querySelector(image.selector);
    const page = element?.closest('[data-scope="vue-smart-pages"][data-part="page"]');
    present[image.id] = !!element && !!page;
    if (!element || !page) continue;
    const pageStyle = getComputedStyle(page);
    const pageRect = page.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const width = parseFloat(pageStyle.width);
    const scale = pageRect.width / width;
    if (!(scale > 0)) continue;
    const left = (rect.left - pageRect.left) / scale;
    const top = (rect.top - pageRect.top) / scale;
    const anchorX =
      image.id === "photo"
        ? width - parseFloat(pageStyle.paddingRight) - rect.width / scale
        : parseFloat(pageStyle.paddingLeft);
    measured[image.fields[0].key] = round(left - anchorX);
    measured[image.fields[1].key] = round(top - parseFloat(pageStyle.paddingTop));
  }
};

const update = (key: Offset, event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.value === "") return;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return;
  const offset = round(Math.min(200, Math.max(-200, value)));
  if (value !== offset) input.value = String(offset);
  void setStyle(key, offset);
};

const restoreInput = (key: Offset, event: FocusEvent) => {
  (event.target as HTMLInputElement).value = String(effective(key));
};

const reset = async (image: (typeof images)[number]) => {
  for (const field of image.fields) await setStyle(field.key, undefined);
  for (const key of image.sizeFields) await setStyle(key, undefined);
  measure();
};

useMutationObserver(target, measure, { childList: true, subtree: true });
useResizeObserver(target, measure);
onMounted(() => {
  target.value = document.querySelector("#resume-preview");
  target.value?.addEventListener("load", measure, true);
  measure();
});
onBeforeUnmount(() => target.value?.removeEventListener("load", measure, true));
</script>
