#!/usr/bin/env bash
# Check that a .modl is signed and, optionally, that its certificate has the
# expected SHA-256 fingerprint. Prints the fingerprint (public information).
#
# Usage: scripts/ci/modl-verify.sh <file.modl> [expected-sha256-fingerprint]
# The fingerprint may have colons or not, in any case.
#
# This checks the structure of the signature (certificate and a signature entry
# for every file) and the certificate's identity. The cryptographic check of the
# signatures is the Gateway's, when the module is installed.
set -euo pipefail

modl="${1:?path to .modl}"
expected="${2:-}"
fail() { echo "modl-verify: $*" >&2; exit 1; }

[ -f "$modl" ] || fail "no such file: $modl"
case "$modl" in *.unsigned.modl) fail "$modl is the unsigned intermediate" ;; esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
unzip -q "$modl" -d "$work" || fail "not a zip archive: $modl"

[ -f "$work/certificates.p7b" ] || fail "certificates.p7b missing (the module is not signed)"
[ -f "$work/signatures.properties" ] || fail "signatures.properties missing (the module is not signed)"
[ -f "$work/module.xml" ] || fail "module.xml missing"

# Every file in the archive except the two signature files has a signature entry.
files="$(cd "$work" && find . -type f ! -name certificates.p7b ! -name signatures.properties | sed 's|^\./|/|')"
while IFS= read -r f; do
  awk -v key="$f=" 'index($0, key) == 1 { found = 1 } END { exit !found }' "$work/signatures.properties" ||
    fail "no signature entry for $f"
done <<EOF_FILES
$files
EOF_FILES

id="$(sed -n 's|.*<id>\(.*\)</id>.*|\1|p' "$work/module.xml" | head -1)"
version="$(sed -n 's|.*<version>\(.*\)</version>.*|\1|p' "$work/module.xml" | head -1)"
[ "$id" = "com.aoindustrial.perspective.mapstudio" ] || fail "unexpected module id: $id"
echo "$version" | grep -Eq '^[0-9]+(\.[0-9]+){2,3}$' || fail "module version is not numeric: $version"

fp="$(keytool -printcert -file "$work/certificates.p7b" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -1)"
[ -n "$fp" ] || fail "could not read the certificate fingerprint"

if [ -n "$expected" ]; then
  norm() { printf '%s' "$1" | tr -d ': ' | tr 'a-f' 'A-F'; }
  [ "$(norm "$fp")" = "$(norm "$expected")" ] || fail "certificate fingerprint $fp does not match expected $expected"
fi

echo "module $id $version"
echo "certificate SHA-256: $fp"
