<template>
  <EditorToolbarBox :text="$t('toolbar.margins.title')" icon="i-radix-icons:margin">
    <SharedUiNumberField
      id="margin-vertical-value"
      :label="$t('toolbar.margins.vertical')"
      :model-value="styles.marginV"
      :min="0"
      :max="100"
      :step="0.1"
      @update:model-value="(value) => setStyle('marginV', value)"
    />
    <SharedUiSlider
      unit="px"
      :model-value="[styles.marginV]"
      :min="0"
      :max="100"
      :step="0.1"
      @update:model-value="(value) => update('marginV', value)"
    />
    <div class="mt-4">
      <SharedUiNumberField
        id="margin-horizontal-value"
        :label="$t('toolbar.margins.horizontal')"
        :model-value="styles.marginH"
        :min="0"
        :max="100"
        :step="0.1"
        @update:model-value="(value) => setStyle('marginH', value)"
      />
      <SharedUiSlider
        unit="px"
        :model-value="[styles.marginH]"
        :min="0"
        :max="100"
        :step="0.1"
        @update:model-value="(value) => update('marginH', value)"
      />
    </div>
  </EditorToolbarBox>
</template>
<script lang="ts" setup>
const { styles, setStyle } = useStyleStore();
const update = (key: "marginV" | "marginH", value?: number[]) => {
  if (value?.[0] !== undefined) void setStyle(key, value[0]);
};
</script>
