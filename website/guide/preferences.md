# Preferences and formatting

Open Preferences with **Ctrl+,** or the command palette. Save the form with **Ctrl+S**.

## General

- **Language:** English or Portuguese (Brazil). Changing it saves drafts and reloads the interface. Your code, connection names, and results are not translated.
- **Local PHP executable:** the PHP CLI used for local analysis. See [PHP setup](./local-php).
- **Completion cache:** remove inactive cached projects after 1–90 days; the default is seven.

The update repository and the bundled Phpactor path are managed internally. They are not end-user configuration fields.

## Keyboard shortcuts

The **Keyboard shortcuts** section lets you replace or remove a binding and restore defaults. It checks conflicts by context and protects essential editing combinations. Button hints and tooltips reflect your changes.

## Updates

Enable or disable **Check for updates on startup**. Use **Save and check now** to request a check. See [updates](./updates) for installation behavior.

## Formatting

Press **Alt+Shift+F**, use the formatting button, or find **Format PHP code** in the command palette. Formatting is explicit, runs locally, supports undo, and never executes your snippet.

Defaults use four spaces, an 80-character line width, single quotes, trailing commas, and PER-CS brace style. This is not a promise of complete Laravel Pint rule compatibility.

You can adjust the settings or import a plain JSON file, up to 64 KiB:

```json
{
  "tabWidth": 4,
  "printWidth": 100,
  "useTabs": false,
  "singleQuote": true,
  "trailingCommaPHP": true,
  "braceStyle": "per-cs"
}
```

Indentation is 1–8; line width is 40–240. Brace style accepts `per-cs` or `1tbs`. Imported keys must be supported scalar settings. PHP/JavaScript configuration, custom plugins, and automatic project configuration loading are not supported.

Invalid PHP is left unchanged. Formatting will also avoid replacing a snippet that you edit while formatting is in progress.
