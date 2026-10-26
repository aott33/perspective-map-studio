#!/usr/bin/env bash
# Shared helpers for the ops/ scripts. Sourced by the other scripts; not run directly.

set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${OPS_DIR}/.." && pwd)"
MODULES_DIR="${OPS_DIR}/modules"

# Must match MODULE_ID in common/.../MapStudioModule.java and the root build.
MODULE_ID="com.aoindustrial.perspective.mapstudio"
# CONTAINER_NAME is set below, after .env is read (it may set MAPSTUDIO_CONTAINER).
PROJECT_NAME="mapstudio-dev"
BUNDLE_PATH="/res/mapstudio/MapStudio.js"

# Java 17 for Gradle (the module's toolchain), from JAVA_17_HOME or a known place.
for candidate in \
    "${JAVA_17_HOME:-}" \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/temurin-17-jdk-amd64 \
    "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"; do
  if [[ -n "${candidate}" && -x "${candidate}/bin/java" ]]; then
    export JAVA_HOME="${candidate}"
    break
  fi
done

# Host port overrides from .env (if present) so the printed URL matches compose.
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${PROJECT_ROOT}/.env"; set +a
fi
# The dev Gateway's admin password is never committed: generated once into the
# git-ignored .env at the repository root and reused from there.
if [[ -z "${GATEWAY_ADMIN_PASSWORD:-}" ]]; then
  GATEWAY_ADMIN_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
  ( umask 077; echo "GATEWAY_ADMIN_PASSWORD=${GATEWAY_ADMIN_PASSWORD}" >> "${PROJECT_ROOT}/.env" )
  chmod 600 "${PROJECT_ROOT}/.env"
fi
export GATEWAY_ADMIN_PASSWORD
# Each checkout its own compose project, containers and volumes. MAPSTUDIO_CONTAINER
# in .env (or the environment) names them; without it, a name derived from this
# checkout's path is recorded in .env on first run, so two checkouts never share
# (and never --fresh or --purge) each other's Gateway or PostgreSQL.
if [[ -z "${MAPSTUDIO_CONTAINER:-}" ]]; then
  MAPSTUDIO_CONTAINER="ms-$(printf '%s' "${PROJECT_ROOT}" | sha256sum | cut -c1-8)"
  ( umask 077; echo "MAPSTUDIO_CONTAINER=${MAPSTUDIO_CONTAINER}" >> "${PROJECT_ROOT}/.env" )
  chmod 600 "${PROJECT_ROOT}/.env"
fi
export MAPSTUDIO_CONTAINER
CONTAINER_NAME="${MAPSTUDIO_CONTAINER}"
# The dev map editor's password (user mapeditor, role MapEditor; ops/users.py), generated the same way.
if [[ -z "${MAPSTUDIO_EDITOR_PASSWORD:-}" ]]; then
  MAPSTUDIO_EDITOR_PASSWORD="$(python3 -I -c 'import secrets, string
a = string.ascii_letters + string.digits
while True:
    v = "".join(secrets.choice(a) for _ in range(20))
    if any(c.islower() for c in v) and any(c.isupper() for c in v) and any(c.isdigit() for c in v) \
            and not any(v[i] == v[i + 1] == v[i + 2] for i in range(18)):
        print(v)
        break')"
  ( umask 077; echo "MAPSTUDIO_EDITOR_PASSWORD=${MAPSTUDIO_EDITOR_PASSWORD}" >> "${PROJECT_ROOT}/.env" )
  chmod 600 "${PROJECT_ROOT}/.env"
fi
export MAPSTUDIO_EDITOR_PASSWORD
SECRETS_DIR="${OPS_DIR}/secrets"
GATEWAY_HTTP_PORT="${GATEWAY_HTTP_PORT:-9088}"
GATEWAY_URL="http://localhost:${GATEWAY_HTTP_PORT}"
SESSION_URL="${GATEWAY_URL}/data/perspective/client/${PROJECT_NAME}"
ADMIN_USER="admin"
ADMIN_PASS="${GATEWAY_ADMIN_PASSWORD}"

# docker compose, always pointed at this folder's compose file and at this
# checkout's own compose project (MAPSTUDIO_CONTAINER, above), so parallel
# Gateways get separate containers, volumes and networks.
COMPOSE=(docker compose -p "${MAPSTUDIO_CONTAINER}" -f "${OPS_DIR}/docker-compose.yml")

# --- logging --------------------------------------------------------------
if [[ -t 1 ]]; then
  C_BLUE=$'\033[34m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_RESET=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi
info()  { echo "${C_BLUE}==>${C_RESET} $*"; }
ok()    { echo "${C_GREEN}ok${C_RESET}  $*"; }
warn()  { echo "${C_YELLOW}!${C_RESET}   $*"; }
err()   { echo "${C_RED}x${C_RESET}   $*" >&2; }

# --- guards ---------------------------------------------------------------
require_docker() {
  if ! docker info >/dev/null 2>&1; then
    err "Docker does not appear to be running."
    exit 1
  fi
}

# --- secrets --------------------------------------------------------------
# Generate the dev stack's secrets (ops/gen_secrets.py) into the git-ignored
# ops/secrets/. A kept PostgreSQL volume of this checkout's compose project was
# initialised with the old password, so a missing pg_password next to it is
# refused, not regenerated. Other checkouts' volumes are never looked at.
ensure_secrets() {
  local volume
  volume="${MAPSTUDIO_CONTAINER}_postgres-data"
  if [[ ! -f "${SECRETS_DIR}/pg_password" ]] && docker volume inspect "${volume}" >/dev/null 2>&1; then
    err "ops/secrets/pg_password is missing but the PostgreSQL volume ${volume} exists (it holds the old password)."
    err "Start from fresh volumes: ops/up.sh --fresh (or ops/down.sh --purge first)."
    exit 1
  fi
  python3 -I "${OPS_DIR}/gen_secrets.py"
}

# --- dev security properties ----------------------------------------------
# The dev API key (security level Authenticated/ApiKeys/MapStudioDev) needs that
# level in the Gateway's Read and Write permissions. The first boot's
# commissioning writes core security-properties itself [live 8.3.10], so after
# the first RUNNING the Gateway's own file is patched (ops/dev_security.py adds
# that level and keeps everything else, the identity provider name included),
# followed by one restart. Dev Gateway only.
SECPROPS_PATH="/usr/local/bin/ignition/data/config/resources/core/ignition/security-properties"
ensure_dev_security() {
  if "${COMPOSE[@]}" exec -T gateway grep -q MapStudioDev "${SECPROPS_PATH}/config.json" 2>/dev/null; then
    return 0
  fi
  info "Allowing the dev API key in the Gateway's security properties (one restart) ..."
  local tmp="${SECRETS_DIR}/security-properties.json"
  "${COMPOSE[@]}" cp "gateway:${SECPROPS_PATH}/config.json" "${tmp}"
  python3 -I "${OPS_DIR}/dev_security.py" "${tmp}" || [[ $? -eq 3 ]]
  "${COMPOSE[@]}" cp "${tmp}" "gateway:${SECPROPS_PATH}/config.json"
  rm -f "${tmp}"
  "${COMPOSE[@]}" exec -T -u root gateway chown -R ignition:ignition "${SECPROPS_PATH}"
  "${COMPOSE[@]}" restart gateway
  wait_for_commissioned 60
  wait_for_bundle 24
}

# --- dev users ------------------------------------------------------------
# Create or update the dev map editor (mapeditor, role MapEditor) and the empty
# role MapOperator through the Gateway's SCIM routes (ops/users.py).
ensure_dev_users() {
  info "Creating the dev map editor user (mapeditor, role MapEditor) ..."
  GW_URL="${GATEWAY_URL}" python3 -I "${OPS_DIR}/users.py"
}

# --- build and stage ------------------------------------------------------
# Build the module (unsigned) and copy the fresh .modl into ops/modules, which
# the Gateway reads as its external modules folder.
build_and_stage_module() {
  info "Building the module with Gradle (the first build downloads Gradle, Node and dependencies)..."
  ( cd "${PROJECT_ROOT}" && ./gradlew build --console plain \
      -Dorg.gradle.java.installations.auto-download=false )

  # Prefer a signed .modl when signing properties were given; otherwise the
  # plain build's *.unsigned.modl is the artifact.
  local modl
  modl="$(find "${PROJECT_ROOT}/build" -maxdepth 1 -name '*.modl' ! -name '*.unsigned.modl' | head -1)"
  if [[ -z "${modl}" ]]; then
    modl="$(find "${PROJECT_ROOT}/build" -maxdepth 1 -name '*.unsigned.modl' | head -1)"
  fi
  if [[ -z "${modl}" ]]; then
    err "No .modl found under build/ after the build."
    exit 1
  fi

  mkdir -p "${MODULES_DIR}"
  rm -f "${MODULES_DIR}"/*.modl 2>/dev/null || true
  cp "${modl}" "${MODULES_DIR}/"
  ok "Staged $(basename "${modl}") -> ops/modules/"
}

# --- waiting --------------------------------------------------------------
wait_for_gateway() {
  local tries="${1:-60}"
  info "Waiting for the Gateway to respond at ${GATEWAY_URL} ..."
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS "${GATEWAY_URL}/StatusPing" 2>/dev/null | grep -q '"state"'; then
      ok "Gateway is responding."
      return 0
    fi
    sleep 5
  done
  warn "Gateway did not respond after $((tries * 5))s. Check 'ops/logs.sh'."
  return 1
}

# Wait until the Gateway is RUNNING with no commissioning or fault detail.
wait_for_commissioned() {
  local tries="${1:-60}"
  info "Waiting for the Gateway to be commissioned and RUNNING ..."
  for ((i = 1; i <= tries; i++)); do
    if [[ "$(curl -fsS "${GATEWAY_URL}/StatusPing" 2>/dev/null)" == '{"state":"RUNNING"}' ]]; then
      ok "Gateway is commissioned and running."
      return 0
    fi
    sleep 5
  done
  err "Gateway did not reach a clean RUNNING state after $((tries * 5))s. Check 'ops/logs.sh'."
  return 1
}

# Wait until the Gateway serves the web bundle (module started and mounted).
wait_for_bundle() {
  local tries="${1:-24}"
  info "Waiting for the Gateway to serve the Map Studio bundle ..."
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null "${GATEWAY_URL}${BUNDLE_PATH}" 2>/dev/null; then
      ok "Bundle served at ${GATEWAY_URL}${BUNDLE_PATH}"
      return 0
    fi
    sleep 5
  done
  err "Gateway is up but not serving the module bundle. Is the module installed and accepted?"
  return 1
}
