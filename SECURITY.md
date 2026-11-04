# Security policy

TinkerCraft is early-stage developer tooling. This policy describes the intended trust boundaries; it is not a security certification or a guarantee that vulnerabilities do not exist.

## Reporting a vulnerability

Do not post credentials, private sources, production data, or a working exploit against someone else's system in a public issue. Use **Security → Report a vulnerability** on the [GitHub repository](https://github.com/Henriquex25/TinkerCraft) if private vulnerability reporting is enabled.

Availability of a monitored private reporting channel has not been verified in this review. No security email or response-time commitment is advertised. If GitHub private reporting is unavailable, ask the maintainer to establish a private channel without publishing sensitive details.

Include the affected version, operating system, prerequisites, reproduction using disposable fixtures, expected impact, and a proposed fix if available. Fixes target the latest development version; long-term maintenance of older releases is not promised.

## Trust boundaries

- **PHP execution has real privileges.** Snippets and Laravel bootstrap run as the configured local, container, or SSH user. There is no sandbox, rollback, read-only mode, or protection against destructive PHP. Run only code and projects you trust.
- **Local language analysis trusts the selected project.** Phpactor can load local project configuration and Composer integrations. Selecting a local source directory, including a bind mount or manual autocomplete copy, must be treated as a trust decision.
- **Automatic remote caches are analysis-only.** Collection excludes hidden files, symlinks, common data directories, and remote Composer PHP loaders. Locally generated autoload maps use JSON metadata. Bounds apply to records, files, aggregate data, and time. Source selection is not a content-based secret scanner: PHP files can still contain confidential data.
- **Workspace data is private, not encrypted.** Tabs, history, profiles, source caches, and downloaded updates live in the user's configuration directory. Secrets inside snippets may persist there. Backups and same-user processes can access them. The application does not isolate itself from a compromised OS or another process running as the same user.
- **Remote commands preserve SSH verification.** OpenSSH uses noninteractive key authentication and strict host-key checking. Cancellation kills the local transport/process group and does not guarantee that a remote process stopped or that effects were reversed.
- **Presentation treats output as data.** React escapes values and errors. LSP documentation is untrusted with HTML disabled. CSV export neutralizes formula-like string values and headers, including leading whitespace; spreadsheet behavior still varies.
- **Updates trust the configured publisher.** Downloads require HTTPS, matching version/architecture/WebKit variant, bounded size, and a matching SHA-256 before an explicit installation action. A checksum from the same publisher is not an independent signature. A compromised release account or source can publish malicious packages. OS authentication and installation are delegated to the system.
- **The development HTTP harness is not a public service.** It binds only to an explicit loopback IP, validates Host and Origin, requires a per-process token, limits request size, and exposes an allowlist of methods. It is not started by the packaged desktop app. Never expose it through a tunnel or public reverse proxy.

## Dependencies and delivery

The Phpactor PHAR is checked against `scripts/phpactor.sha256` before execution and packaging. Updating that pin requires reviewing the upstream release and its digest. Frontend/Go/Composer lockfiles and the vendor digest ledger preserve dependency identity. The frontend build must use the patched DOMPurify dependency for Monaco's sanitizer; do not remove the resolver override without reviewing upstream's bundled version.

CI runs npm and Composer audits, `govulncheck`, race tests, and integration checks. Audits cover known vulnerabilities in their respective databases; they do not replace review, fuzzing, penetration testing, OS library updates, or checking vendored and downloaded code.

GTK, WebKitGTK, PHP, OpenSSH, Docker, and the package manager remain system dependencies. Keep them patched. Do not run TinkerCraft as root to work around Docker or filesystem permissions.

## Current limits

Release artifact signing and reproducible builds are not implemented. The Linux package installer and update flow still need end-to-end validation against a real public release. macOS, Windows, ARM64, and every Laravel/PHP combination have not been certified. See [the review report](docs/review-2026-11-04.md) and [validation notes](docs/validation.md) for the evidence and outstanding work.
