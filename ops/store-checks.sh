#!/usr/bin/env bash
# Map store checks on the dev stack (epic 2 story 5): rights, a failed migration, the
# lazy retry, a schema newer than the module, and (epic 2 story 14) an upgrade from schema 1
# with data. Development only; run by hand (owner decision, 2026-10-26), results recorded in
# docs/platform-checks.md.
#
# Usage: ops/store-checks.sh [scenario ...]    (default: rights partial healed newer upgrade)
#
# Needs the dev stack from ops/up.sh on volumes made after this story (the MapStudioCheck
# connection is seeded into a fresh Gateway volume and the check database into a fresh
# PostgreSQL volume; on older volumes run ops/up.sh --fresh once). It adds the project
# mapstudio-check (ops/docker-compose.store-checks.yml), which names MapStudioCheck, then per
# scenario sets the check database with psql, restarts the Gateway where the scenario needs a
# fresh start, checks the Gateway log and runs e2e/tests/store-ops.spec.mjs. On every exit, an
# early one included (an EXIT trap), it empties the check database and recreates the Gateway
# without the check project, so the plain stack is back. Only this checkout's containers are touched.

export MAPSTUDIO_STORE_CHECKS=1
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

SCENARIOS=("$@")
if [[ ${#SCENARIOS[@]} -eq 0 ]]; then
  SCENARIOS=(rights partial healed newer upgrade)
fi
LINE_PREFIX="Map Studio cannot prepare its map store on database connection MapStudioCheck"
CHECK_CONN="/usr/local/bin/ignition/data/config/resources/core/ignition/database-connection/MapStudioCheck/config.json"
TABLES="mapstudio_batch, mapstudio_edit, mapstudio_kind_setup, mapstudio_item, mapstudio_project, mapstudio_schema_version"
failures=0
since=""

require_docker
# The compose secrets the Gateway mounts (pg_password, map_token) must exist; generated when missing.
ensure_secrets

# psql as the owner role on the check database.
check_sql() {
  "${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -q -At -U mapstudio -d mapstudio_check "$@"
}

fail() {
  err "$*"
  failures=$((failures + 1))
}

# Gateway log lines since the last restart that contain the text.
log_lines() {
  "${COMPOSE[@]}" logs --no-color --since "${since}" gateway 2>/dev/null | grep -F -- "$1" || true
}

# Wait up to $2 seconds for a log line containing $1.
wait_for_log() {
  local text="$1" seconds="$2" waited=0
  while (( waited < seconds )); do
    if [[ -n "$(log_lines "${text}")" ]]; then
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
  done
  return 1
}

restart_gateway() {
  since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  info "Restarting the Gateway ..."
  "${COMPOSE[@]}" restart gateway >/dev/null
  wait_for_commissioned 60
  wait_for_bundle 24
}

# run_spec <scenario> [noshots]: noshots keeps the screenshots of an earlier scenario.
run_spec() {
  local shots=1
  [[ "${2:-}" == "noshots" ]] && shots=0
  info "e2e: store-ops, scenario $1"
  if ! (cd "${PROJECT_ROOT}/e2e" && MAPSTUDIO_STORE_SCENARIO="$1" MAPSTUDIO_STORE_SHOTS="${shots}" \
      npx playwright test tests/store-ops.spec.mjs); then
    fail "store-ops.spec.mjs failed for scenario $1"
  fi
}

reset_check_db() {
  check_sql -c "DROP TABLE IF EXISTS ${TABLES} CASCADE" -c "REVOKE CREATE ON SCHEMA public FROM mapstudio_check"
}

expect_one_line() {
  local text="$1" count
  count="$(log_lines "${text}" | wc -l)"
  if [[ "${count}" -ne 1 ]]; then
    fail "expected exactly one log line containing '${text}', found ${count}"
    log_lines "${text}" >&2
    return 1
  fi
  ok "one log line: $(log_lines "${text}" | sed 's/^.*\]: //' | cut -c1-400)"
}

if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -q '^gateway$'; then
  err "The dev Gateway is not running: start it with ops/up.sh."
  exit 1
fi
if ! "${COMPOSE[@]}" exec -T gateway test -f "${CHECK_CONN}"; then
  err "The Gateway has no MapStudioCheck connection (an older volume): run ops/up.sh --fresh once."
  exit 1
fi

# The restore runs on every exit (lib.sh sets -euo pipefail, so a failed command ends the script
# early): an empty check database and the Gateway recreated without the check project, so the plain
# stack logs no Map Studio error and keeps no schema 999 or CREATE grant.
restored=0
restore() {
  local status=$?
  (( restored )) && return 0
  restored=1
  set +e
  echo
  info "Restoring: empty check database, Gateway without the check project ..."
  reset_check_db || err "could not empty the check database; run ops/store-checks.sh again or ops/up.sh --fresh"
  MAPSTUDIO_STORE_CHECKS="" docker compose -p "${MAPSTUDIO_CONTAINER}" -f "${OPS_DIR}/docker-compose.yml" up -d gateway \
    || err "could not recreate the Gateway without the check project; run ops/up.sh"
  wait_for_commissioned 60 || err "the Gateway did not come back commissioned after the restore"
  wait_for_bundle 24 || err "the Gateway did not serve the bundle after the restore"
  return "${status}"
}
trap restore EXIT

info "Making sure the check database and role exist ..."
"${COMPOSE[@]}" exec -T postgres bash /docker-entrypoint-initdb.d/20-store-checks.sh
reset_check_db

info "Adding the check project mapstudio-check to the Gateway ..."
since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"${COMPOSE[@]}" up -d gateway
wait_for_commissioned 60
wait_for_bundle 24

for scenario in "${SCENARIOS[@]}"; do
  echo
  info "Scenario ${scenario}"
  case "${scenario}" in
    rights)
      # The role has CONNECT only: the first statement of migration 1 needs CREATE on schema public.
      reset_check_db
      restart_gateway
      if wait_for_log "${LINE_PREFIX}" 150; then
        expect_one_line "${LINE_PREFIX}" || true
        for part in "migration 1, statement 1 of" "SQLState 42501" "lacks CREATE on schema public"; do
          log_lines "${LINE_PREFIX}" | grep -qF -- "${part}" || fail "the error line does not say '${part}'"
        done
      else
        fail "no Map Studio error line for MapStudioCheck within 150 s"
      fi
      run_spec unavailable
      expect_one_line "${LINE_PREFIX}" || true
      [[ -z "$(check_sql -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'mapstudio_%'")" ]] \
        || fail "a mapstudio_ table exists after the failed migration"
      ;;
    partial)
      # CREATE granted, but a table of migration 1 already exists: the migration fails midway and
      # every table it created is rolled back.
      reset_check_db
      check_sql -c "GRANT CREATE ON SCHEMA public TO mapstudio_check" -c "CREATE TABLE mapstudio_kind_setup (blocker int)"
      restart_gateway
      if wait_for_log "${LINE_PREFIX}" 150; then
        expect_one_line "${LINE_PREFIX}" || true
        log_lines "${LINE_PREFIX}" | grep -qF "(CREATE TABLE mapstudio_kind_setup ...) failed with SQLState 42P07" \
          || fail "the error line does not name the mapstudio_kind_setup statement and SQLState 42P07"
      else
        fail "no Map Studio error line for MapStudioCheck within 150 s"
      fi
      tables="$(check_sql -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'mapstudio_%' ORDER BY 1" | tr '\n' ' ')"
      [[ "${tables}" == "mapstudio_kind_setup " ]] || fail "expected only the pre-created table, found: ${tables}"
      ok "mapstudio_check tables after the failed migration: ${tables}"
      run_spec unavailable noshots
      ;;
    healed)
      # The blocker goes, and with no restart the next map.load after the 60 s retry interval runs the
      # migrator again (owner decision 1, 2026-10-26).
      check_sql -c "GRANT CREATE ON SCHEMA public TO mapstudio_check" -c "DROP TABLE IF EXISTS mapstudio_kind_setup"
      info "Waiting 65 s, past the retry interval ..."
      sleep 65
      run_spec ready
      if wait_for_log "Map Studio created its map store schema on database connection MapStudioCheck" 30; then
        ok "$(log_lines "created its map store schema on database connection MapStudioCheck" | sed 's/^.*\]: //')"
      else
        fail "no 'created its map store schema' line for MapStudioCheck"
      fi
      count="$(check_sql -c "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'mapstudio_%'")"
      [[ "${count}" == "6" ]] || fail "expected the 6 mapstudio_ tables, found ${count}"
      ;;
    newer)
      # A newer Map Studio recorded schema 999: this module reads, refuses saves, and changes nothing.
      if [[ "$(check_sql -c "SELECT to_regclass('mapstudio_schema_version') IS NOT NULL")" != "t" ]]; then
        reset_check_db
        check_sql -c "GRANT CREATE ON SCHEMA public TO mapstudio_check"
        restart_gateway
        wait_for_log "Map Studio created its map store schema on database connection MapStudioCheck" 150 \
          || fail "the check store was not created before the newer check"
      fi
      check_sql -c "INSERT INTO mapstudio_schema_version (version, module_version) VALUES (999, 'store-checks')"
      edits_before="$(check_sql -c "SELECT count(*) FROM mapstudio_edit")"
      restart_gateway
      if wait_for_log "is at schema version 999, newer than this module knows (2)" 150; then
        expect_one_line "is at schema version 999, newer than this module knows (2)" || true
      else
        fail "no newer-schema warning within 150 s"
      fi
      run_spec read-only
      edits_after="$(check_sql -c "SELECT count(*) FROM mapstudio_edit")"
      [[ "${edits_before}" == "${edits_after}" ]] || fail "mapstudio_edit gained rows on a read-only store"
      ok "mapstudio_edit rows before and after the refused save: ${edits_before} and ${edits_after}"
      [[ "$(check_sql -c "SELECT max(version) FROM mapstudio_schema_version")" == "999" ]] \
        || fail "the newer schema version was changed"
      ;;
    upgrade)
      # Epic 2 story 14: a store left at schema 1 with a map item, its tables owned by another role
      # (the owner role mapstudio) and the connection's role given the runtime rights only. Migration 2
      # (ALTER TABLE) fails with 42501 and changes nothing; once the tables are the connection role's,
      # the next map.load after the retry interval upgrades it to 2 with no restart, the item kept.
      reset_check_db
      check_sql < "${PROJECT_ROOT}/gateway/src/main/resources/com/aoindustrial/perspective/mapstudio/gateway/store/migrations/0001_first_schema.sql"
      check_sql -c "CREATE TABLE mapstudio_schema_version (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), module_version text NOT NULL)" \
        -c "INSERT INTO mapstudio_schema_version (version, module_version) VALUES (1, 'store-checks')" \
        -c "INSERT INTO mapstudio_project (project, seq) VALUES ('mapstudio-check', 1)" \
        -c "INSERT INTO mapstudio_item (project, id, kind, name, geometry, version) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-000000000001', 'pad', 'Schema 1 pad', '{\"type\":\"Point\",\"coordinates\":[-104.97,39.74]}', 1)" \
        -c "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO mapstudio_check" \
        -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mapstudio_check" \
        -c "GRANT CREATE ON SCHEMA public TO mapstudio_check"
      restart_gateway
      if wait_for_log "${LINE_PREFIX}" 150; then
        expect_one_line "${LINE_PREFIX}" || true
        for part in "migration 2, statement" "SQLState 42501"; do
          log_lines "${LINE_PREFIX}" | grep -qF -- "${part}" || fail "the error line does not say '${part}'"
        done
      else
        fail "no Map Studio error line for MapStudioCheck within 150 s"
      fi
      [[ "$(check_sql -c "SELECT max(version) FROM mapstudio_schema_version")" == "1" ]] \
        || fail "the schema version changed after the failed upgrade"
      [[ "$(check_sql -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'mapstudio_item' AND column_name = 'attachment'")" == "0" ]] \
        || fail "the attachment column exists after the failed upgrade"
      run_spec unavailable noshots
      check_sql -c "DO \$\$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'mapstudio_%' LOOP EXECUTE format('ALTER TABLE %I OWNER TO mapstudio_check', t); END LOOP; END \$\$"
      info "Waiting 65 s, past the retry interval ..."
      sleep 65
      run_spec upgraded
      if wait_for_log "Map Studio upgraded its map store schema on database connection MapStudioCheck: applied version(s) [2], now at schema version 2." 30; then
        ok "$(log_lines "upgraded its map store schema on database connection MapStudioCheck" | sed 's/^.*\]: //')"
      else
        fail "no 'upgraded its map store schema ... [2]' line for MapStudioCheck"
      fi
      [[ "$(check_sql -c "SELECT max(version) FROM mapstudio_schema_version")" == "2" ]] || fail "the schema is not at version 2"
      [[ "$(check_sql -c "SELECT count(*) FROM mapstudio_item WHERE attachment IS NULL AND name = 'Schema 1 pad'")" == "1" ]] \
        || fail "the schema 1 item did not read back with attachment null"
      ok "schema 1 to 2 with data: $(check_sql -c "SELECT string_agg(indexname, ', ' ORDER BY indexname) FROM pg_indexes WHERE indexname IN ('mapstudio_item_attached_line', 'mapstudio_edit_project_entity')")"
      ;;
    *)
      fail "unknown scenario ${scenario}"
      ;;
  esac
done

restore

if (( failures > 0 )); then
  err "${failures} store check(s) failed."
  exit 1
fi
ok "All store checks passed: ${SCENARIOS[*]}."
