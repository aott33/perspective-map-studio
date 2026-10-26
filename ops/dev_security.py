#!/usr/bin/env python3
"""Add the dev API key's security level to a Gateway security-properties config.json. Development only.

The dev API key (ops/gen_secrets.py) carries Authenticated/ApiKeys/MapStudioDev; the Gateway lets it read
and write config only when that level is in the Read and Write permissions. Everything else in the file is
kept as the Gateway wrote it (the identity provider name differs between first boots [live 8.3.10]: `default`
on one fresh volume, `temp` on another).

Usage: python3 -I ops/dev_security.py <path to security-properties config.json>
Exit 0 when the file was changed, 3 when the level was already there.
"""
import json
import sys

LEVEL = {'name': 'Authenticated', 'children': [
    {'name': 'ApiKeys', 'children': [{'name': 'MapStudioDev', 'children': []}]}]}


def main(path):
    with open(path) as f:
        config = json.load(f)
    changed = False
    for key in ('readPermissions', 'writePermissions'):
        permission = config.setdefault(key, {'securityLevels': [], 'type': 'AnyOf'})
        levels = permission.setdefault('securityLevels', [])
        if LEVEL not in levels:
            levels.append(LEVEL)
            changed = True
        if permission.get('type') != 'AnyOf':
            permission['type'] = 'AnyOf'
            changed = True
    if not changed:
        return 3
    with open(path, 'w') as f:
        json.dump(config, f, indent=2)
        f.write('\n')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
