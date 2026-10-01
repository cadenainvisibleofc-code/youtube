#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DATABASE_URL:?Defina SUPABASE_DATABASE_URL no ambiente; nunca passe a URI em chat ou commit.}"
: "${BACKUP_CONFIRM:?Defina BACKUP_CONFIRM=YES para confirmar a criação do backup.}"
if [[ "$BACKUP_CONFIRM" != "YES" ]]; then
  echo "Backup não executado: defina BACKUP_CONFIRM=YES." >&2
  exit 2
fi

backup_dir="${BACKUP_DIR:-./private-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
archive="$backup_dir/cadena-supabase-$timestamp.dump"
manifest="$backup_dir/cadena-supabase-$timestamp.manifest.txt"

umask 077
pg_dump \
  --dbname="$SUPABASE_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$archive"

checksum="$(sha256sum "$archive" | awk '{print $1}')"
{
  printf 'created_at_utc=%s\n' "$timestamp"
  printf 'file=%s\n' "$(basename "$archive")"
  printf 'sha256=%s\n' "$checksum"
  printf 'format=postgresql-custom\n'
  printf 'database_url=redacted\n'
} > "$manifest"
chmod 600 "$archive" "$manifest"
printf 'Backup criado: %s\nManifesto: %s\nSHA-256: %s\n' "$(basename "$archive")" "$(basename "$manifest")" "$checksum"
