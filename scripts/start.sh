#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -x "$project_root/build/bin/tinkercraft" ]]; then "$project_root/scripts/build.sh"; fi
cd "$project_root"
if [[ -z "${TINKERCRAFT_RELEASE_SOURCE+x}" && -f "$project_root/.env" ]]; then
  TINKERCRAFT_RELEASE_SOURCE="$(python3 "$project_root/scripts/config.py" TINKERCRAFT_RELEASE_SOURCE)"
  export TINKERCRAFT_RELEASE_SOURCE
fi
exec "$project_root/build/bin/tinkercraft" "$@"
