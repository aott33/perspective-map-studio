#!/usr/bin/env bash
# Stop the local dev Gateway. With --purge, also delete its data volume
# (trial state, commissioning, module acceptance). The committed project in
# ops/project is a bind mount and is never touched.
#
# Usage: ops/down.sh [--purge]

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_docker
if [[ "${1:-}" == "--purge" ]]; then
  info "Stopping the Gateway and removing its data volume..."
  "${COMPOSE[@]}" down -v --remove-orphans
else
  info "Stopping the Gateway (data kept)..."
  "${COMPOSE[@]}" down --remove-orphans
fi
ok "Done."
