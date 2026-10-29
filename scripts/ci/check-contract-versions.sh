#!/usr/bin/env bash
# Fail when a public contract document does not name the version it describes,
# or when any file still calls a released version a draft (epic 2 R14, AD-9).
#
# The versions come from the code, so a document cannot drift from it:
#   contract version   CONTRACT_VERSION in common/.../Messages.java (mirrored in web/typescript/contract.ts)
#   setup schema       SCHEMA_VERSION in common/.../contract/Setup.java
#   map store schema   the highest migration number under gateway/.../store/migrations
#
# Usage: scripts/ci/check-contract-versions.sh [root]   (root defaults to this repository)
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$root"
fail=0
say() { echo "check-contract-versions: $*" >&2; fail=1; }

java_main=common/src/main/java/com/aoindustrial/perspective/mapstudio/common
messages="$java_main/Messages.java"
setup_java="$java_main/contract/Setup.java"
migrations=gateway/src/main/resources/com/aoindustrial/perspective/mapstudio/gateway/store/migrations

contract="$(sed -n 's/.*String CONTRACT_VERSION = "\([^"]*\)";.*/\1/p' "$messages" | head -1)"
[ -n "$contract" ] || { echo "check-contract-versions: no CONTRACT_VERSION in $messages" >&2; exit 1; }
setup_schema="$(sed -n 's/.*int SCHEMA_VERSION = \([0-9]*\);.*/\1/p' "$setup_java" | head -1)"
[ -n "$setup_schema" ] || { echo "check-contract-versions: no SCHEMA_VERSION in $setup_java" >&2; exit 1; }
store_schema="$(ls "$migrations" | sed -n 's/^0*\([0-9][0-9]*\)_.*\.sql$/\1/p' | sort -n | tail -1)"
[ -n "$store_schema" ] || { echo "check-contract-versions: no migration in $migrations" >&2; exit 1; }

case "$contract" in
  *[!0-9.]*|"") say "CONTRACT_VERSION \"$contract\" is not a plain x.y.z release version" ;;
esac
grep -q "export const CONTRACT_VERSION = '$contract';" web/typescript/contract.ts \
  || say "web/typescript/contract.ts does not say CONTRACT_VERSION = '$contract' (Messages.java does)"

# first_line <file> <exact text>
first_line() {
  if [ ! -f "$1" ]; then say "$1 is missing"; return; fi
  [ "$(head -1 "$1")" = "$2" ] || say "$1 must start with \"$2\", not \"$(head -1 "$1")\""
}
# has_line <file> <exact text>
has_line() {
  if [ ! -f "$1" ]; then say "$1 is missing"; return; fi
  grep -qxF -- "$2" "$1" || say "$1 has no line \"$2\""
}

first_line docs/contract.md "# Map Studio contract, version $contract"
has_line docs/contract.md "## The project setup, schema version $setup_schema (AD-5)"
has_line docs/contract.md "## The map store, schema version $store_schema (AD-3, AD-21)"
first_line docs/setup.md "# Map Studio project setup, schema version $setup_schema"
first_line docs/kinds-and-assets.md "# Kinds and assets from the project, version $contract"
first_line docs/kind-setup.md "# Kind setups and item checks, version $contract"
for f in docs/examples/adapters/*.py; do
  has_line "$f" "# Map Studio contract $contract (docs/contract.md, docs/kinds-and-assets.md)."
done
has_line CHANGELOG.md "## $contract"

# No file calls a version a draft once it is released. Planning records keep their history.
# The pattern catches the version and "draft" in either order, a few characters apart:
# "0.2.0 draft", "0.2.0-draft", "0.2.0 (draft)", "**0.2.0** (draft", "0.2.0, draft",
# "0.2.0 in draft", "Draft: contract 0.2.0".
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ "$(git rev-parse --show-toplevel)" = "$(pwd -P)" ]; then
  list() { git ls-files -co --exclude-standard; }
else
  list() { find . -type f -not -path './.git/*' -not -path '*/node_modules/*' | sed 's|^\./||'; }
fi
files="$(list | grep -v -E '^(_bmad-output|_bmad|\.claude)/' \
  | grep -v -x -F scripts/ci/check-contract-versions.sh \
  | grep -v -x -F scripts/ci/test-contract-versions.sh || true)"
# An empty list would make the search pass without looking at anything. No `grep -q`: it stops
# reading at the first match, and with pipefail a list larger than the pipe buffer then fails
# on printf's broken pipe.
printf '%s\n' "$files" | grep -x -F docs/contract.md >/dev/null \
  || { echo "check-contract-versions: the file list for the draft search is empty or misses docs/contract.md" >&2; exit 1; }
draft_re='([0-9]+\.[0-9]+\.[0-9]+[^a-z0-9]{0,6}(in )?\(?draft|draft[^.]{0,40}[0-9]+\.[0-9]+\.[0-9]+)'
set +e
# Files deleted in the work tree but still tracked are skipped; a grep error (exit 2) makes
# xargs stop with 124, while "no match" (grep 1) shows as 123 and is a pass.
drafts="$(printf '%s\n' "$files" | while IFS= read -r f; do [ -f "$f" ] && printf '%s\0' "$f"; done \
  | xargs -0 -r sh -c 'grep -I -n -i -E "$0" -- "$@"; s=$?; [ "$s" -le 1 ] || exit 255' "$draft_re")"
status=$?
set -e
case "$status" in 0|123) ;; *) echo "check-contract-versions: the draft search failed (exit $status)" >&2; exit 1 ;; esac
if [ -n "$drafts" ]; then
  say "a released version is still called a draft:"
  echo "$drafts" >&2
fi

[ "$fail" -eq 0 ] || exit 1
echo "check-contract-versions: OK (contract $contract, setup schema $setup_schema, map store schema $store_schema)"
