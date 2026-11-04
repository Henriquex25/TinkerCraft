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
): CommandDefinition => ({ id, label, group, key, scope, aliases, alsoIn });
export const commands: CommandDefinition[] = [
  command(
    "commands",
    "Paleta de comandos",
    "Navegação",
    "Ctrl+Shift+P",
    "global",
    ["F1"],
  ),
  command(
    "checkUpdates",
    "Sobre e atualizações",
    "Aplicativo",
    "",
    "workspace",
  ),
  command(
    "updates.check",
    "Verificar atualizações",
    "Atualizações",
    "Ctrl+R",
    "updates",
  ),
  command(
    "updates.download",
    "Baixar atualização",
    "Atualizações",
    "Ctrl+D",
    "updates",
  ),
  command(
    "updates.install",
    "Abrir instalador do sistema",
    "Atualizações",
    "Ctrl+Enter",
    "updates",
  ),
  command(
    "updates.release",
    "Abrir página do release",
    "Atualizações",
    "",
    "updates",
  ),
  command(
    "settings.updates",
    "Preferências de atualização",
    "Preferências",
    "Alt+3",
    "settings",
  ),
  command(
    "settings.checkUpdates",
    "Salvar e verificar atualizações",
    "Preferências",
    "Ctrl+R",
    "settings",
  ),
  command("run", "Executar ou cancelar", "Editor", "Ctrl+Enter", "workspace", [
    "Ctrl+R",
  ]),
  command("save", "Salvar abas no aplicativo", "Abas e arquivos", "Ctrl+S"),
  command(
    "exportPHP",
    "Salvar trecho como arquivo PHP",
    "Abas e arquivos",
    "Ctrl+Shift+S",
  ),
  command("openPHP", "Abrir arquivo PHP", "Abas e arquivos", "Ctrl+O"),
  command("newTab", "Nova aba", "Abas e arquivos", "Ctrl+N"),
  command("closeTab", "Fechar aba", "Abas e arquivos", "Ctrl+W"),
  command("renameTab", "Renomear aba", "Abas e arquivos", "F2"),
  command("nextTab", "Próxima aba", "Abas e arquivos", "Ctrl+Tab"),
  command("previousTab", "Aba anterior", "Abas e arquivos", "Ctrl+Shift+Tab"),
  command("history", "Histórico", "Navegação", "Ctrl+H"),
  command("connections", "Projetos e conexões", "Navegação", "Ctrl+B"),
  command("newConnection", "Nova conexão", "Conexões", "Ctrl+Shift+N"),
  command("editConnection", "Configurar conexão", "Conexões", "Ctrl+Alt+E"),
  command("selectConnection", "Selecionar conexão", "Conexões", "Ctrl+Alt+P"),
  command(
    "preferences",
    "Preferências",
    "Navegação",
    "Ctrl+,",
    "workspace",
    undefined,
    ["language"],
  ),
  command("shortcuts", "Configurar atalhos", "Navegação", "Ctrl+Alt+K"),
  command(
    "complete",
    "Mostrar sugestões de autocomplete",
    "Editor",
    "Ctrl+Space",
  ),
  command(
    "refreshLanguage",
    "Atualizar autocomplete",
    "Editor",
    "Ctrl+Alt+R",
    "workspace",
    undefined,
    ["language"],
  ),
  command(
    "languageDetails",
    "Diagnóstico do autocomplete",
    "Editor",
    "Ctrl+Alt+I",
  ),
  command(
    "tabFocus",
    "Alternar navegação com Tab no editor",
    "Editor",
    "Ctrl+M",
  ),
  command("focusEditor", "Focar editor", "Navegação", "Alt+1"),
  command("focusOutput", "Focar resultado", "Navegação", "Alt+2"),
  command("widenEditor", "Ampliar editor", "Navegação"),
  command("narrowEditor", "Reduzir editor", "Navegação"),
  command("clearHistory", "Limpar histórico", "Histórico"),
  command("filterHistory", "Filtrar histórico", "Histórico"),
  command("tree", "Inspecionar resultado", "Resultado", "Ctrl+Alt+1"),
  command("table", "Ver resultado em tabela", "Resultado", "Ctrl+Alt+2"),
  command("json", "Ver resultado em JSON", "Resultado", "Ctrl+Alt+3"),
  command("copyOutput", "Copiar JSON", "Resultado", "Ctrl+Shift+C"),
  command("exportCSV", "Exportar CSV", "Resultado", "Ctrl+Shift+E"),
  command("clearOutput", "Limpar resultado", "Resultado", "Ctrl+Shift+Delete"),
  command("expandTree", "Reabrir árvore", "Resultado", "Ctrl+Alt+ArrowDown"),
  command("collapseTree", "Recolher árvore", "Resultado", "Ctrl+Alt+ArrowUp"),
  command("filterOutput", "Filtrar resultado", "Resultado", "Ctrl+Alt+F"),
  command("sortTable", "Ordenar coluna da tabela", "Resultado", "Ctrl+Alt+S"),
  command(
    "nextPage",
    "Próxima página da tabela",
    "Resultado",
    "Alt+ArrowRight",
  ),
  command(
    "previousPage",
    "Página anterior da tabela",
    "Resultado",
    "Alt+ArrowLeft",
  ),
  command("nextDump", "Próximo dump", "Resultado", "Alt+PageDown"),
  command("previousDump", "Dump anterior", "Resultado", "Alt+PageUp"),
  command("dialog.close", "Fechar janela", "Formulários", "Escape", "dialog"),
  command(
    "dialog.save",
    "Salvar formulário",
    "Formulários",
    "Ctrl+S",
    "dialog",
  ),
  command(
    "profile.new",
    "Criar outra conexão",
    "Conexões",
    "Ctrl+N",
    "profile",
  ),
  command(
    "profile.test",
    "Testar conexão",
    "Conexões",
    "Ctrl+Enter",
    "profile",
  ),
  command(
    "profile.containers",
    "Buscar containers",
    "Conexões",
    "Ctrl+L",
    "profile",
  ),
  command(
    "profile.detect",
    "Detectar diretório",
    "Conexões",
    "Ctrl+D",
    "profile",
  ),
  command(
    "profile.directory",
    "Escolher diretório local",
    "Conexões",
    "Ctrl+O",
    "profile",
  ),
  command(
    "profile.sources",
    "Escolher pasta manual para autocomplete",
    "Conexões",
    "",
    "profile",
  ),
  command("profile.identity", "Escolher chave SSH", "Conexões", "", "profile"),
  command(
    "profile.delete",
    "Excluir conexão",
    "Conexões",
    "Ctrl+Alt+Shift+D",
    "profile",
  ),
  command(
    "settings.general",
    "Preferências gerais",
    "Preferências",
    "Alt+1",
    "settings",
  ),
  command(
    "settings.shortcuts",
    "Atalhos de teclado",
    "Preferências",
    "Alt+2",
    "settings",
  ),
  command(
    "settings.php",
    "Escolher executável PHP",
    "Preferências",
    "",
    "settings",
  ),
  command(
    "settings.phpactor",
    "Escolher Phpactor",
    "Preferências",
    "",
    "settings",
  ),
  command(
    "settings.install",
    "Copiar comando de instalação do Phpactor",
    "Preferências",
    "",
    "settings",
  ),
  command(
    "settings.reset",
    "Restaurar atalhos padrão",
    "Preferências",
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
          Space: "Espaço",
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
    return "Combinação de teclas inválida.";
  if (
    !/^(Ctrl|Alt)\+/.test(value) &&
    !/^F(?:[1-9]|1[0-2])$/.test(value) &&
    value !== "Escape"
  )
    return "Use Ctrl, Alt ou uma tecla F1–F12 para preservar a digitação.";
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
    return "Combinação reservada à edição ou ao sistema.";
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
          `${formatKey(conflict)}: “${a.label}” e “${b.label}” usam o mesmo atalho.`,
        );
    }
  if (keysFor("commands", bindings).length === 0)
    errors.push("Mantenha um atalho para abrir a paleta de comandos.");
  return errors;
}
