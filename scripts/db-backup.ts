import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const databaseUrl = process.env['DATABASE_URL']?.trim()
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const connection = parsePostgresUrl(databaseUrl)

const requestedPath = process.argv[2]
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputPath = path.resolve(requestedPath || path.join('backups', `marketplace-${timestamp}.dump`))
await mkdir(path.dirname(outputPath), { recursive: true })

const code = await run('pg_dump', [
  '--format=custom',
  '--no-owner',
  '--no-privileges',
  `--file=${outputPath}`,
  `--host=${connection.host}`,
  `--port=${connection.port}`,
  `--username=${connection.username}`,
  connection.database,
], connection.environment)
if (code !== 0) throw new Error(`pg_dump failed with exit code ${code}`)
process.stdout.write(`${outputPath}\n`)

function run(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<number> {
  const child = spawn(command, args, { stdio: 'inherit', shell: false, env: environment })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (codeValue) => resolve(codeValue ?? 1))
  })
}

function parsePostgresUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://')
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!url.hostname || !url.username || !database) throw new Error('DATABASE_URL is incomplete')
  const sslMode = url.searchParams.get('sslmode')
  return {
    host: url.hostname,
    port: url.port || '5432',
    username: decodeURIComponent(url.username),
    database,
    environment: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
      ...(sslMode ? { PGSSLMODE: sslMode } : {}),
    },
  }
}
