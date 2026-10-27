#!/usr/bin/env bash
# Prove check-contract-versions.sh: it passes on this repository and fails on a
# copy where one contract document lost its version, a draft came back (in any of
# the wordings this release removed, in a plain copy and in a git work tree), or the
# browser's contract version drifted from the Gateway's. Also proves
# check-release-version.sh refuses a version the CHANGELOG or a package does not name.
#
# Usage: scripts/ci/test-contract-versions.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "== positive: this repository"
"$here/check-contract-versions.sh" "$root"

# A copy of the files the check reads (no .git, so it lists files with find).
copy() {
  rm -rf "$work/repo"; mkdir -p "$work/repo"
  (cd "$root" && tar -cf - CHANGELOG.md README.md NOTICE docs web/typescript/contract.ts \
    web/package.json e2e/package.json \
    common/src/main/java/com/aoindustrial/perspective/mapstudio/common/Messages.java \
    common/src/main/java/com/aoindustrial/perspective/mapstudio/common/contract/Setup.java \
    gateway/src/main/resources/com/aoindustrial/perspective/mapstudio/gateway/store/migrations) \
    | (cd "$work/repo" && tar -xf -)
}

echo "== positive: the copy"
copy
"$here/check-contract-versions.sh" "$work/repo" >/dev/null

# expect_fail <description> <sed expression> <file>
expect_fail() {
  copy
  sed -i "$2" "$work/repo/$3"
  if "$here/check-contract-versions.sh" "$work/repo" 2>"$work/err" >/dev/null; then
    echo "test-contract-versions: accepted $1" >&2; exit 1
  fi
  echo "refused $1: $(head -1 "$work/err")"
}

echo "== negative: a document stripped of its version, a draft, a drift"
expect_fail "contract.md without its version" '1s/, version [0-9.]*$//' docs/contract.md
expect_fail "kinds-and-assets.md without its version" '1s/, version [0-9.]*$//' docs/kinds-and-assets.md
expect_fail "kind-setup.md without its version" '1s/, version [0-9.]*$//' docs/kind-setup.md
expect_fail "setup.md without its schema version" '1s/, schema version [0-9]*$//' docs/setup.md
expect_fail "contract.md without the map store schema version" 's/^## The map store, schema version [0-9]* /## The map store /' docs/contract.md
expect_fail "an adapter example without its version" '/^# Map Studio contract /d' docs/examples/adapters/named_query.py
expect_fail "CHANGELOG.md without the release" 's/^## \([0-9.]*\)$/## Unreleased/' CHANGELOG.md
expect_fail "a draft in the README" '1s/$/ (contract 0.2.0 draft)/' README.md
expect_fail "a draft after a comma" '1s/$/ (contract 0.2.0, draft)/' README.md
expect_fail "a version in draft" '1s/$/ (version 0.2.0 in draft)/' docs/architecture.md
expect_fail "a bold version then (draft" '1s/$/ Catalogue version **0.2.0** (draft, versioned)/' docs/icons.md
expect_fail "Draft: before the version" '1s/$/ **Draft:** part of contract 0.2.0/' NOTICE
expect_fail "a drifted browser contract version" "s/CONTRACT_VERSION = '[^']*'/CONTRACT_VERSION = '9.9.9'/" web/typescript/contract.ts
expect_fail "a draft contract version" 's/CONTRACT_VERSION = "\([0-9.]*\)"/CONTRACT_VERSION = "\1-draft"/' common/src/main/java/com/aoindustrial/perspective/mapstudio/common/Messages.java

echo "== negative: the draft search in a git work tree (git ls-files, not find)"
copy
printf 'Contract 0.2.0 (draft)\n' > "$work/repo/docs/late-draft.md"
(cd "$work/repo" && git init -q && git add -A)
if "$here/check-contract-versions.sh" "$work/repo" 2>"$work/err" >/dev/null; then
  echo "test-contract-versions: accepted a draft in a git work tree" >&2; exit 1
fi
grep -q 'docs/late-draft.md' "$work/err" || { echo "test-contract-versions: the git-mode search did not name the file" >&2; cat "$work/err" >&2; exit 1; }
echo "refused a draft in a git work tree: $(grep -m1 late-draft "$work/err")"
rm -f "$work/repo/docs/late-draft.md"
(cd "$work/repo" && git add -A)
"$here/check-contract-versions.sh" "$work/repo" >/dev/null
echo "accepted the same git work tree without it"

echo "== check-release-version.sh"
copy
version="$(sed -n 's/^## \([0-9][0-9.]*\)$/\1/p' "$work/repo/CHANGELOG.md" | head -1)"
"$here/check-release-version.sh" "$version" "$work/repo"
# expect_release_fail <description> <version> [sed expression] [file]
expect_release_fail() {
  copy
  if [ $# -ge 4 ]; then sed -i "$3" "$work/repo/$4"; fi
  if "$here/check-release-version.sh" "$2" "$work/repo" 2>"$work/err" >/dev/null; then
    echo "test-contract-versions: check-release-version accepted $1" >&2; exit 1
  fi
  echo "refused $1: $(head -1 "$work/err")"
}
expect_release_fail "a tag with no CHANGELOG section" 9.9.9
expect_release_fail "a CHANGELOG without the release" "$version" "s/^## $version\$/## Unreleased/" CHANGELOG.md
expect_release_fail "a web package at another version" "$version" "0,/\"version\": \"$version\"/s//\"version\": \"0.0.1\"/" web/package.json
expect_release_fail "an e2e package at another version" "$version" "0,/\"version\": \"$version\"/s//\"version\": \"0.0.1\"/" e2e/package.json
expect_release_fail "a suffixed version" "$version-rc1"

echo "test-contract-versions: OK"
