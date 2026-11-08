# Configure local PHP

TinkerCraft uses two PHP settings:

| Setting                                             | Purpose                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| **Preferences → General → Local PHP executable**    | Parses snippets and runs language support on your computer                |
| Connection's **Advanced settings → PHP executable** | Executes snippets inside the selected directory, container, or SSH server |

The executables and versions can differ. Even an SSH + Docker connection needs local PHP for analysis.

## Find your executable

In a terminal, run:

```bash
command -v php
php -v
```

You need PHP 8.2 or later locally. Use the absolute executable path if your desktop session cannot find `php`.

1. Open **Preferences** with **Ctrl+,**.
2. Select **General**.
3. Enter the path in **Local PHP executable**, or use the file picker.
4. Save the preferences.

For example, Herd Lite may install PHP at:

```text
/home/your-user/.config/herd-lite/bin/php
```

Replace `your-user` with your own Linux username and verify that the file exists. Other PHP managers use different paths.

## PHP works in the terminal but not in the app

Your terminal may add PHP to `PATH` through shell configuration. An application opened from the desktop menu may receive a different `PATH`.

An absolute path in Preferences fixes that difference without changing the server/container connection's PHP setting. Keep the remote PHP executable as `php` unless that environment needs a different path.

If completion is still unavailable, use **Refresh completion** (**Ctrl+Alt+R**) and inspect [completion diagnostics](./autocomplete#diagnostics).
