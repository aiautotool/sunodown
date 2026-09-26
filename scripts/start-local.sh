#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

echo "Building the latest local source..."
npm run build

for port in 3000 3002; do
  port_pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$port_pids" ]]; then
    echo "Stopping the previous local process on port $port..."
    kill $port_pids
  fi
done

echo "Starting SunoDown at http://localhost:3000"
exec npm run preview:local
