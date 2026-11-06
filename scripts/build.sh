#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
version="$(python3 scripts/version.py)"
release_source="$(python3 scripts/config.py TINKERCRAFT_RELEASE_SOURCE)"
package_format="${TINKERCRAFT_PACKAGE_FORMAT:-source}"
[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || { echo 'Versão inválida; use MAJOR.MINOR.PATCH.' >&2; exit 1; }
[[ "$package_format" == source || "$package_format" == deb ]] || { echo 'Formato inválido.' >&2; exit 1; }
source_pattern='^https://[a-zA-Z0-9._:/?=%&+-]+$'
[[ -z "$release_source" || "$release_source" =~ $source_pattern ]] || { echo 'Fonte de releases inválida.' >&2; exit 1; }
commit="$(git rev-parse --short HEAD 2>/dev/null || true)"
commit="${commit:-dev}"
build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ldflags="-X tinkercraft/internal/buildinfo.Distribution=$package_format -X tinkercraft/internal/buildinfo.Commit=$commit -X tinkercraft/internal/buildinfo.BuildDate=$build_date"
if [[ -n "$release_source" ]]; then ldflags+=" -X tinkercraft/internal/buildinfo.ReleaseSource=$release_source"; fi
/usr/bin/python3 scripts/prepare-icons.py
if [[ ! -d frontend/node_modules ]]; then npm --prefix frontend ci; fi
npm --prefix frontend run build
if ! command -v wails >/dev/null 2>&1; then
  echo 'Wails CLI ausente. Instale com: go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0' >&2
  exit 1
fi
selected_webkit="${TINKERCRAFT_WEBKIT:-auto}"
if [[ "$selected_webkit" == auto ]]; then
  if pkg-config --exists webkit2gtk-4.1; then selected_webkit=4.1; else selected_webkit=4.0; fi
fi
case "$selected_webkit" in
  4.1)
    pkg-config --exists webkit2gtk-4.1 || { echo 'WebKit2GTK 4.1 de desenvolvimento ausente.' >&2; exit 1; }
    wails build -skipbindings -s -tags webkit2_41 -ldflags "$ldflags" -o tinkercraft
    ;;
  4.0)
    pkg-config --exists webkit2gtk-4.0 || { echo 'WebKit2GTK 4.0 de desenvolvimento ausente.' >&2; exit 1; }
    wails build -skipbindings -s -ldflags "$ldflags" -o tinkercraft
    ;;
  *) echo 'TINKERCRAFT_WEBKIT deve ser auto, 4.0 ou 4.1.' >&2; exit 1 ;;
esac
if [[ -f .tools/phpactor.phar ]]; then
  phpactor_sha="$(awk '{print $1}' scripts/phpactor.sha256)"
  printf '%s  %s\n' "$phpactor_sha" .tools/phpactor.phar | sha256sum --check --status
  install -m 644 .tools/phpactor.phar build/bin/phpactor.phar
fi
printf '\nAplicativo: %s/build/bin/tinkercraft\n' "$project_root"
