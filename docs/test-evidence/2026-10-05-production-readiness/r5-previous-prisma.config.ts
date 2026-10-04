import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Archived Prisma source at a4dd98a; this config is only a disposable rehearsal.
const directory = path.join(process.env['TEMP'] ?? '', 'marketplace-readiness-previous-20261005', 'prisma')
export default defineConfig({
  schema: path.join(directory, 'schema.prisma'),
  migrations: { path: path.join(directory, 'migrations') },
  datasource: { url: process.env['DATABASE_URL'] },
})
