#!/usr/bin/env bash
# Structure and fingerprint check of a signed .modl. Prints the module id,
# version and certificate fingerprint (public information).
#
# Usage: scripts/ci/modl-verify.sh <file.modl> [expected-sha256-fingerprint [expected-version]]
# A given argument must not be empty. The fingerprint may have colons or not,
# in any case.
#
# This does NOT verify the signatures cryptographically: it checks that the
# signature files are present, that every file has a signature entry, that the
# certificate in the archive has the expected fingerprint and that module.xml
# has the expected version. A forged module that carries the genuine
# certificates.p7b would pass. The cryptographic check is the Gateway's, when
# the module is installed (see deferred-work.md).
set -euo pipefail

modl="${1:?path to .modl}"
expected="${2:-}"
expected_version="${3:-}"
fail() { echo "modl-verify: $*" >&2; exit 1; }

[ "$#" -lt 2 ] || [ -n "$expected" ] || fail "the expected fingerprint argument is empty"
[ "$#" -lt 3 ] || [ -n "$expected_version" ] || fail "the expected version argument is empty"
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

if [ "$#" -ge 3 ] && [ "$version" != "$expected_version" ]; then
  fail "module version $version does not match expected $expected_version"
fi

fp="$(keytool -printcert -file "$work/certificates.p7b" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -1)"
[ -n "$fp" ] || fail "could not read the certificate fingerprint"

# Hosts that pin the module (the template's modl.py) read certificates.p7b with
# `openssl pkcs7`, so it must be a PKCS#7 bundle, not a bare certificate.
if command -v openssl >/dev/null 2>&1; then
  openssl pkcs7 -inform DER -in "$work/certificates.p7b" -noout >/dev/null 2>&1 ||
    openssl pkcs7 -inform PEM -in "$work/certificates.p7b" -noout >/dev/null 2>&1 ||
    fail "certificates.p7b is not a PKCS#7 bundle (a bare certificate fails host tools that use openssl pkcs7)"
fi

if [ "$#" -ge 2 ]; then
  norm() { printf '%s' "$1" | tr -d ': ' | tr 'a-f' 'A-F'; }
  [ "$(norm "$fp")" = "$(norm "$expected")" ] || fail "certificate fingerprint $fp does not match expected $expected"
fi

echo "module $id $version"
echo "certificate SHA-256: $fp"
