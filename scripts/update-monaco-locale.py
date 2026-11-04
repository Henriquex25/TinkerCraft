#!/usr/bin/env python3
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent

def fetch(url, limit):
    request = urllib.request.Request(url, headers={'User-Agent': 'TinkerCraft-locale-builder'})
    with urllib.request.urlopen(request, timeout=60) as response:
        if not response.geturl().startswith('https://'):
            raise RuntimeError('HTTPS is required for upstream translations')
        data = response.read(limit + 1)
        if len(data) > limit:
            raise RuntimeError('Upstream translation data exceeded the size limit')
        return data

def main():
    locale_dir = ROOT / 'frontend/src/locales'
    metadata = json.loads((locale_dir / 'monaco-sources.json').read_text())
    package = json.loads((ROOT / 'frontend/node_modules/monaco-editor/package.json').read_text())
    vscode_ref, locale_ref = package['vscodeRef'], metadata['vscodeLocRef']
    if any(len(ref) != 40 or any(c not in '0123456789abcdef' for c in ref) for ref in [vscode_ref, locale_ref]):
        raise RuntimeError('Expected full upstream commit hashes')
    localization = json.loads(fetch(f'https://raw.githubusercontent.com/microsoft/vscode-loc/{locale_ref}/i18n/vscode-language-pack-pt-BR/translations/main.i18n.json', 4 * 1024 * 1024))
    archive = fetch(f'https://codeload.github.com/microsoft/vscode/tar.gz/{vscode_ref}', 80 * 1024 * 1024)
    sources = []
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        for entry in tar:
            if not entry.isfile() or '/src/vs/' not in entry.name or not entry.name.endswith('.ts') or entry.size > 2 * 1024 * 1024:
                continue
            module = 'vs/' + entry.name.split('/src/vs/', 1)[1][:-3]
            if module in localization.get('contents', {}):
                sources.append({'module': module, 'source': tar.extractfile(entry).read().decode()})
    with tempfile.TemporaryDirectory(prefix='tinkercraft-locale-') as folder:
        source_file, locale_file = Path(folder) / 'source.json', Path(folder) / 'locale.json'
        source_file.write_text(json.dumps(sources))
        locale_file.write_text(json.dumps(localization))
        subprocess.run(['node', str(ROOT / 'scripts/generate-monaco-locale.mjs'), str(source_file), str(locale_file)], cwd=ROOT, check=True)
    license_text = fetch(f'https://raw.githubusercontent.com/microsoft/vscode-loc/{locale_ref}/LICENSE.md', 128 * 1024)
    (ROOT / 'docs/licenses').mkdir(exist_ok=True)
    (ROOT / 'docs/licenses/vscode-loc-LICENSE.txt').write_bytes(license_text)
    metadata.update(monacoVersion=package['version'], vscodeRef=vscode_ref)
    (locale_dir / 'monaco-sources.json').write_text(json.dumps(metadata, indent=2) + '\n')

if __name__ == '__main__':
    main()
