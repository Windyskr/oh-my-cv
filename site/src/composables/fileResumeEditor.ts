import type { LocalResume } from "./localResume";
import { onBeforeRouteLeave } from "vue-router";
import { toast } from "vue-sonner";

export const useFileResumeEditor = (id: number) => {
  const { setData } = useDataStore();
  const { state, content, dirty, matches, apply, save, endpoint } = useLocalResume();
  const cloud = useRuntimeConfig().public.cloudStorage;
  let active = false;
  let timer: ReturnType<typeof setTimeout>;
  let saveTimer: ReturnType<typeof setTimeout>;
  let retryDelay = 2000;

  const saveStatus = computed(() => {
    if (state.value.restoring) return "正在恢复历史版本…";
    if (state.value.conflict || state.value.failed) return state.value.message;
    if (state.value.applying) return "正在同步文件…";
    if (state.value.saving || dirty.value) return "正在自动保存…";
    return state.value.message;
  });

  const autoSave = async () => {
    if (!active || !dirty.value || state.value.applying || state.value.conflict) return;
    const saved = await save();
    if (saved) retryDelay = 2000;
    else if (active && dirty.value && state.value.failed && !state.value.conflict) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(autoSave, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    }
  };

  watch(
    [
      content,
      () => state.value.baseline,
      () => state.value.saving,
      () => state.value.applying,
      () => state.value.conflict
    ],
    () => {
      clearTimeout(saveTimer);
      if (
        active &&
        dirty.value &&
        !state.value.saving &&
        !state.value.applying &&
        !state.value.conflict
      ) {
        saveTimer = setTimeout(autoSave, state.value.failed ? retryDelay : 500);
      }
    },
    { flush: "post" }
  );

  const refresh = async () => {
    const startedRevision = state.value.revision;
    try {
      const response = await $fetch.raw<LocalResume>(endpoint(), {
        cache: "no-store",
        headers:
          cloud && startedRevision
            ? { "If-None-Match": `"${startedRevision}"` }
            : undefined
      });
      if (response.status === 304) return;
      const resume = response._data!;
      if (
        !active ||
        state.value.saving ||
        state.value.applying ||
        startedRevision !== state.value.revision
      )
        return;
      if (resume.revision !== state.value.revision) {
        if (dirty.value && !matches(resume)) {
          state.value.conflict = true;
          state.value.message = cloud
            ? "云端内容已有新修改，请保存备份后选择使用云端内容。"
            : "本地文件也有修改。请导出当前编辑备份，再选择使用文件内容。";
        } else {
          await apply(resume);
        }
      }
    } catch (failure) {
      const status = (failure as { statusCode?: number }).statusCode;
      if (cloud && active && !state.value.baseline && status === 404) {
        toast.error("未找到该简历，请从列表重新打开");
        await navigateTo(useLocalePath()("/dashboard"));
        return;
      }
      if (active) state.value.message = "读取失败，正在重试；当前编辑内容仍然保留。";
    } finally {
      if (active) timer = setTimeout(refresh, 1000);
    }
  };

  const useFiles = async () => {
    if (dirty.value && !window.confirm("当前未保存的编辑将被文件内容替换。是否继续？"))
      return;
    try {
      const resume = await $fetch<LocalResume>(endpoint(), { cache: "no-store" });
      await apply(resume);
    } catch {
      state.value.message = "读取失败，请重试。";
    }
  };

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty.value) return;
    event.preventDefault();
    event.returnValue = "";
  };

  const markActive = () => {
    if (active && document.visibilityState === "visible")
      void $fetch(cloud ? "/api/v1/active-resume" : "/api/resume-library", {
        method: "POST",
        body: cloud ? { id } : { action: "activate", id },
        retry: false
      }).catch(() => {});
  };
  const saveWhenHidden = () => {
    if (document.visibilityState === "visible") markActive();
    if (document.visibilityState === "hidden") {
      clearTimeout(saveTimer);
      void autoSave();
    }
  };

  onBeforeRouteLeave(async () => {
    clearTimeout(saveTimer);
    await save();
    if (dirty.value) return window.confirm("当前修改尚未保存。是否离开页面？");
  });

  onMounted(async () => {
    setData("loaded", false);
    state.value.documentId = id;
    state.value.filePath = "";
    state.value.revision = "";
    state.value.baseline = "";
    state.value.conflict = false;
    state.value.failed = false;
    state.value.message = cloud ? "正在读取云端简历…" : "正在读取本地简历…";
    active = true;
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", saveWhenHidden);
    try {
      await storageService.initialize();
    } catch {
      state.value.message = "读取简历列表失败，请刷新重试。";
      return;
    }
    if (!active) return;
    markActive();
    refresh();
  });

  onBeforeUnmount(() => {
    active = false;
    clearTimeout(timer);
    clearTimeout(saveTimer);
    window.removeEventListener("beforeunload", beforeUnload);
    document.removeEventListener("visibilitychange", saveWhenHidden);
  });

  return { state, saveStatus, useFiles };
};
