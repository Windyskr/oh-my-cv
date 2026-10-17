<template>
  <EditorToolbarBox
    :text="$t('toolbar.line_height')"
    icon="i-ic:round-format-line-spacing"
  >
    <SharedUiNumberField
      id="line-height-value"
      :label="$t('toolbar.layout.value')"
      :model-value="styles.lineHeight"
      :min="1"
      :max="3"
      :step="0.01"
      unit="×"
      @update:model-value="(value) => setStyle('lineHeight', value)"
    />
    <SharedUiSlider
      :model-value="[styles.lineHeight]"
      :min="1"
      :max="3"
      :step="0.01"
      @update:model-value="update"
    />
  </EditorToolbarBox>
</template>
<script lang="ts" setup>
const { styles, setStyle } = useStyleStore();
const update = (value?: number[]) => {
  if (value?.[0] !== undefined) void setStyle("lineHeight", value[0]);
};
</script>
