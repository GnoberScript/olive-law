#!/usr/bin/env bash
set -euo pipefail

runtime_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/tools/node-v22.14.0-win-x64" && pwd)"
export PATH="$runtime_dir:$PATH"

exec "$runtime_dir/npm.cmd" run dev
