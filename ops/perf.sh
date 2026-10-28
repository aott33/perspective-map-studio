#!/usr/bin/env bash
# The performance check before a release (epic 2 story 17). Development only; run by hand, results
# recorded in docs/platform-checks.md ("Epic 2 story 17") and, with PERF_RECORD, in docs/perf/.
#
# Usage:
#   ops/perf.sh                          both phases on this checkout's dev stack (ops/up.sh first)
#   ops/perf.sh --phase main             only phase main (nomodule alone is refused)
#   PERF_RECORD=0.2.0 ops/perf.sh        also write docs/perf/0.2.0-dev.json (only when no measure crashed)
#   ops/perf.sh --target template        the owner's laptop: the template's kept 300-pad test stack
#                                        (main phase only; see "Template target" below)
#   ops/perf.sh --only edits.apply       only the named measures (comma separated; epic 3 entry 4), then
#                                        the comparison with the last record of the target in docs/perf/
#
# --only. The measures are bundle, idle, map.load, open-to-drawn, frame-rate, map.changed, sessions,
# edits.apply and list-refresh (e2e/perf/only.mjs). The phases follow the measures (idle and sessions
# need nomodule too; --phase is not combined with --only), the runner skips every other measure's
# block and every test with no wanted block (seeding still happens, so edits.apply alone seeds to
# 5,000 items), and the result is e2e/out/perf.json as for a full run, with `only` naming the
# selection. PERF_RECORD is refused with --only: a partial record never replaces a full one. After
# the merge the headline rows of the wanted measures are printed against the newest
# docs/perf/<version>-<target>.json (by version; PERF_COMPARE=<file> picks another), as
# `node perf/compare.mjs <record> ../e2e/out/perf.json --only <measures>` would.
#
# Dev target. Phase nomodule recreates the Gateway with the scratch project mapstudio-perf and an
# empty external modules folder (ops/docker-compose.perf*.yml): the Gateway without Map Studio. Phase
# main recreates it with the project and the module. Each phase waits PERF_SETTLE_S (default 120 s)
# after the Gateway is up, starts the sampler (e2e/perf/sampler.mjs) and runs the Playwright runner
# (e2e/perf/perf.spec.mjs). Before phase main the Gateway is stopped and the rows of project
# mapstudio-perf (only those) are deleted. On every exit, an early one included (an EXIT trap), the
# sampler stops, the Gateway is recreated without the overlays (the plain dev stack), the perf rows
# are deleted again and e2e/out is searched for any secret this run could know. The dev project's
# item count is compared before and after. Only this checkout's containers are touched.
#
# Template target (owner decision 3, 2026-10-27). Never `docker compose up` or `down` on the
# template stack (compose project ign-og-test): the perf project is copied into the running Gateway
# with `docker cp` and a project scan, and on exit it is removed again with a scan, and only the rows
# of project mapstudio-perf are deleted from the map store's database. The Gateway must already run
# Map Studio 0.2.x (the hand-installed candidate, or the signed 0.2.0 after the tag); otherwise the
# run is refused (exit 2). The template bind-mounts its projects folder from the test stack's
# checkout, so the copied project appears there as untracked files until the exit removes it.
# Settings, from the environment:
#   PERF_TEMPLATE_URL          the test Gateway, default http://localhost:8088
#   PERF_TEMPLATE_DIR          the test stack's checkout, for secrets/api-token
#   PERF_TEMPLATE_CONNECTION   the Gateway database connection of the map store (written into the setup)
#   PERF_TEMPLATE_DB, PERF_TEMPLATE_DB_USER   the PostgreSQL database and role of that connection (psql
#                              in the stack's db container; defaults mapstudio / mapstudio)
#   PERF_EDITOR_PASSWORD_FILE  a file holding the password of the user mapeditor (role MapEditor) on
#                              that Gateway; read into the runner's environment, never printed
# [unverified: written in story 17, not run; the laptop run is its first]
#
# Exit: 0 every limit passed, 3 a limit missed, 2 refused before anything started, 1 a crash.
# The trial needs at least 45 minutes left (GET /data/api/v1/trial).

# The cleanup functions run from the EXIT trap, which shellcheck does not follow (SC2317).
# shellcheck disable=SC2317,SC2329
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

TARGET="dev"
PHASES=(nomodule main)
PHASE_ARG=""
ONLY=""
for ((i = 1; i <= $#; i++)); do
  case "${!i}" in
    --target) i=$((i + 1)); TARGET="${!i:-}" ;;
    --phase) i=$((i + 1)); PHASES=("${!i:-}"); PHASE_ARG="yes" ;;
    --only) i=$((i + 1)); ONLY="${!i:-}" ;;
    *) err "Unknown argument: ${!i}"; exit 2 ;;
  esac
done
if [[ -n "${ONLY}" ]]; then
  if [[ -n "${PHASE_ARG}" ]]; then
    err "--only sets the phases itself; do not combine it with --phase"
    exit 2
  fi
  if [[ -n "${PERF_RECORD:-}" ]]; then
    err "PERF_RECORD is refused with --only: a partial record never replaces a full docs/perf record"
    exit 2
  fi
  # Validates the names (exit 2 with the list on an unknown one) and prints the phases they need.
  phases_text="$(cd "${PROJECT_ROOT}/e2e" && node perf/only.mjs phases "${ONLY}")" || exit 2
  read -r -a PHASES <<< "${phases_text}"
  export PERF_ONLY="${ONLY}"
fi
case "${TARGET}" in dev|template) ;; *) err "--target is dev or template"; exit 2 ;; esac
for p in "${PHASES[@]}"; do
  case "${p}" in nomodule|main) ;; *) err "--phase is nomodule or main"; exit 2 ;; esac
done
if [[ "${TARGET}" == "template" ]]; then
  PHASES=(main)
fi
if [[ "${PHASES[*]}" == "nomodule" ]]; then
  # The record is built on phase main; nomodule is only its baseline.
  err "--phase nomodule alone is not supported: run both phases, or --phase main"
  exit 2
fi
if [[ "${TARGET}" == "dev" && "${MAPSTUDIO_STORE_CHECKS:-}" == "1" ]]; then
  # The plain stack this run restores is docker-compose.yml alone, without the store-checks overlay.
  err "unset MAPSTUDIO_STORE_CHECKS before a perf run (the run restores the stack without that overlay)"
  exit 2
fi
if [[ -n "${PERF_RECORD:-}" && ! "${PERF_RECORD}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  err "PERF_RECORD is a version such as 0.2.0"
  exit 2
fi

E2E="${PROJECT_ROOT}/e2e"
OUT="${E2E}/out/perf"
PERF_PROJECT="mapstudio-perf"
SETTLE_S="${PERF_SETTLE_S:-120}"
MIN_TRIAL_S=2700
V010_URL="https://github.com/aott33/perspective-map-studio/releases/download/v0.1.0/Map-Studio-0.1.0.modl"
V010_SHA256="04caa07bb6da52718c527c99ce57cb0b580895ed7b5a0f6a389b20678d5f8930"
BASE=(docker compose -p "${MAPSTUDIO_CONTAINER}" -f "${OPS_DIR}/docker-compose.yml")
PERF=("${BASE[@]}" -f "${OPS_DIR}/docker-compose.perf.yml")
NOMODULE=("${PERF[@]}" -f "${OPS_DIR}/docker-compose.perf-nomodule.yml")
TABLES=(mapstudio_item mapstudio_edit mapstudio_batch mapstudio_kind_setup mapstudio_project)

require_docker
# The compose secrets the Gateway mounts (pg_password, map_token) must exist; generated when missing.
ensure_secrets

if [[ "${TARGET}" == "dev" ]]; then
  GW="${GATEWAY_URL}"
  TOKEN_FILE="${SECRETS_DIR}/api-token"
  GW_CONTAINER="${CONTAINER_NAME}"
else
  GW="${PERF_TEMPLATE_URL:-http://localhost:8088}"
  TOKEN_FILE="${PERF_TEMPLATE_DIR:?set PERF_TEMPLATE_DIR to the test stack checkout}/secrets/api-token"
  GW_CONTAINER="$(docker ps -q --filter label=com.docker.compose.project=ign-og-test --filter label=com.docker.compose.service=ignition | head -1)"
  DB_CONTAINER="$(docker ps -q --filter label=com.docker.compose.project=ign-og-test --filter label=com.docker.compose.service=db | head -1)"
  if [[ -z "${GW_CONTAINER}" || -z "${DB_CONTAINER}" ]]; then
    err "No running test stack (compose project ign-og-test, services ignition and db)."
    exit 2
  fi
  if [[ -z "${PERF_TEMPLATE_CONNECTION:-}" || ! -f "${PERF_EDITOR_PASSWORD_FILE:-/nonexistent}" ]]; then
    err "Set PERF_TEMPLATE_CONNECTION and PERF_EDITOR_PASSWORD_FILE (see the header of ops/perf.sh)."
    exit 2
  fi
  MAPSTUDIO_EDITOR_PASSWORD="$(head -1 "${PERF_EDITOR_PASSWORD_FILE}")"
  export MAPSTUDIO_EDITOR_PASSWORD
fi
if [[ ! -f "${TOKEN_FILE}" ]]; then
  err "No API token file for the ${TARGET} Gateway."
  exit 2
fi

# GET a Gateway route with the API token (on stdin as a header, never on the command line); prints the body.
api_get() {
  printf 'X-Ignition-API-Token: %s\n' "$(cat "${TOKEN_FILE}")" \
    | curl -fsS -m 15 -H @- "${GW}$1" 2>/dev/null || true
}

api_post() {
  printf 'X-Ignition-API-Token: %s\n' "$(cat "${TOKEN_FILE}")" \
    | curl -sS -m 30 -o /dev/null -w '%{http_code}' -X POST -H @- "${GW}$1" 2>/dev/null || true
}

check_trial() {
  local left
  left="$(api_get /data/api/v1/trial | python3 -I -c 'import json, sys
d = json.load(sys.stdin)
print(-1 if d.get("licenseMode") != "Trial" else int(d.get("trialSecondsLeft") or 0))' 2>/dev/null || echo "")"
  if [[ -z "${left}" ]]; then
    err "The Gateway at ${GW} did not answer GET /data/api/v1/trial."
    return 2
  fi
  if (( left >= 0 && left < MIN_TRIAL_S )); then
    err "The trial has $((left / 60)) minutes left; the run needs 45. Restart the Gateway (ops/up.sh --no-build) to reset it."
    return 2
  fi
  return 0
}

# SQL on the map store as the owner role (dev) or the given role (template).
store_sql() {
  if [[ "${TARGET}" == "dev" ]]; then
    "${BASE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -q -At -U mapstudio -d mapstudio "$@"
  else
    docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -q -At -U "${PERF_TEMPLATE_DB_USER:-mapstudio}" -d "${PERF_TEMPLATE_DB:-mapstudio}" "$@"
  fi
}

# Delete the perf project's rows, and only those, in one transaction.
wipe_perf() {
  local sql="BEGIN;"
  for t in "${TABLES[@]}"; do
    sql+=" DELETE FROM ${t} WHERE project = '${PERF_PROJECT}';"
  done
  sql+=" COMMIT;"
  store_sql -c "${sql}"
}

# Rows per project in every store table, one line per table and project (to compare before and after).
row_counts() {
  local sql=""
  for t in "${TABLES[@]}"; do
    sql+="SELECT '${t}', project, count(*) FROM ${t} GROUP BY project UNION ALL "
  done
  store_sql -c "${sql% UNION ALL } ORDER BY 1, 2" 2>/dev/null || echo "unreadable"
}

SAMPLER_PID=""
start_sampler() {
  local phase="$1"
  rm -f "${OUT}/samples-${phase}.jsonl"
  node "${E2E}/perf/sampler.mjs" --container "${GW_CONTAINER}" --gateway "${GW}" --token-file "${TOKEN_FILE}" \
    --out "${OUT}/samples-${phase}.jsonl" &
  SAMPLER_PID=$!
}

stop_sampler() {
  if [[ -n "${SAMPLER_PID}" ]]; then
    kill "${SAMPLER_PID}" 2>/dev/null || true
    wait "${SAMPLER_PID}" 2>/dev/null || true
    SAMPLER_PID=""
  fi
}

# Every secret this run can know (dev passwords, the admin password, the API token, the PostgreSQL
# password) must not be in any file under e2e/out. The patterns go to grep through a file descriptor.
secret_grep() {
  local secrets=() hits
  for v in MAPSTUDIO_EDITOR_PASSWORD MAPSTUDIO_OPERATOR_PASSWORD GATEWAY_ADMIN_PASSWORD; do
    [[ -n "${!v:-}" ]] && secrets+=("${!v}")
  done
  [[ -f "${TOKEN_FILE}" ]] && secrets+=("$(cat "${TOKEN_FILE}")")
  [[ "${TARGET}" == "dev" && -f "${SECRETS_DIR}/pg_password" ]] && secrets+=("$(cat "${SECRETS_DIR}/pg_password")")
  if [[ ${#secrets[@]} -eq 0 || ! -d "${E2E}/out" ]]; then
    return 0
  fi
  hits="$(grep -rlF -f <(printf '%s\n' "${secrets[@]}") "${E2E}/out" 2>/dev/null || true)"
  if [[ -n "${hits}" ]]; then
    err "A secret was found in these files under e2e/out; they are deleted:"
    echo "${hits}" >&2
    echo "${hits}" | while read -r f; do rm -f "${f}"; done
    return 1
  fi
  ok "e2e/out checked: no file holds a secret of this run."
}

# The v0.1.0 release's browser files, for the bundle measure: the public .modl, checked against the
# SHA-256 in ign-scada-template's module lock, its web jar's mounted/ folder extracted.
fetch_v010() {
  local dir="${OUT}/v0.1.0"
  rm -rf "${dir}"
  mkdir -p "${dir}/modl" "${dir}/mounted"
  if ! curl -fsSL -m 120 -o "${dir}/Map-Studio-0.1.0.modl" "${V010_URL}"; then
    warn "Could not download the v0.1.0 .modl; the bundle measure will be unavailable."
    return 0
  fi
  if [[ "$(sha256sum "${dir}/Map-Studio-0.1.0.modl" | cut -d' ' -f1)" != "${V010_SHA256}" ]]; then
    warn "The v0.1.0 .modl does not match its SHA-256; the bundle measure will be unavailable."
    rm -f "${dir}/Map-Studio-0.1.0.modl"
    return 0
  fi
  unzip -q -o "${dir}/Map-Studio-0.1.0.modl" 'web-*.jar' -d "${dir}/modl"
  unzip -q -o "${dir}"/modl/web-*.jar 'mounted/*' -d "${dir}"
  export PERF_BASELINE_DIR="${dir}/mounted"
}

wait_gateway_up() {
  wait_for_commissioned 60
  if [[ "$1" == "module" ]]; then
    wait_for_bundle 24
  fi
}

recreate() {
  local which="$1"
  case "${which}" in
    nomodule) "${NOMODULE[@]}" up -d gateway ;;
    main) "${PERF[@]}" up -d gateway ;;
    plain) "${BASE[@]}" up -d gateway ;;
  esac
}

# Template: copy the perf project in, with the connection of the map store written into its setup.
template_add_project() {
  local tmp
  tmp="$(mktemp -d)"
  cp -R "${OPS_DIR}/perf/project/." "${tmp}/"
  python3 -I - "${tmp}/com.aoindustrial.perspective.mapstudio/setup/setup.json" "${PERF_TEMPLATE_CONNECTION}" <<'PY'
import json, sys
path, connection = sys.argv[1], sys.argv[2]
with open(path) as f:
    setup = json.load(f)
setup['connection'] = connection
with open(path, 'w') as f:
    json.dump(setup, f, indent=2)
    f.write('\n')
PY
  docker cp "${tmp}/." "${GW_CONTAINER}:/usr/local/bin/ignition/data/projects/${PERF_PROJECT}"
  docker exec -u 0 "${GW_CONTAINER}" sh -c "chown -R \$(stat -c %u:%g /usr/local/bin/ignition/data/projects) /usr/local/bin/ignition/data/projects/${PERF_PROJECT}"
  rm -rf "${tmp}"
  [[ "$(api_post /data/api/v1/scan/projects)" == 2* ]] || { err "The project scan was refused."; return 1; }
  sleep 15
}

template_remove_project() {
  docker exec -u 0 "${GW_CONTAINER}" rm -rf "/usr/local/bin/ignition/data/projects/${PERF_PROJECT}" || true
  api_post /data/api/v1/scan/projects >/dev/null || true
}

# --- start ----------------------------------------------------------------------------------------

check_trial || exit 2
if [[ "${TARGET}" == "dev" ]]; then
  if ! "${BASE[@]}" ps --status running --services 2>/dev/null | grep -q '^gateway$'; then
    err "The dev Gateway is not running: start it with ops/up.sh."
    exit 2
  fi
else
  modules="$(api_get /data/api/v1/modules/healthy)"
  if ! printf '%s' "${modules}" | python3 -I -c 'import json, sys
d = json.load(sys.stdin)
v = [m.get("version", "") for m in d.get("items", []) if m.get("id") == "com.aoindustrial.perspective.mapstudio"]
sys.exit(0 if v and v[0].startswith("0.2.") else 1)'; then
    err "The test Gateway does not run Map Studio 0.2.x. Decision 3: hand-install the 0.2.0 candidate (the Gateway must allow unsigned modules), or run this after the 0.2.0 tag (story 13)."
    exit 2
  fi
fi

mkdir -p "${OUT}"
rm -f "${OUT}"/phase-*.json "${E2E}/out/perf.json"
ROWS_BEFORE="$(row_counts | grep -v "|${PERF_PROJECT}|" || true)"
if [[ "${TARGET}" == "template" ]]; then
  PROJECTS_BEFORE="$(docker exec "${GW_CONTAINER}" ls /usr/local/bin/ignition/data/projects | grep -vx "${PERF_PROJECT}" || true)"
fi
if [[ -z "${ONLY}" ]] || (cd "${E2E}" && node perf/only.mjs wants "${ONLY}" bundle); then
  fetch_v010
fi

restored=0
restore() {
  local status=$?
  (( restored )) && return 0
  restored=1
  set +e
  echo
  stop_sampler
  if [[ "${TARGET}" == "dev" ]]; then
    info "Restoring: the plain dev stack, no mapstudio-perf rows ..."
    recreate plain || err "could not recreate the plain Gateway; run ops/up.sh --no-build"
    wait_gateway_up module || err "the Gateway did not come back with the bundle after the restore"
    wipe_perf || err "could not delete the mapstudio-perf rows"
    if docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' "${GW_CONTAINER}" | grep -q "projects/${PERF_PROJECT}"; then
      err "the Gateway still mounts ${PERF_PROJECT}"; status=1
    fi
  else
    info "Restoring the test stack: removing mapstudio-perf (no compose up or down) ..."
    template_remove_project
    wipe_perf || err "could not delete the mapstudio-perf rows"
    local after
    after="$(docker exec "${GW_CONTAINER}" ls /usr/local/bin/ignition/data/projects | grep -vx "${PERF_PROJECT}" || true)"
    if [[ "${after}" != "${PROJECTS_BEFORE}" ]]; then
      err "the test Gateway's project list changed"; status=1
    fi
  fi
  local rows_after
  rows_after="$(row_counts | grep -v "|${PERF_PROJECT}|" || true)"
  if [[ "${rows_after}" != "${ROWS_BEFORE}" ]]; then
    err "the map store's rows of other projects changed during the run:"
    diff <(echo "${ROWS_BEFORE}") <(echo "${rows_after}") >&2
    status=1
  else
    ok "Other projects' rows unchanged; no ${PERF_PROJECT} rows left: $(row_counts | grep -c "|${PERF_PROJECT}|") tables hold any."
  fi
  rm -rf "${OUT}/results" "${OUT}/v0.1.0/modl"
  secret_grep || status=1
  # exit, not return: a status set here (a secret found, other rows changed) must be the run's.
  exit "${status}"
}
trap restore EXIT

export MAPSTUDIO_E2E_PROJECT="${PERF_PROJECT}"
export PERF_TOKEN_FILE="${TOKEN_FILE}"
export PERF_TARGET="${TARGET}"
export GATEWAY_URL="${GW}"
runner_failed=0
for phase in "${PHASES[@]}"; do
  echo
  info "Phase ${phase} (${TARGET})"
  if [[ "${TARGET}" == "dev" ]]; then
    if [[ "${phase}" == "main" ]]; then
      "${BASE[@]}" stop gateway >/dev/null
      wipe_perf
      recreate main
      wait_gateway_up module
    else
      recreate nomodule
      wait_gateway_up nomodule
      wipe_perf
    fi
  else
    wipe_perf
    template_add_project
  fi
  check_trial || exit 2
  info "Settling ${SETTLE_S} s before the measures ..."
  sleep "${SETTLE_S}"
  start_sampler "${phase}"
  if ! (cd "${E2E}" && PERF_PHASE="${phase}" PERF_SAMPLES="${OUT}/samples-${phase}.jsonl" \
      npx playwright test -c perf/playwright.perf.config.mjs); then
    err "The runner failed in phase ${phase}."
    runner_failed=1
  fi
  stop_sampler
done

echo
info "Result (e2e/out/perf.json):"
merge_args=(merge)
if [[ -n "${PERF_RECORD:-}" ]]; then
  if (( runner_failed )); then
    warn "The runner failed, so docs/perf is not written."
  else
    merge_args+=(--record "${PERF_RECORD}" --target "${TARGET}")
  fi
fi
set +e
(cd "${E2E}" && node perf/result.mjs "${merge_args[@]}")
code=$?
set -e
if (( runner_failed )) || (( code == 1 )); then
  exit 1
fi

# The comparison with the last record of this target (the newest version in docs/perf/), the rows of
# the wanted measures only with --only.
LAST_RECORD="${PERF_COMPARE:-$(find "${PROJECT_ROOT}/docs/perf" -maxdepth 1 -name "*-${TARGET}.json" | sort -V | tail -1)}"
if [[ -n "${LAST_RECORD}" && -f "${LAST_RECORD}" ]]; then
  echo
  info "Compared with ${LAST_RECORD#"${PROJECT_ROOT}"/} (record -> this run):"
  compare_args=("${LAST_RECORD}" "${E2E}/out/perf.json")
  [[ -n "${ONLY}" ]] && compare_args+=(--only "${ONLY}")
  (cd "${E2E}" && node perf/compare.mjs "${compare_args[@]}") || true
else
  warn "No docs/perf/*-${TARGET}.json record to compare with."
fi
exit "${code}"
