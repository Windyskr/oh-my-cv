export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || !useRuntimeConfig().public.cloudStorage) return;
  if (!/\/(dashboard|editor(?:\/|$)|account(?:\/|$))/.test(to.path)) return;
  const auth = useCloudAuth();
  if (!(await auth.load(true)))
    return navigateTo({ path: useLocalePath()("/login"), query: { next: to.fullPath } });
});
