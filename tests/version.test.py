import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import version


class VersionTests(unittest.TestCase):
    def test_version_is_the_only_application_version_source(self):
        self.assertRegex(version.current(), r'^\d+\.\d+\.\d+$')
        for name in ['package.json', 'frontend/package.json', 'package-lock.json', 'frontend/package-lock.json']:
            data = json.loads((ROOT / name).read_text())
            self.assertNotIn('version', data, name)
            if 'packages' in data:
                self.assertNotIn('version', data['packages'][''], name)
            else:
                self.assertTrue(data['private'], name)

    def test_valid_and_invalid_release_versions(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(version, 'ROOT', Path(folder)):
            path = Path(folder) / 'VERSION'
            path.write_text('2.3.4\n')
            self.assertEqual(version.current(), '2.3.4')
            for invalid in ['', 'v2.3.4', '02.3.4', '2.3', '2.3.4-beta', '2.3.4\n9.9.9', '2.3.4$(command)', '0' * 65]:
                path.write_text(invalid)
                with self.subTest(value=invalid), self.assertRaises(ValueError):
                    version.current()
            path.unlink()
            with self.assertRaises(ValueError):
                version.current()

    def test_env_cannot_override_version_and_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(version, 'ROOT', Path(folder)):
            path = Path(folder) / 'VERSION'
            path.write_text('2.3.4')
            with mock.patch.dict('os.environ', {'TINKERCRAFT_VERSION': '9.9.9'}):
                self.assertEqual(version.current(), '2.3.4')
            target = Path(folder) / 'target'
            path.rename(target)
            path.symlink_to(target)
            with self.assertRaises(ValueError):
                version.current()


if __name__ == '__main__':
    unittest.main()
