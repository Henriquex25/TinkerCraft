import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import zipfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('desktop_build', ROOT / 'scripts/build-desktop.py')
desktop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(desktop)


class DesktopDistributionTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('TINKERCRAFT_TEST_DESKTOP_VARIANT'), 'native package verification runs in desktop CI')
    def test_actual_native_package(self):
        variant = os.environ['TINKERCRAFT_TEST_DESKTOP_VARIANT']
        target, architecture = variant.split('-')
        version = (ROOT / 'VERSION').read_text().strip()
        binary = ROOT / ('build/bin/tinkercraft.exe' if target == 'windows' else 'build/bin/TinkerCraft.app/Contents/MacOS/tinkercraft')
        info = json.loads(subprocess.run([str(binary), '--version-json'], check=True, capture_output=True, text=True, timeout=30).stdout)
        self.assertEqual(info['version'], version)
        self.assertEqual(info['distribution'], 'preview')
        self.assertEqual(info['variant'], variant)
        self.assertEqual(info['platform'], target)
        self.assertEqual(info['architecture'], architecture)
        self.assertEqual(info['webkit'], '')
        directory = ROOT / 'build/dist' / variant
        archive = directory / f'tinkercraft_{version}_{target}_{architecture}_preview.zip'
        digest, name = (directory / 'checksums.txt').read_text().strip().split()
        self.assertEqual(name, archive.name)
        self.assertEqual(digest, hashlib.sha256(archive.read_bytes()).hexdigest())
        with zipfile.ZipFile(archive) as package:
            files = package.namelist()
            self.assertFalse(any(Path(name).name == '.env' for name in files))
            license_prefix = 'TinkerCraft/licenses/' if target == 'windows' else 'TinkerCraft.app/Contents/Resources/licenses/'
            for name in ['PHP-Parser-LICENSE', 'Monaco-ThirdPartyNotices.txt', 'DOMPurify-LICENSE-MPL', 'Go-LICENSE', 'vscode-loc-LICENSE.txt']:
                self.assertTrue(package.read(license_prefix + name))
            if target == 'darwin':
                phar = package.read('TinkerCraft.app/Contents/MacOS/phpactor.phar')
                self.assertEqual(hashlib.sha256(phar).hexdigest(), (ROOT / 'scripts/phpactor.sha256').read_text().split()[0])
                plist = plistlib.loads(package.read('TinkerCraft.app/Contents/Info.plist'))
                self.assertEqual(plist['CFBundleShortVersionString'], version)
                self.assertEqual(plist['LSMinimumSystemVersion'], '13.0')
            else:
                self.assertEqual(package.read('TinkerCraft/tinkercraft.exe'), binary.read_bytes())

    def test_native_metadata_uses_requested_version_and_is_removed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            template = root / 'module/pkg/buildassets/build/windows/wails.exe.manifest'
            template.parent.mkdir(parents=True)
            template.write_text('version="{{.Info.ProductVersion}}.0"')
            with mock.patch.object(desktop, 'ROOT', root):
                with desktop.native_metadata('windows', '2.3.4', root / 'module'):
                    info = json.loads((root / 'build/windows/info.json').read_text())
                    self.assertEqual(info['fixed']['file_version'], '2.3.4')
                    self.assertIn('version="2.3.4.0"', (root / 'build/windows/wails.exe.manifest').read_text())
                self.assertFalse((root / 'build/windows/info.json').exists())
                with self.assertRaises(RuntimeError):
                    with desktop.native_metadata('darwin', '2.3.4', root / 'module'):
                        info = plistlib.loads((root / 'build/darwin/Info.plist').read_bytes())
                        self.assertEqual(info['CFBundleShortVersionString'], '2.3.4')
                        self.assertEqual(info['CFBundleVersion'], '2.3.4')
                        self.assertEqual(info['LSMinimumSystemVersion'], '13.0')
                        raise RuntimeError('failed build')
                self.assertFalse((root / 'build/darwin/Info.plist').exists())

    def test_existing_native_metadata_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            file = root / 'build/darwin/Info.plist'
            file.parent.mkdir(parents=True)
            file.write_bytes(b'custom metadata')
            with mock.patch.object(desktop, 'ROOT', root), self.assertRaises(ValueError):
                with desktop.native_metadata('darwin', '2.3.4', root):
                    self.fail('overwrote existing metadata')
            self.assertEqual(file.read_bytes(), b'custom metadata')

    def test_windows_archive_contains_only_distribution_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md', '.env', 'phpactor.phar']:
                (root / name).write_bytes(name.encode())
            binary = root / 'tinkercraft.exe'
            binary.write_bytes(b'fake executable')
            destination = root / 'package.zip'
            licenses = root / 'licenses'
            licenses.mkdir()
            (licenses / 'example-LICENSE').write_text('original dependency license')
            with mock.patch.object(desktop, 'ROOT', root):
                desktop.package_windows(binary, destination, '2.3.4', licenses)
            with zipfile.ZipFile(destination) as archive:
                self.assertEqual(set(archive.namelist()), {'TinkerCraft/tinkercraft.exe', 'TinkerCraft/LICENSE', 'TinkerCraft/THIRD_PARTY_NOTICES.md', 'TinkerCraft/README.txt', 'TinkerCraft/licenses/example-LICENSE'})
                self.assertEqual(archive.read('TinkerCraft/tinkercraft.exe'), binary.read_bytes())
                self.assertIn(b'AST completion', archive.read('TinkerCraft/README.txt'))

    def test_dependency_licenses_are_preserved_without_copying_other_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sources = ['runtime/vendor/php-parser/LICENSE', 'frontend/node_modules/monaco-editor/LICENSE',
                       'frontend/node_modules/monaco-editor/ThirdPartyNotices.txt', 'frontend/node_modules/dompurify/LICENSE',
                       'frontend/node_modules/dompurify/LICENSE-MPL', 'docs/licenses/vscode-loc-LICENSE.txt',
                       'go/LICENSE', 'module/LICENSE', 'module/.env', 'frontend/node_modules/example/LICENSE',
                       'frontend/node_modules/example/README.md']
            for source in sources:
                file = root / source
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(source)
            destination = root / 'output'
            destination.mkdir()

            def capture(*args):
                if args[:3] == ('go', 'env', 'GOROOT'):
                    return str(root / 'go')
                if args[:3] == ('go', 'list', '-m'):
                    return json.dumps({'Dir': str(root / 'module'), 'Path': 'example.test/module'})
                return str(root / 'frontend') + '\n' + str(root / 'frontend/node_modules/example')

            with mock.patch.object(desktop, 'ROOT', root), mock.patch.object(desktop, 'capture', side_effect=capture):
                desktop.collect_licenses(destination, 'npm')
            self.assertEqual((destination / 'go-example.test__module/LICENSE').read_text(), 'module/LICENSE')
            self.assertTrue((destination / 'vscode-loc-LICENSE.txt').is_file())
            self.assertTrue((destination / 'Go-LICENSE').is_file())
            self.assertFalse(list(destination.rglob('.env')))
            self.assertFalse(list(destination.rglob('README.md')))

    def test_bad_phpactor_download_preserves_previous_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            (root / 'scripts/phpactor.version').write_text('2026.10.07.0')
            (root / 'scripts/phpactor.sha256').write_text(hashlib.sha256(b'valid').hexdigest())
            (root / '.tools').mkdir()
            phar = root / '.tools/phpactor.phar'
            phar.write_bytes(b'previous installation')
            opener = mock.Mock()
            opener.open.return_value = io.BytesIO(b'corrupt download')
            with mock.patch.object(desktop, 'ROOT', root), mock.patch.object(desktop, 'build_opener', return_value=opener), mock.patch.object(desktop, 'run') as run:
                with self.assertRaises(ValueError):
                    desktop.verified_phpactor()
                run.assert_not_called()
            self.assertEqual(phar.read_bytes(), b'previous installation')
            self.assertEqual(list((root / '.tools').iterdir()), [phar])


if __name__ == '__main__':
    unittest.main()
