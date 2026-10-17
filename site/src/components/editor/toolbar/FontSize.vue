<template>
  <EditorToolbarBox :text="$t('toolbar.font_size')" icon="i-ri:font-size-2">
    <SharedUiNumberField
      id="font-size-value"
      :label="$t('toolbar.layout.value')"
      :model-value="styles.fontSize"
      :min="8"
      :max="24"
      :step="0.1"
      @update:model-value="(value) => setStyle('fontSize', value)"
    />
    <SharedUiSlider
      unit="px"
      :model-value="[styles.fontSize]"
      :min="8"
      :max="24"
      :step="0.1"
      @update:model-value="update"
    />
  </EditorToolbarBox>
</template>
<script lang="ts" setup>
const { styles, setStyle } = useStyleStore();
const update = (value?: number[]) => {
  if (value?.[0] !== undefined) void setStyle("fontSize", value[0]);
};
</script>
