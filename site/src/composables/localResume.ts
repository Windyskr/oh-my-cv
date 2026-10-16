import type { ResumeStyles } from "./stores/style";
import type { DbResumeEmpty } from "~/utils/storage/db";
import { until } from "@vueuse/core";

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
    applying: false,
    failed: false,
    conflict: false,
    message: "正在读取本地简历…"
  }));
  const snapshot = () => ({
    name: data.resumeName,
    markdown: data.markdown,
    css: data.css,
    styles: JSON.parse(JSON.stringify(styles)) as ResumeStyles
  });
  const serialize = ({ name, markdown, css, styles }: DbResumeEmpty) =>
    JSON.stringify({
      name,
      markdown,
      css,
      styles: {
        ...Object.fromEntries(
          Object.entries(styles).sort(([a], [b]) => a.localeCompare(b))
        ),
        fontEN: { name: styles.fontEN.name, fontFamily: styles.fontEN.fontFamily },
        fontCJK: { name: styles.fontCJK.name, fontFamily: styles.fontCJK.fontFamily }
      }
    });
  const content = computed(() => serialize(snapshot()));
  const dirty = computed(
    () => !!state.value.baseline && content.value !== state.value.baseline
  );
  const matches = (resume: DbResumeEmpty) => serialize(resume) === content.value;

  const apply = async (resume: LocalResume) => {
    state.value.applying = true;
    try {
      setData("resumeId", null);
      setData("resumeName", resume.name);
      setAndSyncToMonaco("markdown", resume.markdown);
      setAndSyncToMonaco("css", resume.css);
      for (const [key, value] of Object.entries(resume.styles)) {
        await setStyle(key as keyof ResumeStyles, value);
      }
      state.value.revision = resume.revision;
      state.value.baseline = serialize(resume);
      state.value.conflict = false;
      state.value.failed = false;
      state.value.message = "自动保存已开启";
      setData("loaded", true);
    } finally {
      state.value.applying = false;
    }
  };

  const save = async () => {
    while (state.value.saving) {
      await until(() => state.value.saving).toBe(false);
      if (state.value.failed || state.value.conflict) return false;
    }
    if (!dirty.value) return true;
    if (!state.value.revision || state.value.applying || state.value.conflict)
      return false;
    state.value.saving = true;
    state.value.failed = false;
    const submitted = snapshot();
    try {
      const saved = await $fetch<LocalResume>("/api/local-resume", {
        method: "PUT",
        timeout: 15000,
        retry: false,
        body: { ...submitted, revision: state.value.revision }
      });
      state.value.revision = saved.revision;
      state.value.baseline = serialize(submitted);
      state.value.conflict = false;
      state.value.message = "已保存到本地文件";
      return true;
    } catch (error) {
      const failure = error as { statusCode?: number; response?: { status: number } };
      if (failure.statusCode === 409 || failure.response?.status === 409) {
        state.value.conflict = true;
        state.value.message =
          "本地文件也有修改。请导出当前编辑备份，再选择使用文件内容。";
      } else {
        state.value.failed = true;
        state.value.message = "自动保存失败，正在重试；编辑内容仍然保留。";
      }
      return false;
    } finally {
      state.value.saving = false;
    }
  };

  return { state, content, dirty, matches, apply, save };
};
