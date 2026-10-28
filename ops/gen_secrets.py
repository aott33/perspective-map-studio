#!/usr/bin/env python3
"""Generate the dev stack's secrets into the git-ignored ops/secrets/ folder. Development only.

Writes, each only when it is missing (so a kept PostgreSQL volume keeps matching its password):
- ops/secrets/pg_password: the PostgreSQL password of the owner role mapstudio. Mode 0644 in the 0700
  folder: PostgreSQL's init runs as postgres and the Gateway as uid 2003, and a compose file secret keeps
  its host mode, so a 0600 file is "Permission denied" inside the containers (docs/platform-checks.md,
  story 3, facts learned).
- ops/secrets/api-token (mode 0600): the client token "dev:<key>" ops/users.py sends as
  X-Ignition-API-Token. Never printed.
- ops/secrets/map_token (mode 0644, read by the Gateway as uid IGNITION_UID): the dev map's basemap token
  (epic 3 entry 6), a Docker secret the MapStudioFiles secret provider reads when a browser picks the
  Satellite basemap. Written as the placeholder MAP_TOKEN_PLACEHOLDER, which starts with "pk." so the
  Gateway accepts it and the browser's tile request is seen (the e2e suite stubs the tiles), but is not
  a token Mapbox knows. Replace its content with your own public (pk.) Mapbox token to see real tiles;
  the file is git-ignored and must never be committed.
- ops/secrets/core/ignition/api-token/dev/{config.json,resource.json}: the Gateway's API key resource,
  holding only the SHA-256 hash of the key; the init container copies it into the core collection.
  Format from ign-scada-template scripts/gw/make_api_key.py [live 8.3.9 there]. Its security level is
  Authenticated/ApiKeys/MapStudioDev. After the first RUNNING, ensure_dev_security in ops/lib.sh copies the
  Gateway's own core security-properties out, ops/dev_security.py adds that level to its Read and Write
  permissions, and the file goes back with one restart (dev Gateway only; commissioning rewrites a copy
  seeded before the first boot). A key cannot carry
  Authenticated/Roles/<role>: 8.3.10 logs "Security level 'Authenticated/Roles' cannot be granted via
  config and will be ignored" and answers 403 [live 8.3.10].

Usage: python3 -I ops/gen_secrets.py
"""
import base64
import hashlib
import json
import os
import secrets
import string
import sys
import time
import uuid

OPS = os.path.dirname(os.path.abspath(__file__))
SECRETS = os.path.join(OPS, 'secrets')
ALPHABET = string.ascii_letters + string.digits
# Not a Mapbox token: a public-token prefix on words, so the dev stack's Satellite path runs end to end
# against stubbed tiles without a real token anywhere in the repository.
MAP_TOKEN_PLACEHOLDER = 'pk.placeholder-dev-not-a-mapbox-token'


def password(length=24):
    """Letters and digits, at least one of each class, no character three times in a row."""
    while True:
        value = ''.join(secrets.choice(ALPHABET) for _ in range(length))
        classes = (any(c.islower() for c in value), any(c.isupper() for c in value), any(c.isdigit() for c in value))
        repeated = any(value[i] == value[i + 1] == value[i + 2] for i in range(len(value) - 2))
        if all(classes) and not repeated:
            return value


def write(path, text, mode):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
    with os.fdopen(fd, 'w') as f:
        f.write(text)
    os.chmod(path, mode)


def main():
    os.makedirs(SECRETS, exist_ok=True)
    os.chmod(SECRETS, 0o700)

    pg = os.path.join(SECRETS, 'pg_password')
    if not os.path.exists(pg):
        write(pg, password(), 0o644)
        print('generated ops/secrets/pg_password')
    os.chmod(pg, 0o644)

    token = os.path.join(SECRETS, 'map_token')
    if not os.path.exists(token):
        write(token, MAP_TOKEN_PLACEHOLDER + '\n', 0o644)
        print('generated ops/secrets/map_token (a placeholder, not a real token)')
    os.chmod(token, 0o644)

    client = os.path.join(SECRETS, 'api-token')
    folder = os.path.join(SECRETS, 'core', 'ignition', 'api-token', 'dev')
    if not os.path.exists(client) or not os.path.exists(os.path.join(folder, 'config.json')):
        raw = secrets.token_bytes(32)
        key = base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
        token_hash = base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).rstrip(b'=').decode()
        os.makedirs(folder, exist_ok=True)
        levels = [{'name': 'Authenticated', 'children': [
            {'name': 'ApiKeys', 'children': [{'name': 'MapStudioDev', 'children': []}]}]}]
        config = {'profile': {'type': 'basic-token', 'securityLevels': levels, 'secureChannelRequired': False,
                              'timestamp': int(time.time() * 1000)},
                  'settings': {'tokenHash': token_hash}}
        resource = {'scope': 'A', 'version': 1, 'restricted': False, 'overridable': True,
                    'description': 'Map Studio dev API key for ops/users.py (generated, git-ignored)',
                    'files': ['config.json'], 'attributes': {'uuid': str(uuid.uuid4()), 'enabled': True}}
        write(os.path.join(folder, 'config.json'), json.dumps(config, indent=2) + '\n', 0o644)
        write(os.path.join(folder, 'resource.json'), json.dumps(resource, indent=2) + '\n', 0o644)
        write(client, 'dev:%s' % key, 0o600)
        print('generated the dev API key (ops/secrets/api-token, not printed)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
