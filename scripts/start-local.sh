#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

for port in 3000 8788; do
  port_pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$port_pids" ]]; then
    echo "Stopping the previous local process on port $port before rebuilding..."
    kill $port_pids
  fi
done

# Wrangler keeps the server manifest in memory. Building while the old server
# is alive can make its HTML reference hashes that have just been removed from
# dist/client, leaving the page without CSS or JavaScript.
echo "Building the latest local source..."
npm run build

echo "Starting SunoDown at http://localhost:3000"
exec npm run preview:local
