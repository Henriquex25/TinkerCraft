import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock
import hashlib
import shutil

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('distribution_config', ROOT / 'scripts/config.py')
configuration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configuration)

class DistributionTests(unittest.TestCase):
    def test_phpactor_checksum_is_checked_before_execution(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            (root / 'bin').mkdir()
            (root / '.tools').mkdir()
            for file in ['install-phpactor.sh', 'phpactor.sha256']:
                shutil.copy2(ROOT / 'scripts' / file, root / 'scripts' / file)
            original = root / '.tools/phpactor.phar'
            original.write_bytes(b'previous installation')
            marker = root / 'must-not-execute'
            (root / 'bin/curl').write_text('#!/usr/bin/env python3\nimport sys,pathlib\npathlib.Path(sys.argv[sys.argv.index("-o")+1]).write_bytes(b"corrupted download")\n')
            (root / 'bin/php').write_text('#!/bin/sh\ntouch "$TINKERCRAFT_TEST_PHAR_MARKER"\n')
            for file in (root / 'bin').iterdir():
                file.chmod(0o755)
            result = subprocess.run(['bash', str(root / 'scripts/install-phpactor.sh')], env={**os.environ, 'PATH': str(root / 'bin') + os.pathsep + os.environ['PATH'], 'TINKERCRAFT_TEST_PHAR_MARKER': str(marker)}, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists())
            self.assertEqual(original.read_bytes(), b'previous installation')
            self.assertFalse(list((root / '.tools').glob('phpactor-download-*')))

    def test_dotenv_is_data_and_rejects_duplicates(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            marker = root / 'must-not-exist'
            (root / '.env').write_text(f'TINKERCRAFT_RELEASE_SOURCE="$(touch {marker})"\n')
            with mock.patch.object(configuration, 'ROOT', root):
                self.assertEqual(configuration.values()['TINKERCRAFT_RELEASE_SOURCE'], f'$(touch {marker})')
                self.assertFalse(marker.exists())
                (root / '.env').write_text('TINKERCRAFT_RELEASE_SOURCE="one"\nTINKERCRAFT_RELEASE_SOURCE="two"\n')
                with self.assertRaises(ValueError):
                    configuration.values()

    def test_legacy_dotenv_version_is_ignored(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.env').write_text('TINKERCRAFT_VERSION="9.9.9"\nTINKERCRAFT_RELEASE_SOURCE="https://github.com/example/project"\n')
            with mock.patch.object(configuration, 'ROOT', root):
                self.assertNotIn('TINKERCRAFT_VERSION', configuration.values())
                self.assertEqual(configuration.values()['TINKERCRAFT_RELEASE_SOURCE'], 'https://github.com/example/project')

    def test_release_assembly_checks_each_variant(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for abi in ['40', '41']:
                directory = root / 'input' / ('webkit' + abi)
                directory.mkdir(parents=True)
                name = f'tinkercraft_0.3.0_linux_amd64_webkit{abi}.deb'
                data = b'!<arch>\nfixture' + abi.encode()
                (directory / name).write_bytes(data)
                (directory / 'release-metadata.json').write_text(json.dumps({'version':'0.3.0','variant':'linux-amd64-webkit'+abi,'asset':{'filename':name,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()}}))
            command = ['python3', str(ROOT / 'scripts/prepare-release.py'), '0.3.0', 'https://github.com/example/tinkercraft', str(root / 'input'), str(root / 'output')]
            subprocess.run(command, check=True, capture_output=True)
            manifest = json.loads((root / 'output/manifest.json').read_text())
            self.assertEqual(len(manifest['assets']), 2)
            self.assertEqual(len((root / 'output/checksums.txt').read_text().splitlines()), 2)
            next((root / 'input').rglob('*.deb')).write_bytes(b'tampered')
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)

if __name__ == '__main__':
    unittest.main()
