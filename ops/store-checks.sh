#!/usr/bin/env bash
# Map store checks on the dev stack (epic 2 story 5): rights, a failed migration, the
# lazy retry, a schema newer than the module, (epic 2 story 14) an upgrade from schema 1
# with data, (epic-editing entry 11a) an upgrade from schema 2 with edit rows, (entry 19b) an upgrade from
# schema 3 with edit rows and a project row, and (entry 13a) a stored
# row whose tag path the save rule refuses. Development only; run by hand (owner decision, 2026-10-26), results recorded in
# docs/platform-checks.md.
#
# Usage: ops/store-checks.sh [scenario ...]    (default: rights partial healed newer upgrade badrow)
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
  SCENARIOS=(rights partial healed newer upgrade badrow)
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
      if wait_for_log "is at schema version 999, newer than this module knows (4)" 150; then
        expect_one_line "is at schema version 999, newer than this module knows (4)" || true
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
      # the next map.load after the retry interval upgrades it to 2, 3 and 4 with no restart, the item kept.
      # Then (epic-editing entry 11a, H7) a store at schema 2 with edit rows is upgraded to 3 and 4 alone: the
      # rows are untouched, read back with before, after, name and kind null, and the name comes from the item.
      # Then (entry 19b, S14) a store at schema 3 with edit rows is upgraded to 4 alone: the rows are kept,
      # the project's settings read back as {} and the edit record takes the entity settings.
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
      if wait_for_log "Map Studio upgraded its map store schema on database connection MapStudioCheck: applied version(s) [2, 3, 4], now at schema version 4." 30; then
        ok "$(log_lines "upgraded its map store schema on database connection MapStudioCheck" | sed 's/^.*\]: //')"
      else
        fail "no 'upgraded its map store schema ... [2, 3, 4]' line for MapStudioCheck"
      fi
      [[ "$(check_sql -c "SELECT max(version) FROM mapstudio_schema_version")" == "4" ]] || fail "the schema is not at version 4"
      [[ "$(check_sql -c "SELECT count(*) FROM mapstudio_item WHERE attachment IS NULL AND name = 'Schema 1 pad'")" == "1" ]] \
        || fail "the schema 1 item did not read back with attachment null"
      ok "schema 1 to 4 with data: $(check_sql -c "SELECT string_agg(indexname, ', ' ORDER BY indexname) FROM pg_indexes WHERE indexname IN ('mapstudio_item_attached_line', 'mapstudio_edit_project_entity')")"

      # H7: schema 2 with an item and three edit rows (a create, a move, a rename), tables owned by the
      # connection's role and CREATE on the schema (an upgrade's rights, docs/operations.md), so migrations 3
      # and 4 run at the start and are applied once.
      reset_check_db
      migrations="${PROJECT_ROOT}/gateway/src/main/resources/com/aoindustrial/perspective/mapstudio/gateway/store/migrations"
      check_sql < "${migrations}/0001_first_schema.sql"
      check_sql < "${migrations}/0002_instrument_attachment.sql"
      check_sql -c "CREATE TABLE mapstudio_schema_version (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), module_version text NOT NULL)" \
        -c "INSERT INTO mapstudio_schema_version (version, module_version) VALUES (1, 'store-checks'), (2, 'store-checks')" \
        -c "INSERT INTO mapstudio_project (project, seq) VALUES ('mapstudio-check', 3)" \
        -c "INSERT INTO mapstudio_item (project, id, kind, name, geometry, version) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-000000000002', 'pad', 'Schema 2 pad renamed', '{\"type\":\"Point\",\"coordinates\":[-104.96,39.74]}', 3)" \
        -c "INSERT INTO mapstudio_edit (project, batch_id, seq, entity, entity_id, op, version, actor, source) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000b1', 1, 'item', 'c0ffee00-0000-4000-8000-000000000002', 'create', 1, 'mapeditor', 'session'), ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000b2', 2, 'item', 'c0ffee00-0000-4000-8000-000000000002', 'update', 2, 'mapoperator', 'session'), ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000b3', 3, 'item', 'c0ffee00-0000-4000-8000-000000000002', 'update', 3, 'cutover', 'script')" \
        -c "GRANT CREATE ON SCHEMA public TO mapstudio_check" \
        -c "DO \$\$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'mapstudio_%' LOOP EXECUTE format('ALTER TABLE %I OWNER TO mapstudio_check', t); END LOOP; END \$\$"
      edits_before="$(check_sql -c "SELECT string_agg(edit_id || ':' || seq || ':' || op || ':' || actor || ':' || at, ',' ORDER BY edit_id) FROM mapstudio_edit")"
      restart_gateway
      if wait_for_log "Map Studio upgraded its map store schema on database connection MapStudioCheck: applied version(s) [3, 4], now at schema version 4." 150; then
        expect_one_line "upgraded its map store schema on database connection MapStudioCheck" || true
        ok "$(log_lines "upgraded its map store schema on database connection MapStudioCheck" | sed 's/^.*\]: //')"
      else
        fail "no 'upgraded its map store schema ... [3, 4]' line for MapStudioCheck: $(log_lines "${LINE_PREFIX}" | sed 's/^.*\]: //')"
      fi
      [[ "$(check_sql -c "SELECT string_agg(version::text, ',' ORDER BY version) FROM mapstudio_schema_version")" == "1,2,3,4" ]] \
        || fail "the schema versions are not 1, 2, 3 and 4, each once"
      [[ "$(check_sql -c "SELECT string_agg(edit_id || ':' || seq || ':' || op || ':' || actor || ':' || at, ',' ORDER BY edit_id) FROM mapstudio_edit")" == "${edits_before}" ]] \
        || fail "the schema 2 edit rows changed in the upgrade"
      [[ "$(check_sql -c "SELECT count(*) FROM mapstudio_edit WHERE before IS NULL AND after IS NULL AND name IS NULL AND kind IS NULL")" == "3" ]] \
        || fail "the schema 2 edit rows do not read back with before, after, name and kind null"
      # The name and kind of an old row come from the item's stored record (JdbcMapStore.HISTORY_ROWS_SQL's join).
      old_rows="$(check_sql -c "SELECT string_agg(e.seq || ' ' || e.actor || ' ' || COALESCE(e.name, i.name) || ' ' || COALESCE(e.kind, i.kind), ', ' ORDER BY e.seq DESC) FROM mapstudio_edit e LEFT JOIN mapstudio_item i ON e.entity = 'item' AND i.project = e.project AND i.id = CASE WHEN e.entity = 'item' THEN e.entity_id::uuid END WHERE e.project = 'mapstudio-check'")"
      [[ "${old_rows}" == "3 cutover Schema 2 pad renamed pad, 2 mapoperator Schema 2 pad renamed pad, 1 mapeditor Schema 2 pad renamed pad" ]] \
        || fail "the old rows read back as '${old_rows}'"
      ok "schema 2 to 4 with edit rows: ${old_rows}"

      # S14 (entry 19b): schema 3 with a project row, an item and two edit rows that hold values, tables owned by
      # the connection's role and CREATE on the schema, so migration 4 runs at the start and is applied once.
      reset_check_db
      check_sql < "${migrations}/0001_first_schema.sql"
      check_sql < "${migrations}/0002_instrument_attachment.sql"
      check_sql < "${migrations}/0003_edit_values.sql"
      check_sql -c "CREATE TABLE mapstudio_schema_version (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), module_version text NOT NULL)" \
        -c "INSERT INTO mapstudio_schema_version (version, module_version) VALUES (1, 'store-checks'), (2, 'store-checks'), (3, 'store-checks')" \
        -c "INSERT INTO mapstudio_project (project, seq) VALUES ('mapstudio-check', 2)" \
        -c "INSERT INTO mapstudio_item (project, id, kind, name, geometry, version) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-000000000003', 'pad', 'Schema 3 pad renamed', '{\"type\":\"Point\",\"coordinates\":[-104.96,39.74]}', 2)" \
        -c "INSERT INTO mapstudio_edit (project, batch_id, seq, entity, entity_id, op, version, actor, source, after, name, kind) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000c1', 1, 'item', 'c0ffee00-0000-4000-8000-000000000003', 'create', 1, 'mapeditor', 'session', '{\"name\":\"Schema 3 pad\"}', 'Schema 3 pad', 'pad'), ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000c2', 2, 'item', 'c0ffee00-0000-4000-8000-000000000003', 'update', 2, 'mapoperator', 'session', '{\"name\":\"Schema 3 pad renamed\"}', 'Schema 3 pad renamed', 'pad')" \
        -c "GRANT CREATE ON SCHEMA public TO mapstudio_check" \
        -c "DO \$\$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'mapstudio_%' LOOP EXECUTE format('ALTER TABLE %I OWNER TO mapstudio_check', t); END LOOP; END \$\$"
      edits_sql="SELECT string_agg(edit_id || ':' || seq || ':' || op || ':' || actor || ':' || at || ':' || after::text || ':' || name || ':' || kind, ',' ORDER BY edit_id) FROM mapstudio_edit"
      edits_before="$(check_sql -c "${edits_sql}")"
      restart_gateway
      if wait_for_log "Map Studio upgraded its map store schema on database connection MapStudioCheck: applied version(s) [4], now at schema version 4." 150; then
        expect_one_line "upgraded its map store schema on database connection MapStudioCheck" || true
        ok "$(log_lines "upgraded its map store schema on database connection MapStudioCheck" | sed 's/^.*\]: //')"
      else
        fail "no 'upgraded its map store schema ... [4]' line for MapStudioCheck: $(log_lines "${LINE_PREFIX}" | sed 's/^.*\]: //')"
      fi
      [[ "$(check_sql -c "SELECT string_agg(version::text, ',' ORDER BY version) FROM mapstudio_schema_version")" == "1,2,3,4" ]] \
        || fail "the schema versions are not 1, 2, 3 and 4, each once"
      [[ "$(check_sql -c "${edits_sql}")" == "${edits_before}" ]] || fail "the schema 3 edit rows changed in the upgrade"
      [[ "$(check_sql -c "SELECT seq || ' ' || settings::text FROM mapstudio_project WHERE project = 'mapstudio-check'")" == "2 {}" ]] \
        || fail "the project row did not read back with its seq and settings {}"
      # The widened check: the edit record takes the entity settings and still refuses any other (rolled back either way).
      check_sql -c "BEGIN" -c "INSERT INTO mapstudio_edit (project, batch_id, seq, entity, entity_id, op, version, actor, source) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000c3', 3, 'settings', 'units', 'create', 1, 'store-checks', 'script')" -c "ROLLBACK" > /dev/null \
        || fail "mapstudio_edit refused the entity settings after the upgrade"
      if check_sql -c "BEGIN" -c "INSERT INTO mapstudio_edit (project, batch_id, seq, entity, entity_id, op, version, actor, source) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-0000000000c4', 3, 'theme', 'units', 'create', 1, 'store-checks', 'script')" -c "ROLLBACK" > /dev/null 2>&1; then
        fail "mapstudio_edit took an entity that is not item, kindSetup or settings"
      fi
      ok "schema 3 to 4 with edit rows: the rows kept, settings {}"
      ;;
    badrow)
      # Epic 4 entry 13a (G5): a store at the module's schema holding a kind setup and an item's overrides with a
      # tag path the save rule refuses (an empty part, a//b), put there directly as an older module could have
      # saved them. At the first read after the start the Gateway logs one warning per row and one info line with
      # the count; nothing is rewritten, the map loads and the rows read back through getMap and map.load as stored.
      reset_check_db
      migrations="${PROJECT_ROOT}/gateway/src/main/resources/com/aoindustrial/perspective/mapstudio/gateway/store/migrations"
      versions=""
      for file in "${migrations}"/*.sql; do
        check_sql < "${file}"
        number="$(basename "${file}" | cut -c1-4 | sed 's/^0*//')"
        versions="${versions}${versions:+, }(${number}, 'store-checks')"
      done
      check_sql -c "CREATE TABLE mapstudio_schema_version (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), module_version text NOT NULL)" \
        -c "INSERT INTO mapstudio_schema_version (version, module_version) VALUES ${versions}" \
        -c "INSERT INTO mapstudio_project (project, seq) VALUES ('mapstudio-check', 2)" \
        -c "INSERT INTO mapstudio_kind_setup (project, kind_id, setup, version) VALUES ('mapstudio-check', 'pad', '{\"comms\":{\"path\":\"{asset.path}/Comms\"},\"kpis\":[{\"key\":\"p\",\"path\":\"{asset.path}/a//b\"}]}', 1)" \
        -c "INSERT INTO mapstudio_item (project, id, kind, name, geometry, overrides, version) VALUES ('mapstudio-check', 'c0ffee00-0000-4000-8000-00000000000a', 'pad', 'Bad path pad', '{\"type\":\"Point\",\"coordinates\":[-104.97,39.74]}', '{\"comms\":{\"path\":\"[default]a//b\"}}', 1), ('mapstudio-check', 'c0ffee00-0000-4000-8000-00000000000b', 'pad', 'Good pad', '{\"type\":\"Point\",\"coordinates\":[-104.96,39.74]}', '{}', 1)" \
        -c "GRANT CREATE ON SCHEMA public TO mapstudio_check" \
        -c "DO \$\$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'mapstudio_%' LOOP EXECUTE format('ALTER TABLE %I OWNER TO mapstudio_check', t); END LOOP; END \$\$"
      rows_sql="SELECT (SELECT string_agg(kind_id || ':' || version || ':' || setup::text || ':' || updated_at, ',' ORDER BY kind_id) FROM mapstudio_kind_setup) || ' / ' || (SELECT string_agg(id || ':' || version || ':' || overrides::text || ':' || updated_at, ',' ORDER BY id) FROM mapstudio_item)"
      rows_before="$(check_sql -c "${rows_sql}")"
      restart_gateway
      run_spec badrow
      if wait_for_log "Project mapstudio-check: 3 stored rows (1 kind setup, 2 map items) checked against the tag path rule: 2 would be refused at their next save; nothing was changed." 60; then
        expect_one_line "checked against the tag path rule" || true
        expect_one_line "Project mapstudio-check: the kind setup of pad holds a tag path a save refuses: kpis[0].path: {asset.path}/a//b has an empty part between two /" || true
        expect_one_line "Project mapstudio-check: the overrides of map item Bad path pad (c0ffee00-0000-4000-8000-00000000000a, kind pad) hold a tag path a save refuses: overrides: comms.path: [default]a//b has an empty part between two /" || true
        [[ "$(log_lines "a save refuses" | wc -l)" -eq 2 ]] || fail "expected two warnings, one per failing row: $(log_lines "a save refuses" | wc -l)"
      else
        fail "no 'checked against the tag path rule' info line for mapstudio-check: $(log_lines "tag path rule" | sed 's/^.*\]: //')"
      fi
      [[ "$(check_sql -c "${rows_sql}")" == "${rows_before}" ]] || fail "a stored row changed: the report must not rewrite anything"
      [[ "$(check_sql -c "SELECT count(*) FROM mapstudio_edit")" == "0" ]] || fail "the edit record gained rows"
      ok "stored rows unchanged after the report: $(check_sql -c "SELECT count(*) FROM mapstudio_kind_setup") kind setup, $(check_sql -c "SELECT count(*) FROM mapstudio_item") map items"
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
