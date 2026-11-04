import { useRef, useState } from "react";
import { FileUp, RotateCcw } from "lucide-react";
import { t as tr } from "./i18n";
import { errorText } from "./api";
import { Shortcut, useCommandActions, useCommandHints } from "./commands";
import {
  defaultFormatting,
  parseFormattingRules,
  type FormattingRules,
} from "./formatting-rules";

export function FormattingSettings({
  value,
  change,
}: {
  value: FormattingRules;
  change: (rules: FormattingRules) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [imported, setImported] = useState("");
  const hints = useCommandHints();
  function reset() {
    change({ ...defaultFormatting });
    setImported("");
    setError("");
  }
  useCommandActions({
    "settings.importFormatting": () => input.current?.click(),
    "settings.resetFormatting": reset,
  });
  return (
    <div className="settings-formatting">
      <p className="field-hint">
        {tr(
          "Four spaces, consistent spacing, and readable method chains by default. Formatting runs locally and never executes your PHP.",
        )}
      </p>
      <label className="field">
        <span>{tr("Indentation width")}</span>
        <input
          aria-label={tr("Indentation width")}
          type="number"
          min={1}
          max={8}
          value={value.tabWidth}
          onChange={(event) =>
            change({ ...value, tabWidth: Number(event.target.value) })
          }
        />
      </label>
      <label className="field">
        <span>{tr("Preferred line width")}</span>
        <input
          aria-label={tr("Preferred line width")}
          type="number"
          min={40}
          max={240}
          value={value.printWidth}
          onChange={(event) =>
            change({ ...value, printWidth: Number(event.target.value) })
          }
        />
        <small>
          {tr(
            "Long method chains and arguments are wrapped automatically. This is a target width, not a hard limit.",
          )}
        </small>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value.useTabs}
          onChange={(event) =>
            change({ ...value, useTabs: event.target.checked })
          }
        />
        <span>{tr("Use tabs instead of spaces")}</span>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value.singleQuote}
          onChange={(event) =>
            change({ ...value, singleQuote: event.target.checked })
          }
        />
        <span>{tr("Prefer single quotes when possible")}</span>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value.trailingCommaPHP}
          onChange={(event) =>
            change({ ...value, trailingCommaPHP: event.target.checked })
          }
        />
        <span>{tr("Use trailing commas in multiline lists")}</span>
      </label>
      <label className="field">
        <span>{tr("Brace style")}</span>
        <select
          aria-label={tr("Brace style")}
          value={value.braceStyle}
          onChange={(event) =>
            change({
              ...value,
              braceStyle: event.target.value as FormattingRules["braceStyle"],
            })
          }
        >
          <option value="per-cs">PER Coding Style</option>
          <option value="1tbs">1TBS</option>
        </select>
      </label>
      <div className="form-section-title">{tr("CUSTOM RULES")}</div>
      <p className="field-hint">
        {tr(
          "Import a JSON file with tabWidth, printWidth, useTabs, singleQuote, trailingCommaPHP, or braceStyle. Imported rules are saved in the app; edit and import again to update them. Pint and PHP-CS-Fixer configurations are not supported.",
        )}
      </p>
      <input
        ref={input}
        type="file"
        accept=".json,.prettierrc,application/json"
        aria-label={tr("Formatting rules file")}
        hidden
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          try {
            if (file.size > 65536)
              throw new Error("Formatting rules must be smaller than 64 KiB.");
            const rules = parseFormattingRules(await file.text());
            change(rules);
            setImported(file.name);
            setError("");
          } catch (error) {
            setError(errorText(error));
          }
        }}
      />
      <div className="formatting-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => input.current?.click()}
          title={hints.title("settings.importFormatting")}
        >
          <FileUp size={15} />
          {tr("Import JSON rules")} <Shortcut id="settings.importFormatting" />
        </button>
        <button
          type="button"
          className="text-button"
          onClick={reset}
          title={hints.title("settings.resetFormatting")}
        >
          <RotateCcw size={15} />
          {tr("Restore default formatting")}{" "}
          <Shortcut id="settings.resetFormatting" />
        </button>
      </div>
      {imported && (
        <p className="field-hint">
          {tr("Imported {0}. Save preferences to apply.", [imported])}
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
