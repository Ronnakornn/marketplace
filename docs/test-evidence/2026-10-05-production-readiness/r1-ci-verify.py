import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import yaml

root = Path(__file__).resolve().parents[3]
workflow = yaml.safe_load((root / '.github/workflows/production-gates.yml').read_text(encoding='utf-8'))
jobs = workflow['jobs']
quality = jobs['quality']
assert 'REDIS_URL' not in quality['env']
assert quality['services']['postgres']['ports'] == ['55439:5432']
assert urlparse(quality['env']['COMMERCE_TEST_DATABASE_URL']).path == '/marketplace_test_completion'
assert quality['env']['CHECKOUT_V2_SETTLEMENT_ENABLED'] == 'true'
commands = '\n'.join(step.get('run', '') for step in quality['steps'])
for key in ['COMMERCE_TEST_DATABASE_URL', 'QUEUE_TEST_DATABASE_URL', 'TAX_TEST_DATABASE_URL', 'ROLLOUT_TEST_DATABASE_URL', 'AUDIT_TEST_DATABASE_URL']:
    name = urlparse(quality['env'][key]).path.removeprefix('/')
    assert f'createdb -U postgres {name}' in commands
    assert f'DATABASE_URL="${key}" bunx --bun prisma migrate deploy' in commands
assert 'scripts/assert-ci-integration.ts environment' in commands
assert 'bun run test --reporter=json --outputFile=artifacts/quality-tests.json' in commands
assert 'scripts/assert-ci-integration.ts report artifacts/quality-tests.json' in commands
runtime_env = dict(os.environ)
runtime_env.pop('REDIS_URL', None)
runtime_env.update(quality['env'])
preflight = subprocess.run(['bun', 'run', 'scripts/assert-ci-integration.ts', 'environment'], cwd=root, env=runtime_env, text=True, capture_output=True, timeout=15)
assert preflight.returncode == 0, preflight.stderr

pattern = 'UI, API and database preserve exact satang for|internal mock payment awards'
production = jobs['e2e']
mock = jobs['e2e-numeric-mock']
assert production['env']['NODE_ENV'] == 'production'
assert production['env']['PLAYWRIGHT_PRODUCTION'] == 'true'
assert production['env']['PAYMENT_PROVIDER'] == 'gateway'
assert production['env']['PAYMENT_MOCK_ENABLED'] == 'false'
assert production['env']['RATE_LIMIT_ENABLED'] == 'true'
assert production['env']['CHECKOUT_V2_SETTLEMENT_ENABLED'] == 'true'
production_run = next(step['run'] for step in production['steps'] if step.get('run', '').startswith('bun run test:e2e'))
assert production_run == f"bun run test:e2e --grep-invert '{pattern}'"
assert mock['env']['NODE_ENV'] == 'development'
assert mock['env']['PLAYWRIGHT_PRODUCTION'] == 'false'
assert mock['env']['PAYMENT_PROVIDER'] == 'mock'
assert mock['env']['PAYMENT_MOCK_ENABLED'] == 'true'
assert mock['env']['CHECKOUT_V2_SETTLEMENT_ENABLED'] == 'true'
mock_run = next(step['run'] for step in mock['steps'] if step.get('run', '').startswith('bun run test:e2e'))
assert f"--grep '{pattern}'" in mock_run
for profile in ['chromium', 'firefox', 'webkit', 'mobile-chromium', 'mobile-webkit']:
    assert f'--project={profile}' in mock_run
assert 'e2e/numeric-commerce.spec.ts e2e/numeric-admin-projections.spec.ts' in mock_run
assert urlparse(mock['env']['DATABASE_URL']).path != urlparse(production['env']['DATABASE_URL']).path
for job in [quality, production, mock]:
    assert any(step.get('uses') == 'actions/upload-artifact@v4' and step.get('if') == 'always()' for step in job['steps'])
    assert any(step.get('run') == 'bunx --bun prisma generate' for step in job['steps'])
assert next(i for i, step in enumerate(production['steps']) if step.get('run') == 'bunx --bun prisma generate') < next(i for i, step in enumerate(production['steps']) if step.get('run') == 'bun run build')

result = {
    'yamlSemantics': 'PASS',
    'runtimeEnvironmentPreflight': {'exit': preflight.returncode, 'stdout': preflight.stdout.strip()},
    'qualityDatabases': [urlparse(value).path for key, value in quality['env'].items() if key.endswith('DATABASE_URL')],
    'productionSafeguards': 'gateway, mock=false, rates=true, v2=true',
    'mockPaymentGate': 'development only; six cases on five explicit profiles',
    'githubActionsExecution': 'NOT_EXECUTED',
    'productionBrowserExecution': 'NOT_EXECUTED',
}

def discovered(name):
    report = json.loads(Path(__file__).with_name(name).read_text(encoding='utf-8'))
    assert report['errors'] == []
    rows = set()
    def visit(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                rows.add((spec['file'], spec['title'], test['projectName']))
        for child in suite.get('suites', []):
            visit(child)
    for suite in report['suites']:
        visit(suite)
    return rows

if Path(__file__).with_name('r1-ci-all-discovery.json').exists():
    all_tests = discovered('r1-ci-all-discovery.json')
    production_tests = discovered('r1-ci-production-discovery.json')
    mock_tests = discovered('r1-ci-mock-discovery.json')
    assert all_tests == production_tests | mock_tests
    assert all(row[2] == 'setup' for row in production_tests & mock_tests)
    assert not any(re.search(pattern, row[1]) for row in production_tests)
    assert all(re.search(pattern, row[1]) or row[2] == 'setup' for row in mock_tests)
    for profile in ['chromium', 'firefox', 'webkit', 'mobile-chromium', 'mobile-webkit']:
        assert sum(row[2] == profile for row in mock_tests) == 6
        assert any(row[0] == 'numeric-tax.spec.ts' and row[2] == profile for row in production_tests)
        assert any(row[0] == 'finance-lifecycle.spec.ts' and row[2] == profile for row in production_tests)
    assert any(row[0] == 'auth-lifecycle.spec.ts' for row in production_tests)
    assert any(row[0] == 'seller-routes.spec.ts' for row in production_tests)
    assert any(row[0] == 'catalog-checkout-guards.spec.ts' for row in production_tests)
    result['browserDiscovery'] = {'allConfigurations': len(all_tests), 'productionConfigurations': len(production_tests),
        'developmentMockConfigurations': len(mock_tests), 'sharedSetupConfigurations': len(production_tests & mock_tests),
        'omittedConfigurations': 0, 'execution': 'NOT_EXECUTED (--list only)'}
destination = Path(__file__).with_name('r1-ci-semantics.json')
destination.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
