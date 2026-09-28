#!/usr/bin/env bash
# Проганяє portal_membership_gate.sql на тимчасовому кластері PostgreSQL.
# Жива база не зачіпається. Потрібні бінарники PostgreSQL (initdb, pg_ctl).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
migration="$here/../migrations/20260928120000_portal_membership_gate.sql"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "$bin" ] || { echo "PostgreSQL не знайдено" >&2; exit 2; }
dir="$(mktemp -d)"
runner=()
if [ "$(id -u)" = "0" ]; then chown nobody "$dir"; runner=(runuser -u nobody --); fi
cleanup() { "${runner[@]}" "$bin/pg_ctl" -D "$dir/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap cleanup EXIT
"${runner[@]}" "$bin/initdb" -D "$dir/data" -U postgres --auth=trust >/dev/null
"${runner[@]}" "$bin/pg_ctl" -D "$dir/data" -o "-k $dir -c listen_addresses=''" -l "$dir/log" start >/dev/null
cp "$migration" "$dir/migration.sql" && cp "$here/portal_membership_gate.sql" "$dir/test.sql"
chmod a+r "$dir"/*.sql
psql -h "$dir" -U postgres -d postgres -v migration="$dir/migration.sql" -q -f "$dir/test.sql"
