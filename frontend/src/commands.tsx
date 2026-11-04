import { t as tr } from "./i18n";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Search, X } from "lucide-react";
import {
  commands,
  keysFor,
  formatKey,
  shortcutFromEvent,
  type Bindings,
  type CommandScope,
} from "./shortcuts";
type Action =
  | (() => unknown)
  | {
      run: () => unknown;
      enabled: boolean;
    };
type Actions = Record<string, Action>;
type Registration = {
  ids: string[];
  get: (id: string) => Action | undefined;
};
const noop = () => {};
const Context = createContext({
  bindings: {} as Bindings,
  setBindings: noop as (b: Bindings) => void,
  register: (_r: Registration) => noop,
  invoke: (_id: string): boolean => false,
  openPalette: noop,
});
const scopeNow = (): CommandScope =>
  (Array.from(
    document.querySelectorAll<HTMLElement>("[data-command-scope]"),
  ).at(-1)?.dataset.commandScope as CommandScope) ?? "workspace";
const inScope = (
  scope: CommandScope,
  active: CommandScope,
  alsoIn: CommandScope[] = [],
) =>
  scope === "global" ||
  scope === active ||
  alsoIn.includes(active) ||
  (scope === "dialog" &&
    ["profile", "settings", "language", "updates"].includes(active));
const runnable = (a?: Action) => a && (typeof a === "function" || a.enabled);
const run = (a: Action) => (typeof a === "function" ? a() : a.run());
export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [bindings, setBindings] = useState<Bindings>({});
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const registrations = useRef(new Set<Registration>());
  const activeScope = useRef<CommandScope>("workspace");
  const previousFocus = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef({ bindings, palette });
  latest.current = { bindings, palette };
  function getAction(id: string) {
    for (const r of [...registrations.current].reverse())
      if (r.ids.includes(id)) return r.get(id);
  }
  function invoke(id: string) {
    const definition = commands.find((c) => c.id === id);
    if (
      !definition ||
      !inScope(definition.scope, scopeNow(), definition.alsoIn)
    )
      return false;
    if (id === "commands") {
      openPalette();
      return true;
    }
    const action = getAction(id);
    if (!runnable(action)) return false;
    run(action!);
    return true;
  }
  function openPalette() {
    activeScope.current = scopeNow();
    previousFocus.current = document.activeElement as HTMLElement;
    setQuery("");
    setSelected(0);
    setPalette(true);
  }
  function closePalette(id?: string) {
    setPalette(false);
    requestAnimationFrame(() => {
      previousFocus.current?.isConnected && previousFocus.current.focus();
      if (id) invoke(id);
    });
  }
  const live = useRef({ invoke, openPalette });
  live.current = { invoke, openPalette };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        (event.target as HTMLElement)?.closest("[data-shortcut-recorder]")
      )
        return;
      if (latest.current.palette) return;
      const key = shortcutFromEvent(event);
      const active = scopeNow();
      for (const c of commands) {
        if (
          !inScope(c.scope, active, c.alsoIn) ||
          !keysFor(c.id, latest.current.bindings).includes(key)
        )
          continue;
        if (c.id !== "commands" && !runnable(getAction(c.id))) continue;
        event.preventDefault();
        event.stopImmediatePropagation();
        live.current.invoke(c.id);
        break;
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);
  useLayoutEffect(() => {
    if (palette) input.current?.focus();
  }, [palette]);
  const options = commands.filter(
    (c) =>
      c.id !== "commands" &&
      inScope(c.scope, activeScope.current, c.alsoIn) &&
      runnable(getAction(c.id)) &&
      `${c.group} ${c.label}`
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(
          query
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
        ),
  );
  const index = Math.min(selected, Math.max(0, options.length - 1));
  useEffect(() => {
    document
      .getElementById(`command-option-${index}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index, query]);
  return (
    <Context.Provider
      value={{
        bindings,
        setBindings,
        register: (r) => {
          registrations.current.add(r);
          return () => {
            registrations.current.delete(r);
          };
        },
        invoke,
        openPalette,
      }}
    >
      {children}
      {palette && (
        <div
          className="modal-scrim command-scrim"
          data-command-palette
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePalette();
          }}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label={tr("Command palette")}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                closePalette();
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected(Math.min(options.length - 1, index + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected(Math.max(0, index - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (options[index]) closePalette(options[index].id);
              }
              if (e.key === "Tab") {
                e.preventDefault();
                input.current?.focus();
              }
            }}
          >
            <div className="command-search">
              <Search size={18} />
              <input
                ref={input}
                placeholder={tr("Type an action…")}
                aria-label={tr("Search commands")}
                role="combobox"
                aria-expanded="true"
                aria-controls="command-options"
                aria-activedescendant={
                  options.length ? `command-option-${index}` : undefined
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
              />
              <button
                title={tr("Close palette (Esc)")}
                onClick={() => closePalette()}
              >
                <X size={18} />
              </button>
            </div>
            <div
              role="listbox"
              id="command-options"
              className="command-options"
            >
              {options.map((c, i) => (
                <button
                  role="option"
                  aria-selected={i === index}
                  id={`command-option-${i}`}
                  tabIndex={-1}
                  key={c.id}
                  onClick={() => closePalette(c.id)}
                >
                  <span>
                    <small>{c.group}</small>
                    {c.label}
                  </span>
                  <kbd>{formatKey(keysFor(c.id, bindings)[0] ?? "")}</kbd>
                </button>
              ))}
              {!options.length && (
                <p className="empty-small">
                  {tr("No actions match your search.")}
                </p>
              )}
            </div>
            <footer>{tr("↑ ↓ select · Enter run · Esc close")}</footer>
          </section>
        </div>
      )}
    </Context.Provider>
  );
}
export const useCommandSystem = () => useContext(Context);
export function useCommandActions(actions: Actions) {
  const context = useContext(Context);
  const latest = useRef(actions);
  latest.current = actions;
  const registry = useRef(context.register);
  registry.current = context.register;
  const ids = Object.keys(actions).join("|");
  useLayoutEffect(
    () =>
      registry.current({
        ids: ids.split("|"),
        get: (id) => latest.current[id],
      }),
    [ids],
  );
}
export function useCommandHints() {
  const { bindings } = useContext(Context);
  const key = (id: string) => formatKey(keysFor(id, bindings)[0] ?? "");
  return {
    key,
    title: (id: string, label?: string) => {
      const name = label ?? commands.find((c) => c.id === id)?.label ?? id;
      const shortcut = key(id);
      return shortcut ? `${name} (${shortcut})` : name;
    },
  };
}
export function Shortcut({ id }: { id: string }) {
  const { key } = useCommandHints();
  return key(id) ? <kbd className="action-shortcut">{key(id)}</kbd> : null;
}
