import { translateStatus } from "./i18n";
import { t as tr } from "./i18n";
import type { API } from "./types";
const token = new URLSearchParams(location.hash.slice(1)).get("devToken");
export const isHeadless = !window.go && Boolean(token);
export const api: API = new Proxy({} as API, {
  get(_target, method: string) {
    return async (...args: unknown[]) => {
      const native = window.go?.main?.App;
      if (native)
        return (
          native[method as keyof API] as (
            ...args: unknown[]
          ) => Promise<unknown>
        )(...args);
      if (!token)
        throw new Error(
          tr("Open the TinkerCraft desktop app. The backend is not connected."),
        );
      if (method === "OpenProjectRepository" || method === "OpenSupportPage") {
        window.open(
          method === "OpenSupportPage"
            ? "https://www.buymeacoffee.com/henriquemiranda"
            : "https://github.com/Henriquex25/TinkerCraft",
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
      if (method === "Copy") {
        await navigator.clipboard.writeText(String(args[0]));
        return;
      }
      if (method === "Export" || method === "SaveSnippet") {
        const url = URL.createObjectURL(
          new Blob(
            [
              method === "SaveSnippet" &&
              !String(args[1]).trimStart().startsWith("<?php")
                ? "<?php\n" + String(args[1])
                : String(args[1]),
            ],
            { type: "text/plain;charset=utf-8" },
          ),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download =
          String(args[0]) + (method === "SaveSnippet" ? ".php" : "");
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      }
      if (["ChooseDirectory", "ChooseFile", "OpenSnippet"].includes(method))
        throw new Error(
          tr(
            "File selection is available in the desktop app. In development mode, enter the path in the form.",
          ),
        );
      const response = await fetch("/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TinkerCraft-Token": token,
        },
        body: JSON.stringify({ method, args }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || tr("Local backend error"));
      return data.result;
    };
  },
});
export const errorText = (error: unknown) =>
  translateStatus(error instanceof Error ? error.message : String(error));
export const uid = () =>
  crypto.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
