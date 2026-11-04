# Maintaining TinkerCraft on GitHub

Repository: [Henriquex25/TinkerCraft](https://github.com/Henriquex25/TinkerCraft).

This guide separates source control, community review, and installer distribution. You do not need to commit generated binaries or ask users to build the app.

## Current state

Checked on November 4, 2026: the repository is public, Issues are enabled, Discussions are disabled, and there are no published releases or rulesets. The existing remote workflow is the release builder. The expanded CI, community templates, and revised release workflow in this checkout still need to be committed and pushed. No GitHub settings were changed during preparation because this machine has no authenticated GitHub CLI session.

An export CSV is already tracked in the public repository. The new ignore rule does not remove tracked files or their history. Review whether that file contains private data and handle its removal/history separately before promoting the repository. The setup script does not read the CSV, remove files, rewrite history, commit, push, or publish a release.

## Source, builds, and releases

| Location | Purpose | Commit to Git? |
| --- | --- | --- |
| Go, PHP, React, scripts, lockfiles, tests | Source and reproducible build inputs | Yes |
| `build/appicon*.png`, desktop entry | Branding and packaging inputs | Yes |
| `build/bin/`, `build/dist/`, `frontend/dist/` | Generated executables, packages, web assets | No |
| `.tools/`, `node_modules/`, caches, `.env` | Downloaded tools, dependencies, private local state | No |
| GitHub Actions artifacts | Temporary build/test evidence for maintainers | Not a public update channel |
| GitHub Releases assets | Published installers and checksums for users | Upload through the release workflow |

Today you can install the locally generated package without downloading anything from GitHub:

```bash
sudo apt install --reinstall ./build/dist/tinkercraft_0.2.0_linux_amd64_webkit40.deb
```

Once a release is published, users download the matching `.deb` from Releases. GitHub's automatically generated **Source code** ZIP and TAR archives contain source, not the installer. Installing a `.deb` includes the desktop entry and icons; running `./scripts/start.sh` instead starts the executable from this development checkout.

## One-time repository setup

Use GitHub's web Settings or the included helper. The helper previews changes by default and uses your own GitHub CLI login to apply them. Never paste a personal access token into an issue, a chat message, or the project `.env`.

On Ubuntu / Pop!_OS, install GitHub CLI if needed, then authenticate interactively:

```bash
sudo apt install gh
gh auth login --hostname github.com --web
gh auth status --hostname github.com
```

An existing SSH key authorizes Git transport; it does not create an authenticated session for the GitHub settings API. Follow the CLI's browser flow and use the account with administrator access to the repository. If prompted for a Git protocol, choose **SSH** to match the current remote. Ubuntu 22.04 may install GitHub CLI 2.4.0, which does not support the newer `gh auth login --git-protocol` flag; the command above works with that version too. If asked to upload an SSH key that is already registered with GitHub, skip the upload.

Preview and apply the basic configuration:

```bash
python3 scripts/configure-github.py --repo Henriquex25/TinkerCraft
python3 scripts/configure-github.py --repo Henriquex25/TinkerCraft --apply
```

This enables Issues, Discussions, squash merges, automatic deletion of merged branches, Dependabot alerts, and private vulnerability reporting. It adds a description, topics, and the labels listed in `.github/labels.json`. Unrelated existing labels are preserved. It does not change repository visibility, create posts, publish source, or create releases. The helper rejects a repository that differs from this checkout's `origin`.

In **Settings → General → Features**, check that Issues and Discussions are enabled. Then use **Discussions → category management** to create:

| Name | Format | Purpose |
| --- | --- | --- |
| Announcements | Announcements | Maintainer release/news posts |
| Help and Questions | Questions / Answers | Usage and setup; mark useful answers |
| Ideas | Open-ended discussion | Discuss proposals before implementation |
| Show and Tell | Open-ended discussion | Optional examples and community workflows |

Use these exact names for **Help and Questions** and **Ideas**, because their category slugs must match the files in `.github/DISCUSSION_TEMPLATE`. The helper enables Discussions but does not create categories or welcome posts. Publish/pin a short welcome explaining the issue/discussion distinction and redaction rules when you are ready to moderate the community.

In **Settings → Advanced Security** (the name can vary with GitHub's navigation), verify private vulnerability reporting, Dependabot alerts, and available secret scanning / push protection. Subscribe to security notifications. Confirm that **Security → Report a vulnerability** is available before relying on it in the community. No private reports are created by the helper.

## Pull requests and branch protection

1. Review and publish the prepared source changes, including `.github/workflows/ci.yml`.
2. Wait for **CI → Linux checks** to pass on the current `main` commit. If a runner fails, fix that problem before requiring its check.
3. Preview and apply the ruleset:

```bash
python3 scripts/configure-github.py --repo Henriquex25/TinkerCraft --protect-main
python3 scripts/configure-github.py --repo Henriquex25/TinkerCraft --protect-main --apply
```

The helper checks that CI succeeded for the current `main` commit before applying `.github/main-ruleset.json`. The rules require a pull request, successful **Linux checks** from GitHub Actions, an up-to-date branch, resolved review conversations, and linear history. Force pushes and branch deletion are blocked. Existing unrelated rulesets are preserved; the helper only creates/updates **TinkerCraft main**.

Initially, **zero approving reviews** are required because there is one maintainer. The owner still reviews and merges community contributions, while their own PRs can merge after checks. Requiring an independent approval now could prevent you from merging your own work. `.github/CODEOWNERS` identifies the maintainer for review requests. Once another trusted maintainer joins, require one approval and review the bypass policy together.

Normal contribution flow:

1. Contributor opens an issue/discussion if needed, forks the repo, and creates a branch.
2. They open a PR against `main`; the PR template asks for behavior, validation, and compatibility.
3. GitHub Actions runs checks with read-only permissions and no project secrets.
4. You review the actual diff, test evidence, and any execution/security implications. Passing tests do not replace review. Inspect unknown contributors' workflow changes before approving a run.
5. Request changes or use **Squash and merge**. GitHub closes issues linked with `Closes #123` and deletes the merged source branch when permitted.

Use labels sparingly. Apply `good first issue` only when a task is small and has useful implementation guidance. There is no automatic stale-issue closer or promise of immediate support.

Dependabot pull requests are update proposals, not required merges before a release. Check the branch, commit, and event on each Actions run: a failed dependency PR is separate from the push CI on `main`. The release gate requires successful push CI on the exact `main` commit being built. React, React DOM, and both type packages are grouped in `.github/dependabot.yml` so their peer requirements can be reviewed together. Grouping changes do not repair an already-open incompatible PR automatically; regenerate or correct that proposal before merging it. Keep `npm ci` strict and fix incompatible versions rather than using `--force` or `--legacy-peer-deps`.

## Publish a new version

The release workflow is manual and creates a **draft**. It does not publish on every push and does not require you to push a tag first.

1. Create a branch and update the version consistently. For example, after `0.2.0`, prepare `0.2.1` for fixes:

```bash
git switch -c release/0.2.1
printf '%s\n' 0.2.1 > VERSION
npm version 0.2.1 --no-git-tag-version
npm --prefix frontend version 0.2.1 --no-git-tag-version
```

The npm commands update both manifests and their lockfiles. The workflow rejects a mismatch among `VERSION`, the workflow input, and the root/frontend npm versions. Use `0.3.0` for a larger feature release. Before `1.0`, call out compatibility changes explicitly in the notes.

2. Commit the version change, push the branch, open a PR, wait for checks, and merge. Then wait for the **push CI run on the resulting `main` commit** to finish successfully; a green PR run alone does not satisfy the release gate.
3. Open **Actions → Build Linux release draft → Run workflow**. Select branch **main** and enter **0.2.1**, without `v`. Alternatively:

```bash
gh workflow run release.yml --repo Henriquex25/TinkerCraft --ref main -f version=0.2.1
```

4. The workflow verifies version/branch/CI, builds Ubuntu 22.04 WebKit 4.0 and Ubuntu 24.04 WebKit 4.1 packages, validates them, and creates a draft titled **TinkerCraft 0.2.1**, targeting the exact build commit. Only the draft job has repository write permission. The GitHub URL is embedded automatically; no `.env` or custom secret is needed on runners or on users' machines.
5. Open **Releases** and inspect the draft. It should contain:

```text
tinkercraft_0.2.1_linux_amd64_webkit40.deb
tinkercraft_0.2.1_linux_amd64_webkit41.deb
checksums.txt
manifest.json
```

Review generated notes, add user-facing changes and known limitations, and test the packages on their intended systems. PR labels determine the note categories using `.github/release.yml`. Only WebKit 4.0 has been validated locally so far; a successful cloud build is not a substitute for a WebKit 4.1 desktop smoke test.

6. For a normal update-channel release, leave **This is a pre-release** unchecked, choose **Set as latest release**, and click **Publish release**. The tag is `v0.2.1`. Drafts and pre-releases do not reach the current stable updater. An early `0.x` version may still be described as early-stage in its notes; the GitHub pre-release flag determines channel eligibility, not a quality guarantee.
7. Confirm the published assets and test **About and updates → Check now** from an older installed version. Download and open the installer, complete the OS installation, close the app, and reopen it. Verify the version and workspace retention. If currently installed `0.2.0` matches the first release, it will not offer that same version as an update; use a later version to test an upgrade.

Do not replace the assets of a version users already installed, move a published tag, or reuse a version number for changed code. Publish a higher patch version instead. If a draft build fails, inspect its Actions log; a conflicting existing draft/tag requires review rather than automatic deletion. Do not publish an older rollback as the latest release: prepare the corrective change under a newer version.

## How the installed app updates

The app queries the build's embedded repository for its latest published stable release. Preferences and runtime environment variables cannot change the publisher; only startup checks can be disabled. It compares versions, selects the matching CPU/WebKit package, and requires a valid SHA-256 before offering installation. `checksums.txt` and the GitHub asset digest support that verification; `manifest.json` also supports direct-manifest hosting.

The user explicitly downloads the update and opens the system installer. OS authorization/install and restarting remain user actions. This is an update notification and assisted-installation flow, not silent self-replacement. Committing source or uploading a temporary Actions artifact does not create an available update.

## Official references

- [Issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).
- [Discussion category forms](https://docs.github.com/en/discussions/managing-discussions-for-your-community/creating-discussion-category-forms).
- [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
- [Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
- [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
- [GitHub CLI login](https://cli.github.com/manual/gh_auth_login).
