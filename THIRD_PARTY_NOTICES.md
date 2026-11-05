# Third-party notices

TinkerCraft's own code is distributed under the MIT license. Dependencies retain their original licenses and copyright notices.

## Editor and frontend

| Component | Version | License | Upstream |
| --- | --- | --- | --- |
| Monaco Editor | 0.57.0 | MIT; bundled notices also apply | https://github.com/microsoft/monaco-editor |
| DOMPurify | 3.4.17 | Apache-2.0 or MPL-2.0 | https://github.com/cure53/DOMPurify |
| React / React DOM | 19.2.8 | MIT | https://github.com/facebook/react |
| Lucide React | 1.42.0 | ISC and original icon notices | https://github.com/lucide-icons/lucide |
| Vite | 7.3.7 | MIT; build tooling | https://github.com/vitejs/vite |
| esbuild | 0.28.2 | MIT; tests only | https://github.com/evanw/esbuild |
| TypeScript | 5.9.3 | Apache-2.0; build tooling | https://github.com/microsoft/TypeScript |
| Playwright Core | 1.58.2 | Apache-2.0; tests only | https://github.com/microsoft/playwright |
| Prettier | 3.9.10 | MIT; formatting only | https://github.com/prettier/prettier |
| Prettier PHP plugin | 0.26.0 | MIT | https://github.com/prettier/plugin-php |
| PHP parser for JavaScript | 3.7.0 | BSD-3-Clause | https://github.com/glayzzle/php-parser |
| linguist-languages | 9.5.0 | MIT | https://github.com/ikatyang-collab/linguist-languages |

Monaco now comes from the official npm package, with its identity and dependencies pinned by `frontend/package-lock.json`. Earlier development used an open Monaco bundle from another editor distribution; that bundle is no longer shipped. The editor's ESM API and selected contributions are bundled locally. No editor scripts or workers are fetched from a CDN at runtime.

Monaco 0.57.0 also contains an inlined DOMPurify copy. The Vite resolver deliberately replaces that module with the pinned, patched DOMPurify package, and a build assertion rejects accidental use of the inlined copy. Both DOMPurify license alternatives and Monaco's complete third-party notices are included in the Debian package. Do not remove these notices when redistributing builds.

The Brazilian Portuguese editor messages are derived from Microsoft's MIT-licensed VS Code and vscode-loc sources at the commits recorded in `frontend/src/locales/monaco-sources.json`. The complete Microsoft license is in `docs/licenses/vscode-loc-LICENSE.txt` and is included in Debian packages. Fourteen reviewed overrides supplement the upstream translation. See `docs/translations.md` for reproduction instructions.

## Backend

Wails 2.15.0 is distributed under MIT: https://github.com/wailsapp/wails. Go module versions and checksums are recorded in `go.mod` and `go.sum`. The Debian packager includes available original license/notice files from the Go module dependencies and production npm dependencies in `/usr/share/doc/tinkercraft/licenses`.

## PHP-Parser

`runtime/vendor/php-parser` contains unmodified source from https://github.com/nikic/PHP-Parser under BSD-3-Clause, copyright Nikita Popov. The initial source tree was identified as `nikic-PHP-Parser-044a6a3`; no release version was inferred from that abbreviated commit. Its complete license is preserved in `runtime/vendor/php-parser/LICENSE`, and file identities are recorded in `docs/vendor-sha256.txt`.

## Phpactor

https://github.com/phpactor/phpactor, MIT. The installer downloads release **2026.10.07.0** and checks its pinned SHA-256 before executing it. The PHAR preserves its bundled dependencies and upstream notices. It is ignored by Git and is not part of the Go executable. Standard Debian packages place it beside the executable in `/usr/lib/tinkercraft/phpactor.phar`, with the root license and digest under `/usr/share/doc/tinkercraft`. The packager also verifies the pin before using the PHAR. `--without-phpactor` omits it.

## Test fixtures

The Laravel integration fixture uses Composer-managed open-source dependencies and their original licenses. Its manifest and lockfile are in `tests/fixtures/laravel`. Its vendor directory is excluded from Git and from the application package. The fixture does not redistribute a user's Laravel application.

## Branding and functional inspiration

The TinkerCraft logo was supplied by the project owner. It is independent of Tinkerwell's assets. Tinkerwell and Beyond Code are names of their respective owners. Public documentation and functionality informed an independent implementation; no proprietary code, extracted application resources, screenshots, documentation text, or branding from Tinkerwell is redistributed here.
