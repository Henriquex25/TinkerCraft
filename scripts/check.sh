#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
npm run format:check
unformatted="$(gofmt -l main.go app.go internal cmd runtime/assets.go)"
if [[ -n "$unformatted" ]]; then printf 'Execute gofmt:\n%s\n' "$unformatted" >&2; exit 1; fi
for shell_source in scripts/*.sh; do bash -n "$shell_source"; done
for php_source in runtime/*.php tests/fixtures/*.php; do php -l "$php_source" >/dev/null; done
python3 -m py_compile scripts/*.py tests/*.py
npm --prefix frontend run build
go_tags=()
if [[ "${TINKERCRAFT_WEBKIT:-auto}" == 4.1 ]] || { [[ "${TINKERCRAFT_WEBKIT:-auto}" == auto ]] && pkg-config --exists webkit2gtk-4.1; }; then go_tags=(-tags webkit2_41); fi
go test "${go_tags[@]}" -race -coverprofile=coverage.out ./...
go vet "${go_tags[@]}" ./...
node tests/render.test.mjs
node tests/formatter.test.mjs
python3 tests/distribution.test.py
python3 tests/community.test.py
python3 tests/version.test.py
python3 tests/release.test.py
