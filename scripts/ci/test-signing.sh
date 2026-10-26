#!/usr/bin/env bash
# Prove the signing path with a throwaway certificate generated here and deleted
# on exit. The owner's real key is never used or needed.
#
# Usage: scripts/ci/test-signing.sh   (JDK 17 on PATH or JAVA_HOME)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

MODULE_SIGNING_KEYSTORE_PASSWORD="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
export MODULE_SIGNING_KEYSTORE_PASSWORD

keytool -genkeypair -alias mapstudio -keyalg RSA -keysize 2048 -validity 2 \
  -dname "CN=Throwaway signing test" -keystore "$work/throwaway.p12" -storetype PKCS12 \
  -storepass:env MODULE_SIGNING_KEYSTORE_PASSWORD -keypass:env MODULE_SIGNING_KEYSTORE_PASSWORD 2>/dev/null
fp="$(keytool -list -v -alias mapstudio -keystore "$work/throwaway.p12" \
  -storepass:env MODULE_SIGNING_KEYSTORE_PASSWORD 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -1)"
[ -n "$fp" ] || { echo "test-signing: no fingerprint for the throwaway key" >&2; exit 1; }

"$here/build-signed.sh" "$work/throwaway.p12" mapstudio 0.0.1

signed="$root/build/Map-Studio.modl"
unsigned="$root/build/Map-Studio.unsigned.modl"

echo "== positive: signed build verifies with its own fingerprint and version"
"$here/modl-verify.sh" "$signed" "$fp" 0.0.1

echo "== negative: wrong version, empty fingerprint and empty version arguments are refused"
if "$here/modl-verify.sh" "$signed" "$fp" 9.9.9; then
  echo "test-signing: a wrong version was accepted" >&2; exit 1
fi
if "$here/modl-verify.sh" "$signed" ""; then
  echo "test-signing: an empty fingerprint argument was accepted" >&2; exit 1
fi
if "$here/modl-verify.sh" "$signed" "$fp" ""; then
  echo "test-signing: an empty version argument was accepted" >&2; exit 1
fi

echo "== negative: unsafe passwords are refused before any build"
for bad in 'a\b' ' padded' 'padded '; do
  if MODULE_SIGNING_KEYSTORE_PASSWORD="$bad" "$here/build-signed.sh" "$work/throwaway.p12" mapstudio 0.0.1 >/dev/null 2>&1; then
    echo "test-signing: an unsafe password was accepted" >&2; exit 1
  fi
done
test -f "$signed" || { echo "test-signing: the unsafe-password check touched the build" >&2; exit 1; }

echo "== negative: wrong fingerprint is refused"
if "$here/modl-verify.sh" "$signed" "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF"; then
  echo "test-signing: a wrong fingerprint was accepted" >&2; exit 1
fi

echo "== negative: the unsigned build is refused"
if "$here/modl-verify.sh" "$unsigned"; then
  echo "test-signing: the unsigned module was accepted" >&2; exit 1
fi

echo "== negative: a signed module with an unsigned extra file is refused"
mkdir "$work/tamper"
(cd "$work/tamper" && unzip -q "$signed" && echo x > extra.txt && zip -q -r ../tampered.modl .)
if "$here/modl-verify.sh" "$work/tampered.modl" "$fp"; then
  echo "test-signing: a module with an unsigned file was accepted" >&2; exit 1
fi

echo "== negative: a signed module whose certificates.p7b is a bare PEM certificate is refused"
mkdir "$work/bare"
(cd "$work/bare" && unzip -q "$signed" &&
  openssl pkcs7 -inform DER -in certificates.p7b -print_certs -out cert.pem &&
  mv cert.pem certificates.p7b && zip -q -r ../bare.modl .)
if "$here/modl-verify.sh" "$work/bare.modl" "$fp"; then
  echo "test-signing: a bare certificate in place of a PKCS#7 bundle was accepted" >&2; exit 1
fi

echo "test-signing: OK"
