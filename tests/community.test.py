import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('github_setup', ROOT / 'scripts/configure-github.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class CommunitySetupTests(unittest.TestCase):
    def test_preview_has_no_network_or_authentication_dependency(self):
        with mock.patch.object(sys, 'argv', ['configure-github.py', '--repo', 'example/project']), mock.patch.object(setup, 'api') as api, mock.patch.object(setup.subprocess, 'run') as run, contextlib.redirect_stdout(io.StringIO()) as output:
            setup.main()
        api.assert_not_called()
        run.assert_not_called()
        self.assertIn('PREVIEW ONLY', output.getvalue())

    def test_wrong_origin_cannot_modify_a_repository(self):
        with mock.patch.object(setup, 'origin_repository', return_value='someone/else'), mock.patch.object(setup, 'api') as api:
            with self.assertRaisesRegex(ValueError, 'origin'):
                setup.apply('example/project', False)
        api.assert_not_called()

    def test_protection_cannot_lock_main_before_ci_succeeds(self):
        responses = [
            {'permissions': {'admin': True}, 'private': False, 'default_branch': 'main'},
            {'commit': {'sha': 'a' * 40}},
            {'workflow_runs': []},
        ]
        with mock.patch.object(setup, 'origin_repository', return_value='example/project'), mock.patch.object(setup.shutil, 'which', return_value='/usr/bin/gh'), mock.patch.object(setup.subprocess, 'run'), mock.patch.object(setup, 'api', side_effect=responses) as api:
            with self.assertRaisesRegex(ValueError, 'successful push run'):
                setup.apply('example/project', True)
        self.assertTrue(all(call.args[0] == 'GET' for call in api.call_args_list))


if __name__ == '__main__':
    unittest.main()
