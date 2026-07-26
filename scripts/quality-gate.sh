#!/usr/bin/env bash
set -euo pipefail

python scripts/validate_documentation.py

if [[ ! -f package.json ]]; then
  echo "No package.json found; documentation gate completed."
  exit 0
fi

run_if_present() {
  local script="$1"
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script'] ? 0 : 1)"; then
    if [[ -f pnpm-lock.yaml ]]; then pnpm run "$script"
    elif [[ -f yarn.lock ]]; then yarn "$script"
    elif [[ -f bun.lockb || -f bun.lock ]]; then bun run "$script"
    else npm run "$script"
    fi
  else
    echo "Required script is missing: $script" >&2
    return 1
  fi
}

for script in format:check lint typecheck test test:contract test:determinism test:serialization test:integration build; do
  run_if_present "$script"
done
