#!/usr/bin/env bash
# The short release smoke (epic 3 entry 4): after every tag, and for a patch release, prove the
# published release the way docs/template-install.md "0.2.0 release" did by hand, in minutes, from
# committed scripts. RELEASING.md, "Checks by release type", says when to run it.
#
# Usage:
#   ops/release-smoke.sh <version> [--lock <file> | --template <dir>] [--image <image>] [--keep]
#
#   <version>        the published release, for example 0.2.0 (tag v0.2.0)
#   --lock <file>    a module lock to check (the template's modules/modules.lock.json, or a file
#                    holding the entry alone); the entry with Map Studio's id and this version is
#                    compared field by field with the expected entry
#   --template <dir> a checkout of ign-scada-template: its modules/modules.lock.json as --lock
#   --image <image>  the Gateway image; default ign-og/ignition:8.3.9-modules (the template's) when
#                    Docker has it, else inductiveautomation/ignition:8.3.9 (the version the template
#                    pins), the published module in both cases. Also SMOKE_IMAGE.
#   --keep           leave the smoke stack running at the end (ops/release-smoke.sh --down removes it)
#   --down           only remove the smoke stack and its volumes
#
# Without --lock or --template the expected entry is built from RELEASING.md's lock-entry shape plus
# the published release's values: `sha256` from the release's .sha256 asset, `certSha256` from the
# README's "Signing certificate SHA-256" line. Owner decision 2026-10-28: the template stays on 0.1.0
# until the cutover, so the smoke never needs the template's committed lock to hold the version.
#
# Checks, in order (a failure prints x and exits 1; the first three run before any container starts):
#   1. the lock entry (when given) equals the expected entry;
#   2. the downloaded asset's SHA-256 equals the release's .sha256 (and the entry's);
#   3. scripts/ci/modl-verify.sh: signed, every file signed, the certificate's fingerprint equals the
#      README's, module.xml's version equals the version;
#   4. a Gateway from the chosen image with that .modl as its only external module and a PostgreSQL
#      database beside it (ops/docker-compose.yml plus ops/docker-compose.smoke.yml: no field
#      simulator, broker or feedback stub, no allowunsignedmodules, so the Gateway's own signature
#      check runs), its own compose project <MAPSTUDIO_CONTAINER>-smoke on port SMOKE_HTTP_PORT
#      (default 9089) with fresh volumes;
#   5. GET /data/api/v1/modules/healthy lists the module ACTIVE at the version;
#   6. e2e/rehearsal/release.spec.mjs: two Chromium instances signed in as the dev map editor on
#      /edit; a line drawn in the first is on the second's map within 5 s with no reload;
#   7. every mapstudio_schema_version row records module_version equal to the version.
# On exit (the EXIT trap) the stack and its volumes are removed (unless --keep) and e2e/out is searched
# for every secret this run could know; a hit deletes the file and fails the run.
#
# Settings, from the environment:
#   SMOKE_HTTP_PORT        the host port of the smoke Gateway (default 9089; the dev stack keeps its own)
#   SMOKE_IMAGE            the Gateway image (see --image)
#   SMOKE_SHA256, SMOKE_CERT_SHA256, SMOKE_MODULE_VERSION
#                          replace one expected value each (the asset's SHA-256, the certificate
#                          fingerprint, the module_version the store must record): the way to prove
#                          the three failure paths, as the entry's verify line asks
#   SMOKE_RELEASE_BASE     the release download base (default the public GitHub releases of
#                          aott33/perspective-map-studio)
#   PW_CHROMIUM_PATH       a Chromium for Playwright when the pinned one is not installed
# Secrets (the admin password, the dev users' passwords, the API token, the PostgreSQL password) are
# the dev stack's, read from the git-ignored .env and ops/secrets by ops/lib.sh, never printed.
#
# Exit: 0 every check passed, 1 a check failed or a crash, 2 refused before anything started.

# The cleanup function runs from the EXIT trap, which shellcheck does not follow (SC2317).
# shellcheck disable=SC2317,SC2329
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

VERSION=""
LOCK_FILE=""
IMAGE="${SMOKE_IMAGE:-}"
KEEP=""
DOWN_ONLY=""
for ((i = 1; i <= $#; i++)); do
  case "${!i}" in
    --lock) i=$((i + 1)); LOCK_FILE="${!i:-}" ;;
    --template) i=$((i + 1)); LOCK_FILE="${!i:-}/modules/modules.lock.json" ;;
    --image) i=$((i + 1)); IMAGE="${!i:-}" ;;
    --keep) KEEP="yes" ;;
    --down) DOWN_ONLY="yes" ;;
    -h|--help) sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) err "Unknown argument: ${!i}"; exit 2 ;;
    *)
      if [[ -n "${VERSION}" ]]; then err "One version only: ${VERSION} and ${!i}"; exit 2; fi
      VERSION="${!i}" ;;
  esac
done

# --- the smoke's own stack: the dev compose file under another project name and port -----------
SMOKE_PROJECT="${MAPSTUDIO_CONTAINER}-smoke"
export MAPSTUDIO_CONTAINER="${SMOKE_PROJECT}"
export GATEWAY_HTTP_PORT="${SMOKE_HTTP_PORT:-9089}"
GATEWAY_URL="http://localhost:${GATEWAY_HTTP_PORT}"
export GATEWAY_URL
E2E="${PROJECT_ROOT}/e2e"
WORK="${E2E}/out/smoke"
export SMOKE_MODULES_DIR="${WORK}/modules"
COMPOSE=(docker compose -p "${SMOKE_PROJECT}" -f "${OPS_DIR}/docker-compose.yml" -f "${OPS_DIR}/docker-compose.smoke.yml")

require_docker

if [[ -n "${DOWN_ONLY}" ]]; then
  export SMOKE_IMAGE="${IMAGE:-inductiveautomation/ignition:8.3.9}"
  mkdir -p "${SMOKE_MODULES_DIR}"
  "${COMPOSE[@]}" down -v --remove-orphans
  ok "The smoke stack ${SMOKE_PROJECT} is removed."
  exit 0
fi
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  err "Usage: ops/release-smoke.sh <version> [--lock <file> | --template <dir>] [--image <image>] [--keep]"
  exit 2
fi
if [[ -n "${LOCK_FILE}" && ! -f "${LOCK_FILE}" ]]; then
  err "No lock file at ${LOCK_FILE}."
  exit 2
fi
for tool in curl unzip keytool openssl python3 node; do
  command -v "${tool}" >/dev/null 2>&1 || { err "${tool} is required."; exit 2; }
done
if [[ -z "${IMAGE}" ]]; then
  if docker image inspect ign-og/ignition:8.3.9-modules >/dev/null 2>&1; then
    IMAGE="ign-og/ignition:8.3.9-modules"
  else
    IMAGE="inductiveautomation/ignition:8.3.9"
  fi
fi
export SMOKE_IMAGE="${IMAGE}"
# The cloud box has a Chromium the pinned Playwright cannot find itself (e2e/playwright.config.mjs).
if [[ -z "${PW_CHROMIUM_PATH:-}" && -x /opt/pw-browsers/chromium ]]; then
  export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium
fi

# --- the expected lock entry ------------------------------------------------------------------
ID="${MODULE_ID}"
FILE="Map-Studio-${VERSION}.modl"
BASE_URL="${SMOKE_RELEASE_BASE:-https://github.com/aott33/perspective-map-studio/releases/download}"
URL="${BASE_URL}/v${VERSION}/${FILE}"
README_FP="$(sed -n 's/^Signing certificate SHA-256: \([0-9A-Fa-f:]*\).*/\1/p' "${PROJECT_ROOT}/README.md" | head -1)"
if [[ -z "${README_FP}" ]]; then
  err "README.md has no 'Signing certificate SHA-256: <fingerprint>' line."
  exit 2
fi

START_S="$(date +%s)"
STEP_S="${START_S}"
PASSED=()
# A passed check, with the seconds since the previous one.
pass() {
  local now
  now="$(date +%s)"
  ok "$1 ($((now - STEP_S)) s)"
  STEP_S="${now}"
  PASSED+=("$1")
}
fail() { err "$1"; exit 1; }

rm -rf "${WORK:?}"
mkdir -p "${SMOKE_MODULES_DIR}" "${WORK}/download"
info "Release smoke for Map Studio ${VERSION} (image ${IMAGE}, compose project ${SMOKE_PROJECT}, port ${GATEWAY_HTTP_PORT})"

info "Downloading the release's .sha256 asset ..."
curl -fsSL -m 120 -o "${WORK}/download/${FILE}.sha256" "${URL}.sha256" \
  || fail "Could not download ${URL}.sha256 (is v${VERSION} published?)"
RELEASE_SHA256="$(awk 'NR == 1 { print tolower($1) }' "${WORK}/download/${FILE}.sha256")"
[[ "${RELEASE_SHA256}" =~ ^[0-9a-f]{64}$ ]] || fail "The release's .sha256 asset does not start with a SHA-256: $(head -c 100 "${WORK}/download/${FILE}.sha256")"
EXPECT_SHA256="${SMOKE_SHA256:-${RELEASE_SHA256}}"
EXPECT_CERT="${SMOKE_CERT_SHA256:-${README_FP}}"
EXPECT_MODULE_VERSION="${SMOKE_MODULE_VERSION:-${VERSION}}"
[[ -n "${SMOKE_SHA256:-}" ]] && warn "SMOKE_SHA256 replaces the release's SHA-256 (a failure test)."
[[ -n "${SMOKE_CERT_SHA256:-}" ]] && warn "SMOKE_CERT_SHA256 replaces the README's fingerprint (a failure test)."
[[ -n "${SMOKE_MODULE_VERSION:-}" ]] && warn "SMOKE_MODULE_VERSION replaces the version the store must record (a failure test)."

# The expected entry, RELEASING.md's shape with the release's values.
EXPECTED_JSON="$(ID="${ID}" VERSION="${VERSION}" FILE="${FILE}" URL="${URL}" SHA="${EXPECT_SHA256}" CERT="${EXPECT_CERT}" python3 -I -c '
import json, os
print(json.dumps({
    "id": os.environ["ID"], "name": "Map Studio", "version": os.environ["VERSION"],
    "requiredIgnitionVersion": "8.3.0", "file": os.environ["FILE"], "url": os.environ["URL"],
    "sha256": os.environ["SHA"], "certSha256": os.environ["CERT"],
    "licence": {"name": "Apache-2.0", "commercial": False},
    "upstream": {"type": "github", "repo": "aott33/perspective-map-studio", "asset": "Map-Studio-.*\\.modl", "tag": "v" + os.environ["VERSION"]}
}, indent=2))')"
echo "${EXPECTED_JSON}" > "${WORK}/expected-entry.json"
info "Expected lock entry (e2e/out/smoke/expected-entry.json): sha256 ${EXPECT_SHA256}, certSha256 ${EXPECT_CERT}"

# 1. The given lock's entry equals the expected one.
if [[ -n "${LOCK_FILE}" ]]; then
  info "Checking the lock entry in ${LOCK_FILE} ..."
  if ! python3 -I - "${LOCK_FILE}" "${WORK}/expected-entry.json" <<'PY'
import json, sys
lock_path, expected_path = sys.argv[1], sys.argv[2]
with open(expected_path) as f:
    expected = json.load(f)
with open(lock_path) as f:
    lock = json.load(f)
# The lock is a list of entries, an object holding one under "modules" (or any list value), one
# keyed by module id, or the entry alone [not verified against the template: its own tool reads it].
entries = []
if isinstance(lock, list):
    entries = lock
elif isinstance(lock, dict):
    if "id" in lock:
        entries = [lock]
    else:
        for value in lock.values():
            if isinstance(value, list):
                entries += [e for e in value if isinstance(e, dict)]
            elif isinstance(value, dict) and "version" in value:
                entries.append(value)
mine = [e for e in entries if e.get("id") == expected["id"]]
hit = [e for e in mine if str(e.get("version")) == expected["version"]]
if not hit:
    have = ", ".join(sorted(str(e.get("version")) for e in mine)) or "none"
    print("x   the lock holds no entry for %s %s (versions found: %s). Owner decision 2026-10-28: the template"
          " stays on 0.1.0 until the cutover; run without --lock/--template to check the published release"
          " against the expected entry, or give a file holding the entry." % (expected["id"], expected["version"], have))
    sys.exit(1)
entry = hit[0]
def norm(value, key):
    value = "" if value is None else str(value)
    return value.replace(":", "").upper() if key == "certSha256" else (value.lower() if key == "sha256" else value)
bad = []
for key in ("id", "version", "file", "url", "sha256", "certSha256", "requiredIgnitionVersion"):
    if norm(entry.get(key), key) != norm(expected[key], key):
        bad.append("%s: lock %r, expected %r" % (key, entry.get(key), expected[key]))
tag = (entry.get("upstream") or {}).get("tag")
if tag != expected["upstream"]["tag"]:
    bad.append("upstream.tag: lock %r, expected %r" % (tag, expected["upstream"]["tag"]))
if bad:
    print("x   the lock entry differs from the expected entry:\n    " + "\n    ".join(bad))
    sys.exit(1)
print("    lock entry %s %s: id, version, file, url, sha256, certSha256, requiredIgnitionVersion and upstream.tag as expected" % (entry["id"], entry["version"]))
PY
  then
    fail "Lock entry check failed."
  fi
  pass "lock entry"
fi

# 2. The downloaded asset's SHA-256.
info "Downloading ${URL} ..."
curl -fsSL -m 300 -o "${WORK}/download/${FILE}" "${URL}" || fail "Could not download ${URL}"
GOT_SHA256="$(sha256sum "${WORK}/download/${FILE}" | cut -d' ' -f1)"
if [[ "${GOT_SHA256}" != "${EXPECT_SHA256}" ]]; then
  fail "SHA-256 mismatch for ${FILE}: downloaded ${GOT_SHA256}, expected ${EXPECT_SHA256} (the release's .sha256 says ${RELEASE_SHA256})"
fi
if [[ "${GOT_SHA256}" != "${RELEASE_SHA256}" ]]; then
  fail "The release's .sha256 asset (${RELEASE_SHA256}) does not match the download (${GOT_SHA256})"
fi
pass "SHA-256 ${GOT_SHA256} ($(stat -c %s "${WORK}/download/${FILE}") bytes)"

# 3. Structure, certificate fingerprint and module.xml version.
info "scripts/ci/modl-verify.sh ..."
if ! bash "${PROJECT_ROOT}/scripts/ci/modl-verify.sh" "${WORK}/download/${FILE}" "${EXPECT_CERT}" "${VERSION}"; then
  fail "modl-verify.sh refused ${FILE} (expected certificate ${EXPECT_CERT}, version ${VERSION})"
fi
pass "modl-verify.sh: signed, certificate ${EXPECT_CERT}, module.xml ${VERSION}"

# --- 4. The stack ------------------------------------------------------------------------------
cp "${WORK}/download/${FILE}" "${SMOKE_MODULES_DIR}/"
ensure_secrets

# The Gateway's REST routes with the dev API key (a header from stdin, never on the command line).
TOKEN_FILE="${SECRETS_DIR}/api-token"
api_get() {
  printf 'X-Ignition-API-Token: %s\n' "$(cat "${TOKEN_FILE}")" \
    | curl -fsS -m 15 -H @- "${GATEWAY_URL}$1" 2>/dev/null || true
}

# Every secret this run can know must not be in any file under e2e/out (as ops/perf.sh).
secret_grep() {
  local secrets=() hits
  for v in MAPSTUDIO_EDITOR_PASSWORD MAPSTUDIO_OPERATOR_PASSWORD GATEWAY_ADMIN_PASSWORD; do
    [[ -n "${!v:-}" ]] && secrets+=("${!v}")
  done
  [[ -f "${TOKEN_FILE}" ]] && secrets+=("$(cat "${TOKEN_FILE}")")
  [[ -f "${SECRETS_DIR}/pg_password" ]] && secrets+=("$(cat "${SECRETS_DIR}/pg_password")")
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

cleaned=0
cleanup() {
  local status=$?
  (( cleaned )) && return 0
  cleaned=1
  set +e
  echo
  if [[ -n "${KEEP}" && ${status} -eq 0 ]]; then
    info "Keeping the smoke stack ${SMOKE_PROJECT} at ${GATEWAY_URL} (ops/release-smoke.sh --down removes it)."
  else
    info "Removing the smoke stack ${SMOKE_PROJECT} and its volumes ..."
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || err "could not remove the smoke stack; run ops/release-smoke.sh --down"
  fi
  rm -f "${SMOKE_MODULES_DIR}"/*.modl
  secret_grep || status=1
  local total=$(( $(date +%s) - START_S ))
  echo
  if (( status == 0 )); then
    ok "Release smoke ${VERSION} passed in $((total / 60)) min $((total % 60)) s (image ${IMAGE}): ${#PASSED[@]} checks."
  else
    err "Release smoke ${VERSION} FAILED after $((total / 60)) min $((total % 60)) s (image ${IMAGE}); passed: ${PASSED[*]:-none}."
  fi
  exit "${status}"
}
trap cleanup EXIT

info "Starting the smoke Gateway (${IMAGE}) and PostgreSQL from fresh volumes ..."
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${COMPOSE[@]}" up -d
wait_for_gateway 60 || fail "The smoke Gateway did not answer."
wait_for_commissioned 60 || fail "The smoke Gateway did not reach RUNNING (ops/logs.sh does not know this stack: docker logs ${SMOKE_PROJECT})."
wait_for_bundle 24 || fail "The Gateway does not serve the module bundle: the module was not installed or started (docker logs ${SMOKE_PROJECT})."
ensure_dev_security
ensure_dev_users
pass "Gateway RUNNING with the module's bundle served"

# 5. The module is ACTIVE at the version.
info "Checking the module list ..."
MODULES="$(api_get /data/api/v1/modules/healthy)"
if ! MODULES_JSON="${MODULES}" ID="${ID}" VERSION="${VERSION}" python3 -I -c '
import json, os, sys
d = json.loads(os.environ["MODULES_JSON"] or "{}")
mine = [m for m in d.get("items", []) if m.get("id") == os.environ["ID"]]
if not mine:
    print("x   the Gateway does not list %s among its healthy modules" % os.environ["ID"]); sys.exit(1)
m = mine[0]
state, version = m.get("state"), str(m.get("version"))
print("    %s %s (%s)" % (m.get("id"), version, state))
# The route says "0.2.0 (b0)": the version, then the build number [live 8.3.9].
sys.exit(0 if state == "ACTIVE" and version.split(" ")[0] == os.environ["VERSION"] else 1)'; then
  fail "The module is not ACTIVE at ${VERSION} (GET /data/api/v1/modules/healthy)"
fi
pass "module ${ID} ${VERSION} ACTIVE"

# 6. The browser checks.
info "Browser checks (e2e/rehearsal/release.spec.mjs) ..."
if ! (cd "${E2E}" && npx playwright test -c rehearsal/playwright.rehearsal.config.mjs); then
  fail "The browser checks failed (e2e/out/rehearsal)."
fi
if [[ -f "${E2E}/out/rehearsal/result.json" ]]; then
  pass "a line saved in browser A was on browser B's map after $(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["seenAfterMs"])' "${E2E}/out/rehearsal/result.json") ms, no reload"
else
  fail "The browser checks wrote no e2e/out/rehearsal/result.json."
fi

# 7. module_version in the store.
info "Checking mapstudio_schema_version.module_version ..."
ROWS="$("${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -q -At -U mapstudio -d mapstudio \
  -c "SELECT version, module_version FROM mapstudio_schema_version ORDER BY version" 2>&1)" \
  || fail "Could not read mapstudio_schema_version: ${ROWS}"
[[ -n "${ROWS}" ]] || fail "mapstudio_schema_version has no row: the store was not migrated (the dev setup names connection MapStudio)."
BAD=""
while IFS='|' read -r schema module; do
  echo "    schema version ${schema}: module_version ${module}"
  [[ "${module}" == "${EXPECT_MODULE_VERSION}" ]] || BAD="${BAD} ${schema}=${module}"
done <<< "${ROWS}"
if [[ -n "${BAD}" ]]; then
  fail "module_version mismatch in mapstudio_schema_version (expected ${EXPECT_MODULE_VERSION}):${BAD}"
fi
pass "module_version ${EXPECT_MODULE_VERSION} on every schema version row"
