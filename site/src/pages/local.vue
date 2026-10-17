<template><p class="p-4">正在打开简历…</p></template>
<script setup lang="ts">
definePageMeta({
  middleware: async () => {
    const localePath = useLocalePath();
    try {
      await $fetch("/api/resume-library", { query: { id: 1 } });
      return navigateTo(localePath("/editor/1"), { replace: true });
    } catch {
      return navigateTo(localePath("/dashboard"), { replace: true });
    }
  }
});
</script>
