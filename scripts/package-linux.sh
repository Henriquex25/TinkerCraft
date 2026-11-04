#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
if [[ "${1:-}" == --skip-build ]]; then shift; else
  TINKERCRAFT_PACKAGE_FORMAT=deb ./scripts/build.sh
fi
exec /usr/bin/python3 "$project_root/scripts/package-linux.py" "$@"
