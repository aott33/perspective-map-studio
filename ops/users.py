#!/usr/bin/env python3
"""Create or update the dev map editor on the local dev Gateway. Development only.

Makes the user `mapeditor` in the internal user source behind the Gateway's system identity provider,
gives it the role `MapEditor` (full editing in the dev project's Map Studio setup) and sets its password
from MAPSTUDIO_EDITOR_PASSWORD (generated into the git-ignored .env by ops/lib.sh). Also makes the role
`MapOperator` (phone editing) with no members. The password is never printed.

Routes (adapted from ign-scada-template scripts/gw/render_users.py, [live 8.3.9 there]):
GET /data/api/v1/resources/singleton/ignition/security-properties (the identity provider's name),
GET .../list/ignition/identity-provider (that provider's config.settings.userSource; the template's
.../find/ignition/identity-provider/<name> answers 404 on 8.3.10 [live 8.3.10]), then SCIM on that source:
GET and POST /data/api/v1/scim/<userSource>/v2/Users, PUT .../Users/<id>, GET and POST .../Groups,
PUT .../Groups/<id>. Auth: the dev API key in ops/secrets/api-token (ops/gen_secrets.py).

It writes users, so it refuses unless GW_URL names a Gateway on localhost (ops/lib.sh sets it).

Usage: GW_URL=http://localhost:9121 MAPSTUDIO_EDITOR_PASSWORD=... python3 -I ops/users.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

OPS = os.path.dirname(os.path.abspath(__file__))
GW = os.environ.get('GW_URL', '').rstrip('/')
USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User'
GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group'
EDITOR = 'mapeditor'
EDITOR_ROLE = 'MapEditor'
OPERATOR_ROLE = 'MapOperator'


def api(method, path, body=None):
    with open(os.path.join(OPS, 'secrets', 'api-token')) as f:
        token = f.read().strip()
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(GW + path, data=data, method=method, headers={
        'X-Ignition-API-Token': token, 'Accept': 'application/json'})
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
    except urllib.error.HTTPError as ex:
        # The status and the route only: a body can echo the request, and the request holds a password.
        raise RuntimeError('%s %s answered HTTP %s' % (method, path, ex.code)) from None
    return json.loads(raw) if raw else {}


def listing(path):
    """All Resources of a SCIM list route (it pages with startIndex)."""
    found, start = [], 1
    while True:
        page = api('GET', '%s?startIndex=%d' % (path, start))
        items = page.get('Resources') or []
        found += items
        start += len(items)
        if not items or start > int(page.get('totalResults', 0)):
            return found


def user_source():
    wanted = api('GET', '/data/api/v1/resources/singleton/ignition/security-properties')['config']['systemIdentityProvider']
    providers = api('GET', '/data/api/v1/resources/list/ignition/identity-provider').get('items') or []
    for provider in providers:
        if provider.get('name') == wanted:
            return provider['config']['settings']['userSource']
    raise RuntimeError('the system identity provider %r is not among the Gateway\'s identity providers %s'
                       % (wanted, [p.get('name') for p in providers]))


def ensure_group(scim, groups, role, member_ids):
    group = groups.get(role)
    if group is None:
        api('POST', scim + '/Groups', {'schemas': [GROUP_SCHEMA], 'displayName': role,
                                       'members': [{'value': m} for m in member_ids]})
        return
    have = [m['value'] for m in group.get('members') or []]
    missing = [m for m in member_ids if m not in have]
    if missing:
        # PUT replaces the group: keep the members it has.
        api('PUT', '%s/Groups/%s' % (scim, group['id']), {
            'schemas': [GROUP_SCHEMA], 'displayName': role,
            'members': (group.get('members') or []) + [{'value': m} for m in missing]})


def run():
    parsed = urllib.parse.urlparse(GW)
    if parsed.hostname not in ('localhost', '127.0.0.1'):
        print('users: refusing: GW_URL must name the local dev Gateway (localhost); got %r' % GW)
        return 2
    password = os.environ.get('MAPSTUDIO_EDITOR_PASSWORD', '')
    if not password:
        print('users: MAPSTUDIO_EDITOR_PASSWORD is not set (ops/lib.sh generates it into .env)')
        return 2
    # The API key resource is read at Gateway start; allow the API a little time after RUNNING.
    last = None
    for _ in range(12):
        try:
            source = user_source()
            break
        except (RuntimeError, urllib.error.URLError, KeyError) as ex:
            last = ex
            time.sleep(5)
    else:
        raise RuntimeError('could not read the system identity provider: %s' % last)
    scim = '/data/api/v1/scim/%s/v2' % urllib.parse.quote(source, safe='')
    users = {u['userName']: u['id'] for u in listing(scim + '/Users')}
    body = {'schemas': [USER_SCHEMA], 'userName': EDITOR, 'password': password}
    if EDITOR in users:
        api('PUT', '%s/Users/%s' % (scim, users[EDITOR]), body)
    else:
        users[EDITOR] = api('POST', scim + '/Users', body)['id']
    groups = {g['displayName']: g for g in listing(scim + '/Groups')}
    ensure_group(scim, groups, EDITOR_ROLE, [users[EDITOR]])
    ensure_group(scim, groups, OPERATOR_ROLE, [])
    print('ok   %s in role %s, role %s present (user source %s; password from .env, not printed)'
          % (EDITOR, EDITOR_ROLE, OPERATOR_ROLE, source))
    return 0


def main():
    try:
        return run()
    except (RuntimeError, urllib.error.URLError, OSError, KeyError, ValueError) as ex:
        print('FAIL dev users: %s (Gateway %s)' % (ex, GW))
        return 1


if __name__ == '__main__':
    sys.exit(main())
