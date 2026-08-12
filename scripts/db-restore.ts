import { access } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const backupArgument = process.argv[2]
const confirmed = process.argv.includes('--confirm-restore')
const databaseUrl = process.env['RESTORE_DATABASE_URL']?.trim()

if (!backupArgument) throw new Error('Backup path is required')
if (!confirmed) throw new Error('Pass --confirm-restore to acknowledge that the target database will be overwritten')
if (!databaseUrl) throw new Error('RESTORE_DATABASE_URL is required; DATABASE_URL is intentionally ignored')
const connection = parsePostgresUrl(databaseUrl)

const backupPath = path.resolve(backupArgument)
await access(backupPath)

const child = spawn('pg_restore', [
  '--clean',
  '--if-exists',
  '--no-owner',
  '--no-privileges',
  `--host=${connection.host}`,
  `--port=${connection.port}`,
  `--username=${connection.username}`,
  `--dbname=${connection.database}`,
  backupPath,
], { stdio: 'inherit', shell: false, env: connection.environment })

const code = await new Promise<number>((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (codeValue) => resolve(codeValue ?? 1))
})
if (code !== 0) throw new Error(`pg_restore failed with exit code ${code}`)

function parsePostgresUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('RESTORE_DATABASE_URL must use postgres:// or postgresql://')
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!url.hostname || !url.username || !database) throw new Error('RESTORE_DATABASE_URL is incomplete')
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
