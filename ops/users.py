#!/usr/bin/env python3
"""Create or update the dev map editor on the local dev Gateway. Development only.

First makes sure the identity provider the dev project signs in with, `default` (pinned in the
Gateway-written ops/project/ignition/global-props), exists: a fresh volume has once named its only provider
`temp` instead [live 8.3.10], as ign-scada-template's GW-1 saw on 8.3.9. When `default` is missing and the
Gateway's system identity provider is an internal one, it is copied under the name `default` (same user
source, same settings; the template's scripts/gw/ensure_identity.py). Then it makes the user `mapeditor` in
the internal user source behind `default`, gives it the role `MapEditor` (full editing in the dev project's Map Studio setup) and sets its password
from MAPSTUDIO_EDITOR_PASSWORD (generated into the git-ignored .env by ops/lib.sh). Also makes the role
`MapOperator` (phone editing) with no members. The password is never printed.

Routes (adapted from ign-scada-template scripts/gw/render_users.py, [live 8.3.9 there]):
GET /data/api/v1/resources/singleton/ignition/security-properties (the system identity provider's name),
GET .../list/ignition/identity-provider (every provider with its config), POST
/data/api/v1/resources/ignition/identity-provider (the copy), then SCIM on the user source of `default`:
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


PROJECT_IDP = 'default'


def identity_plan(providers, system_name):
    """What to do so the project's identity provider exists. Pure, so it is tested (ops/tests/test_users.py).

    providers: {name: config} of the Gateway's identity providers; system_name: the system provider's name.
    Returns ('ok', user_source), ('copy', source_name) or ('fail', reason).
    """
    if PROJECT_IDP in providers:
        return 'ok', providers[PROJECT_IDP]['settings']['userSource']
    source = providers.get(system_name)
    if source is None:
        return 'fail', ('neither %r nor the system identity provider %r exists; the Gateway has %s'
                        % (PROJECT_IDP, system_name, sorted(providers) or 'none'))
    kind = (source.get('profile') or {}).get('type')
    if kind != 'internal':
        return 'fail', ('the system identity provider %r is of type %s, not internal; make %r by hand'
                        % (system_name, kind, PROJECT_IDP))
    return 'copy', system_name


def user_source():
    """The user source behind the project's identity provider, creating that provider when it is missing."""
    security = api('GET', '/data/api/v1/resources/singleton/ignition/security-properties')
    system_name = security['config']['systemIdentityProvider']
    items = api('GET', '/data/api/v1/resources/list/ignition/identity-provider').get('items') or []
    providers = {i['name']: i['config'] for i in items}
    action, value = identity_plan(providers, system_name)
    if action == 'fail':
        raise RuntimeError(value)
    if action == 'copy':
        api('POST', '/data/api/v1/resources/ignition/identity-provider', [{
            'name': PROJECT_IDP, 'collection': 'core', 'enabled': True,
            'description': 'Copy of %s made by ops/users.py: the dev project signs in with %s' % (value, PROJECT_IDP),
            'config': providers[value]}])
        print('ok   identity provider %s created as a copy of %s' % (PROJECT_IDP, value))
        return providers[value]['settings']['userSource']
    return value


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
