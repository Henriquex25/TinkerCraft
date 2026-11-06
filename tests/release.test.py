import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import release_preflight as release

SHA = 'a' * 40
REPOSITORY = 'example/project'
SUCCESS = {'head_sha': SHA, 'head_branch': 'main', 'event': 'push', 'status': 'completed', 'conclusion': 'success', 'head_repository': {'full_name': REPOSITORY}}


class ReleaseGateTests(unittest.TestCase):
    def test_only_successful_push_ci_on_the_exact_main_commit_is_accepted(self):
        invalid = [
            {**SUCCESS, 'head_sha': 'b' * 40},
            {**SUCCESS, 'head_branch': 'feature'},
            {**SUCCESS, 'event': 'pull_request'},
            {**SUCCESS, 'event': 'workflow_dispatch'},
            {**SUCCESS, 'status': 'in_progress'},
            {**SUCCESS, 'conclusion': 'failure'},
            {**SUCCESS, 'conclusion': 'skipped'},
            {**SUCCESS, 'conclusion': 'cancelled'},
            {**SUCCESS, 'head_repository': {'full_name': 'untrusted/fork'}},
        ]
        for run in invalid:
            with self.subTest(run=run), mock.patch.object(release.subprocess, 'check_output', return_value=json.dumps({'workflow_runs': [run]})):
                with self.assertRaisesRegex(ValueError, 'exact main commit'):
                    release.require_ci(REPOSITORY, SHA)
        with mock.patch.object(release.subprocess, 'check_output', return_value=json.dumps({'workflow_runs': invalid + [SUCCESS]})) as api:
            release.require_ci(REPOSITORY, SHA)
            command = api.call_args.args[0]
            self.assertEqual(command[:2], ['gh', 'api'])
            self.assertIn('head_sha=' + SHA, command[2])
            self.assertIn('event=push', command[2])
            self.assertIn('branch=main', command[2])

    def test_missing_ci_and_api_errors_never_authorize_release(self):
        with mock.patch.object(release.subprocess, 'check_output', return_value='{"workflow_runs": []}'):
            with self.assertRaises(ValueError):
                release.require_ci(REPOSITORY, SHA)
        with mock.patch.object(release.subprocess, 'check_output', side_effect=subprocess.CalledProcessError(1, ['gh'])):
            with self.assertRaises(subprocess.SubprocessError):
                release.require_ci(REPOSITORY, SHA)

    def test_invalid_identifiers_cannot_be_used_as_cli_arguments(self):
        with mock.patch.object(release.subprocess, 'check_output') as api:
            for repository, sha in [('../project', SHA), ('--project', SHA), (REPOSITORY, '--help'), (REPOSITORY, 'a' * 39)]:
                with self.assertRaises(ValueError):
                    release.require_ci(repository, sha)
            api.assert_not_called()

    def test_workflow_reads_version_without_publishing_and_rejects_other_branches(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'output'
            env = {'GITHUB_REF': 'refs/heads/main', 'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_SHA': SHA, 'GITHUB_OUTPUT': str(output)}
            with mock.patch.dict(os.environ, env), mock.patch.object(release.version, 'current', return_value='2.3.4'), mock.patch.object(release.subprocess, 'check_output', return_value=json.dumps({'workflow_runs': [SUCCESS]})) as api, contextlib.redirect_stdout(io.StringIO()):
                release.main()
                self.assertEqual(output.read_text(), 'version=2.3.4\n')
                self.assertEqual(api.call_count, 1)
            for ref in ['refs/heads/feature', 'refs/tags/v2.3.4']:
                with mock.patch.dict(os.environ, {**env, 'GITHUB_REF': ref}), mock.patch.object(release.subprocess, 'check_output') as api:
                    with self.assertRaises(ValueError):
                        release.main()
                    api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
