#!/usr/bin/env bash
# Fail when the version being released is not the one the repository describes:
# CHANGELOG.md needs a "## X.Y.Z" section and web/package.json and e2e/package.json
# carry "version": "X.Y.Z". The contract version may stay behind on a module-only
# release; check-contract-versions.sh checks the contract documents against it.
#
# Usage: scripts/ci/check-release-version.sh X.Y.Z [root]   (run by release.yml for the tag)
set -euo pipefail

version="${1:?usage: check-release-version.sh X.Y.Z [root]}"
root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$root"
fail=0
say() { echo "check-release-version: $*" >&2; fail=1; }

printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || say "\"$version\" is not a plain X.Y.Z version"
grep -qxF -- "## $version" CHANGELOG.md || say "CHANGELOG.md has no section \"## $version\""
for p in web/package.json e2e/package.json; do
  have="$(sed -n 's/^[[:space:]]*"version": "\([^"]*\)",[[:space:]]*$/\1/p' "$p" | head -1)"
  [ "$have" = "$version" ] || say "$p has version \"$have\", not \"$version\""
done

[ "$fail" -eq 0 ] || exit 1
echo "check-release-version: OK ($version)"
