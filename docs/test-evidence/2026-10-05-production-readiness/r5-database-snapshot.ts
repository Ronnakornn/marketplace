import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { z } from 'zod'

const TableSchema = z.object({ name: z.string(), columns: z.array(z.string()).min(1), rows: z.number().int().nonnegative(), sha256: z.string() })
const SnapshotSchema = z.object({ database: z.string(), tables: z.array(TableSchema), migrationCount: z.number().int() })
type Snapshot = z.infer<typeof SnapshotSchema>

const mode = process.argv[2]
const output = process.argv[3]
const baselineFile = process.argv[4]
if (!output || (mode !== 'snapshot' && mode !== 'compare')) throw new Error('Usage: snapshot|compare output.json [baseline.json]')
const connectionString = process.env['DATABASE_URL']
if (!connectionString) throw new Error('DATABASE_URL required')
const url = new URL(connectionString)
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname)
  || !/^\/marketplace_(test_|e2e_)[a-z0-9_]+$/.test(url.pathname) || url.port !== '55439') throw new Error('Only disposable local rehearsal databases accepted')
const baseline = mode === 'compare' && baselineFile ? SnapshotSchema.parse(JSON.parse(readFileSync(baselineFile, 'utf8'))) : null
if (mode === 'compare' && !baseline) throw new Error('Baseline required for comparison')
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`
const client = new Client({ connectionString })
await client.connect()
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const columns = await client.query<{ name: string; column: string }>(`SELECT table_name AS name,column_name AS column
    FROM information_schema.columns WHERE table_schema='public' AND table_name <> '_prisma_migrations'
    ORDER BY table_name,ordinal_position`)
  const definitions = new Map<string, string[]>()
  for (const row of columns.rows) definitions.set(row.name, [...(definitions.get(row.name) ?? []), row.column])
  const selected = baseline?.tables ?? [...definitions].map(([name, names]) => ({ name, columns: names }))
  const tables: Snapshot['tables'] = []
  for (const table of selected) {
    const result = await client.query<{ row: string }>(`SELECT row_to_json(x)::text AS row FROM
      (SELECT ${table.columns.map(quoteIdentifier).join(',')} FROM public.${quoteIdentifier(table.name)}) x`)
    const rows = result.rows.map(row => row.row).sort()
    tables.push({ name: table.name, columns: table.columns, rows: rows.length,
      sha256: createHash('sha256').update(rows.join('\n')).digest('hex') })
  }
  const migrations = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
  const snapshot: Snapshot = { database: url.pathname.slice(1), tables, migrationCount: Number(migrations.rows[0]?.count ?? 0) }
  const differences = baseline?.tables.filter(table => {
    const current = tables.find(candidate => candidate.name === table.name)
    return !current || current.rows !== table.rows || current.sha256 !== table.sha256
  }).map(table => table.name) ?? []
  const result = { ...snapshot, checkedAt: new Date().toISOString(), applicationRows: tables.reduce((total, table) => total + table.rows, 0),
    comparison: baseline ? { baselineDatabase: baseline.database, originalColumnsOnly: true, differences, passed: differences.length === 0 } : null }
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
  process.stdout.write(JSON.stringify({ database: result.database, tables: tables.length, rows: result.applicationRows,
    migrations: result.migrationCount, differences, passed: !baseline || differences.length === 0 }) + '\n')
  await client.query('ROLLBACK')
  if (differences.length) process.exitCode = 1
} finally { await client.end() }
