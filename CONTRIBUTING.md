# Contributing to TinkerCraft

TinkerCraft focuses on a productive PHP / Laravel scratchpad for Linux. Keep changes focused on that workflow and preserve the separation between editing, language analysis, execution, and presentation.

## Development setup

Start with the [build requirements](README.md#build-from-source), then install the test dependencies:

```bash
npm ci
npm --prefix frontend ci
./scripts/install-phpactor.sh
composer install --working-dir=tests/fixtures/laravel \
  --no-interaction --prefer-dist --no-progress --no-scripts --no-plugins
npx playwright-core install webkit
```

The Laravel fixture has its own Composer lockfile. It contains open-source framework dependencies, not a real user's project. Tests create an isolated application from those dependencies.

Run an isolated desktop workspace while developing:

```bash
TINKERCRAFT_DATA_DIR="$PWD/.data/manual" ./scripts/start.sh
```

`start.sh` does not rebuild an existing binary. Run `./scripts/build.sh` after changing embedded assets or backend code. `wails dev` provides live development. The authenticated loopback HTTP harness in `cmd/tinkercraft-devserver` is for development and browser tests only.

## Before opening a pull request

```bash
npm run format
TINKERCRAFT_PHPACTOR_REAL="$PWD/.tools/phpactor.phar" \
TINKERCRAFT_LARAVEL_VENDOR="$PWD/tests/fixtures/laravel/vendor" \
  ./scripts/check.sh
npm run test:ui
./scripts/build.sh
TINKERCRAFT_NATIVE_TEST=1 xvfb-run -a -s '-screen 0 1440x1000x24' \
  /usr/bin/python3 tests/native.test.py
```

Native tests require Xvfb, xauth, xdotool, Python GI, and Python Xlib. They enforce an isolated display and verify window ownership. Never automate an existing user's application window. WebKit tests use real Go/PHP/Phpactor and simulated Docker commands; they do not establish compatibility with a real Docker daemon or every SSH environment.

Add regression tests when fixing execution, persistence, transport, parsing, update, export, or security bugs. Do not make tests depend on your SSH credentials, a personal repository, a production database, or a specific home directory. If an integration test is skipped because a dependency is absent, state that explicitly in the PR.

## Project structure

| Path | Responsibility |
| --- | --- |
| `frontend/src` | React UI, Monaco integration, keyboard commands, output presentation |
| `internal/core` | Profiles, settings, data contracts, validation |
| `internal/execution` | PHP compiler orchestration, processes, Docker and SSH transports |
| `internal/language` | Phpactor LSP, basic indexer, selective source cache |
| `internal/storage` | Local workspace persistence |
| `internal/updates` | Release checks, version comparison, verified downloads |
| `runtime` | PHP compiler, runner, source collector, and indexer |
| `scripts` | Build, dependency verification, packaging, and release tooling |
| `tests` | Browser, rendering, native desktop, distribution, and Laravel fixtures |

Keep execution explicit. Construct local commands with executable/argument arrays and quote remote POSIX arguments individually. Preserve strict SSH host-key checks, output bounds, cancellation, hidden Eloquent attributes, atomic saves, and remote-cache isolation.

Use `gofmt` for Go and `npm run format` for first-party TypeScript, CSS, tests, and workflows. Keep first-party code self-explanatory; runtime directives and third-party license notices must remain intact. Do not strip dependency attribution or edit generated dependency bundles casually.

Register new actions in the central command catalog so the palette, remapping, tooltips, and buttons remain consistent. Include keyboard accessibility in UI changes.

English is the default interface language. Keep application messages in the translation catalog and preserve user data when switching locales. See [translation maintenance](docs/translations.md) for app messages, Monaco provenance, and regeneration instructions.

## Pull requests and issues

Describe the problem, the resulting behavior, and the checks you ran. Include a small reproduction for bugs, with the OS, PHP version, connection mode, and framework version. Redact hostnames, paths, tokens, credentials, code, and query results that are not public.

Contributions must be your own work or clearly attributed, license-compatible material. Do not submit proprietary Tinkerwell code, assets, extracted application resources, or copied documentation. Public functional inspiration does not grant redistribution rights.

Security issues belong in the private reporting flow described in [SECURITY.md](SECURITY.md), not a public issue containing an exploit against a real system.

## Maintainer setup

The `CI` workflow runs on `pull_request`, `push`, manual dispatch, and a weekly schedule. It uses GitHub-hosted runners, read-only repository permissions, no project secrets, and no `pull_request_target`. Actions are pinned by commit; Dependabot proposes dependency and action updates.

The [maintainer guide](docs/github-maintainer.md) explains repository setup, issue/discussion routing, PR review, protection, and releases. `scripts/configure-github.py` previews settings and can apply them through an authenticated GitHub CLI session. Enable branch rules requiring **Linux checks** after its first successful run, and enable private vulnerability reporting. With a single maintainer, require PRs and checks without requiring someone else to approve the maintainer's own PRs; manually review community PRs. These workflows have been validated locally; their first GitHub execution and repository settings still need confirmation after publishing this revision.

Release builds are a separate, manually triggered workflow and create drafts for review. Only the draft-creation job has repository write permission. Configure the release source when building packages; installed users should not create an `.env` file. See [the release guide](docs/releases.md).
