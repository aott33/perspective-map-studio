#!/usr/bin/env bash
# Build and sign the module. Used by the release workflow and by test-signing.sh,
# so the test exercises the real release path.
#
# Usage: scripts/ci/build-signed.sh <keystore.p12> <alias> <version>
# The keystore password comes from the environment variable
# MODULE_SIGNING_KEYSTORE_PASSWORD (never from the command line).
set -euo pipefail

keystore="${1:?keystore path}"
alias_name="${2:?key alias}"
version="${3:?version}"
: "${MODULE_SIGNING_KEYSTORE_PASSWORD:?set MODULE_SIGNING_KEYSTORE_PASSWORD}"

# Gradle properties files cannot carry every character safely.
case "$MODULE_SIGNING_KEYSTORE_PASSWORD" in
  *\\*) echo "build-signed: the keystore password contains a backslash, which a properties file cannot hold. Choose another password." >&2; exit 1 ;;
  *$'\n'*) echo "build-signed: the keystore password contains a newline. Choose another password." >&2; exit 1 ;;
  " "*|*" "|$'\t'*|*$'\t') echo "build-signed: the keystore password has leading or trailing whitespace. Choose another password." >&2; exit 1 ;;
esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The plugin wants the certificate chain as a PEM file next to the keystore;
# exporting it here means it can never disagree with the key.
keytool -exportcert -rfc -alias "$alias_name" -keystore "$keystore" \
  -storetype PKCS12 -storepass:env MODULE_SIGNING_KEYSTORE_PASSWORD \
  -file "$work/cert.pem"

# The plugin reads project properties named ignition.signing.*. Gradle does not
# honour dotted ORG_GRADLE_PROJECT_ environment names (tested), and a -P
# argument would put the password in the process list, so the properties go in
# a temporary gradle.properties (mode 600) in the project root, removed on exit.
cd "$root"
[ ! -e gradle.properties ] || { echo "build-signed: gradle.properties exists; refusing to overwrite it" >&2; exit 1; }
trap 'rm -rf "$work" "$root/gradle.properties"' EXIT
umask 077
{
  echo "ignition.signing.keystoreFile=$keystore"
  echo "ignition.signing.keystorePassword=$MODULE_SIGNING_KEYSTORE_PASSWORD"
  echo "ignition.signing.certFile=$work/cert.pem"
  echo "ignition.signing.certAlias=$alias_name"
  echo "ignition.signing.certPassword=$MODULE_SIGNING_KEYSTORE_PASSWORD"
} > gradle.properties

./gradlew clean build --no-daemon --console plain \
  -Dorg.gradle.java.installations.auto-download=false \
  -PreleaseVersion="$version"
