#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
phpactor_release='2026.10.07.0'
tools_dir="$project_root/.tools"
mkdir -p "$tools_dir"
download_file="$(mktemp "$tools_dir/phpactor-download-XXXXXX.phar")"
trap 'rm -f "$download_file"' EXIT
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 10 --max-time 180 --retry 2 \
  "https://github.com/phpactor/phpactor/releases/download/$phpactor_release/phpactor.phar" -o "$download_file"
expected_sha="$(awk '{print $1}' "$project_root/scripts/phpactor.sha256")"
printf '%s  %s\n' "$expected_sha" "$download_file" | sha256sum --check --status
php "$download_file" --version
mv "$download_file" "$tools_dir/phpactor.phar"
sha256sum "$tools_dir/phpactor.phar" > "$tools_dir/phpactor.sha256"
printf '\nPhpactor %s instalado em:\n%s/phpactor.phar\n\nO build inclui este componente automaticamente ao lado do executável.\n' "$phpactor_release" "$tools_dir"
