import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import localeSources from "./src/locales/monaco-sources.json";
const monacoVersion = JSON.parse(
  readFileSync(
    new URL("./node_modules/monaco-editor/package.json", import.meta.url),
    "utf8",
  ),
).version;
if (monacoVersion !== localeSources.monacoVersion)
  throw new Error(
    "Regenerate the Monaco locale for the selected editor version.",
  );
export default defineConfig({
  plugins: [
    react(),
    {
      name: "verify-monaco-sanitizer",
      generateBundle() {
        const modules = [...this.getModuleIds()].map((id) =>
          id.replaceAll("\\", "/"),
        );
        if (
          modules.some((id) =>
            id.endsWith(
              "/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js",
            ),
          )
        )
          this.error(
            "Monaco bundled sanitizer must be replaced with the patched dependency.",
          );
        if (!modules.some((id) => id.endsWith("/dompurify/dist/purify.es.mjs")))
          this.error(
            "Patched DOMPurify dependency is missing from the editor build.",
          );
      },
    },
  ],
  base: "./",
  resolve: {
    alias: [
      {
        find: "./dompurify/dompurify.js",
        replacement: fileURLToPath(
          new URL(
            "./node_modules/dompurify/dist/purify.es.mjs",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  build: { target: "es2022" },
});
