import { useSyncExternalStore } from "react";
import portuguese from "./locales/pt-BR.json";
import backendPortuguese from "./locales/messages.pt-BR.json";

export type UILanguage = "en" | "pt-BR";
const catalog: Record<string, string> = { ...portuguese, ...backendPortuguese };
const reverse = new Map(Object.entries(catalog).map(([en, pt]) => [pt, en]));
const listeners = new Set<() => void>();
export const normalizeLanguage = (value: unknown): UILanguage =>
  value === "pt-BR" ? "pt-BR" : "en";
let activeLanguage: UILanguage = "en";
try {
  activeLanguage = normalizeLanguage(
    sessionStorage.getItem("tinkercraft-language"),
  );
} catch {}

export function uiLanguage(): UILanguage {
  return activeLanguage;
}
export function formatLocale(): string {
  return activeLanguage === "en" ? "en-US" : "pt-BR";
}
export function setUILanguage(value: unknown) {
  const next = normalizeLanguage(value);
  try {
    sessionStorage.setItem("tinkercraft-language", next);
  } catch {}
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.title =
      next === "pt-BR"
        ? "TinkerCraft · Workspace PHP"
        : "TinkerCraft · PHP workspace";
  }
  if (next === activeLanguage) return;
  activeLanguage = next;
  for (const listener of listeners) listener();
}
export function useUILanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    uiLanguage,
    () => "en" as UILanguage,
  );
}
function fill(message: string, args: readonly unknown[]): string {
  return message.replace(/\{(\d+)\}/g, (token, index) =>
    Number(index) < args.length ? String(args[Number(index)]) : token,
  );
}
function pattern(message: string) {
  return {
    parts: message.split(/\{\d+\}/),
    indices: [...message.matchAll(/\{(\d+)\}/g)].map((match) =>
      Number(match[1]),
    ),
  };
}
const templates = Object.entries(catalog)
  .filter(([en]) => /\{\d+\}/.test(en))
  .flatMap(([en, pt]) => [
    { key: en, ...pattern(en) },
    { key: en, ...pattern(pt) },
  ])
  .filter((item) => item.parts[0].length > 0);
function matchTemplate(
  message: string,
  template: (typeof templates)[number],
): unknown[] | undefined {
  if (!message.startsWith(template.parts[0])) return;
  let cursor = template.parts[0].length;
  const values: unknown[] = [];
  for (let i = 0; i < template.indices.length; i++) {
    const next = template.parts[i + 1];
    const last = i === template.indices.length - 1;
    const end = last
      ? message.length - next.length
      : next
        ? message.indexOf(next, cursor)
        : -1;
    if (end < cursor || (last && !message.endsWith(next))) return;
    values[template.indices[i]] = message.slice(cursor, end);
    cursor = end + next.length;
  }
  return cursor === message.length ? values : undefined;
}
function entry(key: string) {
  return Object.hasOwn(catalog, key) ? catalog[key] : undefined;
}
export function t(message: string, args: readonly unknown[] = []): string {
  let key = reverse.get(message) ?? message;
  if (
    entry(key) === undefined &&
    args.length === 0 &&
    message.length <= 16384
  ) {
    for (const template of templates) {
      const values = matchTemplate(message, template);
      if (!values) continue;
      key = template.key;
      return fill(
        activeLanguage === "pt-BR" ? (entry(key) ?? key) : key,
        values,
      );
    }
  }
  return fill(activeLanguage === "pt-BR" ? (entry(key) ?? key) : key, args);
}

export function translateStatus(message: string): string {
  return t(message)
    .split(" · ")
    .map((part) => {
      const cache = /^cache (?:updated on|atualizado em) (.+)$/.exec(part);
      if (cache) {
        const date = new Date(cache[1]);
        if (!Number.isNaN(date.getTime()))
          return t("cache updated on {0}", [
            date.toLocaleString(formatLocale()),
          ]);
      }
      return t(part);
    })
    .join(" · ");
}
