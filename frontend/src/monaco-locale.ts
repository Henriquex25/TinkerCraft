import messages from "./locales/monaco.pt-BR.json";
import { uiLanguage } from "./i18n";

if (uiLanguage() === "pt-BR") {
  const scope = globalThis as unknown as {
    _VSCODE_NLS_MESSAGES?: readonly (string | null)[];
    _VSCODE_NLS_LANGUAGE?: string;
  };
  scope._VSCODE_NLS_MESSAGES = messages;
  scope._VSCODE_NLS_LANGUAGE = "pt-br";
}
