import { t as tr } from "./i18n";
export type CommandScope =
  | "workspace"
  | "profile"
  | "settings"
  | "dialog"
  | "global"
  | "language"
  | "updates";
export interface CommandDefinition {
  id: string;
  label: string;
  group: string;
  key: string;
  scope: CommandScope;
  aliases?: string[];
  alsoIn?: CommandScope[];
}
const command = (
  id: string,
  label: string,
  group: string,
  key = "",
  scope: CommandScope = "workspace",
  aliases?: string[],
  alsoIn?: CommandScope[],
): CommandDefinition => ({
  id,
  get label() {
    return tr(label);
  },
  get group() {
    return tr(group);
  },
  key,
  scope,
  aliases,
  alsoIn,
});
export const commands: CommandDefinition[] = [
  command("findEditor", "Find in editor", "Editor"),
  command(
    "settings.language",
    "Change language",
    "Preferences",
    "",
    "settings",
  ),
  command(
    "commands",
    "Command palette",
    "Navigation",
    "Ctrl+Shift+P",
    "global",
    ["F1"],
  ),
  command("checkUpdates", "About and updates", "Application", "", "workspace"),
  command("updates.check", "Check for updates", "Updates", "Ctrl+R", "updates"),
  command(
    "updates.download",
    "Download update",
    "Updates",
    "Ctrl+D",
    "updates",
  ),
  command(
    "updates.install",
    "Open system installer",
    "Updates",
    "Ctrl+Enter",
    "updates",
  ),
  command("updates.release", "Open release page", "Updates", "", "updates"),
  command(
    "settings.updates",
    "Update preferences",
    "Preferences",
    "Alt+3",
    "settings",
  ),
  command(
    "settings.checkUpdates",
    "Save and check for updates",
    "Preferences",
    "Ctrl+R",
    "settings",
  ),
  command("run", "Run or cancel", "Editor", "Ctrl+Enter", "workspace", [
    "Ctrl+R",
  ]),
  command("save", "Save tabs in the app", "Tabs and files", "Ctrl+S"),
  command(
    "exportPHP",
    "Save snippet as PHP file",
    "Tabs and files",
    "Ctrl+Shift+S",
  ),
  command("openPHP", "Open PHP file", "Tabs and files", "Ctrl+O"),
  command("newTab", "New tab", "Tabs and files", "Ctrl+N"),
  command("closeTab", "Close tab", "Tabs and files", "Ctrl+W"),
  command("renameTab", "Rename tab", "Tabs and files", "F2"),
  command("nextTab", "Next tab", "Tabs and files", "Ctrl+Tab"),
  command("previousTab", "Previous tab", "Tabs and files", "Ctrl+Shift+Tab"),
  command("history", "History", "Navigation", "Ctrl+H"),
  command("connections", "Projects and connections", "Navigation", "Ctrl+B"),
  command("newConnection", "New connection", "Connections", "Ctrl+Shift+N"),
  command(
    "editConnection",
    "Configure connection",
    "Connections",
    "Ctrl+Alt+E",
  ),
  command("selectConnection", "Select connection", "Connections", "Ctrl+Alt+P"),
  command(
    "preferences",
    "Preferences",
    "Navigation",
    "Ctrl+,",
    "workspace",
    undefined,
    ["language"],
  ),
  command("shortcuts", "Configure shortcuts", "Navigation", "Ctrl+Alt+K"),
  command("complete", "Show completion suggestions", "Editor", "Ctrl+Space"),
  command(
    "refreshLanguage",
    "Refresh completion",
    "Editor",
    "Ctrl+Alt+R",
    "workspace",
    undefined,
    ["language"],
  ),
  command("languageDetails", "Completion diagnostics", "Editor", "Ctrl+Alt+I"),
  command(
    "tabFocus",
    "Toggle Tab focus navigation in editor",
    "Editor",
    "Ctrl+M",
  ),
  command("focusEditor", "Focus editor", "Navigation", "Alt+1"),
  command("focusOutput", "Focus output", "Navigation", "Alt+2"),
  command("widenEditor", "Widen editor", "Navigation"),
  command("narrowEditor", "Narrow editor", "Navigation"),
  command("clearHistory", "Clear history", "History"),
  command("filterHistory", "Filter history", "History"),
  command("tree", "Inspect output", "Output", "Ctrl+Alt+1"),
  command("table", "Show output as table", "Output", "Ctrl+Alt+2"),
  command("json", "Show output as JSON", "Output", "Ctrl+Alt+3"),
  command("copyOutput", "Copy JSON", "Output", "Ctrl+Shift+C"),
  command("exportCSV", "Export CSV", "Output", "Ctrl+Shift+E"),
  command("clearOutput", "Clear output", "Output", "Ctrl+Shift+Delete"),
  command("expandTree", "Reopen tree", "Output", "Ctrl+Alt+ArrowDown"),
  command("collapseTree", "Collapse tree", "Output", "Ctrl+Alt+ArrowUp"),
  command("filterOutput", "Filter output", "Output", "Ctrl+Alt+F"),
  command("sortTable", "Sort table column", "Output", "Ctrl+Alt+S"),
  command("nextPage", "Next table page", "Output", "Alt+ArrowRight"),
  command("previousPage", "Previous table page", "Output", "Alt+ArrowLeft"),
  command("nextDump", "Next dump", "Output", "Alt+PageDown"),
  command("previousDump", "Previous dump", "Output", "Alt+PageUp"),
  command("dialog.close", "Close window", "Forms", "Escape", "dialog"),
  command("dialog.save", "Save form", "Forms", "Ctrl+S", "dialog"),
  command(
    "profile.new",
    "Create another connection",
    "Connections",
    "Ctrl+N",
    "profile",
  ),
  command(
    "profile.test",
    "Test connection",
    "Connections",
    "Ctrl+Enter",
    "profile",
  ),
  command(
    "profile.containers",
    "Find containers",
    "Connections",
    "Ctrl+L",
    "profile",
  ),
  command(
    "profile.detect",
    "Detect directory",
    "Connections",
    "Ctrl+D",
    "profile",
  ),
  command(
    "profile.directory",
    "Choose local directory",
    "Connections",
    "Ctrl+O",
    "profile",
  ),
  command(
    "profile.sources",
    "Choose manual completion folder",
    "Connections",
    "",
    "profile",
  ),
  command("profile.identity", "Choose SSH key", "Connections", "", "profile"),
  command(
    "profile.delete",
    "Delete connection",
    "Connections",
    "Ctrl+Alt+Shift+D",
    "profile",
  ),
  command(
    "settings.general",
    "General preferences",
    "Preferences",
    "Alt+1",
    "settings",
  ),
  command(
    "settings.shortcuts",
    "Keyboard shortcuts",
    "Preferences",
    "Alt+2",
    "settings",
  ),
  command(
    "settings.php",
    "Choose PHP executable",
    "Preferences",
    "",
    "settings",
  ),
  command(
    "settings.phpactor",
    "Choose Phpactor",
    "Preferences",
    "",
    "settings",
  ),
  command(
    "settings.install",
    "Copy Phpactor installation command",
    "Preferences",
    "",
    "settings",
  ),
  command(
    "settings.reset",
    "Restore default shortcuts",
    "Preferences",
    "",
    "settings",
  ),
];
export type Bindings = Record<string, string>;
export const definition = (id: string) => commands.find((c) => c.id === id)!;
export const keysFor = (id: string, bindings: Bindings = {}): string[] => {
  const c = definition(id);
  return Object.hasOwn(bindings, id)
    ? bindings[id]
      ? [bindings[id]]
      : []
    : [c.key, ...(c.aliases ?? [])].filter(Boolean);
};
export const formatKey = (key: string) =>
  key
    .split("+")
    .map(
      (k) =>
        ({
          Space: tr("Space"),
          ArrowLeft: "←",
          ArrowRight: "→",
          ArrowUp: "↑",
          ArrowDown: "↓",
          Escape: "Esc",
          Delete: "Del",
        })[k] ?? k,
    )
    .join(" + ");
export function shortcutFromEvent(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
): string {
  if (["Control", "Meta", "Alt", "Shift", "AltGraph"].includes(event.key))
    return "";
  let key = event.key === " " ? "Space" : event.key;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  else if (key.length === 1) key = key.toUpperCase();
  if (event.code === "Equal") key = "=";
  return [
    event.ctrlKey || event.metaKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
}
export function validateShortcut(value: string): string {
  if (!value) return "";
  if (
    !/^(Ctrl\+)?(Alt\+)?(Shift\+)?(Enter|Tab|Space|Escape|Backspace|Delete|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|PageUp|PageDown|Home|End|F(?:[1-9]|1[0-2])|[A-Z0-9,./;=\[\]\\'`-])$/.test(
      value,
    )
  )
    return tr("Invalid keyboard shortcut.");
  if (
    !/^(Ctrl|Alt)\+/.test(value) &&
    !/^F(?:[1-9]|1[0-2])$/.test(value) &&
    value !== "Escape"
  )
    return tr("Use Ctrl, Alt, or an F1–F12 key to preserve typing.");
  if (
    [
      "Ctrl+C",
      "Ctrl+V",
      "Ctrl+X",
      "Ctrl+A",
      "Ctrl+Z",
      "Ctrl+Y",
      "Ctrl+Shift+Z",
      "Ctrl+Backspace",
      "Ctrl+Delete",
      "Ctrl+F",
      "Ctrl+Alt+Backspace",
      "Ctrl+Alt+Delete",
      "Alt+F4",
    ].includes(value)
  )
    return tr("This shortcut is reserved for editing or the system.");
  return "";
}
export const scopesOverlap = (a: CommandScope, b: CommandScope) =>
  a === b ||
  a === "global" ||
  b === "global" ||
  (a === "dialog" &&
    ["profile", "settings", "language", "updates"].includes(b)) ||
  (b === "dialog" &&
    ["profile", "settings", "language", "updates"].includes(a));
export function bindingErrors(bindings: Bindings): string[] {
  const errors: string[] = [];
  for (const [id, value] of Object.entries(bindings)) {
    if (!commands.some((c) => c.id === id)) continue;
    const error = validateShortcut(value);
    if (error) errors.push(`${definition(id).label}: ${error}`);
  }
  for (let i = 0; i < commands.length; i++)
    for (let j = i + 1; j < commands.length; j++) {
      const a = commands[i],
        b = commands[j];
      if (
        ![a.scope, ...(a.alsoIn ?? [])].some((x) =>
          [b.scope, ...(b.alsoIn ?? [])].some((y) => scopesOverlap(x, y)),
        )
      )
        continue;
      const conflict = keysFor(a.id, bindings).find((k) =>
        keysFor(b.id, bindings).includes(k),
      );
      if (conflict)
        errors.push(
          tr("{0}: “{1}” and “{2}” use the same shortcut.", [
            formatKey(conflict),
            a.label,
            b.label,
          ]),
        );
    }
  if (keysFor("commands", bindings).length === 0)
    errors.push(tr("Keep a shortcut for opening the command palette."));
  return errors;
}
