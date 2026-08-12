const databaseUrl = process.env['DATABASE_URL']?.trim()
if (!databaseUrl) throw new Error('DATABASE_URL is required for E2E tests')

const url = new URL(databaseUrl)
if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
  throw new Error('E2E DATABASE_URL must use postgres:// or postgresql://')
}

const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase()
if (!databaseName || !/(^|[_-])(test|e2e)([_-]|$)/.test(databaseName)) {
  throw new Error(`Refusing to seed E2E data into non-test database "${databaseName || '(missing)'}"`)
}

process.stdout.write(`E2E database safety check passed for ${databaseName}\n`)
