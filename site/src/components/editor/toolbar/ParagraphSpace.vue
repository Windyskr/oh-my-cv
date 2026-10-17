<template>
  <EditorToolbarBox
    :text="$t('toolbar.paragraph_spacing')"
    icon="i-icon-park-outline:paragraph-break-two"
  >
    <SharedUiNumberField
      id="paragraph-space-value"
      :label="$t('toolbar.layout.value')"
      :model-value="styles.paragraphSpace"
      :min="0"
      :max="50"
      :step="0.1"
      @update:model-value="(value) => setStyle('paragraphSpace', value)"
    />
    <SharedUiSlider
      unit="px"
      :model-value="[styles.paragraphSpace]"
      :min="0"
      :max="50"
      :step="0.1"
      @update:model-value="update"
    />
  </EditorToolbarBox>
</template>
<script lang="ts" setup>
const { styles, setStyle } = useStyleStore();
const update = (value?: number[]) => {
  if (value?.[0] !== undefined) void setStyle("paragraphSpace", value[0]);
};
</script>
