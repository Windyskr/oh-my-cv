<template>
  <EditorToolbarBox :text="$t('toolbar.margins.title')" icon="i-radix-icons:margin">
    <div v-for="(field, index) in fields" :key="field.key" :class="{ 'mt-4': index > 0 }">
      <SharedUiNumberField
        :id="`margin-${field.name}-value`"
        :label="$t(`toolbar.margins.${field.name}`)"
        :model-value="field.value"
        :min="0"
        :max="100"
        :step="0.1"
        @update:model-value="(value) => setStyle(field.key, value)"
      />
      <SharedUiSlider
        unit="px"
        :model-value="[field.value]"
        :min="0"
        :max="100"
        :step="0.1"
        @update:model-value="(value) => update(field.key, value)"
      />
    </div>
  </EditorToolbarBox>
</template>
<script lang="ts" setup>
import { resolveResumeMargins } from "~/utils/resumeMargins";

const { styles, setStyle } = useStyleStore();
type MarginKey = "marginTop" | "marginBottom" | "marginH";
const fields = computed(() => {
  const margins = resolveResumeMargins(styles);
  return [
    { key: "marginTop" as const, name: "top", value: margins.top },
    { key: "marginBottom" as const, name: "bottom", value: margins.bottom },
    { key: "marginH" as const, name: "horizontal", value: margins.left }
  ];
});
const update = (key: MarginKey, value?: number[]) => {
  if (value?.[0] !== undefined) void setStyle(key, value[0]);
};
</script>
