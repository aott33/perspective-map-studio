#!/usr/bin/env bash
# Run the Map Studio platform checks (story 3) on the dev Gateway: PostgreSQL
# beside the Gateway, the checks' config mounted in, the module built and
# staged, then the five CHECK lines collected from the Gateway log.
#
# Usage:
#   ops/checks.sh            Fresh Gateway and PostgreSQL volumes (the config and
#                            the PostgreSQL roles are only read on first start).
#   ops/checks.sh --keep     Reuse the volumes; just rebuild, restart and collect.
#   ops/checks.sh --collect  Collect the CHECK lines from a running Gateway only.
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

collect_checks() {
  # One line per check: the last CHECK line of each name in the Gateway log.
  "${COMPOSE[@]}" logs --no-log-prefix gateway 2>/dev/null \
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

# The alarm-metrics check waits up to 90 s for the alarm to toggle; give the
# whole run four minutes.
info "Waiting for the CHECK lines in the Gateway log ..."
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
    err "CHECK ${name}: no line in the log"
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
