# Interface translations

English (`en`) is the initial and default language. Brazilian Portuguese (`pt-BR`) is available in **Preferences → General → Language**. The selected language is saved in the local workspace, not inferred from the operating system. Existing workspaces without a language preference start in English.

Saving a changed language saves the current drafts and reloads the interface so that Monaco's built-in menus, find widget, accessibility labels, and other controls initialize with the same locale. It does not execute snippets or rename tabs and connections. Code, PHP/project exception messages, query results, filenames, and third-party documentation are user data and are not translated. App-owned native dialog titles are translated; the operating system controls the language of native dialog buttons.

## Application messages

`frontend/src/i18n.ts` provides translation and locale-aware metadata formatting. English text is the message key. `frontend/src/locales/pt-BR.json` contains application UI strings; `messages.pt-BR.json` maps known backend status and error messages. Parameter placeholders use `{0}`, `{1}`, and so on. Preserve the same placeholders in translations and pass user values as parameters, rather than translating those values.

New interface actions must use the central command catalog so that labels, search, keyboard hints, and tooltips update together. Add new message keys to the locale catalog. Do not translate arbitrary execution output or PHP exceptions by matching their text. Structured errors owned by the app use a restricted class list.

`tests/render.test.mjs` checks default language, template substitution, message placeholders, and output preservation. `tests/ui.test.mjs` exercises language selection, persisted settings, editor translation, and switching back to English. Native Xvfb tests exercise reload and draft persistence in Wails.

## Monaco messages

Monaco's locale is initialized before its editor modules. The 2,146 Portuguese messages match Monaco **0.57.0** and come from pinned public Microsoft sources:

- [VS Code](https://github.com/microsoft/vscode/tree/6a598d4a13031703d483d103c1d934a36ad27971).
- [vscode-loc](https://github.com/microsoft/vscode-loc/tree/62d5443b567022539ba6e8565b0f43f5f6b3682b).

The generator matches upstream module/key pairs and English fallbacks. Fourteen explicit translations in `monaco-overrides.pt-BR.json` cover gaps. Reproduce the locale with installed frontend dependencies:

```bash
python3 scripts/update-monaco-locale.py
npm run format
```

The script downloads pinned public sources over HTTPS, reads source files as text without executing their code, and aborts if any message cannot be translated. Provenance is recorded in `monaco-sources.json`; the original MIT license is preserved under `docs/licenses`. Vite rejects a Monaco version that differs from the generated locale metadata. When upgrading Monaco, review upstream revisions, regenerate the locale, and run WebKit and native tests before merging.
