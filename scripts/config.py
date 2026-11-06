#!/usr/bin/env python3

import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
ALLOWED = {'TINKERCRAFT_RELEASE_SOURCE', 'TINKERCRAFT_MAINTAINER'}

def values():
    result = {}
    file = ROOT / '.env'
    if not file.exists():
        return result
    for number, line in enumerate(file.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            raise ValueError(f'.env: linha {number} inválida')
        key, value = match.groups()
        if key == 'TINKERCRAFT_VERSION':
            continue
        if key not in ALLOWED:
            raise ValueError(f'.env: variável não reconhecida na linha {number}')
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif ' #' in value:
            value = value.split(' #', 1)[0].rstrip()
        if '\x00' in value or '\n' in value or key in result:
            raise ValueError(f'.env: valor duplicado ou inválido na linha {number}')
        result[key] = value
    return result

if __name__ == '__main__':
    key = sys.argv[1]
    if key not in ALLOWED:
        raise SystemExit('Variável não suportada')
    try:
        print(os.environ.get(key, values().get(key, '')))
    except ValueError as error:
        raise SystemExit(str(error))
