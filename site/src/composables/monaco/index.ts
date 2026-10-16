import { isClient } from "@renovamen/utils";
import type * as Monaco from "monaco-editor";
import { setupMonacoModel, setupMonacoEditor, type MonacoModel } from "./setup";

type MonacoStates = {
  editor: Monaco.editor.IStandaloneCodeEditor;
  markdown: MonacoModel;
  css: MonacoModel;
};

const useMonacoState = () =>
  useState<MonacoStates | undefined>("monacoStates", shallowRef);

let imageFoldTimer: ReturnType<typeof setTimeout> | undefined;

export const useMonaco = () => {
  const states = useMonacoState();
  const loading = useState<boolean>("monacoLoading", () => false);

  const foldHeaderImages = () => {
    clearTimeout(imageFoldTimer);
    // Allow Monaco to recompute folding regions after a model change.
    imageFoldTimer = setTimeout(() => {
      const current = states.value;
      if (!current || current.editor.getModel() !== current.markdown.get()) return;
      const selectionLines = current.markdown
        .get()
        .getLinesContent()
        .flatMap((line, index) =>
          /<!--\s*#region\s+(?:university-logo|resume-photo)\b/.test(line) ? [index] : []
        );
      if (selectionLines.length) {
        current.editor.getAction("editor.fold")?.run({ selectionLines, levels: 1 });
      }
    }, 400);
  };

  const setup = async (container?: HTMLElement) => {
    if (!isClient || !container) return;

    loading.value = true;

    try {
      const { editor } = await setupMonacoEditor(container);
      const { data, setData } = useDataStore();

      // Markdown model
      const markdown = await setupMonacoModel("markdown", data.markdown, () =>
        setData("markdown", markdown.get().getValue())
      );

      // CSS model
      const css = await setupMonacoModel("css", data.css, () =>
        setData("css", css.get().getValue())
      );

      states.value = { editor, markdown, css };
    } catch (error) {
      // TODO: use toast to show error
      console.error("Failed to initialize the editor: ", error);
    } finally {
      loading.value = false;
    }
  };

  const dispose = () => {
    clearTimeout(imageFoldTimer);
    states.value?.editor.dispose();
    states.value?.markdown.dispose();
    states.value?.css.dispose();

    states.value = undefined;
    loading.value = false;
  };

  const activateModel = (model: "markdown" | "css") => {
    states.value?.editor.setModel(states.value[model].get());
    if (model === "markdown") foldHeaderImages();
  };

  const setContent = (model: "markdown" | "css", content: string) => {
    states.value?.[model].get().setValue(content);
    if (model === "markdown") foldHeaderImages();
  };

  return {
    setup,
    dispose,
    activateModel,
    setContent,
    loading
  };
};
