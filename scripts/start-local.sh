#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

echo "Starting SunoDown with live source updates at http://localhost:3001"
exec npm run dev -- --port 3001
