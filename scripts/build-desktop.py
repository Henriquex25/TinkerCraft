#!/usr/bin/env python3

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import tempfile
from urllib.request import HTTPSHandler, HTTPRedirectHandler, build_opener
import zipfile

from version import current

ROOT = Path(__file__).resolve().parent.parent


def run(*args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def capture(*args):
    return run(*args, capture_output=True, text=True).stdout.strip()


class HTTPSRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, url):
        if not url.startswith('https://'):
            raise ValueError('Phpactor download redirected outside HTTPS.')
        return super().redirect_request(request, fp, code, msg, headers, url)


def verified_phpactor():
    target = ROOT / '.tools/phpactor.phar'
    digest = (ROOT / 'scripts/phpactor.sha256').read_text().split()[0]
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == digest:
        return target
    release = (ROOT / 'scripts/phpactor.version').read_text().strip()
    if not re.fullmatch(r'\d{4}\.\d{2}\.\d{2}\.\d+', release):
        raise ValueError('Invalid Phpactor release pin.')
    target.parent.mkdir(exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
            temporary = Path(output.name)
            opener = build_opener(HTTPSHandler(), HTTPSRedirects())
            with opener.open(f'https://github.com/phpactor/phpactor/releases/download/{release}/phpactor.phar', timeout=60) as response:
                data = response.read(32 * 1024 * 1024 + 1)
            if len(data) > 32 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != digest:
                raise ValueError('Phpactor download does not match scripts/phpactor.sha256.')
            output.write(data)
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return target


@contextmanager
def native_metadata(target, version, module_dir):
    files = {}
    if target == 'windows':
        directory = ROOT / 'build/windows'
        files[directory / 'info.json'] = json.dumps({
            'fixed': {'file_version': version},
            'info': {'0000': {'ProductVersion': version, 'ProductName': 'TinkerCraft', 'FileDescription': 'TinkerCraft PHP workspace'}},
        }).encode()
        manifest = (module_dir / 'pkg/buildassets/build/windows/wails.exe.manifest').read_text()
        files[directory / 'wails.exe.manifest'] = manifest.replace('{{.Info.ProductVersion}}', version).encode()
    else:
        files[ROOT / 'build/darwin/Info.plist'] = plistlib.dumps({
            'CFBundlePackageType': 'APPL', 'CFBundleName': 'TinkerCraft',
            'CFBundleExecutable': 'tinkercraft', 'CFBundleIdentifier': 'com.henriquemiranda.tinkercraft',
            'CFBundleVersion': version, 'CFBundleShortVersionString': version,
            'CFBundleIconFile': 'iconfile', 'LSMinimumSystemVersion': '13.0',
            'NSHighResolutionCapable': True,
        })
    if any(file.exists() or file.is_symlink() for file in files):
        raise ValueError('Generated native metadata already exists. Move it aside before building.')
    try:
        for file, data in files.items():
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        yield
    finally:
        for file in files:
            file.unlink(missing_ok=True)


def collect_licenses(destination, npm, phar=None):
    for source, name in [
        ('runtime/vendor/php-parser/LICENSE', 'PHP-Parser-LICENSE'),
        ('frontend/node_modules/monaco-editor/LICENSE', 'Monaco-LICENSE'),
        ('frontend/node_modules/monaco-editor/ThirdPartyNotices.txt', 'Monaco-ThirdPartyNotices.txt'),
        ('frontend/node_modules/dompurify/LICENSE', 'DOMPurify-LICENSE'),
        ('frontend/node_modules/dompurify/LICENSE-MPL', 'DOMPurify-LICENSE-MPL'),
    ]:
        shutil.copy2(ROOT / source, destination / name)
    for file in (ROOT / 'docs/licenses').iterdir():
        if file.is_file():
            shutil.copy2(file, destination / file.name)
    go_license = Path(capture('go', 'env', 'GOROOT')) / 'LICENSE'
    if not go_license.is_file():
        toolchain = re.match(r'go(\d+\.\d+)', capture('go', 'env', 'GOVERSION'))
        if toolchain is None:
            raise ValueError('Cannot identify the Go toolchain license.')
        go_license = Path('/usr/share/doc') / f'golang-{toolchain.group(1)}-go/copyright'
    shutil.copy2(go_license, destination / 'Go-LICENSE')

    def copy_notices(directory, prefix):
        for file in directory.iterdir():
            if file.is_file() and file.name.lower().startswith(('license', 'copying', 'notice', 'thirdparty')):
                target = destination / prefix / file.name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file, target)

    frontend = ROOT / 'frontend'
    for folder in capture(npm, '--prefix', 'frontend', 'ls', '--omit=dev', '--parseable', '--all').splitlines():
        directory = Path(folder)
        if directory != frontend:
            copy_notices(directory, 'npm-' + directory.relative_to(frontend).as_posix().replace('/', '__'))
    modules = capture('go', 'list', '-m', '-json', 'all')
    decoder = json.JSONDecoder()
    while modules.strip():
        module, end = decoder.raw_decode(modules.lstrip())
        modules = modules.lstrip()[end:]
        if module.get('Dir') and not module.get('Main'):
            copy_notices(Path(module['Dir']), 'go-' + module['Path'].replace('/', '__'))
    if phar is not None:
        data = run('php', '-r', "echo file_get_contents('phar://' . $argv[1] . '/LICENSE');", str(phar), capture_output=True).stdout
        (destination / 'Phpactor-LICENSE').write_bytes(data)
        (destination / 'Phpactor-SHA256').write_text(hashlib.sha256(phar.read_bytes()).hexdigest() + '  phpactor.phar\n')
    for entry in destination.rglob('*'):
        entry.chmod(0o755 if entry.is_dir() else 0o644)
    destination.chmod(0o755)


def package_windows(binary, destination, version, licenses):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.write(binary, 'TinkerCraft/tinkercraft.exe')
        for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
            archive.write(ROOT / name, 'TinkerCraft/' + name)
        for file in sorted(licenses.rglob('*')):
            if file.is_file():
                archive.write(file, 'TinkerCraft/licenses/' + file.relative_to(licenses).as_posix())
        archive.writestr('TinkerCraft/README.txt', f'TinkerCraft {version} — experimental Windows build\n\n'
                         'Extract the ZIP before opening tinkercraft.exe. Requires WebView2 and PHP CLI (64-bit).\n'
                         'Configure the absolute path to php.exe in Preferences if PHP is not on PATH.\n'
                         'Native Windows uses AST completion; Phpactor/WSL integration is not included.\n'
                         'Docker Desktop and OpenSSH are optional and must be installed separately.\n'
                         'Updates are manual. This build has no publisher signature.\n')


def build(target, architecture):
    version = current()
    expected = capture('go', 'list', '-m', '-f', '{{.Version}}', 'github.com/wailsapp/wails/v2')
    wails = shutil.which('wails')
    if not wails or expected not in capture(wails, 'version').split():
        raise ValueError(f'Install the matching CLI: go install github.com/wailsapp/wails/v2/cmd/wails@{expected}')
    module_dir = Path(capture('go', 'list', '-m', '-f', '{{.Dir}}', 'github.com/wailsapp/wails/v2'))
    phar = verified_phpactor() if target == 'darwin' else None
    npm = shutil.which('npm')
    if not npm:
        raise ValueError('npm is required.')
    run(npm, 'ci')
    run(npm, '--prefix', 'frontend', 'ci')
    run(npm, '--prefix', 'frontend', 'run', 'build')
    commit = capture('git', 'rev-parse', '--short', 'HEAD')
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    flags = f'-X tinkercraft/internal/buildinfo.Distribution=preview -X tinkercraft/internal/buildinfo.Commit={commit} -X tinkercraft/internal/buildinfo.BuildDate={stamp}'
    arguments = [wails, 'build', '-skipbindings', '-s', '-nosyncgomod', '-m', '-platform', f'{target}/{architecture}', '-ldflags', flags, '-o', 'tinkercraft.exe' if target == 'windows' else 'tinkercraft']
    environment = os.environ.copy()
    if target == 'windows':
        arguments += ['-webview2', 'browser']
    else:
        environment['MACOSX_DEPLOYMENT_TARGET'] = '13.0'
        environment['CGO_CFLAGS'] = environment.get('CGO_CFLAGS', '') + ' -mmacosx-version-min=13.0'
        environment['CGO_LDFLAGS'] = environment.get('CGO_LDFLAGS', '') + ' -mmacosx-version-min=13.0'
    if target == 'darwin':
        bundle = ROOT / 'build/bin/TinkerCraft.app'
        if bundle.exists():
            shutil.rmtree(bundle)
    with native_metadata(target, version, module_dir):
        run(*arguments, env=environment)
    variant = f'{target}-{architecture}'
    directory = ROOT / 'build/dist' / variant
    directory.mkdir(parents=True, exist_ok=True)
    archive = directory / f'tinkercraft_{version}_{variant.replace("-", "_")}_preview.zip'
    with tempfile.TemporaryDirectory(prefix='tinkercraft-licenses-') as folder:
        licenses = Path(folder)
        collect_licenses(licenses, npm, phar)
        if target == 'windows':
            package_windows(ROOT / 'build/bin/tinkercraft.exe', archive, version, licenses)
        else:
            bundle = ROOT / 'build/bin/TinkerCraft.app'
            bundled_phar = bundle / 'Contents/MacOS/phpactor.phar'
            shutil.copy2(phar, bundled_phar)
            bundled_phar.chmod(0o644)
            for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
                shutil.copy2(ROOT / name, bundle / 'Contents/Resources' / name)
            shutil.copytree(licenses, bundle / 'Contents/Resources/licenses')
            run('codesign', '--force', '--sign', '-', str(bundle))
            run('codesign', '--verify', '--deep', '--strict', str(bundle))
            archive.unlink(missing_ok=True)
            run('ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(bundle), str(archive))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (directory / 'checksums.txt').write_text(f'{digest}  {archive.name}\n', encoding='utf-8')
    print(f'Experimental package: {archive}')


def main():
    host = {'Windows': 'windows', 'Darwin': 'darwin', 'Linux': 'linux'}.get(platform.system())
    parser = argparse.ArgumentParser(description='Build experimental desktop packages. macOS requires a Mac; Windows also supports cross-compilation.')
    parser.add_argument('--target', choices=['windows', 'darwin'], help='Defaults to the current OS; use windows to cross-compile from Linux/macOS.')
    parser.add_argument('--arch', choices=['amd64', 'arm64'], default={'x86_64': 'amd64', 'AMD64': 'amd64', 'arm64': 'arm64'}.get(platform.machine()))
    args = parser.parse_args()
    target = args.target or host
    if host is None or args.arch is None or target not in {'windows', 'darwin'} or (target == 'windows' and args.arch != 'amd64') or (target == 'darwin' and host != 'darwin'):
        parser.error('Use Windows x64 or macOS (Intel/Apple Silicon). Cross-compile Windows with --target windows --arch amd64. Linux builds use scripts/build.sh.')
    try:
        build(target, args.arch)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))


if __name__ == '__main__':
    main()
