# Install and get started

TinkerCraft is a Linux desktop application for writing PHP snippets and running them inside your project. It is an independent open-source project inspired by Tinkerwell.

## Before installation

You need a **local PHP 8.2+ CLI**, including when your project runs on a remote server. It handles parsing and language support. The selected project environment also needs a compatible PHP CLI and its own dependencies.

Docker and OpenSSH are needed only for connections that use them.

## Download the installer

Open [GitHub Releases](https://github.com/Henriquex25/TinkerCraft/releases/latest) and download the `.deb` matching your Linux system:

| System                         | Package filename ends with |
| ------------------------------ | -------------------------- |
| Ubuntu / Pop!_OS 22.04, x86-64 | `linux_amd64_webkit40.deb` |
| Ubuntu 24.04, x86-64           | `linux_amd64_webkit41.deb` |

These are the current build targets. Other distributions and architectures have not been validated for this guide. The automatically generated **Source code** archives are not installers.

Double-click the `.deb`, choose **Install** in your system package installer, and authorize the installation. It resolves the declared system libraries. Open **TinkerCraft** from your application menu.

::: tip No build tools required
You do not need Go, Node.js, npm, Wails, development headers, or an `.env` file to install a published package. Phpactor and the update repository are included. Instructions for building the source are for contributors.
:::

If your desktop has no graphical package installer, open a terminal in the download directory and run `sudo apt install ./filename.deb`, replacing `filename.deb` with the actual downloaded filename.

## Your first snippet

Configure [local PHP](./local-php), select the built-in **PHP Playground** connection, and run:

```php
['message' => 'Hello from TinkerCraft', 'total' => 6 * 7];
```

Press **Ctrl+Enter**. The last expression becomes the return value; PHP opening and closing tags are optional.

Next, [connect your own project](./connections). Your snippets use the real access and database configuration of that project; execute only code you intend to run.
