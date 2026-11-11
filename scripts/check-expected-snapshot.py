#!/usr/bin/env python3
"""One authored Node fixture; no install, browser, database, build or provider."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time

parser = argparse.ArgumentParser()
for option in ('repository', 'overlay', 'proof', 'node'):
    parser.add_argument('--' + option, type=Path, required=True)
args = parser.parse_args()
assert sys.platform == 'darwin'
repo, overlay, proof, node = (p.resolve() for p in (args.repository, args.overlay, args.proof, args.node))
base = '6277e1e56a4066fcb9b4a4b49496cdf980219f3f'
parent = '9a4042fb33af07463e245690f17b2604fd10e968'
selected = ['lib/model.ts', 'lib/media.ts', 'lib/archive.ts', 'lib/render.ts', 'lib/types.ts', 'lib/local.ts',
            'tests/unit/archive.test.mjs', 'tests/unit/model.test.mjs', 'tests/unit/render.test.mjs']
case = 'missing IndexedDB rejects honestly rather than using a fake successful fallback'
assert not proof.exists()
proof.mkdir(mode=0o700)
root = Path(tempfile.mkdtemp(prefix='linen-cas-expected-', dir='/private/tmp'))
root.chmod(0o700)
nonce = secrets.token_hex(16)
marker = root / '.owner'
marker.write_text(nonce)
marker.chmod(0o600)
root_id = (root.stat().st_dev, root.stat().st_ino)
rows = []
report = {'schemaVersion': 'linen.expected-snapshot-native.v1', 'sourceParentCommit': parent,
          'nativeBaseCommit': base, 'case': case, 'passed': False, 'errors': [], 'cleanup': {},
          'scope': {'expectedSnapshotInputGuard': True, 'unavailableIndexedDB': True,
                    'actualIndexedDB': False, 'browser': False, 'semanticBuild': False, 'backend': False},
          'proofLimits': ['One modified authored fixture, not a new 44-case run or two-tab/browser acceptance.',
                          'Native macOS Node24.21.0 differs from planned Linux Node24.22.2.']}


def sha(body):
    return hashlib.sha256(body).hexdigest()


def identity(path):
    s = path.lstat()
    return (s.st_dev, s.st_ino, s.st_uid, stat.S_IMODE(s.st_mode), s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def git(*values):
    return subprocess.check_output(['git', *values], cwd=repo)


def guard():
    assert git('rev-parse', 'HEAD').decode().strip() == base
    assert git('status', '--porcelain=v1', '-z', '--untracked-files=all') == b''


def save_report():
    target = proof / 'report.json'
    temporary = proof / 'report.pending'
    temporary.write_text(json.dumps(report, indent=2) + '\n')
    os.replace(temporary, target)


try:
    guard()
    for rel in selected:
        source = overlay / rel if (overlay / rel).is_file() else repo / rel
        assert source.is_file() and not source.is_symlink()
        body = source.read_bytes()
        assert len(body) < 128 * 1024
        target = root / rel
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        target.write_bytes(body)
        target.chmod(0o600)
        rows.append({'path': rel, 'bytes': len(body), 'sha256': sha(body),
                     'gitBlob': hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()})
    assert sum(r['bytes'] for r in rows) < 256 * 1024
    report['sourceExport'] = rows
    report['sourceVectorSha256'] = sha(json.dumps(rows, sort_keys=True).encode())
    node_identity = identity(node)
    node_hash = sha(node.read_bytes())
    assert subprocess.check_output([str(node), '--version']) == b'v24.21.0\n'
    report['runtime'] = {'node': 'v24.21.0', 'platform': 'darwin', 'nodeSha256': node_hash,
                         'identityExcludesAccessTime': True}
    env = {'PATH': str(node.parent) + ':/usr/bin:/bin', 'HOME': os.environ['HOME'],
           'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC', 'TMPDIR': str(root),
           'NODE_DISABLE_COMPILE_CACHE': '1'}
    command = [str(node), '--test', '--test-reporter=tap', '--test-name-pattern=^' + re.escape(case) + '$',
               str(root / 'tests/unit/archive.test.mjs')]
    started = time.monotonic()
    process = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    assert os.getpgid(process.pid) == process.pid
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=30)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGTERM)
        try:
            stdout, stderr = process.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate(timeout=3)
    (proof / 'stdout.tap').write_bytes(stdout)
    (proof / 'stderr.log').write_bytes(stderr)
    # Persist the actual child result before any post-run identity or summary observer.
    report['child'] = {'pid': process.pid, 'exitCode': process.returncode, 'timedOut': timed_out,
                       'reaped': process.returncode is not None, 'durationSeconds': round(time.monotonic() - started, 6),
                       'stdout': {'bytes': len(stdout), 'sha256': sha(stdout)},
                       'stderr': {'bytes': len(stderr), 'sha256': sha(stderr)}}
    save_report()
    assert len(stdout) <= 1024 ** 2 and len(stderr) <= 1024 ** 2
    assert process.returncode == 0 and not timed_out and stderr == b''
    try:
        os.killpg(process.pid, 0)
        raise AssertionError('owned child process group remains')
    except ProcessLookupError:
        report['child']['groupAbsent'] = True
    assert identity(node) == node_identity and sha(node.read_bytes()) == node_hash
    selected_names, filtered_names = [], []
    for name in re.findall(r'^ok \d+ - (.+)$', stdout.decode(), re.M):
        if ' # SKIP ' in name:
            name, reason = name.split(' # SKIP ', 1)
            assert reason == 'test name does not match pattern'
            filtered_names.append(name)
        else:
            selected_names.append(name)
    assert selected_names == [case] and case not in filtered_names
    report['filterSkippedNames'] = filtered_names
    summary = {key: int(re.search(r'^# ' + key + r' (\d+)$', stdout.decode(), re.M).group(1))
               for key in ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')}
    report['summary'] = summary
    assert summary == {'tests': 1 + len(filtered_names), 'pass': 1, 'fail': 0,
                       'cancelled': 0, 'skipped': len(filtered_names), 'todo': 0}
    for row in rows:
        assert sha((root / row['path']).read_bytes()) == row['sha256']
        original = overlay / row['path'] if (overlay / row['path']).is_file() else repo / row['path']
        assert sha(original.read_bytes()) == row['sha256']
    guard()
    report['sourcePreserved'] = True
    report['passed'] = True
except Exception as error:
    report['errors'].append({'type': type(error).__name__, 'message': str(error)})
finally:
    try:
        assert root.resolve(strict=True) == root and (root.lstat().st_dev, root.lstat().st_ino) == root_id
        assert sha(marker.read_bytes()) == sha(nonce.encode())
        assert {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()} == {'.owner'} | {r['path'] for r in rows}
        for p in root.rglob('*'):
            assert not p.is_symlink() and p.lstat().st_uid == os.getuid()
        openers = subprocess.run(['lsof', '-nP', '+D', str(root)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        assert openers.returncode == 1 and openers.stdout == openers.stderr == b''
        shutil.rmtree(root)
        assert not os.path.lexists(root)
        report['cleanup'] = {'ownedExportRemoved': True, 'absenceReadback': True, 'noOpenersObserved': True,
                             'sourceFiles': len(rows), 'sourceBytes': sum(r['bytes'] for r in rows)}
    except Exception as error:
        report['cleanup'] = {'ownedExportRemoved': False, 'error': type(error).__name__}
        report['passed'] = False
    save_report()
print(json.dumps({'passed': report['passed'], 'child': report.get('child'), 'summary': report.get('summary'),
                  'errors': report['errors'], 'cleanup': report['cleanup']}))
raise SystemExit(0 if report['passed'] else 1)
