#!/usr/bin/env python3

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def current():
    path = ROOT / 'VERSION'
    if path.is_symlink() or not path.is_file():
        raise ValueError('VERSION must be a regular file.')
    if path.stat().st_size > 64:
        raise ValueError('VERSION is too long.')
    value = path.read_text(encoding='utf-8').strip()
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', value):
        raise ValueError('VERSION must contain MAJOR.MINOR.PATCH without a v prefix.')
    return value


if __name__ == '__main__':
    try:
        print(current())
    except (OSError, UnicodeError, ValueError) as error:
        raise SystemExit(str(error))
