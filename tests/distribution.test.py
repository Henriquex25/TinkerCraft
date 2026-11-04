"""Configuration and release assembly tests; no network or system installation."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock
import hashlib

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('distribution_config', ROOT / 'scripts/config.py')
configuration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configuration)

class DistributionTests(unittest.TestCase):
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
