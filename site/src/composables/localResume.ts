import type { ResumeStyles } from "./stores/style";
import type { DbResumeEmpty } from "~/utils/storage/db";

export type LocalResume = DbResumeEmpty & {
  revision: string;
};

export const useLocalResume = () => {
  const { data, setData, setAndSyncToMonaco } = useDataStore();
  const { styles, setStyle } = useStyleStore();
  const state = useState("local-resume-sync", () => ({
    revision: "",
    baseline: "",
    saving: false,
    conflict: false,
    message: "正在读取本地简历…"
  }));
  const snapshot = () => ({
    name: data.resumeName,
    markdown: data.markdown,
    css: data.css,
    styles: JSON.parse(JSON.stringify(styles)) as ResumeStyles
  });
  const dirty = computed(
    () => !!state.value.baseline && JSON.stringify(snapshot()) !== state.value.baseline
  );

  const apply = async (resume: LocalResume) => {
    setData("resumeId", null);
    setData("resumeName", resume.name);
    setAndSyncToMonaco("markdown", resume.markdown);
    setAndSyncToMonaco("css", resume.css);
    for (const [key, value] of Object.entries(resume.styles)) {
      await setStyle(key as keyof ResumeStyles, value);
    }
    state.value.revision = resume.revision;
    state.value.baseline = JSON.stringify(snapshot());
    state.value.conflict = false;
    state.value.message = "本地简历 · 文件修改后自动更新";
    setData("loaded", true);
  };

  const save = async () => {
    if (state.value.saving || !state.value.revision) return;
    state.value.saving = true;
    const submitted = snapshot();
    try {
      const saved = await $fetch<LocalResume>("/api/local-resume", {
        method: "PUT",
        body: { ...submitted, revision: state.value.revision }
      });
      state.value.revision = saved.revision;
      state.value.baseline = JSON.stringify(submitted);
      state.value.conflict = false;
      state.value.message = "已保存到本地文件";
    } catch (error) {
      const failure = error as { statusCode?: number; response?: { status: number } };
      if (failure.statusCode === 409 || failure.response?.status === 409) {
        state.value.conflict = true;
        state.value.message =
          "本地文件也有修改。请导出当前编辑备份，再选择使用文件内容。";
      } else {
        state.value.message = "保存失败，请重试。当前编辑内容仍然保留。";
      }
    } finally {
      state.value.saving = false;
    }
  };

  return { state, dirty, apply, save };
};
