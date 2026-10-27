"""Tests of the dev stack's pure helpers: python3 -I ops/tests/test_users.py (no Gateway needed)."""
import importlib.util
import json
import os
import tempfile
import unittest

OPS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(OPS, name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


users = load('users')
dev_security = load('dev_security')

INTERNAL = {'profile': {'type': 'internal'}, 'settings': {'userSource': 'default'}}


class IdentityPlanTest(unittest.TestCase):

    def test_default_exists(self):
        self.assertEqual(users.identity_plan({'default': INTERNAL}, 'default'), ('ok', 'default'))

    def test_temp_only_is_copied_as_default(self):
        temp = {'profile': {'type': 'internal'}, 'settings': {'userSource': 'temp'}}
        self.assertEqual(users.identity_plan({'temp': temp}, 'temp'), ('copy', 'temp'))

    def test_default_exists_beside_temp(self):
        temp = {'profile': {'type': 'internal'}, 'settings': {'userSource': 'temp'}}
        self.assertEqual(users.identity_plan({'temp': temp, 'default': INTERNAL}, 'temp'), ('ok', 'default'))

    def test_non_internal_system_provider_is_not_copied(self):
        oidc = {'profile': {'type': 'oidc'}, 'settings': {}}
        action, reason = users.identity_plan({'corp': oidc}, 'corp')
        self.assertEqual(action, 'fail')
        self.assertIn('oidc', reason)

    def test_missing_system_provider_fails(self):
        action, reason = users.identity_plan({}, 'temp')
        self.assertEqual(action, 'fail')
        self.assertIn('temp', reason)


class DevSecurityTest(unittest.TestCase):

    def test_adds_the_dev_key_level_once_and_keeps_the_rest(self):
        admin = {'name': 'Authenticated', 'children': [{'name': 'Roles', 'children': [
            {'name': 'Administrator', 'children': []}]}]}
        config = {'systemIdentityProvider': 'temp',
                  'readPermissions': {'securityLevels': [admin], 'type': 'AnyOf'},
                  'writePermissions': {'securityLevels': [admin], 'type': 'AnyOf'}}
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'config.json')
            with open(path, 'w') as f:
                json.dump(config, f)
            self.assertEqual(dev_security.main(path), 0)
            self.assertEqual(dev_security.main(path), 3, 'the second run changes nothing')
            with open(path) as f:
                out = json.load(f)
        self.assertEqual(out['systemIdentityProvider'], 'temp')
        for key in ('readPermissions', 'writePermissions'):
            self.assertEqual(out[key]['securityLevels'], [admin, dev_security.LEVEL])


if __name__ == '__main__':
    unittest.main()
