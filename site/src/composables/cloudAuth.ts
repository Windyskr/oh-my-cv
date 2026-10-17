export type CloudUser = { id: string; username: string; display_name: string };
let pending: Promise<CloudUser | null> | undefined;
export const useCloudAuth = () => {
  const user = useState<CloudUser | null>("cloud-user", () => null);
  const loaded = useState("cloud-user-loaded", () => false);
  const load = async (force = false) => {
    if (loaded.value && !force) return user.value;
    if (pending) return pending;
    pending = $fetch<{ user: CloudUser }>("/api/auth/me", { retry: false })
      .then((result) => {
        user.value = result.user;
        loaded.value = true;
        return user.value;
      })
      .catch(() => {
        user.value = null;
        loaded.value = true;
        return null;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
  const signIn = async (username: string, password: string, register = false) => {
    const result = await $fetch<{ user: CloudUser }>(
      `/api/auth/${register ? "register" : "login"}`,
      { method: "POST", body: { username, password }, retry: false }
    );
    clearNuxtData("resume-list");
    user.value = result.user;
    loaded.value = true;
  };
  const logout = async () => {
    const local = useLocalResume();
    if (local.dirty.value && !(await local.save())) throw new Error("请先保存当前修改");
    await $fetch("/api/auth/logout", { method: "POST", retry: false });
    user.value = null;
    loaded.value = true;
    local.state.value.revision = "";
    local.state.value.baseline = "";
    local.state.value.documentId = null;
    local.state.value.filePath = "";
    const store = useDataStore();
    store.setData("loaded", false);
    store.setData("resumeId", null);
    store.setData("markdown", "");
    store.setData("css", "");
    store.setData("resumeName", "");
    clearNuxtData("resume-list");
    await navigateTo(useLocalePath()("/login"));
  };
  return { user, loaded, load, signIn, logout };
};
