#!/usr/bin/env python3

import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlencode

import version


def require_ci(repository, sha):
    if not re.fullmatch(r'[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid GitHub repository.')
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Invalid release commit SHA.')
    query = urlencode({'head_sha': sha, 'branch': 'main', 'event': 'push', 'status': 'success', 'per_page': 100})
    response = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repository}/actions/workflows/ci.yml/runs?{query}'], text=True))
    for run in response['workflow_runs']:
        if (run.get('head_sha') == sha and run.get('head_branch') == 'main'
                and run.get('event') == 'push' and run.get('status') == 'completed'
                and run.get('conclusion') == 'success'
                and run.get('head_repository', {}).get('full_name', '').lower() == repository.lower()):
            return
    raise ValueError('Wait for successful push CI on this exact main commit before releasing.')


def main():
    if os.environ.get('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('Run releases from main after merging a reviewed PR.')
    value = version.current()
    require_ci(os.environ.get('GITHUB_REPOSITORY', ''), os.environ.get('GITHUB_SHA', ''))
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with Path(output).open('a', encoding='utf-8') as file:
            file.write(f'version={value}\n')
    print(f'Release {value}: successful CI verified for {os.environ["GITHUB_SHA"]}.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, UnicodeError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error))
