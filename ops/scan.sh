#!/usr/bin/env bash
# Ask the dev Gateway to scan its projects, so an edited file under ops/project
# (for example the Map Studio setup) is read without a restart.
#
# Usage: ops/scan.sh
#
# POST /data/api/v1/scan/projects with the dev API key (ops/secrets/api-token,
# never printed) [live 8.3.10, docs/platform-checks.md "Epic 2 story 6"].

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

TOKEN_FILE="${SECRETS_DIR}/api-token"
if [[ ! -f "${TOKEN_FILE}" ]]; then
  err "ops/secrets/api-token is missing; run ops/up.sh first."
  exit 1
fi

# The token goes to curl on stdin (a header file), never on the command line.
status="$(printf 'X-Ignition-API-Token: %s\n' "$(cat "${TOKEN_FILE}")" \
  | curl -sS -o /dev/null -w '%{http_code}' -X POST -H @- "${GATEWAY_URL}/data/api/v1/scan/projects")"
if [[ "${status}" != 2* ]]; then
  err "The project scan was refused (HTTP ${status})."
  exit 1
fi
ok "Project scan requested (HTTP ${status})."
