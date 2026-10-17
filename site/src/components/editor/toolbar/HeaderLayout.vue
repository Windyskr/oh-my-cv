<template>
  <EditorToolbarBox :text="$t('toolbar.header_layout.title')" icon="i-lucide:contact">
    <EditorToolbarLayoutFields
      :fields="[
        'nameFontSize',
        'contactFontSize',
        'headerTopGap',
        'headerMinHeight',
        'nameContactGap',
        'headerSectionGap'
      ]"
    />
  </EditorToolbarBox>
</template>
