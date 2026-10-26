#!/usr/bin/env bash
# Shared helpers for the ops/ scripts. Sourced by the other scripts; not run directly.

set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${OPS_DIR}/.." && pwd)"
MODULES_DIR="${OPS_DIR}/modules"

# Must match MODULE_ID in common/.../MapStudioModule.java and the root build.
MODULE_ID="com.aoindustrial.perspective.mapstudio"
CONTAINER_NAME="${MAPSTUDIO_CONTAINER:-mapstudio-ignition}"
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
GATEWAY_HTTP_PORT="${GATEWAY_HTTP_PORT:-9088}"
GATEWAY_URL="http://localhost:${GATEWAY_HTTP_PORT}"
SESSION_URL="${GATEWAY_URL}/data/perspective/client/${PROJECT_NAME}"
ADMIN_USER="admin"
ADMIN_PASS="${GATEWAY_ADMIN_PASSWORD}"

# docker compose, always pointed at this folder's compose file.
# The compose project follows MAPSTUDIO_CONTAINER when set, so parallel Gateways
# get separate volumes and networks; otherwise compose's default (this folder's
# name, "ops") applies.
COMPOSE=(docker compose)
if [[ -n "${MAPSTUDIO_CONTAINER:-}" ]]; then
  COMPOSE+=(-p "${MAPSTUDIO_CONTAINER}")
fi
COMPOSE+=(-f "${OPS_DIR}/docker-compose.yml")

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
