#!/usr/bin/env python3

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument('version')
parser.add_argument('repository_url')
parser.add_argument('input', type=Path)
parser.add_argument('output', type=Path)
a = parser.parse_args()
if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', a.version):
    raise SystemExit('Versão inválida')
u = urlparse(a.repository_url)
if u.scheme != 'https' or u.netloc != 'github.com' or not re.fullmatch(r'/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?', u.path):
    raise SystemExit('Informe a URL HTTPS do repositório GitHub')
repo = a.repository_url.rstrip('/')
a.output.mkdir(parents=True, exist_ok=True)
assets = {}
checksums = []
for metadata in sorted(a.input.rglob('release-metadata.json')):
    data = json.loads(metadata.read_text())
    variant, asset = data['variant'], data['asset']
    if data['version'] != a.version or not re.fullmatch(r'linux-(?:amd64|arm64)-webkit(?:40|41)', variant) or variant in assets:
        raise SystemExit('Artefato de outra versão ou variante duplicada')
    name = f'tinkercraft_{a.version}_{variant.replace("-", "_")}.deb'
    file = metadata.parent / name
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    if asset['filename'] != name or asset['sha256'] != digest or asset['size'] != file.stat().st_size:
        raise SystemExit('Artefato divergente dos metadados')
    shutil.copy2(file, a.output / name)
    assets[variant] = {**asset, 'url': f'{repo}/releases/download/v{a.version}/{name}'}
    checksums.append(f'{digest}  {name}')
if not assets:
    raise SystemExit('Nenhum pacote foi encontrado')
(a.output / 'checksums.txt').write_text('\n'.join(checksums) + '\n')
(a.output / 'manifest.json').write_text(json.dumps({'schemaVersion': 1, 'version': a.version, 'notes': '', 'releaseURL': f'{repo}/releases/tag/v{a.version}', 'assets': assets}, indent=2) + '\n')
print(f'{len(assets)} variantes prontas em {a.output}')
