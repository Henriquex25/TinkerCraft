#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -x "$project_root/build/bin/tinkercraft" ]]; then "$project_root/scripts/build.sh"; fi
cd "$project_root"
exec "$project_root/build/bin/tinkercraft" "$@"
