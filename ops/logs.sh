#!/usr/bin/env bash
# Tail the Gateway's wrapper log. Pass -n <lines> or any other `docker compose logs` flag.
#
# Usage: ops/logs.sh [-f] [-n 200]

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

"${COMPOSE[@]}" logs "$@" gateway
