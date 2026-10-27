#!/usr/bin/env bash
# Build the module, stage it and bring up the local dev Gateway with it loaded.
#
# Usage:
#   ops/up.sh           Build, stage and (re)start the Gateway. On a fresh volume
#                       the Gateway is commissioned unattended, module included
#                       (ACCEPT_MODULE_* in docker-compose.yml); no browser wizard.
#   ops/up.sh --fresh   Wipe the Gateway data first (fresh trial, fresh acceptance).
#   ops/up.sh --no-build  Skip the Gradle build; stage nothing, just (re)start.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

FRESH=""
BUILD="yes"
for arg in "$@"; do
  case "${arg}" in
    --fresh) FRESH="yes" ;;
    --no-build) BUILD="" ;;
    *) err "Unknown argument: ${arg}"; exit 2 ;;
  esac
done

require_docker
if [[ -n "${BUILD}" ]]; then
  build_and_stage_module
fi

if [[ -n "${FRESH}" ]]; then
  info "Recreating the Gateway and PostgreSQL from fresh volumes..."
  "${COMPOSE[@]}" down -v --remove-orphans
fi
ensure_secrets

running=""
if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -q '^gateway$'; then
  running="yes"
fi

if [[ -n "${running}" ]]; then
  info "Restarting the Gateway to load the staged build..."
  "${COMPOSE[@]}" restart gateway
  wait_for_commissioned 60
else
  info "Starting the Gateway container..."
  "${COMPOSE[@]}" up -d
  # First boot: the EULA, admin user and edition commission headlessly from the
  # compose environment, and ACCEPT_MODULE_LICENSES / ACCEPT_MODULE_CERTS accept
  # the staged module, so the Gateway reaches RUNNING with no browser wizard.
  wait_for_gateway 60
  wait_for_commissioned 60
fi

wait_for_bundle 24
ensure_dev_security
ensure_dev_users

echo
ok "Map Studio dev Gateway is running."
echo "    Gateway:  ${GATEWAY_URL}  (user ${ADMIN_USER}; password in .env)"
echo "    Session:  ${SESSION_URL}  (map editor: user mapeditor, MAPSTUDIO_EDITOR_PASSWORD in .env)"
echo "    Map store: ops/psql.sh  (psql in the PostgreSQL container)"
echo "    Logs:     ops/logs.sh        Tests: cd e2e && npm test"
echo "    Stop:     ops/down.sh        Wipe: ops/down.sh --purge"
