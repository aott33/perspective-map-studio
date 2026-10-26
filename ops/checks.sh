#!/usr/bin/env bash
# Run the Map Studio platform checks (story 3) on the dev Gateway: PostgreSQL
# beside the Gateway, the checks' config seeded into it, the module built and
# staged, then the five CHECK lines collected from the Gateway log.
#
# Usage:
#   ops/checks.sh            Fresh Gateway and PostgreSQL volumes (the config and
#                            the PostgreSQL roles are only read on first start).
#   ops/checks.sh --keep     Reuse the volumes; just rebuild, restart and collect.
#   ops/checks.sh --collect  Collect the CHECK lines of the running Gateway's
#                            current start only.
#
# Only lines logged since the Gateway container's current start are collected,
# so a restart or re-run never reports the previous run's lines. While the
# checks stack exists, ops/up.sh, down.sh and logs.sh include it automatically;
# ops/down.sh --purge removes it, PostgreSQL volume included.
#
# Exit status is 0 when all five checks are PASS, 1 otherwise. Development only.

export MAPSTUDIO_CHECKS=1
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

MODE="fresh"
for arg in "$@"; do
  case "${arg}" in
    --keep) MODE="keep" ;;
    --collect) MODE="collect" ;;
    *) err "Unknown argument: ${arg}"; exit 2 ;;
  esac
done

# The five checks the module logs, in the order it runs them.
CHECK_NAMES=(setup postgres postgres-rights project-script alarm-metrics)

# The Gateway container's current start, so an older start's lines are ignored
# (compose logs persist across restarts).
gateway_started_at() {
  docker inspect -f '{{.State.StartedAt}}' "${CONTAINER_NAME}" 2>/dev/null || echo "0001-01-01T00:00:00Z"
}

collect_checks() {
  # Every CHECK line since the current start; the caller keeps the last per name.
  "${COMPOSE[@]}" logs --no-log-prefix --since "${SINCE}" gateway 2>/dev/null \
    | grep -o 'CHECK [a-z-]* \(PASS\|FAIL\) .*' || true
}

require_docker
ensure_checks_secrets

if [[ "${MODE}" != "collect" ]]; then
  if [[ "${MODE}" == "fresh" ]]; then
    "${OPS_DIR}/up.sh" --fresh
  else
    "${OPS_DIR}/up.sh"
  fi
fi
SINCE="$(gateway_started_at)"
info "Collecting CHECK lines logged since the Gateway's start at ${SINCE} ..."

# The alarm-metrics check waits up to 90 s for the alarm to toggle; give the
# whole run four minutes.
lines=""
for ((i = 1; i <= 48; i++)); do
  lines="$(collect_checks)"
  found=0
  for name in "${CHECK_NAMES[@]}"; do
    if grep -q "^CHECK ${name} " <<<"${lines}"; then
      found=$((found + 1))
    fi
  done
  if (( found >= ${#CHECK_NAMES[@]} )); then
    break
  fi
  sleep 5
done

echo
status=0
for name in "${CHECK_NAMES[@]}"; do
  # A missing line must be reported, not end the script (lib.sh sets -e and pipefail).
  line="$(grep "^CHECK ${name} " <<<"${lines}" | tail -1 || true)"
  if [[ -z "${line}" ]]; then
    err "CHECK ${name}: no line in the log since ${SINCE}"
    status=1
  elif [[ "${line}" == "CHECK ${name} PASS "* ]]; then
    ok "${line}"
  else
    err "${line}"
    status=1
  fi
done
echo
if (( status == 0 )); then
  ok "All ${#CHECK_NAMES[@]} platform checks passed on ${GATEWAY_URL}."
else
  err "Some platform checks did not pass. Full log: ops/logs.sh -n 400 | grep MapStudio"
fi
exit "${status}"
