#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
go test ./...
go vet ./...
npm --prefix frontend run build
node tests/render.test.mjs
python3 tests/distribution.test.py
