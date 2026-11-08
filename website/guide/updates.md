# Update TinkerCraft

By default, TinkerCraft checks the official GitHub repository for a published stable release after startup. An available update appears in an invitation and in the footer.

## One update action

1. Choose **Update**.
2. Authorize the installation in the Linux system dialog when requested.
3. Wait for TinkerCraft to install, save your tabs, and reopen.

The app downloads only the matching architecture/WebKit package and verifies it against the published SHA-256. It confirms installation before restarting. If that version is already installed on disk, the same button restarts directly without reinstalling it.

**Remind me later** dismisses the invitation for now; the footer indicator remains available. Opening the app does not download or install an update automatically.

## Manual checks

Open **About and updates** from the command palette and choose **Check now**. Preferences contains the startup-check setting and **Save and check now**.

You do not need an `.env` file, repository URL, or GitHub token. The publisher's update repository is included in the package.

## If an update does not finish

- Cancelled authorization or installation failure keeps the current app open.
- If installation succeeded but reopening failed, close and open TinkerCraft normally to use the new version.
- Integrated installation requires the official installed `.deb` app, APT, pkexec, and the desktop session's graphical authentication agent.
- Source or extracted builds do not modify the system installation. Install a published `.deb` through your package manager.

Older versions may still offer **Open system installer**. Complete that older flow once to receive the implementation with the single Update action.

Stable releases are the update channel; GitHub drafts and prereleases are not offered. Your workspace is preserved during package updates.
