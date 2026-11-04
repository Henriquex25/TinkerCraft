#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent


def api(method, endpoint, data=None):
    command = ['gh', 'api', '--hostname', 'github.com', '--method', method, endpoint]
    if data is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=json.dumps(data) if data is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout) if result.stdout.strip() else None


def origin_repository():
    remote = subprocess.check_output(['git', 'remote', 'get-url', 'origin'], cwd=ROOT, text=True).strip()
    match = re.fullmatch(r'(?:git@github\.com:|https://github\.com/)([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?/?', remote)
    return match[1] if match else None


def preflight(repository, protect):
    origin = origin_repository()
    if origin is None or origin.casefold() != repository.casefold():
        raise ValueError('The selected repository must match this checkout\'s GitHub origin.')
    if not shutil.which('gh'):
        raise ValueError('Install GitHub CLI and run: gh auth login --hostname github.com --web')
    subprocess.run(['gh', 'auth', 'status', '--hostname', 'github.com'], capture_output=True, check=True)
    info = api('GET', f'repos/{repository}')
    if not info.get('permissions', {}).get('admin') or info.get('private') or info.get('default_branch') != 'main':
        raise ValueError('Administrator access to a public repository with default branch main is required.')
    if protect:
        branch = api('GET', f'repos/{repository}/branches/main')
        sha = branch['commit']['sha']
        runs = api('GET', f'repos/{repository}/actions/workflows/ci.yml/runs?head_sha={sha}&branch=main&event=push&status=success&per_page=100')
        if not runs.get('workflow_runs'):
            raise ValueError('Publish CI and wait for a successful push run on the current main commit before enabling protection.')
        app = api('GET', 'apps/github-actions')
        if app.get('id') != 15368:
            raise ValueError('Unexpected GitHub Actions application ID; review the ruleset before applying.')


def apply(repository, protect):
    preflight(repository, protect)
    base = f'repos/{repository}'
    if protect:
        ruleset = json.loads((ROOT / '.github/main-ruleset.json').read_text())
        existing = api('GET', f'{base}/rulesets?per_page=100&includes_parents=false')
        matches = [item for item in existing if item['name'] == ruleset['name']]
        if len(matches) > 1:
            raise ValueError('Multiple matching rulesets; review them in GitHub Settings.')
        if matches:
            api('PUT', f'{base}/rulesets/{matches[0]["id"]}', ruleset)
        else:
            api('POST', f'{base}/rulesets', ruleset)
        print('Applied main protection: PR, Linux checks, resolved conversations, linear history, no force push or deletion.')
        return
    api('PATCH', base, {
        'description': 'A focused, open-source PHP / Laravel desktop playground for Linux.',
        'has_issues': True, 'has_discussions': True,
        'allow_squash_merge': True, 'allow_merge_commit': False, 'allow_rebase_merge': False,
        'delete_branch_on_merge': True, 'allow_update_branch': True,
    })
    api('PUT', f'{base}/topics', {'names': ['php', 'laravel', 'desktop', 'linux', 'wails', 'monaco-editor', 'docker', 'ssh']})
    existing = set()
    page = 1
    while True:
        labels = api('GET', f'{base}/labels?per_page=100&page={page}')
        existing.update(item['name'].casefold() for item in labels)
        if len(labels) < 100:
            break
        page += 1
    for label in json.loads((ROOT / '.github/labels.json').read_text()):
        if label['name'].casefold() in existing:
            api('PATCH', f'{base}/labels/{quote(label["name"], safe="")}', {'new_name': label['name'], 'color': label['color'], 'description': label['description']})
        else:
            api('POST', f'{base}/labels', label)
    api('PUT', f'{base}/vulnerability-alerts')
    api('PUT', f'{base}/private-vulnerability-reporting')
    print('Applied repository metadata, Discussions, squash merging, labels, Dependabot alerts, and private vulnerability reporting.')
    print('Create discussion categories and verify security notifications using docs/github-maintainer.md.')


def main():
    parser = argparse.ArgumentParser(description='Preview or apply TinkerCraft GitHub community settings. No commits, pushes, or releases are created.')
    parser.add_argument('--repo', required=True, help='OWNER/REPOSITORY; must match origin when applying')
    parser.add_argument('--apply', action='store_true', help='Write settings using your authenticated GitHub CLI account')
    parser.add_argument('--protect-main', action='store_true', help='Apply only the main ruleset after a successful CI run')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repo):
        parser.error('Use OWNER/REPOSITORY.')
    if not args.apply:
        print('PREVIEW ONLY: no network calls or changes.')
        print('Repository:', args.repo)
        if args.protect_main:
            print((ROOT / '.github/main-ruleset.json').read_text())
        else:
            print('Enable Issues, Discussions, squash merging, automatic merged-branch deletion, Dependabot alerts, and private reporting.')
            print('Apply project description, topics, and labels; existing unrelated labels are preserved.')
            print('Labels:', ', '.join(item['name'] for item in json.loads((ROOT / '.github/labels.json').read_text())))
        return
    try:
        apply(args.repo, args.protect_main)
    except (ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Setup stopped: {error}. No commits, pushes, releases, or history changes were performed.')


if __name__ == '__main__':
    main()
