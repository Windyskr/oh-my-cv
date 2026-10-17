<template>
  <EditorToolbarBox :text="$t('toolbar.text_spacing.title')" icon="i-lucide:list">
    <EditorToolbarLayoutFields
      :fields="[
        'paragraphAfterGap',
        'listItemGap',
        'listIndent',
        'entryGap',
        'entryLineHeight'
      ]"
    />
  </EditorToolbarBox>
</template>
