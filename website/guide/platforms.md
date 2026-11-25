# Operating systems and platform differences

Linux is the established distribution target. Windows and macOS have **experimental build and packaging support**; their native CI jobs and desktop workflows still need validation before these platforms can be called supported releases. Preparing a package does not publish it.

::: warning Experimental Windows and macOS support
**Windows and macOS support is experimental and has not completed native validation.** The Windows ZIP was cross-compiled on Linux but has not been tested on Windows. For macOS, build scripts and CI jobs are prepared; native builds and desktop validation remain pending. Neither platform should be treated as a stable or validated release.
:::

| System                 | Target                                                   | Package                                           | Update method                          | Project completion                 |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------- | -------------------------------------- | ---------------------------------- |
| Ubuntu / Pop!_OS 22.04 | x86-64                                                   | `.deb`, WebKitGTK 4.0                             | In-app Update through APT              | Phpactor with AST fallback         |
| Ubuntu 24.04           | x86-64                                                   | `.deb`, WebKitGTK 4.1; runtime validation pending | In-app Update through APT              | Phpactor with AST fallback         |
| Windows 10/11          | x64; experimental                                        | Portable ZIP                                      | Replace extracted application manually | AST indexer; no native Phpactor    |
| macOS 13+              | Intel (`amd64`) or Apple Silicon (`arm64`); experimental | `.app` inside ZIP                                 | Replace application manually           | Bundled Phpactor with AST fallback |

The Windows ARM64 and macOS universal formats are not packaged yet. Linux packages remain in [GitHub Releases](https://github.com/Henriquex25/TinkerCraft/releases). Windows/Mac test packages are produced as **CI artifacts** named `tinkercraft-preview-windows-amd64`, `tinkercraft-preview-darwin-amd64`, and `tinkercraft-preview-darwin-arm64`, only after their jobs succeed. They expire after 14 days and require a GitHub login to download. They are not automatically attached to a release. If no successful artifact is available, [build from source](https://github.com/Henriquex25/TinkerCraft/blob/main/docs/cross-platform.md).

## Windows

### Install a test build

1. Download the artifact from a successful **CI → Desktop preview (windows-amd64)** job for the commit you intend to test. Extract the artifact to find its package ZIP and `checksums.txt`.
2. In PowerShell, use `Get-FileHash .\tinkercraft_<version>_windows_amd64_preview.zip -Algorithm SHA256` and compare the result with `checksums.txt`.
3. Extract that package into a folder owned by your user. Open `TinkerCraft\tinkercraft.exe` from the extracted folder.

The executable requires the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). When it is missing, the app offers the official runtime download page; install the runtime and reopen TinkerCraft. This ZIP creates no Start menu shortcut, file association, or uninstall entry. Delete the extracted application folder to remove it; your workspace is separate.

These builds have no publisher certificate. Windows may show an unknown-publisher or SmartScreen warning. Verify the source and checksum; publisher signing is still pending. There is no need to disable Windows protection globally.

### Configure PHP

Install a **64-bit PHP 8.2+ CLI** separately, with the extensions your project requires. Find it in PowerShell:

```powershell
(Get-Command php.exe).Source
php.exe -v
```

If it is not on PATH, locate the installed `php.exe`, for example `C:\tools\php\php.exe`, using the file picker in **Preferences → General → Local PHP executable**. Enter the executable path alone, without extra quotes or arguments. The connection's PHP executable is a separate setting: a local connection can use that same path; a Linux container/server normally uses `php` or `/usr/bin/php`.

The project directory for local execution is a native path, for example `C:\Users\Ana\projects\shop`. Do not select `wsl.exe` as PHP: the executable setting does not accept a command plus arguments. Running PHP inside WSL or opening a WSL workspace is not an integrated execution mode in this preview.

### Completion, Docker, and SSH

[Phpactor requires Linux/macOS or WSL](https://github.com/phpactor/phpactor#requirements). This Windows preview uses the existing AST indexer explicitly and does not bundle/start Phpactor. It provides basic functions, classes, and public/inherited members; it does not provide equivalent chained type inference, generics, or Phpactor diagnostics. The completion status identifies the fallback. There is no bundled WSL bridge or alternative language server.

For Docker, install Docker Desktop separately, use **Linux containers**, and make the Docker CLI available to the desktop session. Use a POSIX container directory such as `/var/www/html`, even when its host files are under `C:\Users\...`. Docker's VM mount paths may be inaccessible to Windows; TinkerCraft then uses the selective source cache. Completion still requires local Windows PHP.

For SSH, enable/install the Windows OpenSSH client, configure `%USERPROFILE%\.ssh\config`, verify the server fingerprint in a terminal, and make encrypted keys available to the SSH agent used by the app. TinkerCraft invokes `ssh.exe` on PATH, not a PuTTY session. The SSH destination must provide a POSIX shell; Docker over SSH targets Linux containers. Password prompts are not supported.

### Update

Save the tabs and close TinkerCraft normally. Download the new test package for the same architecture, compare its checksum, extract it into a new folder, and start the new executable. Keep the old folder until the new build opens successfully. The workspace is preserved because it is stored outside the application folder. There is no in-app Windows installer or automatic restart after an update.

## macOS

### Install a test build

1. Download a successful **Desktop preview** artifact for your processor: `darwin-arm64` for Apple Silicon or `darwin-amd64` for Intel. Extract the artifact to find the package ZIP and `checksums.txt`.
2. Run `shasum -a 256 tinkercraft_<version>_darwin_<arch>_preview.zip` and compare with `checksums.txt`.
3. Extract the package ZIP, move `TinkerCraft.app` into Applications (or your user's Applications folder), and open it in Finder.

The current Go build toolchain requires macOS 13 or later. The app uses the system WKWebView; no GTK or WebView2 installation is needed. Phpactor is included inside the app bundle and must remain there.

Test bundles use an **ad hoc signature** for local integrity. This is not an Apple Developer ID signature or notarization, and Gatekeeper can block a downloaded bundle. For a build you have verified, follow the per-app controls documented by [Apple](https://support.apple.com/en-us/102445); managed Macs may prohibit opening it. Do not disable Gatekeeper globally. Public distribution with Developer ID signing and notarization is pending. To uninstall, move the app to Trash; this preserves its workspace.

### Configure PHP

Install **PHP 8.2+ CLI** separately. macOS does not supply the PHP CLI required by this app. Use your existing PHP manager or install an appropriate version, then check:

```bash
command -v php
php -v
```

Applications opened in Finder do not necessarily inherit your terminal's PATH. Select the absolute executable path in **Preferences → General → Local PHP executable**. Common examples are `/opt/homebrew/bin/php` on Apple Silicon and `/usr/local/bin/php` on Intel; verify the path on your machine. Also configure the local connection's PHP executable if its default `php` is not found. Use a local project path such as `/Users/ana/projects/shop`.

Docker Desktop and the OpenSSH client must be available to the desktop process for those connection modes. Server and container directories remain POSIX paths. An inaccessible Docker VM bind mount uses the selective source cache. SSH retains strict host-key verification and non-interactive authentication, with configuration under `~/.ssh`.

### Update

Save tabs and quit normally. Download and verify the new ZIP for your processor, extract it, and replace `TinkerCraft.app` as a whole. Do not replace files inside the signed bundle individually. Reopen it and retain the previous app until the new build has been checked. There is no Sparkle integration, in-app installer, or automatic update restart in this preview.

## Data, shortcuts, and behavior shared across platforms

| System  | Default workspace                                           |
| ------- | ----------------------------------------------------------- |
| Linux   | `~/.config/tinkercraft` (or `$XDG_CONFIG_HOME/tinkercraft`) |
| Windows | `%APPDATA%\tinkercraft`                                     |
| macOS   | `~/Library/Application Support/tinkercraft`                 |

An existing `lume` workspace in the same OS configuration directory is reused when no current workspace exists. `TINKERCRAFT_DATA_DIR` overrides the location, with the legacy `LUME_DATA_DIR` alias retained. Set it before launching the app; desktop shortcuts do not inherit variables set in an unrelated terminal. For isolated testing, run the executable from a terminal with a dedicated data directory.

Back up the active workspace with the app closed. Removing or replacing application files does not remove snippets, settings, history, or caches. Files are not encrypted. Keep them inside your own account's protected profile; Windows access is controlled by filesystem ACLs rather than Unix permission bits.

The [shortcut table](./keyboard-shortcuts) uses `Ctrl` notation. Windows and Linux use Ctrl. On macOS, the command dispatcher accepts **Command in place of Ctrl**, and the interface currently still labels those bindings Ctrl. Option corresponds to Alt. Some system shortcuts may intercept a combination; remap it in Preferences. Test native copy/paste, save/export dialogs, focus, and close with unsaved edits before relying on a preview build.

Code only runs after an explicit action. A local cancellation stops the local process group/job; stopping Docker/SSH transport cannot guarantee cancellation of remote work or reverse database effects. Formatting runs offline on every platform. Local PHP remains necessary even for remote projects.
