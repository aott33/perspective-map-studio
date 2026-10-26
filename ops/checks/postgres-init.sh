#!/bin/sh
# Runs once, on the first start of the PostgreSQL volume (docker-entrypoint-initdb.d),
# as the database superuser POSTGRES_USER (mapstudio, the owner role).
#
# Creates mapstudio_ro: a role that can log in and connect, and nothing more.
# PostgreSQL 15 and later give no CREATE on schema public to ordinary roles, so
# the module's CREATE TABLE on this connection fails with SQLState 42501, which
# is the "missing rights" case the platform checks record (AD-21).
#
# The password comes from the Docker secret and is passed to psql as a variable
# (:'pw' quotes it as a literal), never interpolated into the SQL text.
set -eu

ro_password="$(cat /run/secrets/pg_ro_password)"

psql -v ON_ERROR_STOP=1 -v pw="${ro_password}" -v db="${POSTGRES_DB}" \
    --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<'SQL'
CREATE ROLE mapstudio_ro LOGIN PASSWORD :'pw';
GRANT CONNECT ON DATABASE :"db" TO mapstudio_ro;
SQL
