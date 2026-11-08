# Troubleshooting

## PHP executable not found

**Symptom:** `Could not parse code with local PHP (php)` or `executable file not found in $PATH`.

Your project can be reachable even when local analysis PHP is missing. Configure an absolute PHP 8.2+ path under **Preferences → General → Local PHP executable**. See [local PHP](./local-php).

## Connection works, but completion is missing

Confirm local PHP, request **Ctrl+Space**, and open **Ctrl+Alt+I** for completion diagnostics. Then use **Ctrl+Alt+R** to refresh the source cache.

Check that the connection directory is the project root. For Docker it must be the container path. The first snapshot/index can take longer; partial-source and fallback warnings explain reduced coverage.

A missing schema property or runtime macro may need existing IDE Helper metadata. TinkerCraft's automatic helpers do not query the database.

## Class "User" not found

Select Laravel or automatic Laravel bootstrap and verify the path contains your Laravel application. Try the full name:

```php
\App\Models\User::count();
```

Use an explicit import for duplicate short names or exclusions in `tinker.dont_alias`. Automatic short-name aliases require the version that includes Laravel alias support.

## SSH asks for a password or rejects the host

Test the same host/user/key with OpenSSH in a terminal. Verify a new host key, and load an encrypted key into the SSH agent available to the desktop session. TinkerCraft does not provide interactive password authentication or ignore host-key verification.

## Docker cannot find the project

Check the selected container, its running state, Docker permissions, and PHP CLI inside it. Use **Detect directory**, then verify the result. A host path and a container path are different locations.

## CSV is missing rows

CSV contains the inspected data, after the table filter. Check query limits and partial-result indicators. Increasing the table page does not fetch more database rows. [Read about output limits](./output#partial-results).

## Installer says the same version is already installed

An old window can keep running after its executable was updated on disk. Close and reopen the app. Newer updater implementations detect this case and use Update to restart directly.

## Get help

Search [issues](https://github.com/Henriquex25/TinkerCraft/issues) and [discussions](https://github.com/Henriquex25/TinkerCraft/discussions). Include the app version from the footer, Linux version, connection mode, and a minimal example. Remove credentials, private source, and personal data before sharing logs or screenshots.

If the app helps you, you can [star the repository](https://github.com/Henriquex25/TinkerCraft) or [buy the maintainer a coffee](https://www.buymeacoffee.com/henriquemiranda). Support is optional; features are not donation-gated.
