<template>
  <div class="flex items-center justify-between gap-2">
    <label :for="id" class="text-xs">{{ label }}</label>
    <div class="flex items-center gap-1.5 shrink-0">
      <input
        :id="id"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        class="h-8 w-18 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
        @input="update"
        @blur="restore"
      />
      <span v-if="unit" class="min-w-3 text-xs text-muted-foreground">{{ unit }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
  }>(),
  { step: 0.1, unit: "px", disabled: false }
);
const emit = defineEmits<{ (event: "update:modelValue", value: number): void }>();
const update = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.value === "") return;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return;
  const decimals = String(props.step).split(".")[1]?.length || 0;
  const normalized = Number(
    Math.min(props.max, Math.max(props.min, value)).toFixed(decimals)
  );
  if (value !== normalized) input.value = String(normalized);
  emit("update:modelValue", normalized);
};
const restore = (event: FocusEvent) => {
  (event.target as HTMLInputElement).value = String(props.modelValue);
};
</script>
