// Load editor features and only the two languages used by the resume editor.
import "monaco-editor/esm/vs/editor/editor.all.js";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution.js";
import "monaco-editor/esm/vs/language/css/monaco.contribution.js";

export * from "monaco-editor/esm/vs/editor/editor.api";
