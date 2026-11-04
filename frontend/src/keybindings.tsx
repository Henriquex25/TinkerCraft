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
        Selecione um campo e pressione a combinação desejada. Backspace remove o
        atalho; Tab navega e Esc sai da captura. A paleta de comandos permite
        acessar ações sem atalho individual.
      </p>
      <label className="search-box">
        <Search size={15} />
        <input
          aria-label="Buscar atalho"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ação ou categoria…"
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
                    ? "Sempre"
                    : c.scope === "dialog"
                      ? "Formulários"
                      : c.scope === "profile"
                        ? "Conexões"
                        : c.scope === "updates"
                          ? "Atualizações"
                          : "Preferências"}
              </small>
            </label>
            <input
              id={`binding-${c.id}`}
              data-shortcut-recorder
              aria-label={`${c.label} — atalho`}
              readOnly
              value={formatKey(keysFor(c.id, value)[0] ?? "")}
              placeholder="Sem atalho"
              title="Clique e pressione uma combinação"
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
              aria-label={`Restaurar atalho de ${c.label}`}
              title={`Restaurar padrão${c.key ? ` (${formatKey(c.key)})` : ""}`}
              onClick={() => restore(c.id)}
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remover atalho de ${c.label}`}
              title="Remover atalho"
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
        Restaurar todos os padrões <Shortcut id="settings.reset" />
      </button>
    </div>
  );
}
