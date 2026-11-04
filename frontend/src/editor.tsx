import { t as tr } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { api, errorText } from "./api";
import type { Tab } from "./types";
import * as monaco from "./monaco";
import * as php from "monaco-editor/languages/definitions/php/php.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker&inline";
import { requestPHPFormat } from "./formatter";
import { defaultFormatting, type FormattingRules } from "./formatting-rules";
const PHP_LANGUAGE = "tinkercraft-php";
let focusedEditor: any;
export function editorAction(action: string) {
  if (!focusedEditor) return;
  focusedEditor.focus();
  if (action !== "focus") focusedEditor.trigger("tinkercraft", action, {});
}
let loader: Promise<any> | undefined;
const models = new Map<string, any>();
const modelTabs = new Map<string, string>();
const viewStates = new Map<string, any>();
const modelRules = new Map<string, FormattingRules>();
const getLatestCode = (id: string) => models.get(id)?.getValue() ?? "";
const range = (r: any) =>
  r && {
    startLineNumber: r.start.line + 1,
    startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1,
    endColumn: r.end.character + 1,
  };
const documentation = (d: any) => ({
  value: typeof d === "string" ? d : (d?.value ?? ""),
  isTrusted: false,
  supportHtml: false,
});
function loadMonaco() {
  if (loader) return loader;
  loader = Promise.resolve().then(() => {
    window.MonacoEnvironment = { getWorker: () => new EditorWorker() };
    monaco.languages.register({ id: PHP_LANGUAGE, aliases: ["PHP"] });
    monaco.languages.setLanguageConfiguration(PHP_LANGUAGE, php.conf);
    monaco.languages.setMonarchTokensProvider(PHP_LANGUAGE, {
      ...php.language,
      start: "phpRoot",
    });
    monaco.languages.registerDocumentFormattingEditProvider(PHP_LANGUAGE, {
      async provideDocumentFormattingEdits(model, _options, token) {
        const version = model.getVersionId();
        try {
          const text = await requestPHPFormat(
            model.getValue(),
            modelRules.get(model.uri.toString()) ?? defaultFormatting,
            token,
          );
          if (
            text === undefined ||
            token.isCancellationRequested ||
            model.isDisposed() ||
            model.getVersionId() !== version
          )
            return [];
          return [{ range: model.getFullModelRange(), text }];
        } catch (error) {
          if (!token.isCancellationRequested)
            window.dispatchEvent(
              new CustomEvent("tinkercraft:format-error", {
                detail: tr("Could not format PHP: {0}", [errorText(error)]),
              }),
            );
          return [];
        }
      },
    });
    monaco.editor.defineTheme("tinkercraft", {
      base: "vs-dark",
      inherit: true,
      rules: [
        {
          token: "comment",
          foreground: "7D7D7D",
          fontStyle: "italic",
        },
        { token: "keyword", foreground: "F0A264" },
        { token: "string", foreground: "D6B98C" },
        { token: "number", foreground: "D8AB7F" },
        { token: "variable", foreground: "E2E2E2" },
        { token: "delimiter", foreground: "ADADAD" },
        { token: "type", foreground: "C8C8C8" },
      ],
      colors: {
        "editor.background": "#171717",
        "editor.foreground": "#E2E2E2",
        "editorLineNumber.foreground": "#666666",
        "editorLineNumber.activeForeground": "#B8B8B8",
        "editor.selectionBackground": "#503725",
        "editor.inactiveSelectionBackground": "#35302C",
        "editor.lineHighlightBackground": "#212121",
        "editorCursor.foreground": "#F59B51",
        "editorIndentGuide.background1": "#303030",
        "editorWidget.background": "#242424",
        "editorWidget.border": "#454545",
        "editorSuggestWidget.background": "#242424",
        "editorSuggestWidget.selectedBackground": "#513724",
        "editorHoverWidget.background": "#242424",
        focusBorder: "#F59B51",
        "scrollbarSlider.background": "#80808033",
        "scrollbarSlider.hoverBackground": "#80808066",
      },
    });
    const itemKind = (kind: number) =>
      ({
        1: 18,
        2: 0,
        3: 1,
        4: 2,
        5: 3,
        6: 4,
        7: 5,
        8: 7,
        9: 8,
        10: 9,
        12: 12,
        14: 17,
        15: 27,
        21: 14,
      })[kind] ?? 18;
    function completion(item: any, fallback: any) {
      const edit = item.textEdit;
      return {
        label: item.label,
        kind: itemKind(item.kind),
        detail:
          item.detail === "Variável local" || item.detail === "Local variable"
            ? tr("Local variable")
            : item.detail,
        documentation: documentation(item.documentation),
        insertText:
          edit?.newText ??
          item.insertText ??
          (typeof item.label === "string" ? item.label : item.label.label),
        insertTextRules:
          item.insertTextFormat === 2
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
        range: range(edit?.range ?? edit?.replace) ?? fallback,
        filterText: item.filterText,
        sortText: item.sortText,
        additionalTextEdits: item.additionalTextEdits?.map((e: any) => ({
          range: range(e.range),
          text: e.newText,
        })),
        _lsp: item,
      };
    }
    monaco.languages.registerCompletionItemProvider(PHP_LANGUAGE, {
      triggerCharacters: [">", ":", "$", "\\"],
      async provideCompletionItems(
        model: any,
        position: any,
        _ctx: any,
        cancellation: any,
      ) {
        const id = modelTabs.get(model.uri.toString());
        if (!id) return { suggestions: [] };
        const version = model.getVersionId();
        const word = model.getWordUntilPosition(position);
        const startsWithDollar =
          model.getLineContent(position.lineNumber)[word.startColumn - 1] ===
          "$";
        const fallback = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn + (startsWithDollar ? 1 : 0),
          endColumn: word.endColumn,
        };
        try {
          const response = await api.LanguageRequest(
            id,
            "textDocument/completion",
            getLatestCode(id),
            position.lineNumber - 1,
            position.column - 1,
          );
          if (
            cancellation.isCancellationRequested ||
            model.isDisposed() ||
            version !== model.getVersionId()
          )
            return { suggestions: [] };
          return {
            suggestions: (Array.isArray(response)
              ? response
              : (response?.items ?? [])
            ).map((item: any) => ({
              ...completion(item, fallback),
              _tabId: id,
            })),
            incomplete: response?.isIncomplete ?? false,
          };
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("tinkercraft:language-error", {
              detail: { id, message: errorText(error) },
            }),
          );
          return { suggestions: [] };
        }
      },
      async resolveCompletionItem(item: any) {
        const id = item._tabId;
        if (!id || !item._lsp?.data) return item;
        try {
          const resolved = await api.ResolveCompletion(id, item._lsp);
          return resolved
            ? { ...item, ...completion(resolved, item.range) }
            : item;
        } catch {
          return item;
        }
      },
    });
    monaco.languages.registerHoverProvider(PHP_LANGUAGE, {
      async provideHover(model: any, position: any) {
        const id = modelTabs.get(model.uri.toString());
        if (!id) return null;
        try {
          const response = await api.LanguageRequest(
            id,
            "textDocument/hover",
            getLatestCode(id),
            position.lineNumber - 1,
            position.column - 1,
          );
          if (!response?.contents) return null;
          const contents = Array.isArray(response.contents)
            ? response.contents
            : [response.contents];
          return {
            range: range(response.range),
            contents: contents.map((d: any) =>
              d.language
                ? documentation(`\`\`\`${d.language}\n${d.value}\n\`\`\``)
                : documentation(d),
            ),
          };
        } catch {
          return null;
        }
      },
    });
    monaco.languages.registerSignatureHelpProvider(PHP_LANGUAGE, {
      signatureHelpTriggerCharacters: ["(", ","],
      async provideSignatureHelp(model: any, position: any) {
        const id = modelTabs.get(model.uri.toString());
        if (!id) return null;
        try {
          const response = await api.LanguageRequest(
            id,
            "textDocument/signatureHelp",
            getLatestCode(id),
            position.lineNumber - 1,
            position.column - 1,
          );
          if (!response?.signatures) return null;
          return {
            value: {
              ...response,
              signatures: response.signatures.map((s: any) => ({
                ...s,
                documentation: documentation(s.documentation),
                parameters: (s.parameters ?? []).map((p: any) => ({
                  ...p,
                  documentation: documentation(p.documentation),
                })),
              })),
            },
            dispose() {},
          };
        } catch {
          return null;
        }
      },
    });
    return monaco;
  });
  return loader;
}
export function editorTabs(tabs: Tab[]): Tab[] {
  return tabs.map((tab) => ({
    ...tab,
    code: models.get(tab.id)?.getValue() ?? tab.code,
  }));
}
export async function settleEditorInput() {
  const versions = () =>
    [...models].map(([id, model]) => `${id}:${model.getVersionId()}`).join("|");
  const started = Date.now();
  let previous = versions(),
    stable = started;
  while (Date.now() - started < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    const current = versions(),
      now = Date.now();
    if (current !== previous) {
      previous = current;
      stable = now;
    }
    if (now - started >= 240 && now - stable >= 120) break;
  }
}
export function releaseModel(id: string) {
  const model = models.get(id);
  if (model) {
    modelTabs.delete(model.uri.toString());
    modelRules.delete(model.uri.toString());
    model.dispose();
    models.delete(id);
    viewStates.delete(id);
  }
}
export function CodeEditor({
  tab,
  formatting = defaultFormatting,
  onChange,
  onPosition,
}: {
  tab: Tab;
  formatting?: FormattingRules;
  onChange: (code: string) => void;
  onPosition: (line: number, column: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const activeModel = useRef<string | null>(null);
  const callbacks = useRef({ onChange, onPosition });
  callbacks.current = { onChange, onPosition };
  const latestTab = useRef(tab);
  latestTab.current = tab;
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    loadMonaco()
      .then((monaco) => {
        if (disposed || !host.current) return;
        monacoRef.current = monaco;
        editor.current = monaco.editor.create(host.current, {
          theme: "tinkercraft",
          language: PHP_LANGUAGE,
          automaticLayout: true,
          fontFamily:
            '"JetBrains Mono", "Fira Code", "DejaVu Sans Mono", monospace',
          fontSize: 15,
          lineHeight: 26,
          minimap: { enabled: false },
          padding: { top: 22, bottom: 30 },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          lineNumbersMinChars: 3,
          roundedSelection: true,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          wordWrap: "on",
          tabSize: 4,
          quickSuggestions: { other: true, comments: false, strings: false },
          suggest: { showWords: false },
          wordBasedSuggestions: "off",
          fixedOverflowWidgets: true,
          accessibilitySupport: "auto",
          ariaLabel: tr("PHP code editor"),
        });
        focusedEditor = editor.current;
        setReady(true);
        const disposables = [
          editor.current.onDidChangeModelContent(() => {
            callbacks.current.onChange(editor.current.getValue());
          }),
          editor.current.onDidChangeCursorPosition((e: any) =>
            callbacks.current.onPosition(
              e.position.lineNumber,
              e.position.column,
            ),
          ),
        ];
        const current = latestTab.current;
        const model =
          models.get(current.id) ??
          monaco.editor.createModel(
            current.code,
            PHP_LANGUAGE,
            monaco.Uri.parse(`inmemory://tinkercraft/${current.id}.php`),
          );
        models.set(current.id, model);
        modelTabs.set(model.uri.toString(), current.id);
        editor.current.setModel(model);
        activeModel.current = current.id;
        editor.current.focus();
        const unlisten = window.runtime?.EventsOn(
          "language:diagnostics",
          (event) => {
            const target = models.get(event.tabId);
            if (!target) return;
            const prefix = target.getValue().trimStart().startsWith("<?php")
              ? 0
              : 1;
            monaco.editor.setModelMarkers(
              target,
              "phpactor",
              (event.data?.diagnostics ?? []).map((d: any) => ({
                startLineNumber: Math.max(1, d.range.start.line + 1 - prefix),
                startColumn: d.range.start.character + 1,
                endLineNumber: Math.max(1, d.range.end.line + 1 - prefix),
                endColumn: d.range.end.character + 1,
                severity:
                  d.severity === 1
                    ? monaco.MarkerSeverity.Error
                    : d.severity === 2
                      ? monaco.MarkerSeverity.Warning
                      : monaco.MarkerSeverity.Info,
                message: d.message,
                source: "Phpactor",
              })),
            );
          },
        );
        cleanup = () => {
          if (focusedEditor === editor.current) focusedEditor = null;
          disposables.forEach((d) => d.dispose());
          unlisten?.();
          editor.current.dispose();
          editor.current = null;
        };
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      });
    let cleanup = () => {};
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!editor.current || !monaco) return;
    let model = models.get(tab.id);
    if (!model) {
      model = monaco.editor.createModel(
        tab.code,
        PHP_LANGUAGE,
        monaco.Uri.parse(`inmemory://tinkercraft/${tab.id}.php`),
      );
      models.set(tab.id, model);
      modelTabs.set(model.uri.toString(), tab.id);
    }
    if (activeModel.current !== tab.id) {
      if (activeModel.current && editor.current.getModel())
        viewStates.set(activeModel.current, editor.current.saveViewState());
      editor.current.setModel(model);
      if (viewStates.has(tab.id))
        editor.current.restoreViewState(viewStates.get(tab.id));
      activeModel.current = tab.id;
      editor.current.focus();
    }
    if (model.getValue() !== tab.code) model.setValue(tab.code);
  }, [tab.id, tab.code]);
  useEffect(() => {
    const model = models.get(tab.id);
    if (!model) return;
    modelRules.set(model.uri.toString(), formatting);
    model.updateOptions({
      tabSize: formatting.tabWidth,
      insertSpaces: !formatting.useTabs,
    });
  }, [ready, tab.id, formatting]);
  return (
    <div className="code-editor" ref={host}>
      {!ready && !error && (
        <div className="editor-loading">{tr("Loading editor…")}</div>
      )}
      {error && <div className="editor-error">{error}</div>}
    </div>
  );
}
