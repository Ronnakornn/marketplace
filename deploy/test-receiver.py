#!/usr/bin/env python3
"""Exercise the receiver with disposable paths and fake external services on Linux."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile


SOURCE = Path(__file__).with_name('receive-release.sh').read_text()
REVISION = 'a' * 40


def run_case(case, extra_path=None):
    with tempfile.TemporaryDirectory(prefix='marketplace-receiver-test-') as temporary:
        root = Path(temporary)
        shared = root / 'shared'
        shared.mkdir()
        (shared / '.env').write_text('NEXT_PUBLIC_APP_URL=https://example.test\nAPI_BASE_URL=http://127.0.0.1:3001\n')
        current = root / 'current'
        commands = root / 'commands'
        commands.mkdir()
        fixture = root / 'fixture'
        fixture.mkdir()
        (fixture / 'public').mkdir()
        required = ['.next/BUILD_ID', 'node_modules/.bin/prisma', 'node_modules/.bin/next',
                    'generated/client/client.ts', 'server/index.ts', 'scripts/db-backup.ts',
                    'deploy/ecosystem.release.cjs', 'prisma/schema.prisma']
        for name in required:
            target = fixture / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('fixture')
        dotenv = fixture / 'node_modules/dotenv'
        dotenv.mkdir()
        (dotenv / 'index.js').write_text('exports.parse=b=>Object.fromEntries(b.toString().trim().split("\\n").map(l=>l.split(/=(.*)/s).slice(0,2)))')
        (fixture / 'release-manifest.json').write_text(json.dumps({
            'revision': REVISION, 'platform': 'ubuntu-24.04-x86_64', 'bun': '1.3.14',
            'publicBuildEnv': {'NEXT_PUBLIC_APP_URL': 'https://example.test', 'API_BASE_URL': 'http://127.0.0.1:3001'},
        }))
        archive_path = root / 'release.tar.gz'
        with tarfile.open(archive_path, 'w:gz') as archive:
            for child in fixture.iterdir():
                archive.add(child, arcname=child.name)
            if extra_path:
                member = tarfile.TarInfo(extra_path)
                member.size = 6
                archive.addfile(member, io.BytesIO(b'secret'))
        digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        if case == 'checksum':
            digest = '0' * 64
        mocked = {
            'uname': '#!/bin/sh\necho "Linux x86_64"\n',
            'sleep': '#!/bin/sh\nexit 0\n',
            'curl': '''#!/usr/bin/env python3
import os, sys
if os.environ['CASE'] == 'readiness': sys.exit(1)
print('{"status":"ok","services":{"api":"ok","database":"ok","databaseSchema":"ok"}}')
''',
            'pm2': '''#!/usr/bin/env python3
import json, os, pathlib, sys
root=pathlib.Path(os.environ['FIXTURE_ROOT']); state=root/'state'; log=root/'pm2.log'
with log.open('a') as f: f.write(' '.join(sys.argv[1:])+'\\n')
if sys.argv[1]=='jlist':
 cwd=state.read_text() if state.exists() else str(root/'shared')
 print(json.dumps([{'name':n,'pm2_env':{'status':'online','pm_cwd':cwd,'pm_exec_path':'/bin/bash','args':['-c','true'],'exec_interpreter':'none','env':{}}} for n in ['marketplace-web','marketplace-api']]))
elif sys.argv[1]=='startOrRestart':
 if 'previous.cjs' in sys.argv[2]: state.write_text(str(root/'shared'))
 elif os.environ['CASE']=='activation': sys.exit(1)
 else: state.write_text(os.environ['MARKETPLACE_RELEASE_DIR'])
''',
        }
        for name, content in mocked.items():
            target = commands / name
            target.write_text(content)
            target.chmod(0o700)
        script = SOURCE.replace('export PATH="/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"', f'export PATH="{commands}:$PATH"')
        script = script.replace('base=/var/www/marketplace-releases', f'base={root}/releases')
        script = script.replace('shared=/var/www/marketplace', f'shared={shared}')
        script = script.replace('current=/var/www/marketplace-current', f'current={current}')
        script = script.replace('source /etc/os-release', 'ID=ubuntu; VERSION_ID=24.04')
        script = script.replace('bun run scripts/db-backup.ts "$backup"', 'touch "$backup"')
        script = script.replace('bun run db:migrate:deploy', 'false' if case == 'migration' else 'true')
        receiver = root / 'receiver.sh'
        receiver.write_text(script)
        result = subprocess.run(['bash', str(receiver)], input=archive_path.read_bytes(), capture_output=True,
                                env={**os.environ, 'SSH_ORIGINAL_COMMAND': f'deploy {REVISION} {digest}',
                                     'FIXTURE_ROOT': str(root), 'CASE': case})
        activated = current.is_symlink() and current.resolve() == root / 'releases' / REVISION
        if case == 'success':
            assert result.returncode == 0 and activated, result.stderr.decode()
            release = current.resolve()
            assert (release / '.env').resolve() == shared / '.env'
            assert (release / 'public/uploads').resolve() == shared / 'public/uploads'
            assert (release / '.data').resolve() == shared / '.data'
        else:
            assert result.returncode != 0 and not activated, (case, result.stdout, result.stderr)
            if case in ['activation', 'readiness']:
                assert current.resolve() == shared
                assert 'previous.cjs' in (root / 'pm2.log').read_text()
                assert list((root / 'releases/backups').glob('*.dump'))
            if case in ['checksum', 'traversal', 'secret']:
                assert not (root / 'pm2.log').exists()
        print(f'{case} passed')


for scenario, unsafe in [('checksum', None), ('traversal', '../escape'), ('secret', 'app/.env.local'),
                         ('migration', None), ('activation', None), ('readiness', None), ('success', None)]:
    run_case(scenario, unsafe)
