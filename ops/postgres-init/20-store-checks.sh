#!/usr/bin/env bash
# The store checks' database and role (epic 2 story 5; ops/store-checks.sh). Development only.
#
# Run by the postgres image on a fresh volume (docker-entrypoint-initdb.d), and again by
# ops/store-checks.sh on a kept one; idempotent. Makes database mapstudio_check, owned by the
# owner role, and a login role mapstudio_check with no right beyond what PostgreSQL 16 gives
# every role (CONNECT and TEMP on the database, USAGE on schema public; no CREATE on it), so
# Map Studio's first start on connection MapStudioCheck fails with 42501 until a check grants
# CREATE. The password is the stack's pg_password Docker secret (the connection reads it through
# the MapStudioFiles secret provider); it goes to psql as a variable, never on a command line or
# into a log.
set -euo pipefail

secret=/run/secrets/pg_password
if [[ ! -r "${secret}" ]]; then
  echo "20-store-checks: ${secret} is not readable; the store checks' role is not made." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -q --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  -v pw="$(cat "${secret}")" <<'SQL'
SELECT 'CREATE ROLE mapstudio_check LOGIN'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mapstudio_check')\gexec
ALTER ROLE mapstudio_check WITH LOGIN PASSWORD :'pw';
SELECT format('CREATE DATABASE mapstudio_check OWNER %I', current_user)
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'mapstudio_check')\gexec
SQL
echo "20-store-checks: database and role mapstudio_check are in place."
