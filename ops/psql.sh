#!/usr/bin/env bash
# psql on the dev map store, inside this worktree's PostgreSQL container (no host port is published).
# Development only.
#
# Usage:
#   ops/psql.sh                       Interactive psql as the owner role mapstudio.
#   ops/psql.sh -c "select ..."       One statement, for example the edit record:
#   ops/psql.sh -c "select project, batch_id, seq, entity, entity_id, op, version, actor, source, at
#                   from mapstudio_edit order by edit_id"

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_docker
tty_flag=(-T)
if [[ -t 0 && -t 1 ]]; then
  tty_flag=()
fi
"${COMPOSE[@]}" exec "${tty_flag[@]}" postgres psql -U mapstudio -d mapstudio "$@"
