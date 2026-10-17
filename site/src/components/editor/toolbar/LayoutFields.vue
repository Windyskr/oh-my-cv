<template>
  <div class="space-y-3">
    <SharedUiNumberField
      v-for="key in fields"
      :key="key"
      :id="`layout-${key}`"
      :label="$t(layoutFields[key].label)"
      :model-value="effective(key)"
      :min="layoutFields[key].min"
      :max="layoutFields[key].max"
      :step="layoutFields[key].step"
      :unit="layoutFields[key].unit"
      :disabled="disabled"
      @update:model-value="(value) => setStyle(key, value)"
    />
    <UiButton
      v-if="showReset"
      variant="ghost"
      size="sm"
      class="w-full"
      :disabled="disabled"
      @click="reset"
    >
      {{ resetText || $t("toolbar.layout.reset") }}
    </UiButton>
  </div>
</template>

<script lang="ts" setup>
import { useMutationObserver, useResizeObserver } from "@vueuse/core";
import {
  layoutFields,
  measureLayoutField,
  type LayoutFieldKey
} from "~/utils/layoutSettings";
const props = withDefaults(
  defineProps<{
    fields: readonly LayoutFieldKey[];
    disabled?: boolean;
    showReset?: boolean;
    resetText?: string;
  }>(),
  { disabled: false, showReset: true, resetText: "" }
);
const { styles, setStyle } = useStyleStore();
const target = shallowRef<HTMLElement | null>(null);
const measured = reactive<Partial<Record<LayoutFieldKey, number>>>({});
const measure = () => {
  for (const key of props.fields) measured[key] = measureLayoutField(target.value, key);
};
const effective = (key: LayoutFieldKey) =>
  styles[key] ?? measured[key] ?? layoutFields[key].fallback;
const reset = async () => {
  for (const key of props.fields) await setStyle(key, undefined);
  measure();
};
useMutationObserver(target, measure, { childList: true, subtree: true });
useResizeObserver(target, measure);
onMounted(() => {
  target.value = document.querySelector("#resume-preview");
  measure();
});
</script>
