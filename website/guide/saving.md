# Save and restore snippets

## Tabs are saved automatically

Open tabs preserve their names, code, and selected connections on this device. They are restored when you reopen TinkerCraft, including snippets you have never executed.

Press **Ctrl+S** to request an immediate save of all tabs. The save indicator confirms when writing finishes. A normal window close waits for the latest draft to be saved; a forced termination or power loss can still lose recent edits.

## Name your tabs

Press **F2**, double-click a tab title, or use its rename action. Enter confirms; Escape cancels.

Use **Ctrl+N** for a new tab, **Ctrl+W** to close one, and **Ctrl+Tab** / **Ctrl+Shift+Tab** to navigate.

Closing a tab removes it from the open workspace. Export snippets that you want to keep independently.

## Save a PHP file

**Ctrl+Shift+S** exports the current tab through the system file picker. TinkerCraft adds the PHP opening tag when needed. **Ctrl+O** opens a PHP file in a new tab.

Saving tabs inside the app and exporting a file are separate actions. Exporting gives you a file that can be backed up or committed to your own repository.

## History and projects

History keeps the latest 50 executions. It is useful for revisiting a run, but does not replace saved files or drafts that have not been executed.

Connection profiles identify your projects and runtimes. There is no separate snippet library or filesystem project manager yet.

## Your workspace

The default workspace is `~/.config/tinkercraft`. Earlier installations may reuse `~/.config/lume`. Back up the active workspace with the application closed. It stores snippets, history, profiles, preferences, and source caches locally; these files are private but not encrypted. Secrets written into snippets may be saved there.

Updating or removing the application package preserves this workspace.
