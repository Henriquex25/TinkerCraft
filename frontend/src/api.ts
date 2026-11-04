import type { API } from "./types";

// The HTTP adapter exists only for authenticated, loopback development/tests.
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
          "Abra o aplicativo desktop TinkerCraft. O backend não está conectado.",
        );
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
          "Seleção de arquivos disponível no aplicativo desktop. No modo de desenvolvimento, informe o caminho no formulário.",
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
      if (!response.ok) throw new Error(data.error || "Falha no backend local");
      return data.result;
    };
  },
});
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export const uid = () =>
  crypto.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
