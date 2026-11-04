#!/usr/bin/env python3
"""Build a relocatable Debian package and release metadata without installing it."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse

from config import values

ROOT = Path(__file__).resolve().parent.parent

def copy(source, destination, executable=False):
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    destination.chmod(0o755 if executable else 0o644)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--without-phpactor', action='store_true')
    args = parser.parse_args()
    for tool in ['dpkg-deb', 'dpkg-shlibdeps', 'desktop-file-validate']:
        if not shutil.which(tool):
            raise SystemExit(f'Instale {tool} para gerar o pacote.')
    binary = ROOT / 'build/bin/tinkercraft'
    info = json.loads(subprocess.check_output([str(binary), '--version-json'], text=True))
    if info['platform'] != 'linux' or info['distribution'] != 'deb':
        raise SystemExit('Gere o binário com TINKERCRAFT_PACKAGE_FORMAT=deb ./scripts/build.sh')
    version, arch, variant = info['version'], info['architecture'], info['variant']
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version) or arch not in ['amd64', 'arm64']:
        raise SystemExit('Versão/arquitetura do binário não suportada.')
    configuration = values()
    maintainer = os.environ.get('TINKERCRAFT_MAINTAINER', configuration.get('TINKERCRAFT_MAINTAINER', 'TinkerCraft <noreply@localhost>'))
    if '\n' in maintainer or '\r' in maintainer:
        raise SystemExit('Identificação de maintainer inválida.')
    output = ROOT / 'build/dist'
    output.mkdir(parents=True, exist_ok=True)
    name = f'tinkercraft_{version}_{variant.replace("-", "_")}.deb'
    with tempfile.TemporaryDirectory(prefix='tinkercraft-package-') as folder:
        work = Path(folder)
        tree = work / 'package'
        copy(binary, tree / 'usr/lib/tinkercraft/tinkercraft', True)
        wrapper = tree / 'usr/bin/tinkercraft'
        wrapper.parent.mkdir(parents=True, exist_ok=True)
        wrapper.write_text('#!/bin/sh\nexec /usr/lib/tinkercraft/tinkercraft "$@"\n')
        wrapper.chmod(0o755)
        copy(ROOT / 'build/tinkercraft.desktop', tree / 'usr/share/applications/tinkercraft.desktop')
        try:
            import gi
            gi.require_version('GdkPixbuf', '2.0')
            from gi.repository import GdkPixbuf
        except ImportError:
            raise SystemExit('Instale python3-gi e gir1.2-gdkpixbuf-2.0 para gerar os ícones PNG.')
        icon = GdkPixbuf.Pixbuf.new_from_file(str(ROOT / 'build/appicon.png'))
        if icon.get_width() != icon.get_height():
            raise SystemExit('build/appicon.png deve ser quadrado; o original não será recortado.')
        for size in [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024]:
            path = tree / f'usr/share/icons/hicolor/{size}x{size}/apps/tinkercraft.png'
            path.parent.mkdir(parents=True, exist_ok=True)
            icon.scale_simple(size, size, GdkPixbuf.InterpType.HYPER).savev(str(path), 'png', [], [])
        docs = tree / 'usr/share/doc/tinkercraft'
        for source, target in [('LICENSE', 'copyright'), ('THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'), ('README.md', 'README.md'), ('frontend/public/vendor/monaco/LICENSE.txt', 'Monaco-LICENSE.txt'), ('frontend/public/vendor/monaco/Apache-2.0.txt', 'Apache-2.0.txt'), ('runtime/vendor/php-parser/LICENSE', 'PHP-Parser-LICENSE')]:
            copy(ROOT / source, docs / target)
        copy(ROOT / 'docs/releases.md', docs / 'docs/releases.md')
        if not args.without_phpactor:
            phar = ROOT / '.tools/phpactor.phar'
            if not phar.is_file():
                raise SystemExit('Instale o Phpactor com ./scripts/install-phpactor.sh antes de empacotar, ou use --without-phpactor.')
            copy(phar, tree / 'usr/lib/tinkercraft/phpactor.phar')
            license_text = subprocess.check_output(['php', '-r', "echo file_get_contents('phar://' . $argv[1] . '/LICENSE');", str(phar)])
            (docs / 'Phpactor-LICENSE').write_bytes(license_text)
            (docs / 'Phpactor-SHA256').write_text(hashlib.sha256(phar.read_bytes()).hexdigest() + '  phpactor.phar\n')
        subprocess.run(['desktop-file-validate', str(tree / 'usr/share/applications/tinkercraft.desktop')], check=True)
        debian = work / 'debian'
        debian.mkdir()
        (debian / 'control').write_text(f'Source: tinkercraft\nSection: devel\nPriority: optional\nMaintainer: {maintainer}\n\nPackage: tinkercraft\nArchitecture: any\nDescription: PHP and Laravel scratchpad\n')
        dependencies = subprocess.run(['dpkg-shlibdeps', '-O', '-e', str(tree / 'usr/lib/tinkercraft/tinkercraft')], cwd=work, text=True, capture_output=True)
        if dependencies.returncode:
            raise SystemExit(dependencies.stderr)
        depends = next(line.split('=', 1)[1] for line in dependencies.stdout.splitlines() if line.startswith('shlibs:Depends='))
        size = sum(file.stat().st_size for file in tree.rglob('*') if file.is_file()) // 1024 + 1
        control = tree / 'DEBIAN'
        control.mkdir()
        (control / 'control').write_text(f'''Package: tinkercraft
Version: {version}
Section: devel
Priority: optional
Architecture: {arch}
Maintainer: {maintainer}
Installed-Size: {size}
Depends: {depends}, xdg-utils
Recommends: php-cli (>= 2:8.2) | php8.2-cli | php8.3-cli | php8.4-cli | php8.5-cli, openssh-client
Suggests: docker.io, php-mbstring, php-xml, php-sqlite3
Description: Desktop scratchpad for PHP and Laravel
 Write PHP with completion, run snippets in local or remote projects,
 and inspect structured output. Supports Docker and SSH connections.
''')
        for entry in tree.rglob('*'):
            entry.chmod(0o755 if entry.is_dir() or entry in [wrapper, tree / 'usr/lib/tinkercraft/tinkercraft'] else 0o644)
        tree.chmod(0o755)
        # No maintainer scripts: installation does not run application code or touch home directories.
        subprocess.run(['dpkg-deb', '--root-owner-group', '-Zxz', '--build', str(tree), str(output / name)], check=True)
    package = output / name
    digest = hashlib.sha256(package.read_bytes()).hexdigest()
    (output / 'checksums.txt').write_text(f'{digest}  {name}\n')
    asset = {'filename': name, 'sha256': digest, 'size': package.stat().st_size}
    (output / 'release-metadata.json').write_text(json.dumps({'version': version, 'variant': variant, 'asset': asset}, indent=2) + '\n')
    source = info['releaseSource']
    parsed = urlparse(source)
    if parsed.scheme == 'https' and parsed.netloc == 'github.com' and len(parsed.path.strip('/').split('/')) == 2:
        repo = source.rstrip('/').removesuffix('.git')
        asset['url'] = f'{repo}/releases/download/v{version}/{name}'
        (output / 'manifest.json').write_text(json.dumps({'schemaVersion': 1, 'version': version, 'notes': '', 'releaseURL': f'{repo}/releases/tag/v{version}', 'assets': {variant: asset}}, indent=2) + '\n')
    else:
        (output / 'manifest.json').unlink(missing_ok=True)
    print(f'\nPacote: {package}\nSHA-256: {digest}\nVariante: {variant}')

if __name__ == '__main__':
    main()
