import { t as tr } from "./i18n";
import { useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Shortcut, useCommandHints } from "./commands";
import {
  bindingErrors,
  commands,
  formatKey,
  keysFor,
  shortcutFromEvent,
  validateShortcut,
  type Bindings,
} from "./shortcuts";
export function Keybindings({
  value,
  change,
}: {
  value: Bindings;
  change: (value: Bindings) => void;
}) {
  const hints = useCommandHints();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const errors = bindingErrors(value);
  const rows = commands.filter((c) =>
    `${c.label} ${c.group}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  function restore(id: string) {
    const next = { ...value };
    delete next[id];
    change(next);
    setError("");
  }
  return (
    <div className="keybindings">
      <p>
        {tr(
          "Select a field and press your desired shortcut. Backspace removes it; Tab moves focus and Esc leaves capture mode. The command palette also provides access to actions without a shortcut.",
        )}
      </p>
      <label className="search-box">
        <Search size={15} />
        <input
          aria-label={tr("Search shortcuts")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("Search actions or categories…")}
        />
      </label>
      {(error || errors.length > 0) && (
        <div className="form-error" role="alert">
          {error || errors.join(" ")}
        </div>
      )}
      <div className="keybinding-list">
        {rows.map((c) => (
          <div className="keybinding-row" key={c.id}>
            <label htmlFor={`binding-${c.id}`}>
              <span>{c.label}</span>
              <small>
                {c.group} ·{" "}
                {c.scope === "workspace"
                  ? "Editor"
                  : c.scope === "global"
                    ? tr("Always")
                    : c.scope === "dialog"
                      ? tr("Forms")
                      : c.scope === "profile"
                        ? tr("Connections")
                        : c.scope === "updates"
                          ? tr("Updates")
                          : tr("Preferences")}
              </small>
            </label>
            <input
              id={`binding-${c.id}`}
              data-shortcut-recorder
              aria-label={tr("{0} — shortcut", [c.label])}
              readOnly
              value={formatKey(keysFor(c.id, value)[0] ?? "")}
              placeholder={tr("No shortcut")}
              title={tr("Click and press a shortcut")}
              onKeyDown={(e) => {
                if (e.key === "Tab") return;
                e.preventDefault();
                e.stopPropagation();
                if (e.key === "Escape") {
                  e.currentTarget.blur();
                  setError("");
                  return;
                }
                if (e.key === "Backspace" || e.key === "Delete") {
                  change({ ...value, [c.id]: "" });
                  setError("");
                  return;
                }
                const binding = shortcutFromEvent(e.nativeEvent);
                if (!binding) return;
                const message = validateShortcut(binding);
                if (message) {
                  setError(message);
                  return;
                }
                change({ ...value, [c.id]: binding });
                setError("");
              }}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={tr("Restore shortcut for {0}", [c.label])}
              title={tr("Restore default{0}", [
                c.key ? ` (${formatKey(c.key)})` : "",
              ])}
              onClick={() => restore(c.id)}
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={tr("Remove shortcut for {0}", [c.label])}
              title={tr("Remove shortcut")}
              onClick={() => change({ ...value, [c.id]: "" })}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="secondary-button"
        title={hints.title("settings.reset")}
        onClick={() => {
          change({});
          setError("");
        }}
      >
        <RotateCcw size={14} />
        {tr("Restore all defaults") + " "}
        <Shortcut id="settings.reset" />
      </button>
    </div>
  );
}
